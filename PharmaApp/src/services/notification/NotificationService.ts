/**
 * NotificationService - Bildirim servisi (Firebase Cloud Messaging + Notifee)
 */

import messaging, { FirebaseMessagingTypes, AuthorizationStatus } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import notifee, { AndroidImportance, TriggerType, TimestampTrigger, RepeatFrequency } from '@notifee/react-native';
import LocalDatabase, { Alarm } from '../database/LocalDatabase';
import { Platform, Alert } from 'react-native';

class NotificationService {
  private initialized = false;

  /**
   * Bildirim servisini başlat
   */
  async initialize(): Promise<void> {
    console.log('=== NotificationService.initialize() called ===');
    
    if (this.initialized) {
      console.log('Already initialized, skipping');
      return;
    }

    try {
      // Notifee kanalı oluştur (Android)
      if (Platform.OS === 'android') {
        const channelId = await notifee.createChannel({
          id: 'pharma-alarms',
          name: 'İlaç Alarmları',
          description: 'İlaç alma hatırlatmaları için bildirimler',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });
        console.log(`=== Notification channel created: ${channelId} ===`);
      }

      // Firebase Cloud Messaging izinleri (v22 modular API)
      const messagingInstance = messaging(getApp());
      const authStatus = await messagingInstance.requestPermission();
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('=== Push notification permission granted ===');
      } else {
        console.warn('=== Push notification permission denied ===');
      }

      // Background message handler (v22 modular API)
      messagingInstance.setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Message handled in the background!', remoteMessage);
      });

      // Foreground message handler (v22 modular API)
      messagingInstance.onMessage(async (remoteMessage) => {
        console.log('Message received in foreground:', remoteMessage);
        // Foreground'da bildirim göster
        if (remoteMessage.notification) {
          await notifee.displayNotification({
            title: remoteMessage.notification.title || 'Bildirim',
            body: remoteMessage.notification.body || '',
            android: {
              channelId: 'pharma-alarms',
              importance: AndroidImportance.HIGH,
              sound: 'default',
            },
          });
        }
      });

      this.initialized = true;
      console.log('=== NotificationService initialized successfully ===');
    } catch (error) {
      console.error('=== Notification service initialization error ===', error);
      this.initialized = true; // Hata olsa bile devam et
    }
  }

  /**
   * Test bildirimi gönder (hemen)
   */
  async sendTestNotification(): Promise<void> {
    try {
      console.log('=== Attempting to send test notification ===');
      
      if (Platform.OS !== 'android') {
        Alert.alert('Bildirim', 'Bildirimler sadece Android\'de çalışır');
        return;
      }

      // Önce kanalın var olduğundan emin ol
      if (!this.initialized) {
        await this.initialize();
      }

      // İzin kontrolünü atla - direkt bildirim göndermeyi dene
      // Notifee bazen yanlış rapor edebilir, ama bildirim çalışabilir
      console.log('=== Bypassing permission check, trying to send notification directly ===');
      
      // Kanalı tekrar oluştur (emin olmak için)
      try {
        const channelId = await notifee.createChannel({
          id: 'pharma-alarms',
          name: 'İlaç Alarmları',
          description: 'İlaç alma hatırlatmaları için bildirimler',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
          vibrationPattern: [300, 500],
        });
        console.log('Channel created/verified:', channelId);
      } catch (channelError) {
        console.warn('Channel creation error (might already exist):', channelError);
      }

      // Bildirim gönder
      console.log('=== Displaying notification ===');
      try {
        const notificationId = await notifee.displayNotification({
          title: 'Test Bildirimi',
          body: 'Bildirim sistemi çalışıyor! 🎉',
          android: {
            channelId: 'pharma-alarms',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [300, 500],
            pressAction: {
              id: 'default',
            },
            showTimestamp: true,
          },
        });

        console.log('=== Test notification sent successfully ===');
        console.log('Notification ID:', notificationId);
        Alert.alert('Başarılı', `Bildirim gönderildi! (ID: ${notificationId})\n\nÜstte bildirim görmelisiniz.`);
      } catch (notificationError: any) {
        console.error('=== Notification display error ===', notificationError);
        console.error('Error message:', notificationError?.message);
        console.error('Error code:', notificationError?.code);
        console.error('Error name:', notificationError?.name);
        console.error('Full error:', JSON.stringify(notificationError, Object.getOwnPropertyNames(notificationError), 2));
        
        // İzin hatası mı kontrol et
        const errorMessage = String(notificationError?.message || '');
        const errorString = JSON.stringify(notificationError);
        
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('not allowed') || 
            errorString.includes('permission') || errorString.includes('denied')) {
          Alert.alert(
            'İzin Hatası',
            'Bildirim izni hatası!\n\nADB komutu çalıştırın:\n\nadb shell pm grant com.pharmaapp android.permission.POST_NOTIFICATIONS\n\nSonra uygulamayı reload edin (r tuşu) ve tekrar deneyin.'
          );
        } else {
          Alert.alert(
            'Bildirim Hatası',
            `Bildirim gönderilemedi!\n\nHata: ${errorMessage}\n\nKonsolda detaylı hata var.`
          );
        }
      }
    } catch (error: any) {
      console.error('=== Failed to send test notification ===', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Hata', `Bildirim gönderilemedi: ${error?.message || 'Bilinmeyen hata'}\n\nDetay: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Alarm için bildirim zamanla
   */
  async scheduleAlarmNotification(alarm: Alarm, drugName: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (alarm.is_active !== 1) {
        console.log('Alarm is not active, skipping notification');
        return;
      }

      const [hours, minutes] = alarm.time.split(':').map(Number);
      const now = new Date();
      const alarmTime = new Date();
      alarmTime.setHours(hours, minutes, 0, 0);
      alarmTime.setMilliseconds(0);

      // Eğer bugünün saati geçtiyse, yarın için zamanla
      if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }

      const minutesUntilAlarm = Math.round((alarmTime.getTime() - now.getTime()) / 1000 / 60);
      
      console.log(`=== Scheduling alarm for ${drugName} ===`);
      console.log(`Current time: ${now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false })}`);
      console.log(`Alarm time: ${alarmTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false })}`);
      console.log(`Alarm will fire in ${minutesUntilAlarm} minutes`);
      console.log(`Repeat type: ${alarm.repeat_type}`);

      // Notification ID - unique olmalı
      const notificationId = `alarm_${alarm.id}`;

      try {
        // Repeat interval hesapla
        let repeatFrequency: RepeatFrequency | undefined = undefined;
        if (alarm.repeat_type === 'daily') {
          repeatFrequency = RepeatFrequency.DAILY;
        }
        // 'interval' ve 'custom' için repeat frequency yok, tek seferlik bildirim
        // Interval için her X saatte bir ayrı bildirim zamanlamak gerekir (şimdilik tek seferlik)

        // Ana alarm bildirimi
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: alarmTime.getTime(),
          repeatFrequency: repeatFrequency,
          alarmManager: {
            allowWhileIdle: true, // Android 12+ için gerekli
          },
        };

        console.log(`Creating trigger notification with timestamp: ${alarmTime.getTime()}`);
        console.log(`Repeat frequency: ${repeatFrequency || 'none'}`);

        await notifee.createTriggerNotification(
          {
            id: notificationId,
            title: 'İlaç Alma Zamanı',
            body: `${drugName} ilacını almanız gerekiyor`,
            android: {
              channelId: 'pharma-alarms',
              importance: AndroidImportance.HIGH,
              sound: 'default',
              vibrationPattern: [300, 500],
              pressAction: {
                id: 'default',
              },
              data: {
                alarmId: String(alarm.id),
                drugId: String(alarm.drug_id),
                type: 'drug_reminder',
              },
            },
          },
          trigger
        );

        console.log(`=== Notification scheduled successfully with ID: ${notificationId} ===`);
        console.log(`Will fire at: ${alarmTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false })}`);

        // Hatırlatma bildirimi (15 dakika önce) - sadece ilk sefer için
        if (alarm.reminder_before > 0 && minutesUntilAlarm > alarm.reminder_before) {
          const reminderTime = new Date(alarmTime);
          reminderTime.setMinutes(reminderTime.getMinutes() - alarm.reminder_before);

          if (reminderTime > now) {
            const reminderTrigger: TimestampTrigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: reminderTime.getTime(),
              alarmManager: {
                allowWhileIdle: true,
              },
            };

            await notifee.createTriggerNotification(
              {
                id: `${notificationId}_reminder`,
                title: 'İlaç Hatırlatması',
                body: `${drugName} ilacını ${alarm.reminder_before} dakika sonra almanız gerekiyor`,
                android: {
                  channelId: 'pharma-alarms',
                  importance: AndroidImportance.HIGH,
                  sound: 'default',
                  data: {
                    alarmId: alarm.id,
                    drugId: alarm.drug_id,
                    type: 'drug_reminder_before',
                  },
                },
              },
              reminderTrigger
            );
            console.log(`Reminder notification scheduled for ${reminderTime.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false })}`);
          }
        }
      } catch (error: any) {
        console.error('=== Failed to schedule notification ===', error);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        Alert.alert('Alarm Hatası', `Alarm zamanlanamadı: ${error?.message || 'Bilinmeyen hata'}`);
      }
    } catch (error: any) {
      console.error('=== Failed to schedule alarm notification ===', error);
      console.error('Error message:', error?.message);
      Alert.alert('Alarm Hatası', `Alarm zamanlanamadı: ${error?.message || 'Bilinmeyen hata'}`);
    }
  }

  /**
   * Alarm bildirimini iptal et
   */
  async cancelAlarmNotification(alarmId: string): Promise<void> {
    try {
      const notificationId = `alarm_${alarmId}`;
      await notifee.cancelNotification(notificationId);
      await notifee.cancelNotification(`${notificationId}_reminder`);
      console.log(`Cancelled notifications for alarm ${alarmId} (IDs: ${notificationId}, ${notificationId}_reminder)`);
    } catch (error) {
      console.warn('Failed to cancel alarm notification:', error);
    }
  }

  /**
   * Tüm alarm bildirimlerini zamanla
   */
  async scheduleAllAlarms(): Promise<void> {
    try {
      const alarms = await LocalDatabase.getActiveAlarms();
      const drugs = await LocalDatabase.getAllDrugs();

      console.log(`Scheduling ${alarms.length} alarms`);

      for (const alarm of alarms) {
        const drug = drugs.find((d) => d.id === alarm.drug_id);
        if (drug) {
          await this.scheduleAlarmNotification(alarm, drug.name);
        }
      }
    } catch (error) {
      console.error('Error scheduling alarms:', error);
    }
  }

  /**
   * Push notification token al
   */
  async getFCMToken(): Promise<string | null> {
    try {
      const messagingInstance = messaging(getApp());
      const token = await messagingInstance.getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Tüm bildirimleri temizle
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
      console.log('All notifications cancelled');
    } catch (error) {
      console.warn('Failed to cancel all notifications:', error);
    }
  }
}

export default new NotificationService();
