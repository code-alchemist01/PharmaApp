/**
 * PharmaApp - İlaç Tanıma Uygulaması
 */

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { NavigationContainerRef } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import LocalDatabase, { History } from './src/services/database/LocalDatabase';
import MLService from './src/services/ml/MLService';
import NotificationService from './src/services/notification/NotificationService';
import notifee, { Event, EventType } from '@notifee/react-native';
import { generateUUID } from './src/utils/helpers';
import { getTurkeyTime, createTurkeyDateTime, getTurkeyTodayStart, getTurkeyTodayEnd } from './src/utils/timezoneHelpers';

function App(): React.JSX.Element {
  // Sabit light tema kullan (sistem temasını takip etme)
  const isDarkMode = false;
  const [dbInitialized, setDbInitialized] = useState(false);
  const [mlInitialized, setMlInitialized] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const missedAlarmsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Starting initialization...');
        
        console.log('[App] Initializing database...');
        await LocalDatabase.initialize();
        console.log('[App] Database initialized successfully');
        
        // Yanlış oluşturulmuş "missed" kayıtlarını temizle
        try {
          const deletedCount = await LocalDatabase.cleanupInvalidMissedRecords();
          if (deletedCount > 0) {
            console.log(`[App] Cleaned up ${deletedCount} invalid missed records`);
          }
        } catch (error) {
          console.error('[App] Error cleaning up invalid missed records:', error);
        }
        
        setDbInitialized(true);

        // ML modellerini yükle (async, arka planda)
        MLService.loadModels()
          .then(() => {
            setMlInitialized(true);
            console.log('[App] ML models loaded');
          })
          .catch((error) => {
            console.error('[App] ML models loading failed:', error);
            setMlInitialized(true); // Hata olsa bile devam et
          });

        // Bildirim servisini başlat
        NotificationService.initialize()
          .then(() => {
            console.log('[App] Notification service initialized');
            // Tüm alarmları zamanla
            NotificationService.scheduleAllAlarms();
          })
          .catch((error) => {
            console.error('[App] Notification service initialization failed:', error);
          });

        console.log('[App] Initialization completed');
      } catch (error) {
        console.error('[App] Database initialization failed:', error);
        setDbInitialized(true); // Hata olsa bile devam et
      }
    };

    initializeApp().then(() => {
      // Database initialize olduktan sonra alarm kontrolünü başlat
      console.log('[App] Database initialized, starting missed alarms check');
      
      // Alarm kontrolü - 10 dakika geçince otomatik "kaçırıldı" işaretle
      // SADECE tekrarlı alarmlar için (daily, custom, interval)
      const checkMissedAlarms = async () => {
        try {
          const activeAlarms = await LocalDatabase.getActiveAlarms();
          const now = getTurkeyTime(); // Türkiye saat diliminde şu anki zaman
          const nowTimestamp = now.getTime();
          const dayOfWeek = now.getDay(); // 0 = Pazar, 6 = Cumartesi

          for (const alarm of activeAlarms) {
            // SADECE tekrarlı alarmlar için kontrol yap
            // Tekrarlı olmayan alarmlar için otomatik "missed" oluşturma
            if (!alarm.repeat_type || alarm.repeat_type === 'none') {
              continue; // Tekrarlı değilse atla
            }

            // Custom repeat için bugünün alarm günü olup olmadığını kontrol et
            if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
              const repeatDays = JSON.parse(alarm.repeat_days);
              if (!repeatDays.includes(dayOfWeek)) {
                continue; // Bugün alarm günü değilse atla
              }
            }

            // Bugün için zaten kayıt var mı kontrol et
            const hasHistory = await LocalDatabase.hasHistoryForAlarmToday(alarm.id);
            if (hasHistory) continue;

            // Bugünkü alarm zamanını hesapla (Türkiye saat diliminde)
            const [hours, minutes] = alarm.time.split(':').map(Number);
            const todayAlarmTime = createTurkeyDateTime(hours, minutes);
            const todayAlarmTimestamp = todayAlarmTime.getTime();

            // 10 dakika = 10 * 60 * 1000 ms
            const tenMinutes = 10 * 60 * 1000;
            const missedTime = todayAlarmTimestamp + tenMinutes;

            // Bugünkü alarm için kontrol: Eğer alarm zamanı geçmiş ve 10 dakika da geçmişse
            // VE bugünün içindeyse (24 saat içinde) VE henüz kayıt yoksa
            if (nowTimestamp >= missedTime && nowTimestamp < todayAlarmTimestamp + 24 * 60 * 60 * 1000) {
              // Otomatik olarak "kaçırıldı" kaydı oluştur
              const drug = await LocalDatabase.getDrugById(alarm.drug_id);
              if (drug) {
                const historyEntry: History = {
                  id: generateUUID(),
                  drug_id: alarm.drug_id,
                  alarm_id: alarm.id,
                  taken_at: todayAlarmTimestamp, // Bugünkü alarm zamanı
                  photo_base64: null,
                  verified: 0,
                  status: 'missed',
                  created_at: Date.now(),
                };

                await LocalDatabase.addHistory(historyEntry);
                console.log(`[App] Auto-marked as missed: ${drug.name} at ${alarm.time} (today's alarm)`);
              }
            }
          }
        } catch (error) {
          console.error('[App] Error checking missed alarms:', error);
        }
      };

      // Her dakika kontrol et
      missedAlarmsIntervalRef.current = setInterval(checkMissedAlarms, 60 * 1000);
      // İlk kontrolü hemen yap
      checkMissedAlarms();
    });

    // Bildirim tıklama handler'ı - SADECE notification tıklandığında çalışır
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }: Event) => {
      console.log('=== Notification event received ===', { type, detail });
      
      // SADECE PRESS event'inde çalış (notification tıklandığında)
      if (type === EventType.PRESS && detail.notification) {
        const data = detail.notification.data;
        console.log('=== Notification PRESSED, data ===', data);
        
        if (data) {
          // Data string olabilir, parse et
          let parsedData: any = data;
          if (typeof data === 'string') {
            try {
              parsedData = JSON.parse(data);
            } catch (e) {
              parsedData = data;
            }
          }
          
          console.log('=== Parsed data ===', parsedData);
          
          // SADECE drug_reminder tipindeki notification'lar için navigation yap
          if (parsedData && parsedData.type === 'drug_reminder' && parsedData.alarmId && parsedData.drugId) {
            console.log('=== Drug reminder notification clicked ===', {
              alarmId: parsedData.alarmId,
              drugId: parsedData.drugId,
            });
            
            // Bugün için zaten kayıt var mı kontrol et
            const hasHistory = await LocalDatabase.hasHistoryForAlarmToday(parsedData.alarmId);
            if (hasHistory) {
              console.log('=== Already taken/missed today, not opening verification screen ===');
              // Kullanıcıya bilgi ver
              Alert.alert(
                'Bilgi',
                'Bu ilaç bugün zaten alındı veya kaçırıldı.',
                [{ text: 'Tamam' }]
              );
              return; // Bugün için zaten kayıt varsa açma
            }
            
            // Navigation ref'in hazır olmasını bekle
            setTimeout(() => {
              if (navigationRef.current) {
                try {
                  // Önce mevcut ekranı kontrol et - eğer zaten DrugVerification ekranındaysa tekrar açma
                  const state = navigationRef.current.getRootState();
                  if (state) {
                    const currentRoute = state.routes[state.index || 0];
                    if (currentRoute?.name === 'Drugs') {
                      const drugsState = currentRoute.state;
                      if (drugsState) {
                        const drugsCurrentRoute = drugsState.routes[drugsState.index || 0];
                        if (drugsCurrentRoute?.name === 'DrugVerification') {
                          console.log('=== Already on DrugVerification screen, not navigating again ===');
                          return;
                        }
                      }
                    }
                  }
                  
                  // SADECE DrugVerification screen'ine navigate et, Drugs stack'inin kendisine değil
                  navigationRef.current.navigate('Drugs', {
                    screen: 'DrugVerification',
                    params: {
                      alarmId: parsedData.alarmId,
                      drugId: parsedData.drugId,
                    },
                  });
                  console.log('=== Navigation to DrugVerification successful ===');
                } catch (error) {
                  console.error('=== Navigation error ===', error);
                }
              } else {
                console.error('=== Navigation ref is null ===');
              }
            }, 500);
          } else {
            console.log('=== Not a drug reminder notification, ignoring ===');
          }
        }
      } else {
        console.log('=== Not a PRESS event, ignoring ===', { type });
      }
    });

    // Background event handler
    // Not: Background'da navigation yapılamaz, sadece log
    notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
      console.log('=== Background notification event ===', { type, detail });
      
      if (type === EventType.PRESS && detail.notification) {
        const data = detail.notification.data;
        console.log('=== Background notification pressed ===', data);
        // Background'da navigation yapılamaz, kullanıcı uygulamayı açtığında
        // foreground event handler çalışacak
      }
    });

        return () => {
          unsubscribe();
          if (missedAlarmsIntervalRef.current) {
            clearInterval(missedAlarmsIntervalRef.current);
          }
        };
  }, []);

  if (!dbInitialized) {
    console.log('[App] Database not initialized, showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  console.log('[App] Rendering main app');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PaperProvider theme={MD3LightTheme}>
          <SafeAreaProvider>
            <StatusBar barStyle="dark-content" />
            <AppNavigator ref={navigationRef} />
          </SafeAreaProvider>
        </PaperProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default App;
