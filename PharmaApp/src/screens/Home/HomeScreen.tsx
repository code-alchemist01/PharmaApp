/**
 * HomeScreen - Ana sayfa (Dashboard)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import LocalDatabase, { Alarm, Drug, History } from '../../services/database/LocalDatabase';
import { formatTime } from '../../utils/helpers';

interface AlarmWithDrug extends Alarm {
  drug?: Drug;
}

interface TodayStats {
  total: number;
  taken: number;
  missed: number;
  pending: number;
}

const HomeScreen: React.FC = () => {
  // Tüm hooks'ları önce tanımla (conditional return'dan önce)
  const navigation = useNavigation();
  const { user } = useAuth();
  const [todayAlarms, setTodayAlarms] = useState<AlarmWithDrug[]>([]);
  const [stats, setStats] = useState<TodayStats>({ total: 0, taken: 0, missed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTodayData = useCallback(async () => {
    try {
      // Bugünün başlangıç ve bitiş zamanı
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const todayStartTime = todayStart.getTime();
      const todayEndTime = todayEnd.getTime();

      // Tüm aktif alarmları getir
      const allAlarms = await LocalDatabase.getAllAlarms();
      const allDrugs = await LocalDatabase.getAllDrugs();
      const allHistory = await LocalDatabase.getAllHistory();

      // Bugünün günü (0=Pazar, 1=Pazartesi, ..., 6=Cumartesi)
      const todayDay = now.getDay();

      // Bugünün alarmlarını filtrele ve sırala
      const alarmsWithDrugs: AlarmWithDrug[] = allAlarms
        .filter((alarm) => {
          // Sadece aktif alarmlar
          if (alarm.is_active !== 1) return false;

          // Günlük tekrar: Her gün
          if (alarm.repeat_type === 'daily') {
            return true;
          }

          // Özel günler: Bugünün günü repeat_days içinde olmalı
          if (alarm.repeat_type === 'custom') {
            if (!alarm.repeat_days) return false;
            try {
              const repeatDays = JSON.parse(alarm.repeat_days) as number[];
              return repeatDays.includes(todayDay);
            } catch {
              return false;
            }
          }

          // Aralıklı: Şimdilik tüm aralıklı alarmları göster (karmaşık hesaplama gerekir)
          if (alarm.repeat_type === 'interval') {
            return true; // Basit yaklaşım: Tüm aralıklı alarmları göster
          }

          // Tek seferlik: Sadece bugünkü alarmlar (oluşturulma tarihine göre)
          // Şimdilik tüm tek seferlik alarmları göster
          return true;
        })
        .map((alarm) => ({
          ...alarm,
          drug: allDrugs.find((d) => d.id === alarm.drug_id),
        }))
        .filter((alarm) => alarm.drug) // İlaç bilgisi olan alarmlar
        .sort((a, b) => {
          // Alarm zamanına göre sırala
          const [hoursA, minutesA] = a.time.split(':').map(Number);
          const [hoursB, minutesB] = b.time.split(':').map(Number);
          const timeA = hoursA * 60 + minutesA;
          const timeB = hoursB * 60 + minutesB;
          return timeA - timeB;
        });

      setTodayAlarms(alarmsWithDrugs);

      // Bugünkü istatistikleri hesapla
      const todayHistory = allHistory.filter(
        (h) => h.taken_at >= todayStartTime && h.taken_at <= todayEndTime
      );

      const taken = todayHistory.filter((h) => h.status === 'taken').length;
      const missed = todayHistory.filter((h) => h.status === 'missed').length;
      const total = alarmsWithDrugs.length;
      const pending = total - taken - missed;

      setStats({ total, taken, missed, pending });
    } catch (error) {
      console.error('Error loading today data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTodayData();
    }, [loadTodayData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTodayData();
  }, [loadTodayData]);

  const getNextAlarmTime = (alarm: AlarmWithDrug): string => {
    const [hours, minutes] = alarm.time.split(':').map(Number);
    const now = new Date();
    const alarmTime = new Date(now);
    alarmTime.setHours(hours, minutes, 0, 0);

    // Eğer bugünkü alarm geçmişse, yarınki alarmı göster
    if (alarmTime < now && (alarm.repeat_type === 'daily' || alarm.repeat_type === 'custom')) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }

    return formatTime(alarmTime);
  };

  // Early return yerine conditional rendering kullan

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.welcomeText}>
          Hoş Geldiniz, {user?.displayName || user?.email?.split('@')[0] || 'Kullanıcı'}!
        </Text>

        {/* Bugünkü Özet İstatistikler */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Bugünün Özeti
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {stats.total}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Toplam Alarm
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statNumber, styles.statTaken]}>
                  {stats.taken}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Alındı
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statNumber, styles.statMissed]}>
                  {stats.missed}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Kaçırıldı
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statNumber, styles.statPending]}>
                  {stats.pending}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Beklemede
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Bugünün İlaçları */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Bugünün İlaçları
              </Text>
              <Chip icon="pill" style={styles.chip}>
                {todayAlarms.length} ilaç
              </Chip>
            </View>
            {todayAlarms.length === 0 ? (
              <Text variant="bodyMedium" style={styles.emptyText}>
                Bugün için alarm yok
              </Text>
            ) : (
              <View style={styles.alarmsList}>
                {todayAlarms.slice(0, 5).map((alarm) => (
                  <View key={alarm.id} style={styles.alarmItem}>
                    <View style={styles.alarmInfo}>
                      <Text variant="titleMedium" style={styles.drugName}>
                        {alarm.drug?.name || 'Bilinmeyen İlaç'}
                      </Text>
                      <Text variant="bodySmall" style={styles.alarmTime}>
                        ⏰ {alarm.time} {alarm.repeat_type === 'daily' && '(Günlük)'}
                      </Text>
                    </View>
                    <Chip
                      icon="check-circle"
                      style={[
                        styles.statusChip,
                        alarm.is_active === 1 ? styles.activeChip : styles.inactiveChip,
                      ]}>
                      {alarm.is_active === 1 ? 'Aktif' : 'Pasif'}
                    </Chip>
                  </View>
                ))}
                {todayAlarms.length > 5 && (
                  <Button
                    mode="text"
                    onPress={() => navigation.navigate('Alarms' as never)}
                    style={styles.moreButton}>
                    {todayAlarms.length - 5} ilaç daha göster
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Hızlı Erişim */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Hızlı Erişim
            </Text>
          </Card.Content>
          <Card.Actions style={styles.actions}>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Drugs' as never)}
              style={styles.actionButton}
              icon="pill">
              İlaçlar
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Alarms' as never)}
              style={styles.actionButton}
              icon="alarm">
              Alarmlar
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('History' as never)}
              style={styles.actionButton}
              icon="history">
              Geçmiş
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Statistics' as never)}
              style={styles.actionButton}
              icon="chart-bar">
              İstatistikler
            </Button>
          </Card.Actions>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  welcomeText: {
    marginBottom: 24,
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  chip: {
    alignSelf: 'flex-start',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  statTaken: {
    color: '#4CAF50',
  },
  statMissed: {
    color: '#f44336',
  },
  statPending: {
    color: '#ff9800',
  },
  statLabel: {
    marginTop: 4,
    color: 'gray',
  },
  alarmsList: {
    marginTop: 8,
  },
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  alarmInfo: {
    flex: 1,
  },
  drugName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  alarmTime: {
    color: 'gray',
  },
  statusChip: {
    marginLeft: 8,
  },
  activeChip: {
    backgroundColor: '#e8f5e9',
  },
  inactiveChip: {
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    textAlign: 'center',
    color: 'gray',
    marginTop: 16,
    marginBottom: 8,
  },
  moreButton: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  actionButton: {
    margin: 4,
  },
});

export default HomeScreen;
