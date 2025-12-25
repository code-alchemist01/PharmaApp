/**
 * AndroidNotificationService - Android native bildirim servisi
 * react-native-push-notification yerine Android'in kendi bildirim sistemini kullanır
 */

import { Platform, NativeModules } from 'react-native';

interface NotificationConfig {
  title: string;
  message: string;
  channelId?: string;
}

class AndroidNotificationService {
  private NotificationManager: any = null;

  constructor() {
    if (Platform.OS === 'android') {
      try {
        const { NotificationManager } = NativeModules;
        this.NotificationManager = NotificationManager;
      } catch (error) {
        console.error('NotificationManager not available:', error);
      }
    }
  }

  /**
   * Test bildirimi gönder
   */
  sendTestNotification(): void {
    if (Platform.OS !== 'android') {
      console.warn('Notifications only work on Android');
      return;
    }

    try {
      // Android'in kendi bildirim sistemini kullan
      const { NotificationManager } = require('react-native').NativeModules;
      
      if (!NotificationManager) {
        console.error('NotificationManager native module not found');
        // Fallback: Alert göster
        const { Alert } = require('react-native');
        Alert.alert('Bildirim Modülü Bulunamadı', 'Native modül bağlanmamış. Lütfen uygulamayı rebuild edin.');
        return;
      }

      // Basit bildirim gönder
      NotificationManager.showNotification({
        title: 'Test Bildirimi',
        message: 'Bildirim sistemi çalışıyor!',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}

export default new AndroidNotificationService();

