/**
 * LocalDatabase - SQLite veritabanı servisi
 */

import SQLite from 'react-native-sqlite-storage';

// SQLite hata ayıklama modunu etkinleştir
SQLite.DEBUG(true);
SQLite.enablePromise(true);

export interface Drug {
  id: string;
  name: string;
  dosage?: string;
  image_base64?: string;
  created_at: number;
  updated_at: number;
}

export interface Alarm {
  id: string;
  drug_id: string;
  time: string; // HH:mm formatında
  repeat_type: 'daily' | 'custom' | 'interval';
  repeat_days?: string; // JSON array: [1,3,5] for Mon,Wed,Fri
  interval_hours?: number;
  reminder_before: number; // minutes
  sound_path?: string;
  is_active: number; // 0 or 1
  created_at: number;
}

export interface History {
  id: string;
  drug_id: string;
  alarm_id?: string;
  taken_at: number;
  photo_base64?: string;
  verified: number; // 0 or 1
  status: 'taken' | 'missed' | 'pending';
  created_at: number;
}

export interface SyncStatus {
  id: string;
  table_name: string;
  record_id: string;
  synced: number; // 0 or 1
  sync_timestamp?: number;
}

class LocalDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName = 'pharma_app.db';
  private dbVersion = '1.0';
  private dbDisplayName = 'Pharma App Database';
  private dbSize = 200000;

  /**
   * Veritabanını başlat
   */
  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabase({
        name: this.dbName,
        version: this.dbVersion,
        displayName: this.dbDisplayName,
        size: this.dbSize,
        location: 'default',
      });

      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Tabloları oluştur
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // İlaçlar tablosu
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS drugs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dosage TEXT,
        image_base64 TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Alarmlar tablosu
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY,
        drug_id TEXT NOT NULL,
        time TEXT NOT NULL,
        repeat_type TEXT,
        repeat_days TEXT,
        interval_hours INTEGER,
        reminder_before INTEGER DEFAULT 15,
        sound_path TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE
      );
    `);

    // Geçmiş tablosu
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        drug_id TEXT NOT NULL,
        alarm_id TEXT,
        taken_at INTEGER NOT NULL,
        photo_base64 TEXT,
        verified INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE
      );
    `);

    // Senkronizasyon durumu tablosu
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        sync_timestamp INTEGER,
        UNIQUE(table_name, record_id)
      );
    `);

    // İndeksler
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_drugs_created_at ON drugs(created_at);`);
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_alarms_drug_id ON alarms(drug_id);`);
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_alarms_is_active ON alarms(is_active);`);
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_history_drug_id ON history(drug_id);`);
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_history_taken_at ON history(taken_at);`);
    await this.db.executeSql(`CREATE INDEX IF NOT EXISTS idx_sync_status_synced ON sync_status(synced);`);
  }

  /**
   * İlaç ekle
   */
  async addDrug(drug: Drug): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql(
      `INSERT INTO drugs (id, name, dosage, image_base64, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        drug.id,
        drug.name,
        drug.dosage || null,
        drug.image_base64 || null,
        drug.created_at,
        drug.updated_at,
      ]
    );
  }

  /**
   * Tüm ilaçları getir
   */
  async getAllDrugs(): Promise<Drug[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql('SELECT * FROM drugs ORDER BY created_at DESC');
    const drugs: Drug[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      drugs.push(results.rows.item(i));
    }

    return drugs;
  }

  /**
   * İlaç getir (ID ile)
   */
  async getDrugById(id: string): Promise<Drug | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql('SELECT * FROM drugs WHERE id = ?', [id]);

    if (results.rows.length > 0) {
      return results.rows.item(0);
    }

    return null;
  }

  /**
   * İlaç güncelle
   */
  async updateDrug(drug: Partial<Drug> & { id: string }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (drug.name !== undefined) {
      updates.push('name = ?');
      values.push(drug.name);
    }
    if (drug.dosage !== undefined) {
      updates.push('dosage = ?');
      values.push(drug.dosage);
    }
    if (drug.image_base64 !== undefined) {
      updates.push('image_base64 = ?');
      values.push(drug.image_base64);
    }
    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(drug.id);

    await this.db.executeSql(
      `UPDATE drugs SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * İlaç sil
   */
  async deleteDrug(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql('DELETE FROM drugs WHERE id = ?', [id]);
  }

  /**
   * Alarm ekle
   */
  async addAlarm(alarm: Alarm): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql(
      `INSERT INTO alarms (id, drug_id, time, repeat_type, repeat_days, interval_hours, reminder_before, sound_path, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alarm.id,
        alarm.drug_id,
        alarm.time,
        alarm.repeat_type,
        alarm.repeat_days || null,
        alarm.interval_hours || null,
        alarm.reminder_before,
        alarm.sound_path || null,
        alarm.is_active,
        alarm.created_at,
      ]
    );
  }

  /**
   * Alarm güncelle
   */
  async updateAlarm(alarm: Partial<Alarm> & { id: string }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (alarm.drug_id !== undefined) {
      updates.push('drug_id = ?');
      values.push(alarm.drug_id);
    }
    if (alarm.time !== undefined) {
      updates.push('time = ?');
      values.push(alarm.time);
    }
    if (alarm.repeat_type !== undefined) {
      updates.push('repeat_type = ?');
      values.push(alarm.repeat_type);
    }
    if (alarm.repeat_days !== undefined) {
      updates.push('repeat_days = ?');
      values.push(alarm.repeat_days || null);
    }
    if (alarm.interval_hours !== undefined) {
      updates.push('interval_hours = ?');
      values.push(alarm.interval_hours || null);
    }
    if (alarm.reminder_before !== undefined) {
      updates.push('reminder_before = ?');
      values.push(alarm.reminder_before);
    }
    if (alarm.sound_path !== undefined) {
      updates.push('sound_path = ?');
      values.push(alarm.sound_path || null);
    }
    if (alarm.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(alarm.is_active);
    }

    values.push(alarm.id);

    await this.db.executeSql(
      `UPDATE alarms SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Alarm sil
   */
  async deleteAlarm(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql('DELETE FROM alarms WHERE id = ?', [id]);
  }

  /**
   * Tüm alarmları getir
   */
  async getAllAlarms(): Promise<Alarm[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql('SELECT * FROM alarms ORDER BY created_at DESC');
    const alarms: Alarm[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      alarms.push(results.rows.item(i));
    }

    return alarms;
  }

  /**
   * ID'ye göre alarm getir
   */
  async getAlarmById(id: string): Promise<Alarm | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql('SELECT * FROM alarms WHERE id = ?', [id]);

    if (results.rows.length > 0) {
      return results.rows.item(0);
    }

    return null;
  }

  /**
   * Aktif alarmları getir
   */
  async getActiveAlarms(): Promise<Alarm[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT * FROM alarms WHERE is_active = 1 ORDER BY time ASC'
    );
    const alarms: Alarm[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      alarms.push(results.rows.item(i));
    }

    return alarms;
  }

  /**
   * Tüm geçmiş kayıtlarını getir
   */
  async getAllHistory(): Promise<History[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql('SELECT * FROM history ORDER BY taken_at DESC');
    const history: History[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      history.push(results.rows.item(i));
    }

    return history;
  }

  /**
   * Geçmiş kaydı ekle
   */
  async addHistory(history: History): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql(
      `INSERT INTO history (id, drug_id, alarm_id, taken_at, photo_base64, verified, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        history.id,
        history.drug_id,
        history.alarm_id || null,
        history.taken_at,
        history.photo_base64 || null,
        history.verified,
        history.status,
        history.created_at,
      ]
    );
  }

  /**
   * Geçmiş kayıtları getir
   */
  async getHistory(limit?: number): Promise<History[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const query = limit
      ? `SELECT * FROM history ORDER BY taken_at DESC LIMIT ${limit}`
      : 'SELECT * FROM history ORDER BY taken_at DESC';

    const [results] = await this.db.executeSql(query);
    const history: History[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      history.push(results.rows.item(i));
    }

    return history;
  }

  /**
   * İlaç ID'sine göre geçmiş kayıtlarını getir
   */
  async getHistoryByDrugId(drugId: string): Promise<History[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT * FROM history WHERE drug_id = ? ORDER BY taken_at DESC',
      [drugId]
    );
    const history: History[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      history.push(results.rows.item(i));
    }

    return history;
  }

  /**
   * Bugün için ilaç alınıp alınmadığını kontrol et
   */
  async isDrugTakenToday(drugId: string, alarmId?: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    let query = `
      SELECT * FROM history 
      WHERE drug_id = ? 
      AND taken_at >= ? 
      AND taken_at <= ?
      AND status IN ('taken', 'missed')
    `;
    const params: any[] = [drugId, todayStart, todayEnd];

    if (alarmId) {
      query += ' AND alarm_id = ?';
      params.push(alarmId);
    }

    const [results] = await this.db.executeSql(query, params);
    return results.rows.length > 0;
  }

  /**
   * Belirli bir alarm için bugün kayıt var mı kontrol et
   */
  async hasHistoryForAlarmToday(alarmId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const [results] = await this.db.executeSql(
      `SELECT * FROM history 
       WHERE alarm_id = ? 
       AND taken_at >= ? 
       AND taken_at <= ?
       AND status IN ('taken', 'missed')`,
      [alarmId, todayStart, todayEnd]
    );

    return results.rows.length > 0;
  }

  /**
   * Belirli bir tarih aralığında alarm için kayıt var mı?
   */
  async hasHistoryForAlarmOnDate(
    alarmId: string,
    dateStart: number,
    dateEnd: number
  ): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      `SELECT * FROM history 
       WHERE alarm_id = ? 
       AND taken_at >= ? 
       AND taken_at <= ?
       AND status IN ('taken', 'missed')`,
      [alarmId, dateStart, dateEnd]
    );

    return results.rows.length > 0;
  }

  /**
   * Tek bir geçmiş kaydını sil
   */
  async deleteHistory(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql('DELETE FROM history WHERE id = ?', [id]);
  }

  /**
   * Tüm geçmiş kayıtlarını sil
   */
  async clearAllHistory(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql('DELETE FROM history');
  }

  /**
   * Yanlış oluşturulmuş "missed" kayıtlarını temizle
   * (Tekrarlı olmayan alarmlar için oluşturulmuş kayıtları siler)
   */
  async cleanupInvalidMissedRecords(): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Tüm "missed" kayıtlarını getir
    const [results] = await this.db.executeSql(
      "SELECT * FROM history WHERE status = 'missed' AND alarm_id IS NOT NULL"
    );

    let deletedCount = 0;

    for (let i = 0; i < results.rows.length; i++) {
      const history = results.rows.item(i);
      
      // Alarm bilgisini getir
      const alarm = await this.getAlarmById(history.alarm_id);
      
      if (!alarm) {
        // Alarm silinmiş, bu kaydı da sil
        await this.db.executeSql('DELETE FROM history WHERE id = ?', [history.id]);
        deletedCount++;
        continue;
      }

      // Tekrarlı olmayan alarmlar için oluşturulmuş kayıtları sil
      if (!alarm.repeat_type || alarm.repeat_type === 'none') {
        await this.db.executeSql('DELETE FROM history WHERE id = ?', [history.id]);
        deletedCount++;
        continue;
      }

      // Custom repeat için o günün alarm günü olup olmadığını kontrol et
      if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
        const takenDate = new Date(history.taken_at);
        const dayOfWeek = takenDate.getDay();
        const repeatDays = JSON.parse(alarm.repeat_days);
        
        if (!repeatDays.includes(dayOfWeek)) {
          // O gün alarm günü değilse, bu kaydı sil
          await this.db.executeSql('DELETE FROM history WHERE id = ?', [history.id]);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Senkronizasyon durumu ekle/güncelle
   */
  async updateSyncStatus(tableName: string, recordId: string, synced: boolean): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql(
      `INSERT OR REPLACE INTO sync_status (id, table_name, record_id, synced, sync_timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [`${tableName}_${recordId}`, tableName, recordId, synced ? 1 : 0, synced ? Date.now() : null]
    );
  }

  /**
   * Senkronize edilmemiş kayıtları getir
   */
  async getUnsyncedRecords(tableName: string): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT record_id FROM sync_status WHERE table_name = ? AND synced = 0',
      [tableName]
    );

    const recordIds: string[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      recordIds.push(results.rows.item(i).record_id);
    }

    return recordIds;
  }

  /**
   * Veritabanını kapat
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export default new LocalDatabase();

