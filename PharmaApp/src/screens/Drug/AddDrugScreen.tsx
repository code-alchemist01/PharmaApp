/**
 * AddDrugScreen - İlaç ekleme ekranı
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Text, Button, Card, TextInput, ActivityIndicator, Chip } from 'react-native-paper';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MLService, { InferenceResult } from '../../services/ml/MLService';
import LocalDatabase, { Drug } from '../../services/database/LocalDatabase';
import FirestoreService from '../../services/database/FirestoreService';
import { DRUG_CLASSES, DrugClass } from '../../utils/constants';
import { generateId, base64ToUri, requestCameraPermission, requestMediaPermission } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { DrugStackParamList } from '../../navigation/AppNavigator';

type AddDrugScreenRouteProp = RouteProp<DrugStackParamList, 'AddDrug'>;
type AddDrugScreenNavigationProp = StackNavigationProp<DrugStackParamList, 'AddDrug'>;

const AddDrugScreen: React.FC = () => {
  const navigation = useNavigation<AddDrugScreenNavigationProp>();
  const route = useRoute<AddDrugScreenRouteProp>();
  const { user } = useAuth();
  const { drugId } = route.params || {};
  const isEditMode = !!drugId;

  const [drug, setDrug] = useState<Drug | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [selectedDrug, setSelectedDrug] = useState<DrugClass | null>(null);
  const [manualDrugName, setManualDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [showManualSelection, setShowManualSelection] = useState(false);
  const [useManualName, setUseManualName] = useState(false);

  // Edit modunda ilaç bilgilerini yükle
  useEffect(() => {
    if (isEditMode && drugId) {
      loadDrugData();
    }
  }, [drugId, isEditMode]);

  const loadDrugData = async () => {
    if (!drugId) return;
    try {
      const drugData = await LocalDatabase.getDrugById(drugId);
      if (drugData) {
        setDrug(drugData);
        setManualDrugName(drugData.name);
        setDosage(drugData.dosage || '');
        if (drugData.image_base64) {
          setImageBase64(drugData.image_base64);
          setImageUri(base64ToUri(drugData.image_base64));
        }
        // İlaç adı DRUG_CLASSES içindeyse seçili yap, değilse manuel isim kullan
        if (DRUG_CLASSES.includes(drugData.name as DrugClass)) {
          setSelectedDrug(drugData.name as DrugClass);
          setUseManualName(false);
        } else {
          // Manuel isim kullanılıyor
          setUseManualName(true);
        }
      }
    } catch (error) {
      console.error('Error loading drug data:', error);
      Alert.alert('Hata', 'İlaç bilgileri yüklenirken bir sorun oluştu');
    }
  };

  const handleImagePicker = async () => {
    Alert.alert(
      'Fotoğraf Seç',
      'Fotoğrafı nereden almak istersiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kamera',
          onPress: async () => {
            const hasPermission = await requestCameraPermission();
            if (hasPermission) {
              launchCamera(
                {
                  mediaType: 'photo',
                  quality: 0.8,
                  includeBase64: true,
                },
                handleImageResponse
              );
            }
          },
        },
        {
          text: 'Galeri',
          onPress: async () => {
            const hasPermission = await requestMediaPermission();
            if (hasPermission) {
              launchImageLibrary(
                {
                  mediaType: 'photo',
                  quality: 0.8,
                  includeBase64: true,
                },
                handleImageResponse
              );
            }
          },
        },
      ]
    );
  };

  const handleImageResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) {
      return;
    }

    const asset = response.assets?.[0];
    if (asset?.uri && asset.base64) {
      setImageUri(asset.uri);
      setImageBase64(asset.base64);
      setInferenceResult(null);
      setSelectedDrug(null);
      setShowManualSelection(false);
    }
  };

  const handleProcessImage = async () => {
    if (!imageUri || !imageBase64) {
      Alert.alert('Hata', 'Lütfen önce bir fotoğraf seçin');
      return;
    }

    setProcessing(true);
    setInferenceResult(null);

    try {
      const result = await MLService.infer(imageUri);

      setInferenceResult(result);

      if (result.detected && result.classification) {
        // Otomatik tanıma başarılı
        setSelectedDrug(result.classification.className);
        setShowManualSelection(false);
      } else {
        // Otomatik tanıma başarısız, manuel seçim göster
        setShowManualSelection(true);
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Görüntü işlenirken bir hata oluştu');
      setShowManualSelection(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    // Edit modunda: Manuel isim her zaman kullanılır
    // Ekleme modunda: Manuel isim veya seçili ilaç olmalı
    let drugName: string;
    
    if (isEditMode) {
      // Edit modunda manuel isim zorunlu
      if (!manualDrugName.trim()) {
        Alert.alert('Hata', 'Lütfen ilaç adını girin');
        return;
      }
      drugName = manualDrugName.trim();
    } else {
      // Ekleme modunda
      if (useManualName) {
        if (!manualDrugName.trim()) {
          Alert.alert('Hata', 'Lütfen ilaç adını girin');
          return;
        }
        drugName = manualDrugName.trim();
      } else {
        if (!selectedDrug) {
          Alert.alert('Hata', 'Lütfen bir ilaç seçin veya manuel isim girin');
          return;
        }
        drugName = selectedDrug;
      }
    }

    if (!imageBase64) {
      Alert.alert('Hata', 'Fotoğraf bulunamadı');
      return;
    }

    setLoading(true);

    try {
      const now = Date.now();
      const currentDrugId = isEditMode && drug ? drug.id : generateId();

      const drugData: Drug = {
        id: currentDrugId,
        name: drugName,
        dosage: dosage.trim() || undefined,
        image_base64: imageBase64,
        created_at: isEditMode && drug ? drug.created_at : now,
        updated_at: now,
      };

      if (isEditMode) {
        // Güncelleme modu
        await LocalDatabase.updateDrug(drugData);
        await LocalDatabase.updateSyncStatus('drugs', currentDrugId, false);

        // Firestore'a senkronize et
        if (user?.uid) {
          try {
            await FirestoreService.updateDrug(drugData);
            await LocalDatabase.updateSyncStatus('drugs', currentDrugId, true);
          } catch (error) {
            console.error('Firestore sync error:', error);
          }
        }

        // Alert'i göster ve await et, sonra navigation yap
        await new Promise<void>((resolve) => {
          Alert.alert('Başarılı', 'İlaç başarıyla güncellendi', [
            {
              text: 'Tamam',
              onPress: () => {
                resolve();
              },
            },
          ]);
        });
        navigation.goBack();
      } else {
        // Ekleme modu
        await LocalDatabase.addDrug(drugData);
        await LocalDatabase.updateSyncStatus('drugs', currentDrugId, false);

        // Firestore'a senkronize et
        if (user?.uid) {
          try {
            await FirestoreService.addDrug(drugData);
            await LocalDatabase.updateSyncStatus('drugs', currentDrugId, true);
          } catch (error) {
            console.error('Firestore sync error:', error);
          }
        }

        // Alert'i göster ve await et, sonra navigation yap
        await new Promise<void>((resolve) => {
          Alert.alert('Başarılı', 'İlaç başarıyla eklendi', [
            {
              text: 'Tamam',
              onPress: () => {
                resolve();
              },
            },
          ]);
        });
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || (isEditMode ? 'İlaç güncellenemedi' : 'İlaç kaydedilemedi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              {isEditMode ? 'İlaç Düzenle' : 'Yeni İlaç Ekle'}
            </Text>

            {!imageUri ? (
              <View style={styles.imagePlaceholder}>
                <Text variant="bodyMedium" style={styles.placeholderText}>
                  Fotoğraf seçin veya çekin
                </Text>
                <Button
                  mode="contained"
                  onPress={handleImagePicker}
                  icon="camera"
                  style={styles.imageButton}>
                  Fotoğraf Seç
                </Button>
              </View>
            ) : (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <View style={styles.imageActions}>
                  <Button
                    mode="outlined"
                    onPress={handleImagePicker}
                    icon="camera"
                    compact>
                    Değiştir
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleProcessImage}
                    loading={processing}
                    disabled={processing}
                    icon="magnify"
                    compact>
                    {processing ? 'İşleniyor...' : 'Tanı'}
                  </Button>
                </View>
              </View>
            )}

            {processing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#6200ee" />
                <Text style={styles.processingText}>Görüntü analiz ediliyor...</Text>
              </View>
            )}

            {inferenceResult && (
              <View style={styles.resultContainer}>
                {inferenceResult.detected && inferenceResult.classification ? (
                  <>
                    <Text variant="titleMedium" style={styles.resultTitle}>
                      Tanınan İlaç:
                    </Text>
                    <Chip
                      icon="check-circle"
                      style={styles.resultChip}
                      selectedColor="#2e7d32">
                      {inferenceResult.classification.className} (
                      {(inferenceResult.classification.confidence * 100).toFixed(1)}%)
                    </Chip>
                    {inferenceResult.classification.allPredictions.length > 1 && (
                      <Text variant="bodySmall" style={styles.otherPredictions}>
                        Diğer olasılıklar:
                      </Text>
                    )}
                  </>
                ) : (
                  <Text variant="bodyMedium" style={styles.errorText}>
                    {inferenceResult.error || 'İlaç tanınamadı'}
                  </Text>
                )}
              </View>
            )}

            {showManualSelection && (
              <View style={styles.manualSelection}>
                <Text variant="titleMedium" style={styles.manualTitle}>
                  Manuel Seçim:
                </Text>
                <View style={styles.drugChips}>
                  {DRUG_CLASSES.map((drug) => (
                    <Chip
                      key={drug}
                      selected={selectedDrug === drug}
                      onPress={() => setSelectedDrug(drug)}
                      style={styles.drugChip}>
                      {drug}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* Edit modunda veya ilaç seçildiğinde/manuel isim aktifken göster */}
            {(isEditMode || selectedDrug || useManualName) && (
              <>
                {/* Edit modunda: Her zaman manuel isim input'u göster */}
                {isEditMode ? (
                  <>
                    <TextInput
                      label="İlaç Adı"
                      value={manualDrugName}
                      onChangeText={(text) => {
                        setManualDrugName(text);
                        setUseManualName(true);
                        // Manuel isim girildiğinde otomatik seçimi temizle
                        if (text.trim() && selectedDrug) {
                          setSelectedDrug(null);
                        }
                      }}
                      mode="outlined"
                      placeholder="İlaç adını girin"
                      style={styles.input}
                    />
                    <Text variant="bodySmall" style={styles.helperText}>
                      İsterseniz yeni bir fotoğraf çekip otomatik tanıma yapabilirsiniz
                    </Text>
                  </>
                ) : (
                  <>
                    {/* Ekleme modunda: Toggle butonu ile manuel isim */}
                    <View style={styles.manualNameContainer}>
                      <Text variant="bodyMedium" style={styles.manualNameLabel}>
                        Manuel İsim Girişi (Opsiyonel)
                      </Text>
                      <Button
                        mode={useManualName ? 'contained' : 'outlined'}
                        onPress={() => {
                          setUseManualName(!useManualName);
                          if (!useManualName) {
                            setManualDrugName('');
                          } else {
                            // Manuel isim aktif edildiğinde otomatik seçimi temizle
                            setSelectedDrug(null);
                          }
                        }}
                        icon={useManualName ? 'check' : 'pencil'}
                        compact>
                        {useManualName ? 'Manuel İsim Aktif' : 'Manuel İsim Kullan'}
                      </Button>
                    </View>
                    {useManualName && (
                      <TextInput
                        label="İlaç Adı"
                        value={manualDrugName}
                        onChangeText={setManualDrugName}
                        mode="outlined"
                        placeholder="İlaç adını girin"
                        style={styles.input}
                      />
                    )}
                  </>
                )}
                <TextInput
                  label="Dozaj (Opsiyonel)"
                  value={dosage}
                  onChangeText={setDosage}
                  mode="outlined"
                  placeholder="Örn: 500mg, 1 tablet"
                  style={styles.input}
                />
              </>
            )}

            {/* Kaydet butonu: Edit modunda veya ilaç seçildiğinde/manuel isim aktifken göster */}
            {(isEditMode || selectedDrug || (useManualName && manualDrugName.trim())) && (
              <Button
                mode="contained"
                onPress={handleSave}
                loading={loading}
                disabled={loading}
                style={styles.saveButton}>
                {isEditMode ? 'Güncelle' : 'Kaydet'}
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
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholderText: {
    marginBottom: 16,
    color: 'gray',
  },
  imageButton: {
    marginTop: 8,
  },
  imageContainer: {
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    marginTop: 8,
    color: 'gray',
  },
  resultContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  resultTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  resultChip: {
    marginBottom: 8,
  },
  otherPredictions: {
    marginTop: 8,
    color: 'gray',
  },
  errorText: {
    color: '#d32f2f',
  },
  manualSelection: {
    marginTop: 16,
  },
  manualTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  drugChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  drugChip: {
    margin: 4,
  },
  input: {
    marginTop: 16,
    marginBottom: 16,
  },
  helperText: {
    color: 'gray',
    marginTop: -8,
    marginBottom: 8,
    fontSize: 12,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default AddDrugScreen;

