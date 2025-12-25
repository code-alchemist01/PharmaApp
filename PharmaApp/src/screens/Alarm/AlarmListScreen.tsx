/**
 * AlarmListScreen - Alarm listesi ekranı
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, ScrollView, RefreshControl } from 'react-native';
import { Text, FAB, Card, Button, Chip, IconButton, Portal, Dialog, Divider, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LocalDatabase, { Alarm, Drug, History } from '../../services/database/LocalDatabase';
import FirestoreService from '../../services/database/FirestoreService';
import NotificationService from '../../services/notification/NotificationService';
import { formatTime, formatDateTime } from '../../utils/helpers';
import { getTurkeyTime, createTurkeyDateTime, getTurkeyTodayStart, getTurkeyTodayEnd } from '../../utils/timezoneHelpers';
import SwipeableRow from '../../components/SwipeableRow';

type AlarmListScreenNavigationProp = StackNavigationProp<any, 'AlarmList'>;

interface AlarmWithDrug extends Alarm {
  drug?: Drug;
}

const AlarmListScreen: React.FC = () => {
  const navigation = useNavigation<AlarmListScreenNavigationProp>();
  const [alarms, setAlarms] = useState<AlarmWithDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alarmTimeStatus, setAlarmTimeStatus] = useState<Record<string, boolean>>({});
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedAlarmHistory, setSelectedAlarmHistory] = useState<History[]>([]);
  const [selectedAlarmName, setSelectedAlarmName] = useState<string>('');

  const loadAlarms = useCallback(async (isRefresh = false, showLoading = true) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (showLoading) {
      setLoading(true);
    }
    try {
      const allAlarms = await LocalDatabase.getAllAlarms();
      const allDrugs = await LocalDatabase.getAllDrugs();

      const alarmsWithDrugs: AlarmWithDrug[] = allAlarms.map((alarm) => ({
        ...alarm,
        drug: allDrugs.find((d) => d.id === alarm.drug_id),
      }));

      setAlarms(alarmsWithDrugs);

      // Her alarm için zaman kontrolü yap
      const statusMap: Record<string, boolean> = {};
      
      for (const alarm of alarmsWithDrugs) {
        // Her kontrol için şu anki zamanı al (Türkiye saat diliminde)
        const now = getTurkeyTime();
        now.setSeconds(0, 0);
        now.setMilliseconds(0);
        
        // Alarm zamanı kontrolü
        const [hours, minutes] = alarm.time.split(':').map(Number);
        const reminderBefore = alarm.reminder_before || 15;
        
        // Bugünkü alarm zamanını bul - Türkiye saat diliminde
        const todayAlarmTime = createTurkeyDateTime(hours, minutes);
        
        // Bugünkü alarm için buton zamanlarını hesapla
        const todayButtonStartTime = new Date(todayAlarmTime);
        todayButtonStartTime.setMinutes(todayButtonStartTime.getMinutes() - reminderBefore);
        const todayButtonEndTime = new Date(todayAlarmTime);
        todayButtonEndTime.setMinutes(todayButtonEndTime.getMinutes() + 10); // 10 dakika sonra kapanacak
        
        // Bugünkü alarm için kayıt kontrolü
        const todayStart = getTurkeyTodayStart();
        const todayEnd = getTurkeyTodayEnd();
        const hasHistoryToday = await LocalDatabase.hasHistoryForAlarmOnDate(
          alarm.id,
          todayStart.getTime(),
          todayEnd.getTime()
        );
        
        // Bugünkü alarm için buton görünür mü?
        const nowTime = now.getTime();
        const todayStartTime = todayButtonStartTime.getTime();
        const todayEndTime = todayButtonEndTime.getTime();
        const isInTodayWindow = nowTime >= todayStartTime && nowTime <= todayEndTime;
        const isTodayTime = !hasHistoryToday && isInTodayWindow;
        
        // Eğer bugünkü alarm için buton görünüyorsa, onu kullan
        if (isTodayTime) {
          statusMap[alarm.id] = true;
          console.log(`[AlarmList] Alarm ${alarm.id} (${alarm.time}): Bugünkü alarm için buton görünür`);
          continue;
        }
        
        // Bugünkü alarm için buton görünmüyorsa, yarınki alarmı kontrol et (sadece tekrarlı alarmlar için)
        if (!alarm.repeat_type || alarm.repeat_type === 'none') {
          // Tekrarlı değil → buton görünmez
          statusMap[alarm.id] = false;
          continue;
        }
        
        // Yarınki alarm zamanını hesapla
        let nextAlarmTime = new Date(todayAlarmTime);
        if (alarm.repeat_type === 'daily') {
          // Günlük tekrar: yarın
          nextAlarmTime.setDate(nextAlarmTime.getDate() + 1);
        } else if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
          // Özel günler: bir sonraki uygun günü bul
          const repeatDays = JSON.parse(alarm.repeat_days);
          const today = now.getDay(); // 0 = Pazar, 6 = Cumartesi
          let daysToAdd = 1;
          let found = false;
          
          // Önümüzdeki 7 gün içinde uygun gün ara
          for (let i = 0; i < 7; i++) {
            const checkDay = (today + daysToAdd) % 7;
            if (repeatDays.includes(checkDay)) {
              found = true;
              break;
            }
            daysToAdd++;
          }
          
          if (found) {
            nextAlarmTime.setDate(nextAlarmTime.getDate() + daysToAdd);
          } else {
            // Uygun gün bulunamadı, buton görünmez
            statusMap[alarm.id] = false;
            continue;
          }
        }
        
        // Yarınki alarm için buton zamanları
        const buttonStartTime = new Date(nextAlarmTime);
        buttonStartTime.setMinutes(buttonStartTime.getMinutes() - reminderBefore);
        const buttonEndTime = new Date(nextAlarmTime);
        buttonEndTime.setMinutes(buttonEndTime.getMinutes() + 10); // 10 dakika sonra kapanacak
        
        // Yarınki alarm için kayıt kontrolü
        const nextAlarmDate = new Date(nextAlarmTime);
        nextAlarmDate.setHours(0, 0, 0, 0);
        nextAlarmDate.setMilliseconds(0);
        const nextAlarmDateStart = nextAlarmDate.getTime();
        const nextAlarmDateEnd = nextAlarmDateStart + 24 * 60 * 60 * 1000 - 1;
        const hasHistoryNext = await LocalDatabase.hasHistoryForAlarmOnDate(
          alarm.id,
          nextAlarmDateStart,
          nextAlarmDateEnd
        );
        
        // Yarınki alarm için buton görünür mü?
        const startTime = buttonStartTime.getTime();
        const endTime = buttonEndTime.getTime();
        const isInNextWindow = nowTime >= startTime && nowTime <= endTime;
        const isNextTime = !hasHistoryNext && isInNextWindow;
        
        statusMap[alarm.id] = isNextTime;
        
        // Debug log
        const formatDateTime = (date: Date) => {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const hour = date.getHours().toString().padStart(2, '0');
          const minute = date.getMinutes().toString().padStart(2, '0');
          return `${day}.${month} ${hour}:${minute}`;
        };
        
        console.log(`[AlarmList] Alarm ${alarm.id} (${alarm.time}):`);
        console.log(`  - Şu an: ${formatDateTime(now)} (timestamp: ${nowTime})`);
        console.log(`  - Bugünkü alarm: ${formatDateTime(todayAlarmTime)}`);
        console.log(`  - Bugünkü buton açılış: ${formatDateTime(todayButtonStartTime)} (${reminderBefore} dk önce)`);
        console.log(`  - Bugünkü buton kapanış: ${formatDateTime(todayButtonEndTime)} (10 dk sonra)`);
        console.log(`  - Bugünkü kayıt var mı: ${hasHistoryToday ? 'EVET' : 'HAYIR'}`);
        console.log(`  - Bugünkü buton görünür: ${isTodayTime ? 'EVET ✅' : 'HAYIR ❌'}`);
        if (!isTodayTime && (alarm.repeat_type === 'daily' || alarm.repeat_type === 'custom')) {
          console.log(`  - Yarınki alarm: ${formatDateTime(nextAlarmTime)}`);
          console.log(`  - Yarınki buton açılış: ${formatDateTime(buttonStartTime)}`);
          console.log(`  - Yarınki buton kapanış: ${formatDateTime(buttonEndTime)}`);
          console.log(`  - Yarınki kayıt var mı: ${hasHistoryNext ? 'EVET' : 'HAYIR'}`);
          console.log(`  - Yarınki buton görünür: ${isNextTime ? 'EVET ✅' : 'HAYIR ❌'}`);
        }
      }
      console.log('[AlarmList] Alarm time status updated:', statusMap);
      setAlarmTimeStatus(statusMap);
    } catch (error) {
      console.error('Error loading alarms:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    loadAlarms(true);
  }, [loadAlarms]);

  useFocusEffect(
    useCallback(() => {
      // İlk yüklemede loading göster
      loadAlarms(false, true);
      // Her 5 saniyede bir kontrol et (buton görünürlüğü için - loading gösterme)
      const interval = setInterval(() => {
        loadAlarms(false, false); // Loading gösterme, sadece güncelle
      }, 5000); // 5 saniye
      return () => clearInterval(interval);
    }, [loadAlarms])
  );

  const handleAddAlarm = () => {
    navigation.navigate('AlarmSetting' as never);
  };

  const handleEditAlarm = (alarm: Alarm) => {
    navigation.navigate('AlarmSetting' as never, { alarmId: alarm.id } as never);
  };

  const handleDeleteAlarm = async (alarmId: string) => {
    Alert.alert(
      'Alarmı Sil',
      'Bu alarmı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await LocalDatabase.deleteAlarm(alarmId);
              await LocalDatabase.updateSyncStatus('alarms', alarmId, false);
              
              try {
                await FirestoreService.deleteAlarm(alarmId);
                await LocalDatabase.updateSyncStatus('alarms', alarmId, true);
              } catch (error) {
                console.error('Firestore delete error:', error);
              }

              loadAlarms();
            } catch (error) {
              Alert.alert('Hata', 'Alarm silinemedi');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (alarm: Alarm) => {
    try {
      await LocalDatabase.updateAlarm({
        id: alarm.id,
        is_active: alarm.is_active === 1 ? 0 : 1,
      });
      await LocalDatabase.updateSyncStatus('alarms', alarm.id, false);
      
      try {
        await FirestoreService.updateAlarm({
          id: alarm.id,
          is_active: alarm.is_active === 1 ? 0 : 1,
        });
        await LocalDatabase.updateSyncStatus('alarms', alarm.id, true);
      } catch (error) {
        console.error('Firestore update error:', error);
      }

      loadAlarms();
    } catch (error) {
      Alert.alert('Hata', 'Alarm güncellenemedi');
    }
  };

  const getRepeatText = (alarm: Alarm): string => {
    if (alarm.repeat_type === 'daily') {
      return 'Günlük';
    } else if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
      const days = JSON.parse(alarm.repeat_days);
      const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      return days.map((d: number) => dayNames[d]).join(', ');
    } else if (alarm.repeat_type === 'interval' && alarm.interval_hours) {
      return `Her ${alarm.interval_hours} saatte bir`;
    }
    return 'Tek seferlik';
  };

  const handleTakeDrug = (alarm: AlarmWithDrug) => {
    if (!alarm.drug) {
      Alert.alert('Hata', 'İlaç bilgisi bulunamadı');
      return;
    }
    
    navigation.navigate('Drugs' as never, {
      screen: 'DrugVerification',
      params: {
        alarmId: alarm.id,
        drugId: alarm.drug_id,
        drugName: alarm.drug.name,
      },
    } as never);
  };

  const handleShowHistory = async (alarm: AlarmWithDrug) => {
    try {
      const allHistory = await LocalDatabase.getAllHistory();
      const alarmHistory = allHistory
        .filter((h) => h.alarm_id === alarm.id)
        .sort((a, b) => b.taken_at - a.taken_at); // En yeni önce
      
      setSelectedAlarmHistory(alarmHistory);
      setSelectedAlarmName(alarm.drug?.name || 'Bilinmeyen İlaç');
      setShowHistoryDialog(true);
    } catch (error) {
      Alert.alert('Hata', 'Geçmiş kayıtları yüklenemedi');
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'taken':
        return 'Alındı';
      case 'missed':
        return 'Kaçırıldı';
      case 'pending':
        return 'Beklemede';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'taken':
        return '#4CAF50';
      case 'missed':
        return '#f44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  const renderAlarm = ({ item }: { item: AlarmWithDrug }) => (
    <SwipeableRow
      onEdit={() => handleEditAlarm(item)}
      onDelete={() => handleDeleteAlarm(item.id)}>
      <Card style={styles.alarmCard}>
      <Card.Content>
        <View style={styles.alarmHeader}>
          <View style={styles.alarmInfo}>
            <Text variant="titleLarge" style={styles.alarmTime}>
              {item.time}
            </Text>
            <Text variant="titleMedium" style={styles.drugName}>
              {item.drug?.name || 'Bilinmeyen ilaç'}
            </Text>
            <Text variant="bodySmall" style={styles.repeatText}>
              {getRepeatText(item)}
            </Text>
            {item.reminder_before > 0 && (
              <Text variant="bodySmall" style={styles.reminderText}>
                {item.reminder_before} dakika önce hatırlat
              </Text>
            )}
          </View>
          <View style={styles.alarmActions}>
            <Chip
              icon={item.is_active === 1 ? 'check-circle' : 'cancel'}
              style={[
                styles.statusChip,
                item.is_active === 1 ? styles.activeChip : styles.inactiveChip,
              ]}>
              {item.is_active === 1 ? 'Aktif' : 'Pasif'}
            </Chip>
          </View>
        </View>
      </Card.Content>
      <Card.Actions style={styles.cardActions}>
        {alarmTimeStatus[item.id] === true && item.is_active === 1 && (
          <Button
            mode="contained"
            onPress={() => handleTakeDrug(item)}
            icon="pill"
            buttonColor="#4CAF50"
            style={styles.takeDrugButton}
            compact>
            İlacı Al
          </Button>
        )}
        <Button
          onPress={() => handleToggleActive(item)}
          icon={item.is_active === 1 ? 'pause' : 'play'}
          compact>
          {item.is_active === 1 ? 'Duraklat' : 'Aktif Et'}
        </Button>
        <Button onPress={() => handleEditAlarm(item)} icon="pencil" compact>
          Düzenle
        </Button>
        <Button onPress={() => handleShowHistory(item)} icon="history" compact>
          Geçmiş
        </Button>
        <IconButton
          icon="delete"
          iconColor="#d32f2f"
          size={20}
          onPress={() => handleDeleteAlarm(item.id)}
        />
      </Card.Actions>
    </Card>
    </SwipeableRow>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Alarmlar yükleniyor...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {alarms.length === 0 ? (
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Alarmlarım
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Henüz alarm eklenmedi
          </Text>
          <Button
            mode="contained"
            onPress={handleAddAlarm}
            style={styles.button}>
            Alarm Ekle
          </Button>
        </View>
      ) : (
        <FlatList
          data={alarms}
          renderItem={renderAlarm}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200ee']} />
          }
          ListHeaderComponent={
            <Text variant="headlineMedium" style={styles.listTitle}>
              Alarmlarım ({alarms.length})
            </Text>
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text variant="headlineSmall" style={styles.emptyTitle}>
                  Henüz alarm yok
                </Text>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Yeni alarm eklemek için + butonuna basın
                </Text>
              </View>
            )
          }
        />
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddAlarm}
      />
      
      {/* Alarm Geçmişi Dialog */}
      <Portal>
        <Dialog
          visible={showHistoryDialog}
          onDismiss={() => setShowHistoryDialog(false)}
          style={styles.historyDialog}>
          <Dialog.Title>Alarm Geçmişi - {selectedAlarmName}</Dialog.Title>
          <Dialog.ScrollArea style={styles.historyScrollArea}>
            <ScrollView>
              {selectedAlarmHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Text variant="bodyMedium" style={styles.emptyHistoryText}>
                    Bu alarm için henüz geçmiş kayıt yok
                  </Text>
                </View>
              ) : (
                selectedAlarmHistory.map((history, index) => (
                  <View key={history.id}>
                    <View style={styles.historyItem}>
                      <View style={styles.historyItemHeader}>
                        <Text variant="bodyLarge" style={styles.historyDate}>
                          {formatDateTime(history.taken_at)}
                        </Text>
                        <Chip
                          style={[
                            styles.historyStatusChip,
                            { backgroundColor: getStatusColor(history.status) + '20' },
                          ]}
                          textStyle={{ color: getStatusColor(history.status) }}>
                          {getStatusText(history.status)}
                        </Chip>
                      </View>
                      {history.verified === 1 && (
                        <Chip icon="check-circle" style={styles.verifiedChip} compact>
                          Doğrulandı
                        </Chip>
                      )}
                    </View>
                    {index < selectedAlarmHistory.length - 1 && <Divider />}
                  </View>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowHistoryDialog(false)}>Kapat</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 24,
    color: 'gray',
  },
  button: {
    marginTop: 16,
  },
  list: {
    padding: 16,
  },
  listTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  alarmCard: {
    marginBottom: 12,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alarmInfo: {
    flex: 1,
  },
  alarmTime: {
    fontWeight: 'bold',
    fontSize: 32,
    marginBottom: 4,
  },
  drugName: {
    marginBottom: 4,
  },
  repeatText: {
    color: 'gray',
    marginBottom: 2,
  },
  reminderText: {
    color: '#6200ee',
    marginTop: 4,
  },
  alarmActions: {
    alignItems: 'flex-end',
  },
  statusChip: {
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: '#c8e6c9',
  },
  inactiveChip: {
    backgroundColor: '#ffcdd2',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  cardActions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  takeDrugButton: {
    marginRight: 4,
    marginBottom: 4,
  },
  historyDialog: {
    maxHeight: '80%',
  },
  historyScrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  emptyHistory: {
    padding: 24,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: 'gray',
    textAlign: 'center',
  },
  historyItem: {
    padding: 16,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontWeight: 'bold',
    flex: 1,
  },
  historyStatusChip: {
    marginLeft: 8,
  },
  verifiedChip: {
    backgroundColor: '#c8e6c9',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyTitle: {
    marginBottom: 8,
    color: 'gray',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptyText: {
    color: 'gray',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: 'gray',
  },
});

export default AlarmListScreen;

