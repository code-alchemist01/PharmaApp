/**
 * FirestoreService - Firestore veritabanı servisi
 */

import firestore, { Timestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { Drug, Alarm, History } from './LocalDatabase';

class FirestoreService {
  private getUserId(): string {
    const user = auth(getApp()).currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user.uid;
  }

  /**
   * İlaç ekle
   */
  async addDrug(drug: Drug): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .doc(drug.id)
      .set({
        name: drug.name,
        dosage: drug.dosage || null,
        image_base64: drug.image_base64 || null,
        createdAt: Timestamp.fromMillis(drug.created_at),
        updatedAt: Timestamp.fromMillis(drug.updated_at),
      });
  }

  /**
   * İlaç güncelle
   */
  async updateDrug(drug: Partial<Drug> & { id: string }): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    const updateData: any = {
      updatedAt: Timestamp.fromMillis(Date.now()),
    };

    if (drug.name !== undefined) updateData.name = drug.name;
    if (drug.dosage !== undefined) updateData.dosage = drug.dosage;
    if (drug.image_base64 !== undefined) updateData.image_base64 = drug.image_base64;

    await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .doc(drug.id)
      .update(updateData);
  }

  /**
   * İlaç sil
   */
  async deleteDrug(drugId: string): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .doc(drugId)
      .delete();
  }

  /**
   * Tüm ilaçları getir
   */
  async getAllDrugs(): Promise<Drug[]> {
    const userId = this.getUserId();
    const snapshot = await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        dosage: data.dosage || undefined,
        image_base64: data.image_base64 || undefined,
        created_at: data.createdAt?.toMillis() || Date.now(),
        updated_at: data.updatedAt?.toMillis() || Date.now(),
      };
    });
  }

  /**
   * İlaç getir (ID ile)
   */
  async getDrugById(drugId: string): Promise<Drug | null> {
    const userId = this.getUserId();
    const doc = await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .doc(drugId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      id: doc.id,
      name: data.name,
      dosage: data.dosage || undefined,
      image_base64: data.image_base64 || undefined,
      created_at: data.createdAt?.toMillis() || Date.now(),
      updated_at: data.updatedAt?.toMillis() || Date.now(),
    };
  }

  /**
   * Alarm ekle
   */
  async addAlarm(alarm: Alarm): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('alarms')
      .doc(alarm.id)
      .set({
        drugId: alarm.drug_id,
        time: alarm.time,
        repeatType: alarm.repeat_type,
        repeatDays: alarm.repeat_days ? JSON.parse(alarm.repeat_days) : null,
        intervalHours: alarm.interval_hours || null,
        reminderBefore: alarm.reminder_before,
        soundPath: alarm.sound_path || null,
        isActive: alarm.is_active === 1,
        createdAt: Timestamp.fromMillis(alarm.created_at),
      });
  }

  /**
   * Alarm güncelle
   */
  async updateAlarm(alarm: Partial<Alarm> & { id: string }): Promise<void> {
    const userId = this.getUserId();
    const updateData: any = {};

    if (alarm.drug_id !== undefined) updateData.drugId = alarm.drug_id;
    if (alarm.time !== undefined) updateData.time = alarm.time;
    if (alarm.repeat_type !== undefined) updateData.repeatType = alarm.repeat_type;
    if (alarm.repeat_days !== undefined) {
      updateData.repeatDays = alarm.repeat_days ? JSON.parse(alarm.repeat_days) : null;
    }
    if (alarm.interval_hours !== undefined) updateData.intervalHours = alarm.interval_hours;
    if (alarm.reminder_before !== undefined) updateData.reminderBefore = alarm.reminder_before;
    if (alarm.sound_path !== undefined) updateData.soundPath = alarm.sound_path;
    if (alarm.is_active !== undefined) updateData.isActive = alarm.is_active === 1;

    await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('alarms')
      .doc(alarm.id)
      .update(updateData);
  }

  /**
   * Alarm sil
   */
  async deleteAlarm(alarmId: string): Promise<void> {
    const userId = this.getUserId();
    await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('alarms')
      .doc(alarmId)
      .delete();
  }

  /**
   * Tüm alarmları getir
   */
  async getAllAlarms(): Promise<Alarm[]> {
    const userId = this.getUserId();
    const snapshot = await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('alarms')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        drug_id: data.drugId,
        time: data.time,
        repeat_type: data.repeatType,
        repeat_days: data.repeatDays ? JSON.stringify(data.repeatDays) : undefined,
        interval_hours: data.intervalHours || undefined,
        reminder_before: data.reminderBefore || 15,
        sound_path: data.soundPath || undefined,
        is_active: data.isActive ? 1 : 0,
        created_at: data.createdAt?.toMillis() || Date.now(),
      };
    });
  }

  /**
   * Geçmiş kaydı ekle
   */
  async addHistory(history: History): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    const historyData: any = {
      drugId: history.drug_id,
      alarmId: history.alarm_id || null,
      takenAt: Timestamp.fromMillis(history.taken_at),
      verified: history.verified === 1,
      status: history.status,
      createdAt: Timestamp.fromMillis(history.created_at),
    };
    
    // photo_base64 sadece varsa ekle (undefined olmamalı)
    if (history.photo_base64) {
      historyData.photo_base64 = history.photo_base64;
    }
    
    await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('history')
      .doc(history.id)
      .set(historyData);
  }

  /**
   * Geçmiş kayıtları getir
   */
  async getHistory(limit?: number): Promise<History[]> {
    const userId = this.getUserId();
    let query = firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('history')
      .orderBy('takenAt', 'desc');

    if (limit) {
      query = query.limit(limit) as any;
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        drug_id: data.drugId,
        alarm_id: data.alarmId || undefined,
        taken_at: data.takenAt?.toMillis() || Date.now(),
        photo_base64: data.photo_base64 || undefined,
        verified: data.verified ? 1 : 0,
        status: data.status,
        created_at: data.createdAt?.toMillis() || Date.now(),
      };
    });
  }

  /**
   * Geçmiş kaydı sil
   */
  async deleteHistory(userId: string, historyId: string): Promise<void> {
    await firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('history')
      .doc(historyId)
      .delete();
  }

  /**
   * Tüm geçmiş kayıtlarını sil
   */
  async clearAllHistory(): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    const snapshot = await firestoreInstance
      .collection('users')
      .doc(userId)
      .collection('history')
      .get();

    const batch = firestoreInstance.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  /**
   * İlaçları dinle (real-time)
   */
  subscribeToDrugs(callback: (drugs: Drug[]) => void): () => void {
    const userId = this.getUserId();
    return firestore(getApp())
      .collection('users')
      .doc(userId)
      .collection('drugs')
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const drugs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            dosage: data.dosage || undefined,
            image_base64: data.image_base64 || undefined,
            created_at: data.createdAt?.toMillis() || Date.now(),
            updated_at: data.updatedAt?.toMillis() || Date.now(),
          };
        });
        callback(drugs);
      });
  }

  /**
   * Kullanıcı profil fotoğrafını güncelle (Firestore'da base64 olarak)
   */
  async updateUserProfilePhoto(photoBase64: string): Promise<void> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    console.log('[FirestoreService] Updating user profile photo for userId:', userId);
    await firestoreInstance.collection('users').doc(userId).set(
      {
        photoBase64: photoBase64,
        updatedAt: Timestamp.fromMillis(Date.now()),
      },
      { merge: true }
    );
    console.log('[FirestoreService] User profile photo updated successfully');
  }

  /**
   * Kullanıcı profil fotoğrafını getir
   */
  async getUserProfilePhoto(): Promise<string | null> {
    const userId = this.getUserId();
    const firestoreInstance = firestore(getApp());
    console.log('[FirestoreService] Getting user profile photo for userId:', userId);
    const doc = await firestoreInstance.collection('users').doc(userId).get();
    const data = doc.data();
    const photoBase64 = data?.photoBase64 || null;
    console.log('[FirestoreService] User profile photo found:', photoBase64 ? 'Yes' : 'No');
    return photoBase64;
  }
}

export default new FirestoreService();

