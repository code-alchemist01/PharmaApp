/**
 * DrugVerificationScreen - İlaç alma onayı ekranı
 * Bildirim geldiğinde açılır, fotoğraf çekme ve doğrulama yapar
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Chip } from 'react-native-paper';
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LocalDatabase, { Drug, Alarm, History } from '../../services/database/LocalDatabase';
import MLService from '../../services/ml/MLService';
import { findMatchingDrug } from '../../services/ml/DrugNameNormalizer';
import { generateUUID, requestCameraPermission, requestMediaPermission } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import FirestoreService from '../../services/database/FirestoreService';

type DrugVerificationScreenRouteProp = RouteProp<
  { DrugVerification: { alarmId?: string; drugId?: string; drugName?: string } },
  'DrugVerification'
>;
type DrugVerificationScreenNavigationProp = StackNavigationProp<any, 'DrugVerification'>;

const DrugVerificationScreen: React.FC = () => {
  const navigation = useNavigation<DrugVerificationScreenNavigationProp>();
  const route = useRoute<DrugVerificationScreenRouteProp>();
  const { user } = useAuth();
  const { alarmId, drugId, drugName: routeDrugName } = route.params || {};

  const [drug, setDrug] = useState<Drug | null>(null);
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    recognizedDrug?: string;
    confidence?: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false); // İşlem yapılıyor mu kontrolü
  const [isCompleted, setIsCompleted] = useState(false); // İşlem tamamlandı mı kontrolü

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Drug ve alarm yüklendikten sonra kontrol et
    if (drug && alarmId) {
      checkIfAlreadyProcessed();
    }
  }, [drug, alarmId]);

  // Eğer alarmId yoksa (İlaçlarım sayfasından geldiyse), sayfayı kapat
  useEffect(() => {
    if (!alarmId && drug) {
      // İlaçlarım sayfasından direkt gelmişse, sayfayı kapat
      Alert.alert(
        'Bilgi',
        'Bu sayfa sadece alarm bildirimlerinden açılabilir.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              setIsCompleted(true);
              navigation.navigate('DrugList');
            },
          },
        ]
      );
    }
  }, [alarmId, drug, navigation]);

  const checkIfAlreadyProcessed = async () => {
    if (!alarmId) return;
    
    try {
      const hasHistory = await LocalDatabase.hasHistoryForAlarmToday(alarmId);
      if (hasHistory) {
        // Bugün için zaten kayıt varsa ekranı kapat
        setIsCompleted(true);
        Alert.alert(
          'Bilgi',
          'Bu ilaç bugün zaten alındı veya kaçırıldı.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                // DrugList'e dön
                navigation.navigate('DrugList');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking history:', error);
    }
  };

  const loadData = async () => {
    try {
      if (drugId) {
        const drugData = await LocalDatabase.getDrugById(drugId);
        setDrug(drugData);
      }
      if (alarmId) {
        const alarmData = await LocalDatabase.getAlarmById(alarmId);
        setAlarm(alarmData);
        if (alarmData && !drugId) {
          const drugData = await LocalDatabase.getDrugById(alarmData.drug_id);
          setDrug(drugData);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
    }
  };

  const handleImagePick = async (type: 'camera' | 'library') => {
    // İzin kontrolü
    if (type === 'camera') {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        return;
      }
    } else {
      const hasPermission = await requestMediaPermission();
      if (!hasPermission) {
        return;
      }
    }

    let response: ImagePickerResponse;
    if (type === 'camera') {
      response = await launchCamera({ mediaType: 'photo', includeBase64: true });
    } else {
      response = await launchImageLibrary({ mediaType: 'photo', includeBase64: true });
    }

    if (response.didCancel) {
      return;
    } else if (response.errorMessage) {
      Alert.alert('Hata', 'Görsel seçilemedi: ' + response.errorMessage);
    } else if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      setImageUri(asset.uri || null);
      setImageBase64(asset.base64 || null);
      setVerificationResult(null);
    }
  };

  const handleVerify = async () => {
    // İşlem zaten yapılıyorsa veya tamamlandıysa tekrar çalıştırma
    if (isProcessing) {
      return;
    }

    if (!imageUri || !drug) {
      Alert.alert('Uyarı', 'Lütfen önce bir fotoğraf çekin.');
      return;
    }

    // Bugün için zaten alınmış mı kontrol et
    const alreadyTaken = await LocalDatabase.isDrugTakenToday(drug.id, alarmId);
    if (alreadyTaken) {
      Alert.alert(
        'Uyarı',
        'Bu ilaç bugün zaten alındı veya kaçırıldı. Yarın tekrar alabilirsiniz.',
        [
          {
            text: 'Tamam',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    setIsProcessing(true);
    setVerifying(true);
    setVerificationResult(null);

    try {
      // Birleştirilmiş ML model ile tanıma
      const result = await MLService.inferCombined(imageUri);
      
      if (result.error || !result.classification) {
        throw new Error(result.error || 'İlaç tanınamadı');
      }

      const recognized = String(result.classification.className);
      const confidence = result.classification.confidence;
      
      // Normalize edilmiş eşleştirme yap
      const isMatch = findMatchingDrug(recognized, drug.name);

      setVerificationResult({
        success: isMatch,
        recognizedDrug: recognized,
        confidence: confidence,
      });

      if (isMatch) {
        // Tekrar kontrol et (race condition önleme)
        const stillNotTaken = !(await LocalDatabase.isDrugTakenToday(drug.id, alarmId));
        if (!stillNotTaken) {
          Alert.alert(
            'Uyarı',
            'Bu ilaç az önce alındı. Lütfen tekrar deneyin.',
            [
              {
                text: 'Tamam',
                onPress: () => navigation.goBack(),
              },
            ]
          );
          setIsProcessing(false);
          setVerifying(false);
          return;
        }

        // Başarılı - geçmişe kaydet
        await saveHistory('taken');
        
        // İşlem tamamlandı olarak işaretle
        setIsCompleted(true);
        
        // Alert göster ve await et, sonra ekranı kapat
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Başarılı',
            `${drug.name} ilacı başarıyla doğrulandı ve kaydedildi.`,
            [
              {
                text: 'Tamam',
                onPress: () => {
                  resolve();
                },
              },
            ]
          );
        });
        setIsProcessing(false);
        // DrugList'e dön
        navigation.navigate('DrugList');
      } else {
        // Doğrulama başarısız - kullanıcı tekrar deneyebilir (ama sadece 3 kez)
        setIsProcessing(false);
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Doğrulama Başarısız',
            `Tanınan ilaç: ${recognized}\nBeklenen ilaç: ${drug.name}\n\nLütfen doğru ilacın fotoğrafını çekin veya "Bugün Kullanmayacağım" butonuna basın.`,
            [
              {
                text: 'Tamam',
                onPress: () => {
                  resolve();
                },
              },
            ]
          );
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Hata',
          'Doğrulama sırasında bir sorun oluştu.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                resolve();
              },
            },
          ]
        );
      });
      setIsProcessing(false);
    } finally {
      setVerifying(false);
    }
  };

  const saveHistory = async (status: 'taken' | 'missed' | 'pending') => {
    if (!drug || !user) return;

    try {
      // Eğer "taken" kaydediliyorsa ve alarmId varsa, bugün için varsa "missed" kaydını sil
      if (status === 'taken' && alarmId) {
        try {
          // Bugün için bu alarm'a ait "missed" kayıtlarını bul ve sil
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          todayStart.setMilliseconds(0);
          const todayEnd = new Date(todayStart);
          todayEnd.setHours(23, 59, 59, 999);
          
          const allHistory = await LocalDatabase.getAllHistory();
          const todayMissedRecords = allHistory.filter((h) => {
            if (h.alarm_id !== alarmId) return false;
            if (h.status !== 'missed') return false;
            const takenDate = new Date(h.taken_at);
            return takenDate >= todayStart && takenDate <= todayEnd;
          });
          
          // Bugün için "missed" kayıtlarını sil
          for (const missedRecord of todayMissedRecords) {
            await LocalDatabase.deleteHistory(missedRecord.id);
            console.log(`[DrugVerification] Deleted missed record: ${missedRecord.id}`);
          }
        } catch (error) {
          console.error('Error deleting missed records:', error);
          // Hata olsa bile devam et
        }
      }

      const historyEntry: History = {
        id: generateUUID(),
        drug_id: drug.id,
        alarm_id: alarmId || null,
        taken_at: Date.now(),
        photo_base64: imageBase64 || null,
        verified: verificationResult?.success ? 1 : 0,
        status: status,
        created_at: Date.now(),
      };

      // Local database'e kaydet
      await LocalDatabase.addHistory(historyEntry);

      // Firestore'a senkronize et
      if (user.uid) {
        await FirestoreService.addHistory(historyEntry);
      }
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const handleSkip = async () => {
    // İşlem zaten yapılıyorsa veya tamamlandıysa tekrar çalıştırma
    if (isProcessing) {
      return;
    }

    // Bugün için zaten kayıt var mı kontrol et
    if (alarmId) {
      const hasHistory = await LocalDatabase.hasHistoryForAlarmToday(alarmId);
      if (hasHistory) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Uyarı',
            'Bu ilaç bugün zaten işaretlendi.',
            [
              {
                text: 'Tamam',
                onPress: () => {
                  resolve();
                },
              },
            ]
          );
        });
        navigation.goBack();
        return;
      }
    }

    // Onay sorusu - await et
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'İlacı Atla',
        'Bu ilacı bugün kullanmayacak mısınız?',
        [
          { 
            text: 'İptal', 
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Evet, Bugün Kullanmayacağım',
            onPress: () => resolve(true),
          },
        ]
      );
    });

    if (!confirmed) {
      return; // Kullanıcı iptal etti
    }

    // Onaylandı - kaydet
    setIsProcessing(true);
    try {
      await saveHistory('missed');
      
      // Kaydedildi mesajını göster ve await et
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Kaydedildi',
          'İlaç bugün kullanılmayacak olarak işaretlendi.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                resolve();
              },
            },
          ]
        );
      });
      
      setIsCompleted(true);
      setIsProcessing(false);
      // DrugList'e dön
      navigation.navigate('DrugList');
    } catch (error) {
      console.error('Error saving missed:', error);
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Hata',
          'Kayıt sırasında bir sorun oluştu.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                resolve();
              },
            },
          ]
        );
      });
      setIsProcessing(false);
    }
  };

  const displayName = routeDrugName || drug?.name || 'İlaç';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.title}>
              İlaç Alma Onayı
            </Text>
            <Text variant="titleLarge" style={styles.drugName}>
              {displayName}
            </Text>
            {alarm && (
              <Text variant="bodyMedium" style={styles.alarmTime}>
                Alarm: {alarm.time}
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Fotoğraf Çekin
            </Text>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              İlacın fotoğrafını çekerek doğrulama yapın
            </Text>

            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <Button
                  mode="outlined"
                  onPress={() => {
                    setImageUri(null);
                    setImageBase64(null);
                  }}
                  style={styles.removeImageButton}>
                  Fotoğrafı Kaldır
                </Button>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Fotoğraf yok</Text>
              </View>
            )}

            <View style={styles.imageButtons}>
              <Button
                mode="contained"
                onPress={() => handleImagePick('camera')}
                icon="camera"
                style={styles.imageButton}>
                Kamera
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleImagePick('library')}
                icon="image-multiple"
                style={styles.imageButton}>
                Galeri
              </Button>
            </View>
          </Card.Content>
        </Card>

        {verificationResult && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Doğrulama Sonucu
              </Text>
              <Chip
                icon={verificationResult.success ? 'check-circle' : 'close-circle'}
                style={[
                  styles.resultChip,
                  verificationResult.success ? styles.successChip : styles.failChip,
                ]}>
                {verificationResult.success ? 'Doğrulandı' : 'Doğrulanamadı'}
              </Chip>
              {verificationResult.recognizedDrug && (
                <Text variant="bodyMedium" style={styles.resultText}>
                  Tanınan: {verificationResult.recognizedDrug}
                </Text>
              )}
              {verificationResult.confidence && (
                <Text variant="bodySmall" style={styles.confidenceText}>
                  Güven: %{Math.round(verificationResult.confidence * 100)}
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {!isCompleted && (
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              onPress={handleVerify}
              loading={verifying}
              disabled={verifying || !imageUri || isProcessing || isCompleted}
              style={styles.verifyButton}>
              Doğrula
            </Button>
            <Button 
              mode="outlined" 
              onPress={handleSkip} 
              disabled={isProcessing || isCompleted}
              style={styles.skipButton}>
              Bugün Kullanmayacağım
            </Button>
          </View>
        )}
        {isCompleted && (
          <View style={styles.actionButtons}>
            <Text style={styles.completedText}>
              İşlem tamamlandı. Sayfa kapanıyor...
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  drugName: {
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    color: '#6200ee',
    fontWeight: 'bold',
  },
  alarmTime: {
    textAlign: 'center',
    color: 'gray',
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  sectionDescription: {
    marginBottom: 16,
    color: 'gray',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: 300,
    height: 300,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  imagePlaceholderText: {
    color: 'gray',
    fontSize: 16,
  },
  removeImageButton: {
    marginTop: 8,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imageButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  resultChip: {
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  successChip: {
    backgroundColor: '#c8e6c9',
  },
  failChip: {
    backgroundColor: '#ffcdd2',
  },
  resultText: {
    marginTop: 8,
  },
  confidenceText: {
    marginTop: 4,
    color: 'gray',
  },
  expectedText: {
    marginTop: 8,
    color: '#6200ee',
    fontWeight: 'bold',
  },
  actionButtons: {
    marginTop: 16,
  },
  verifyButton: {
    marginBottom: 8,
  },
  skipButton: {
    marginTop: 8,
  },
  completedText: {
    textAlign: 'center',
    color: 'gray',
    fontStyle: 'italic',
    marginTop: 16,
  },
});

export default DrugVerificationScreen;

