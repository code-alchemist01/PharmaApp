/**
 * DrugDetailScreen - İlaç detay ekranı
 * İlaç bilgileri, alarmlar ve geçmiş kayıtlarını gösterir
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, FlatList, Alert } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Divider, Button, IconButton, Menu } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrugStackParamList } from '../../navigation/AppNavigator';
import LocalDatabase, { Drug, Alarm, History } from '../../services/database/LocalDatabase';
import FirestoreService from '../../services/database/FirestoreService';
import { base64ToUri, formatDateTime } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

type DrugDetailScreenRouteProp = {
  key: string;
  name: 'DrugDetail';
  params: {
    drugId: string;
  };
};

type DrugDetailScreenNavigationProp = StackNavigationProp<DrugStackParamList, 'DrugDetail'>;

const DrugDetailScreen: React.FC = () => {
  const route = useRoute<DrugDetailScreenRouteProp>();
  const navigation = useNavigation<DrugDetailScreenNavigationProp>();
  const { user } = useAuth();
  const { drugId } = route.params;

  const [drug, setDrug] = useState<Drug | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [drugStats, setDrugStats] = useState({
    total: 0,
    taken: 0,
    missed: 0,
    successRate: 0,
  });

  const loadDrugData = useCallback(async () => {
    setLoading(true);
    try {
      // İlaç bilgilerini yükle
      const drugData = await LocalDatabase.getDrugById(drugId);
      setDrug(drugData);

      // Bu ilaca ait alarmları yükle
      const allAlarms = await LocalDatabase.getAllAlarms();
      const drugAlarms = allAlarms.filter((alarm) => alarm.drug_id === drugId);
      setAlarms(drugAlarms);

      // Bu ilaca ait geçmiş kayıtlarını yükle
      const drugHistory = await LocalDatabase.getHistoryByDrugId(drugId);
      setHistory(drugHistory);

      // İlaç istatistiklerini hesapla
      const total = drugHistory.length;
      const taken = drugHistory.filter((item) => item.status === 'taken').length;
      const missed = drugHistory.filter((item) => item.status === 'missed').length;
      const successRate = total > 0 ? Math.round((taken / total) * 100) : 0;
      setDrugStats({ total, taken, missed, successRate });
    } catch (error) {
      console.error('Error loading drug data:', error);
    } finally {
      setLoading(false);
    }
  }, [drugId]);

  useFocusEffect(
    useCallback(() => {
      loadDrugData();
    }, [loadDrugData])
  );

  const getRepeatText = (alarm: Alarm) => {
    if (alarm.repeat_type === 'daily') {
      return 'Her Gün';
    }
    if (alarm.repeat_type === 'interval' && alarm.interval_hours) {
      return `Her ${alarm.interval_hours} saatte bir`;
    }
    if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
      const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const days = JSON.parse(alarm.repeat_days).map((dayIndex: number) => dayNames[dayIndex % 7]);
      return days.join(', ');
    }
    return 'Tek Seferlik';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return '#4CAF50';
      case 'missed':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'taken':
        return 'Alındı';
      case 'missed':
        return 'Kaçırıldı';
      default:
        return 'Beklemede';
    }
  };

  const handleAddAlarm = () => {
    navigation.navigate('Alarms' as never, {
      screen: 'AlarmSetting',
      params: { drugId: drugId },
    } as never);
  };

  const handleEditAlarm = (alarm: Alarm) => {
    navigation.navigate('Alarms' as never, {
      screen: 'AlarmSetting',
      params: { alarmId: alarm.id, drugId: drugId },
    } as never);
  };

  const handleEditDrug = () => {
    setMenuVisible(false);
    navigation.navigate('AddDrug', { drugId: drugId });
  };

  const handleDeleteDrug = () => {
    setMenuVisible(false);
    
    // Bu ilaca ait alarm sayısını kontrol et
    const alarmCount = alarms.length;
    const alarmText = alarmCount > 0 
      ? `\n\n⚠️ Bu ilaca ait ${alarmCount} adet alarm bulunmaktadır. İlaç silindiğinde bu alarmlar da otomatik olarak silinecektir.`
      : '';
    
    Alert.alert(
      'İlacı Sil',
      `${drug?.name} ilacını silmek istediğinize emin misiniz?${alarmText}\n\nBu işlem geri alınamaz!`,
      [
        { 
          text: 'İptal', 
          style: 'cancel',
          onPress: () => setMenuVisible(false),
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Local database'den sil
              await LocalDatabase.deleteDrug(drugId);

              // Firestore'dan da sil (eğer kullanıcı giriş yapmışsa)
              if (user?.uid) {
                try {
                  await FirestoreService.deleteDrug(drugId);
                } catch (error) {
                  console.error('Firestore delete error:', error);
                  // Firestore hatası olsa bile devam et
                }
              }

              Alert.alert(
                'Başarılı', 
                'İlaç ve ilgili alarmlar başarıyla silindi.',
                [
                  {
                    text: 'Tamam',
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error deleting drug:', error);
              Alert.alert('Hata', 'İlaç silinirken bir sorun oluştu. Lütfen tekrar deneyin.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  if (!drug) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            İlaç bulunamadı
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.button}>
            Geri Dön
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* İlaç Fotoğrafı */}
        {drug.image_base64 && (
          <Card style={styles.imageCard}>
            <Image
              source={{ uri: base64ToUri(drug.image_base64) }}
              style={styles.image}
              resizeMode="contain"
            />
          </Card>
        )}

        {/* İlaç Bilgileri */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.drugHeader}>
              <View style={styles.drugHeaderLeft}>
                <Text variant="headlineMedium" style={styles.drugName}>
                  {drug.name}
                </Text>
              </View>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={24}
                    onPress={() => setMenuVisible(true)}
                  />
                }>
                <Menu.Item onPress={handleEditDrug} title="Düzenle" leadingIcon="pencil" />
                <Menu.Item onPress={handleDeleteDrug} title="Sil" leadingIcon="delete" titleStyle={{ color: '#d32f2f' }} />
              </Menu>
            </View>
            {drug.dosage && (
              <Text variant="bodyLarge" style={styles.dosage}>
                Dozaj: {drug.dosage}
              </Text>
            )}
            <Text variant="bodySmall" style={styles.createdAt}>
              Kayıt Tarihi: {formatDateTime(drug.created_at)}
            </Text>
          </Card.Content>
        </Card>

        {/* İlaç İstatistikleri */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              İstatistikler
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statValue}>
                  {drugStats.total}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Toplam Kayıt
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, styles.takenStat]}>
                  {drugStats.taken}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Alındı
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, styles.missedStat]}>
                  {drugStats.missed}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Kaçırıldı
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statValue, styles.successStat]}>
                  {drugStats.successRate}%
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Başarı Oranı
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Alarmlar */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleLarge" style={styles.cardTitle}>
                Alarmlar ({alarms.length})
              </Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={handleAddAlarm}
                compact>
                Alarm Ekle
              </Button>
            </View>
            {alarms.length === 0 ? (
              <Text variant="bodyMedium" style={styles.emptyText}>
                Bu ilaç için henüz alarm eklenmedi
              </Text>
            ) : (
              alarms.map((alarm) => (
                <View key={alarm.id} style={styles.alarmItem}>
                  <View style={styles.alarmInfo}>
                    <Text variant="titleMedium" style={styles.alarmTime}>
                      {alarm.time}
                    </Text>
                    <Text variant="bodySmall" style={styles.alarmRepeat}>
                      {getRepeatText(alarm)}
                    </Text>
                    {alarm.reminder_before > 0 && (
                      <Text variant="bodySmall" style={styles.reminderText}>
                        {alarm.reminder_before} dakika önce hatırlat
                      </Text>
                    )}
                  </View>
                  <View style={styles.alarmActions}>
                    <Chip
                      icon={alarm.is_active === 1 ? 'check-circle' : 'close-circle'}
                      selected={alarm.is_active === 1}
                      style={[
                        styles.statusChip,
                        alarm.is_active === 1 ? styles.activeChip : styles.inactiveChip,
                      ]}
                      textStyle={alarm.is_active === 1 ? { color: '#1b5e20' } : { color: '#b71c1c' }}>
                      {alarm.is_active === 1 ? 'Aktif' : 'Pasif'}
                    </Chip>
                    <Button
                      mode="text"
                      icon="pencil"
                      onPress={() => handleEditAlarm(alarm)}
                      compact>
                      Düzenle
                    </Button>
                  </View>
                  {alarm !== alarms[alarms.length - 1] && <Divider style={styles.divider} />}
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Geçmiş Kayıtları */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Geçmiş Kayıtlar ({history.length})
            </Text>
            {history.length === 0 ? (
              <Text variant="bodyMedium" style={styles.emptyText}>
                Bu ilaç için henüz geçmiş kayıt yok
              </Text>
            ) : (
              history.slice(0, 10).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text variant="bodyMedium" style={styles.historyDate}>
                      {formatDateTime(item.taken_at)}
                    </Text>
                    {item.photo_base64 && (
                      <Image
                        source={{ uri: base64ToUri(item.photo_base64) }}
                        style={styles.historyPhoto}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  <View style={styles.historyActions}>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
                      textStyle={styles.statusChipText}>
                      {getStatusText(item.status)}
                    </Chip>
                    {item.verified === 1 && (
                      <Chip icon="check-circle" style={styles.verifiedChip}>
                        Doğrulandı
                      </Chip>
                    )}
                  </View>
                  {item !== history[history.length - 1] && <Divider style={styles.divider} />}
                </View>
              ))
            )}
            {history.length > 10 && (
              <Button
                mode="text"
                onPress={() => navigation.navigate('History' as never)}
                style={styles.viewAllButton}>
                Tümünü Gör ({history.length})
              </Button>
            )}
          </Card.Content>
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
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  button: {
    marginTop: 16,
  },
  imageCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#e0e0e0',
  },
  card: {
    marginBottom: 16,
  },
  drugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  drugHeaderLeft: {
    flex: 1,
  },
  drugName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dosage: {
    marginBottom: 4,
    color: '#6200ee',
  },
  createdAt: {
    color: 'gray',
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyText: {
    color: 'gray',
    textAlign: 'center',
    paddingVertical: 16,
  },
  alarmItem: {
    paddingVertical: 12,
  },
  alarmInfo: {
    marginBottom: 8,
  },
  alarmTime: {
    fontWeight: 'bold',
    fontSize: 24,
    marginBottom: 4,
  },
  alarmRepeat: {
    color: 'gray',
    marginBottom: 2,
  },
  reminderText: {
    color: '#6200ee',
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  activeChip: {
    backgroundColor: '#c8e6c9',
  },
  inactiveChip: {
    backgroundColor: '#ffcdd2',
  },
  verifiedChip: {
    marginTop: 8,
    backgroundColor: '#c8e6c9',
    alignSelf: 'flex-start',
  },
  divider: {
    marginTop: 12,
  },
  historyItem: {
    paddingVertical: 12,
  },
  historyInfo: {
    marginBottom: 8,
  },
  historyDate: {
    marginBottom: 8,
    fontWeight: '500',
  },
  historyPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewAllButton: {
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#6200ee',
  },
  statLabel: {
    color: 'gray',
    textAlign: 'center',
  },
  takenStat: {
    color: '#4CAF50',
  },
  missedStat: {
    color: '#f44336',
  },
  successStat: {
    color: '#2196F3',
  },
});

export default DrugDetailScreen;

