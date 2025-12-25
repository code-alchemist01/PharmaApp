/**
 * HistoryScreen - Geçmiş ekranı (İlaç alma geçmişi)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Image, Alert, Modal, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, IconButton, Searchbar, Portal, Dialog } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import LocalDatabase, { History, Drug } from '../../services/database/LocalDatabase';
import { useAuth } from '../../context/AuthContext';
import FirestoreService from '../../services/database/FirestoreService';
import { base64ToUri, formatDateTime } from '../../utils/helpers';
import SwipeableRow from '../../components/SwipeableRow';

interface HistoryWithDrug extends History {
  drug?: Drug;
}

type FilterStatus = 'all' | 'taken' | 'missed' | 'pending';
type FilterPeriod = 'all' | 'today' | 'week' | 'month';

const HistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryWithDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterDrugId, setFilterDrugId] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryWithDrug | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [allDrugs, setAllDrugs] = useState<Drug[]>([]);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const allHistory = await LocalDatabase.getAllHistory();
      const drugs = await LocalDatabase.getAllDrugs();
      setAllDrugs(drugs);

      const historyWithDrugs: HistoryWithDrug[] = allHistory.map((item) => ({
        ...item,
        drug: drugs.find((d) => d.id === item.drug_id),
      }));

      // Tarihe göre sırala (en yeni önce)
      historyWithDrugs.sort((a, b) => b.taken_at - a.taken_at);

      setHistory(historyWithDrugs);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    loadHistory(true);
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Filtrelenmiş ve aranmış geçmiş
  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Arama filtresi
    if (searchQuery.trim()) {
      filtered = filtered.filter((item) =>
        item.drug?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Durum filtresi
    if (filterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    // İlaç filtresi
    if (filterDrugId) {
      filtered = filtered.filter((item) => item.drug_id === filterDrugId);
    }

    // Tarih filtresi
    if (filterPeriod !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filterPeriod) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      const startTime = startDate.getTime();
      filtered = filtered.filter((item) => item.taken_at >= startTime);
    }

    return filtered;
  }, [history, searchQuery, filterStatus, filterDrugId, filterPeriod]);

  const formatDate = (timestamp: number) => {
    return formatDateTime(timestamp);
  };

  const handleHistoryPress = (item: HistoryWithDrug) => {
    setSelectedHistory(item);
    setDetailModalVisible(true);
  };


  const clearFilters = () => {
    setFilterStatus('all');
    setFilterDrugId(null);
    setFilterPeriod('all');
    setSearchQuery('');
  };

  const applyFilters = () => {
    setFilterDialogVisible(false);
  };

  const hasActiveFilters = filterStatus !== 'all' || filterDrugId !== null || filterPeriod !== 'all' || searchQuery.trim() !== '';

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

  const handleClearHistory = () => {
    Alert.alert(
      'Geçmişi Temizle',
      'Tüm geçmiş kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              // Önce Firestore'dan sil (eğer kullanıcı giriş yapmışsa)
              if (user?.uid) {
                try {
                  await FirestoreService.clearAllHistory();
                } catch (error) {
                  console.error('Firestore clear error:', error);
                  // Firestore hatası olsa bile devam et
                }
              }
              
              // Local database'den sil
              await LocalDatabase.clearAllHistory();
              
              // Listeyi yenile
              await loadHistory();
              Alert.alert('Başarılı', 'Geçmiş kayıtları temizlendi.');
            } catch (error) {
              console.error('Error clearing history:', error);
              Alert.alert('Hata', 'Geçmiş temizlenirken bir sorun oluştu.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteHistory = async (historyId: string) => {
    Alert.alert(
      'Kayıt Sil',
      'Bu kaydı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await LocalDatabase.deleteHistory(historyId);
              await LocalDatabase.updateSyncStatus('history', historyId, false);
              
              if (user?.uid) {
                try {
                  await FirestoreService.deleteHistory(user.uid, historyId);
                  await LocalDatabase.updateSyncStatus('history', historyId, true);
                } catch (error) {
                  console.error('Firestore delete error:', error);
                }
              }

              loadHistory();
            } catch (error) {
              Alert.alert('Hata', 'Kayıt silinemedi');
            }
          },
        },
      ]
    );
  };

  const renderHistoryItem = ({ item }: { item: HistoryWithDrug }) => (
    <SwipeableRow
      onDelete={() => handleDeleteHistory(item.id)}>
      <Card style={styles.card} onPress={() => handleHistoryPress(item)}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleLarge" style={styles.drugName}>
              {item.drug?.name || 'Bilinmeyen İlaç'}
            </Text>
            <Text variant="bodyMedium" style={styles.date}>
              {formatDate(item.taken_at)}
            </Text>
          </View>
          <Chip
            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) }]}
            textStyle={styles.statusChipText}>
            {getStatusText(item.status)}
          </Chip>
        </View>

        {item.photo_base64 && (
          <Image 
            source={{ uri: base64ToUri(item.photo_base64) }} 
            style={styles.photo} 
            resizeMode="contain"
          />
        )}

        {item.verified === 1 && (
          <Chip icon="check-circle" style={styles.verifiedChip}>
            Doğrulandı
          </Chip>
        )}
      </Card.Content>
    </Card>
    </SwipeableRow>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Geçmiş yükleniyor...
        </Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Geçmiş
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Henüz ilaç alma kaydı yok
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Arama ve Filtre */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="İlaç adı ile ara..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <View style={styles.filterRow}>
          <Button
            mode={hasActiveFilters ? 'contained' : 'outlined'}
            onPress={() => setFilterDialogVisible(true)}
            icon="filter"
            style={styles.filterButton}
            contentStyle={styles.filterButtonContent}>
            Filtrele
            {hasActiveFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {[
                    filterStatus !== 'all' ? 1 : 0,
                    filterDrugId ? 1 : 0,
                    filterPeriod !== 'all' ? 1 : 0,
                  ].reduce((a, b) => a + b, 0)}
                </Text>
              </View>
            )}
          </Button>
          {hasActiveFilters && (
            <IconButton
              icon="close-circle"
              iconColor="#d32f2f"
              size={24}
              onPress={clearFilters}
              style={styles.clearFilterIcon}
            />
          )}
        </View>
      </View>

      {/* Filtre Dialog */}
      <Portal>
        <Dialog
          visible={filterDialogVisible}
          onDismiss={() => setFilterDialogVisible(false)}
          style={styles.filterDialog}>
          <Dialog.Title>Filtrele</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.filterDialogContent}>
              {/* Durum Filtresi */}
              <Text variant="titleMedium" style={styles.filterSectionTitle}>
                Durum
              </Text>
              <View style={styles.filterChips}>
                <Chip
                  selected={filterStatus === 'all'}
                  onPress={() => setFilterStatus('all')}
                  style={styles.filterChip}>
                  Tümü
                </Chip>
                <Chip
                  selected={filterStatus === 'taken'}
                  onPress={() => setFilterStatus('taken')}
                  style={styles.filterChip}
                  selectedColor="#4CAF50">
                  Alındı
                </Chip>
                <Chip
                  selected={filterStatus === 'missed'}
                  onPress={() => setFilterStatus('missed')}
                  style={styles.filterChip}
                  selectedColor="#f44336">
                  Kaçırıldı
                </Chip>
                <Chip
                  selected={filterStatus === 'pending'}
                  onPress={() => setFilterStatus('pending')}
                  style={styles.filterChip}
                  selectedColor="#ff9800">
                  Beklemede
                </Chip>
              </View>

              {/* Tarih Filtresi */}
              <Text variant="titleMedium" style={styles.filterSectionTitle}>
                Tarih
              </Text>
              <View style={styles.filterChips}>
                <Chip
                  selected={filterPeriod === 'all'}
                  onPress={() => setFilterPeriod('all')}
                  style={styles.filterChip}>
                  Tüm Zamanlar
                </Chip>
                <Chip
                  selected={filterPeriod === 'today'}
                  onPress={() => setFilterPeriod('today')}
                  style={styles.filterChip}>
                  Bugün
                </Chip>
                <Chip
                  selected={filterPeriod === 'week'}
                  onPress={() => setFilterPeriod('week')}
                  style={styles.filterChip}>
                  Son 7 Gün
                </Chip>
                <Chip
                  selected={filterPeriod === 'month'}
                  onPress={() => setFilterPeriod('month')}
                  style={styles.filterChip}>
                  Son 30 Gün
                </Chip>
              </View>

              {/* İlaç Filtresi */}
              {allDrugs.length > 0 && (
                <>
                  <Text variant="titleMedium" style={styles.filterSectionTitle}>
                    İlaç
                  </Text>
                  <View style={styles.filterChips}>
                    <Chip
                      selected={filterDrugId === null}
                      onPress={() => setFilterDrugId(null)}
                      style={styles.filterChip}>
                      Tüm İlaçlar
                    </Chip>
                    {allDrugs.map((drug) => (
                      <Chip
                        key={drug.id}
                        selected={filterDrugId === drug.id}
                        onPress={() =>
                          setFilterDrugId(filterDrugId === drug.id ? null : drug.id)
                        }
                        style={styles.filterChip}>
                        {drug.name}
                      </Chip>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={clearFilters} textColor="#d32f2f">
              Temizle
            </Button>
            <Button onPress={applyFilters} mode="contained">
              Uygula
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FlatList
        data={filteredHistory}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200ee']} />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text variant="headlineMedium" style={styles.listTitle}>
              Geçmiş ({filteredHistory.length} / {history.length})
            </Text>
            {history.length > 0 && (
              <Button
                mode="outlined"
                onPress={handleClearHistory}
                icon="delete-sweep"
                textColor="#d32f2f"
                style={styles.clearButton}>
                Temizle
              </Button>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {hasActiveFilters ? 'Filtreye uygun kayıt bulunamadı' : 'Henüz ilaç alma kaydı yok'}
            </Text>
            {hasActiveFilters && (
              <Button mode="text" onPress={clearFilters} style={styles.clearFilterButton}>
                Filtreleri Temizle
              </Button>
            )}
          </View>
        }
      />

      {/* Detay Modal */}
      <Portal>
        <Dialog
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          style={styles.dialog}>
          <Dialog.Title>Kayıt Detayı</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {selectedHistory && (
                <>
                  <View style={styles.detailRow}>
                    <Text variant="labelLarge" style={styles.detailLabel}>
                      İlaç:
                    </Text>
                    <Text variant="bodyLarge" style={styles.detailValue}>
                      {selectedHistory.drug?.name || 'Bilinmeyen İlaç'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="labelLarge" style={styles.detailLabel}>
                      Tarih:
                    </Text>
                    <Text variant="bodyLarge" style={styles.detailValue}>
                      {formatDate(selectedHistory.taken_at)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="labelLarge" style={styles.detailLabel}>
                      Durum:
                    </Text>
                    <Chip
                      style={[
                        styles.detailChip,
                        { backgroundColor: getStatusColor(selectedHistory.status) },
                      ]}
                      textStyle={styles.statusChipText}>
                      {getStatusText(selectedHistory.status)}
                    </Chip>
                  </View>
                  {selectedHistory.verified === 1 && (
                    <View style={styles.detailRow}>
                      <Chip icon="check-circle" style={styles.verifiedChip}>
                        Doğrulandı
                      </Chip>
                    </View>
                  )}
                  {selectedHistory.photo_base64 && (
                    <View style={styles.detailRow}>
                      <Image
                        source={{ uri: base64ToUri(selectedHistory.photo_base64) }}
                        style={styles.detailPhoto}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDetailModalVisible(false)}>Kapat</Button>
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
    color: 'gray',
  },
  list: {
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontWeight: 'bold',
    flex: 1,
  },
  clearButton: {
    borderColor: '#d32f2f',
  },
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  drugName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    color: 'gray',
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  photo: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#e0e0e0',
  },
  verifiedChip: {
    marginTop: 8,
    backgroundColor: '#c8e6c9',
    alignSelf: 'flex-start',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  searchbar: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flex: 1,
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  filterBadgeText: {
    color: '#6200ee',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearFilterIcon: {
    margin: 0,
  },
  filterDialog: {
    maxHeight: '80%',
  },
  filterDialogContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterSectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: 'gray',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFilterButton: {
    marginTop: 8,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogContent: {
    paddingHorizontal: 16,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#6200ee',
  },
  detailValue: {
    marginTop: 4,
  },
  detailChip: {
    alignSelf: 'flex-start',
  },
  detailPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
  },
});

export default HistoryScreen;
