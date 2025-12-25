/**
 * DrugListScreen - İlaç listesi ekranı
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Button, FAB, SegmentedButtons, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrugStackParamList } from '../../navigation/AppNavigator';
import LocalDatabase, { Drug } from '../../services/database/LocalDatabase';
import DrugCard from '../../components/DrugCard';
import DrugListItem from '../../components/DrugListItem';
import SwipeableRow from '../../components/SwipeableRow';
import FirestoreService from '../../services/database/FirestoreService';

type DrugListScreenNavigationProp = StackNavigationProp<DrugStackParamList, 'DrugList'>;

type ViewMode = 'list' | 'card';

const DrugListScreen: React.FC = () => {
  const navigation = useNavigation<DrugListScreenNavigationProp>();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchQuery, setSearchQuery] = useState('');

  const loadDrugs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const allDrugs = await LocalDatabase.getAllDrugs();
      setDrugs(allDrugs);
    } catch (error) {
      console.error('Error loading drugs:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    await loadDrugs(true);
  }, [loadDrugs]);

  useFocusEffect(
    useCallback(() => {
      loadDrugs();
    }, [loadDrugs])
  );

  const handleAddDrug = () => {
    navigation.navigate('AddDrug');
  };

  const handleDrugPress = (drugId: string) => {
    navigation.navigate('DrugDetail', { drugId });
  };

  const handleEditDrug = (drugId: string) => {
    navigation.navigate('DrugDetail', { drugId });
  };

  const handleDeleteDrug = async (drugId: string) => {
    Alert.alert(
      'İlaç Sil',
      'Bu ilacı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await LocalDatabase.deleteDrug(drugId);
              await LocalDatabase.updateSyncStatus('drugs', drugId, false);
              
              try {
                await FirestoreService.deleteDrug(drugId);
                await LocalDatabase.updateSyncStatus('drugs', drugId, true);
              } catch (error) {
                console.error('Firestore delete error:', error);
              }

              loadDrugs();
            } catch (error) {
              Alert.alert('Hata', 'İlaç silinemedi');
            }
          },
        },
      ]
    );
  };

  const filteredDrugs = useMemo(() => {
    let filtered = drugs;

    // Arama filtresi
    if (searchQuery.trim()) {
      filtered = filtered.filter((drug) =>
        drug.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (drug.dosage && drug.dosage.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  }, [drugs, searchQuery]);

  const renderDrug = ({ item }: { item: Drug }) => {
    if (viewMode === 'card') {
      return <DrugCard drug={item} onPress={() => handleDrugPress(item.id)} />;
    } else {
      return (
        <SwipeableRow
          onEdit={() => handleEditDrug(item.id)}
          onDelete={() => handleDeleteDrug(item.id)}>
          <DrugListItem drug={item} onPress={() => handleDrugPress(item.id)} />
        </SwipeableRow>
      );
    }
  };

  const numColumns = viewMode === 'card' ? 2 : 1;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            İlaçlar yükleniyor...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {drugs.length === 0 ? (
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            İlaçlarım
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Henüz ilaç eklenmedi
          </Text>
          <Button
            mode="contained"
            onPress={handleAddDrug}
            style={styles.button}>
            İlaç Ekle
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.listTitle}>
              İlaçlarım ({filteredDrugs.length}/{drugs.length})
            </Text>
            <Searchbar
              placeholder="İlaç ara..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchbar}
            />
            <SegmentedButtons
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              buttons={[
                { value: 'card', label: 'Kart', icon: 'view-grid' },
                { value: 'list', label: 'Liste', icon: 'view-list' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>
          {filteredDrugs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                {searchQuery
                  ? 'Sonuç bulunamadı'
                  : 'Henüz ilaç eklenmedi'}
              </Text>
            </View>
          ) : (
            <FlatList
              key={viewMode} // numColumns değiştiğinde FlatList'i yeniden render et
              data={filteredDrugs}
              renderItem={renderDrug}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              numColumns={numColumns}
              columnWrapperStyle={numColumns === 2 ? styles.row : undefined}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200ee']} />
              }
            />
          )}
        </>
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddDrug}
      />
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
  header: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: 'white',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  listTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  searchbar: {
    marginBottom: 12,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  row: {
    justifyContent: 'space-between',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    minHeight: 200,
  },
  emptyText: {
    color: 'gray',
    textAlign: 'center',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default DrugListScreen;

