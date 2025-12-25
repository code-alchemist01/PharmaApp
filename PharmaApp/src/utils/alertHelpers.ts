/**
 * Alert Helpers - Alert.alert'i Promise'e çeviren yardımcı fonksiyonlar
 */

import { Alert } from 'react-native';

/**
 * Alert.alert'i Promise'e çevirir
 * Kullanım: await showAlert('Başlık', 'Mesaj', [{ text: 'Tamam' }])
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
): Promise<void> => {
  return new Promise((resolve) => {
    const alertButtons = buttons || [{ text: 'Tamam' }];
    
    // Son butona resolve ekle
    const lastButton = alertButtons[alertButtons.length - 1];
    const originalOnPress = lastButton.onPress;
    
    alertButtons[alertButtons.length - 1] = {
      ...lastButton,
      onPress: () => {
        if (originalOnPress) {
          originalOnPress();
        }
        resolve();
      },
    };
    
    Alert.alert(title, message, alertButtons);
  });
};

