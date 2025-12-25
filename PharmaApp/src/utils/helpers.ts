/**
 * Helpers - Yardımcı fonksiyonlar
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { DRUG_CLASSES, DrugClass } from './constants';

/**
 * Base64 string'i Image URI'ye dönüştür
 * Eğer zaten URI formatındaysa (file:// veya data:) direkt döndürür
 */
export const base64ToUri = (base64: string): string => {
  // Zaten URI formatındaysa (file:// veya data:image) direkt döndür
  if (base64.startsWith('file://') || base64.startsWith('data:image')) {
    return base64;
  }
  // Saf base64 string ise prefix ekle
  return `data:image/jpeg;base64,${base64}`;
};

/**
 * Image URI'yi base64 string'e dönüştür
 */
export const uriToBase64 = async (uri: string): Promise<string> => {
  // React Native'de bu işlem için react-native-fs kullanılabilir
  // Şimdilik placeholder
  return uri;
};

/**
 * Türkiye time zone'una göre tarih formatla (DD.MM.YYYY HH:mm)
 * Time zone: Europe/Istanbul (GMT+03:00)
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Türkiye time zone'una göre formatla
  return date.toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // 24 saat formatı
  });
};

/**
 * Türkiye time zone'una göre tarih formatla (DD.MM.YYYY)
 * Time zone: Europe/Istanbul (GMT+03:00)
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Türkiye time zone'una göre formatla
  return date.toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Saat formatla (HH:mm) - 24 saat formatı
 * Türkiye'de 24 saat formatı kullanılır
 */
export const formatTime = (timeString: string): string => {
  // Zaten HH:mm formatında olmalı, ama kontrol edelim
  if (timeString.includes('AM') || timeString.includes('PM')) {
    // 12 saat formatından 24 saat formatına çevir
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours, 10);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return `${String(hour24).padStart(2, '0')}:${minutes}`;
  }
  return timeString; // Zaten HH:mm formatında
};

/**
 * İlaç adını doğrula
 */
export const isValidDrugName = (name: string): name is DrugClass => {
  return DRUG_CLASSES.includes(name as DrugClass);
};

/**
 * UUID oluştur
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * UUID oluştur (generateUUID alias)
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Görüntü boyutunu ayarla (placeholder - gerçek implementasyon ML servisinde olacak)
 */
export const resizeImage = async (
  uri: string,
  width: number,
  height: number
): Promise<string> => {
  // React Native Image Manipulator veya benzeri kütüphane kullanılacak
  return uri;
};

/**
 * Kamera iznini kontrol et ve iste (Android için)
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS için react-native-image-picker otomatik yönetir
  }

  try {
    // Android 6.0+ için runtime izin kontrolü
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Kamera İzni',
        message: 'Uygulama fotoğraf çekmek için kamera iznine ihtiyaç duyuyor.',
        buttonNeutral: 'Daha Sonra',
        buttonNegative: 'İptal',
        buttonPositive: 'İzin Ver',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    } else {
      Alert.alert(
        'İzin Gerekli',
        'Kamera izni olmadan fotoğraf çekemezsiniz. Lütfen ayarlardan izin verin.'
      );
      return false;
    }
  } catch (err) {
    console.warn('Kamera izni hatası:', err);
    return false;
  }
};

/**
 * Galeri/Medya iznini kontrol et ve iste (Android için)
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS için react-native-image-picker otomatik yönetir
  }

  try {
    const apiLevel = Platform.Version as number;
    let permission: string;

    // Android 13+ (API 33+) için READ_MEDIA_IMAGES, daha eski versiyonlar için READ_EXTERNAL_STORAGE
    if (apiLevel >= 33) {
      permission = PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
    } else {
      permission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    }

    const granted = await PermissionsAndroid.request(permission, {
      title: 'Galeri İzni',
      message: 'Uygulama fotoğraf seçmek için galeri iznine ihtiyaç duyuyor.',
      buttonNeutral: 'Daha Sonra',
      buttonNegative: 'İptal',
      buttonPositive: 'İzin Ver',
    });

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    } else {
      Alert.alert(
        'İzin Gerekli',
        'Galeri izni olmadan fotoğraf seçemezsiniz. Lütfen ayarlardan izin verin.'
      );
      return false;
    }
  } catch (err) {
    console.warn('Galeri izni hatası:', err);
    return false;
  }
};

