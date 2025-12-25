/**
 * SyncService - Local SQLite ve Firestore arasında senkronizasyon
 */

import LocalDatabase from '../database/LocalDatabase';
import FirestoreService from '../database/FirestoreService';
import NetInfo from '@react-native-community/netinfo';

class SyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Otomatik senkronizasyonu başlat
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, intervalMs);

    // İlk senkronizasyonu hemen yap
    this.syncAll();
  }

  /**
   * Otomatik senkronizasyonu durdur
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Tüm verileri senkronize et
   */
  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('No internet connection, skipping sync');
      return;
    }

    this.isSyncing = true;

    try {
      await this.syncDrugs();
      await this.syncAlarms();
      await this.syncHistory();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * İlaçları senkronize et
   */
  private async syncDrugs(): Promise<void> {
    // Local'den Firestore'a (senkronize edilmemiş kayıtlar)
    const unsyncedIds = await LocalDatabase.getUnsyncedRecords('drugs');
    for (const drugId of unsyncedIds) {
      try {
        const drug = await LocalDatabase.getDrugById(drugId);
        if (drug) {
          await FirestoreService.addDrug(drug);
          await LocalDatabase.updateSyncStatus('drugs', drugId, true);
        }
      } catch (error) {
        console.error(`Error syncing drug ${drugId}:`, error);
      }
    }

    // Firestore'dan Local'e (tüm kayıtlar)
    try {
      const firestoreDrugs = await FirestoreService.getAllDrugs();
      for (const drug of firestoreDrugs) {
        const localDrug = await LocalDatabase.getDrugById(drug.id);
        if (!localDrug) {
          // Local'de yok, ekle
          await LocalDatabase.addDrug(drug);
          await LocalDatabase.updateSyncStatus('drugs', drug.id, true);
        } else if (drug.updated_at > localDrug.updated_at) {
          // Firestore'daki daha güncel, güncelle
          await LocalDatabase.updateDrug(drug);
          await LocalDatabase.updateSyncStatus('drugs', drug.id, true);
        }
      }
    } catch (error) {
      console.error('Error syncing drugs from Firestore:', error);
    }
  }

  /**
   * Alarmları senkronize et
   */
  private async syncAlarms(): Promise<void> {
    // Local'den Firestore'a
    const unsyncedIds = await LocalDatabase.getUnsyncedRecords('alarms');
    for (const alarmId of unsyncedIds) {
      try {
        const alarms = await LocalDatabase.getAllAlarms();
        const alarm = alarms.find((a) => a.id === alarmId);
        if (alarm) {
          await FirestoreService.addAlarm(alarm);
          await LocalDatabase.updateSyncStatus('alarms', alarmId, true);
        }
      } catch (error) {
        console.error(`Error syncing alarm ${alarmId}:`, error);
      }
    }

    // Firestore'dan Local'e
    try {
      const firestoreAlarms = await FirestoreService.getAllAlarms();
      for (const alarm of firestoreAlarms) {
        const localAlarms = await LocalDatabase.getAllAlarms();
        const localAlarm = localAlarms.find((a) => a.id === alarm.id);
        if (!localAlarm) {
          await LocalDatabase.addAlarm(alarm);
          await LocalDatabase.updateSyncStatus('alarms', alarm.id, true);
        }
      }
    } catch (error) {
      console.error('Error syncing alarms from Firestore:', error);
    }
  }

  /**
   * Geçmişi senkronize et
   */
  private async syncHistory(): Promise<void> {
    // Local'den Firestore'a
    const unsyncedIds = await LocalDatabase.getUnsyncedRecords('history');
    for (const historyId of unsyncedIds) {
      try {
        const historyList = await LocalDatabase.getHistory();
        const history = historyList.find((h) => h.id === historyId);
        if (history) {
          await FirestoreService.addHistory(history);
          await LocalDatabase.updateSyncStatus('history', historyId, true);
        }
      } catch (error) {
        console.error(`Error syncing history ${historyId}:`, error);
      }
    }

    // Firestore'dan Local'e
    try {
      const firestoreHistory = await FirestoreService.getHistory();
      for (const history of firestoreHistory) {
        const localHistory = await LocalDatabase.getHistory();
        const exists = localHistory.some((h) => h.id === history.id);
        if (!exists) {
          await LocalDatabase.addHistory(history);
          await LocalDatabase.updateSyncStatus('history', history.id, true);
        }
      }
    } catch (error) {
      console.error('Error syncing history from Firestore:', error);
    }
  }

  /**
   * Manuel senkronizasyon tetikle
   */
  async triggerSync(): Promise<void> {
    await this.syncAll();
  }
}

export default new SyncService();

