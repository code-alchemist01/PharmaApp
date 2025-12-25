/**
 * MLService - Machine Learning servisi
 * Gerçek ONNX modelleri kullanarak inference yapar
 * 12 sınıflı ve 150 sınıflı modelleri birleştirerek kullanır
 */

import { DRUG_CLASSES, DRUG_CLASSES_150, DrugClass } from '../../utils/constants';
import MLTestNativeModule from './MLTestNativeModule';
import { normalizeDrugName } from './DrugNameNormalizer';

export interface DetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface ClassificationResult {
  className: DrugClass | string; // 12 sınıflı için DrugClass, 150 sınıflı için string
  confidence: number;
  allPredictions: Array<{ className: DrugClass | string; confidence: number; source?: '12-class' | '150-class' }>;
  source?: '12-class' | '150-class' | 'combined';
}

export interface InferenceResult {
  detected: boolean;
  detection?: DetectionResult;
  classification?: ClassificationResult;
  error?: string;
}

class MLService {
  private modelsLoaded12 = false;
  private modelsLoaded150 = false;

  /**
   * 12 sınıflı modelleri yükle
   */
  async loadModels12(): Promise<void> {
    if (this.modelsLoaded12) {
      return;
    }

    try {
      if (!MLTestNativeModule.isAvailable()) {
        throw new Error('Native modül mevcut değil');
      }

      await MLTestNativeModule.loadDetectionModel();
      await MLTestNativeModule.loadClassificationModel();
      
      this.modelsLoaded12 = true;
    } catch (error: any) {
      console.error('[MLService] 12-class model loading error:', error);
      this.modelsLoaded12 = false;
      throw new Error(`12-class model yükleme hatası: ${error.message}`);
    }
  }

  /**
   * 150 sınıflı modeli yükle
   */
  async loadModels150(): Promise<void> {
    if (this.modelsLoaded150) {
      return;
    }

    try {
      if (!MLTestNativeModule.isAvailable()) {
        throw new Error('Native modül mevcut değil');
      }

      await MLTestNativeModule.loadClassificationModel150();
      
      this.modelsLoaded150 = true;
    } catch (error: any) {
      console.error('[MLService] 150-class model loading error:', error);
      this.modelsLoaded150 = false;
      throw new Error(`150-class model yükleme hatası: ${error.message}`);
    }
  }

  /**
   * Tüm modelleri yükle (12 sınıflı + 150 sınıflı)
   * Optimizasyon: Bir model yüklenemezse diğeriyle devam et
   */
  async loadModels(): Promise<void> {
    try {
      // 12 sınıflı modeli önce yükle (zorunlu)
      await this.loadModels12();
      
      // 150 sınıflı modeli arka planda yükle (opsiyonel)
      this.loadModels150().catch((error) => {
        console.warn('[MLService] 150-class model yüklenemedi, 12-class model ile devam ediliyor:', error.message);
        this.modelsLoaded150 = false;
      });
      
      console.log('[MLService] Models loading initiated');
    } catch (error: any) {
      console.error('[MLService] Model loading error:', error);
      // 12 sınıflı model yüklenemezse hata fırlat
      throw error;
    }
  }

  /**
   * Görüntüden ilaç tespiti yap
   */
  async detectDrug(imageUri: string): Promise<DetectionResult | null> {
    try {
      if (!this.modelsLoaded12) {
        await this.loadModels12();
      }

      // Görüntü yolunu temizle
      let cleanPath = imageUri;
      if (imageUri.startsWith('file://')) {
        cleanPath = imageUri.replace('file://', '');
      }

      const result = await MLTestNativeModule.runDetection(cleanPath);
      
      if (result && result.detected && result.detection) {
        return {
          x: result.detection.x,
          y: result.detection.y,
          width: result.detection.width,
          height: result.detection.height,
          confidence: result.detection.confidence,
        };
      }

      return null;
    } catch (error: any) {
      // Sessizce hata yut, detection başarısız olabilir
      return null;
    }
  }

  /**
   * 12 sınıflı model ile crop ile classification
   */
  private async classifyWithCrop12(
    imageUri: string,
    detection: DetectionResult
  ): Promise<ClassificationResult | null> {
    try {
      if (!this.modelsLoaded12) {
        await this.loadModels12();
      }

      let cleanPath = imageUri;
      if (imageUri.startsWith('file://')) {
        cleanPath = imageUri.replace('file://', '');
      }

      const result = await MLTestNativeModule.runClassificationWithCrop(
        cleanPath,
        detection.x,
        detection.y,
        detection.width,
        detection.height
      );

      if (result && result.classIndex !== undefined) {
        const className = DRUG_CLASSES[result.classIndex] || DRUG_CLASSES[0];
        
        const allPredictions = result.allPredictions.map((pred: any) => ({
          className: DRUG_CLASSES[pred.index] || DRUG_CLASSES[0],
          confidence: pred.confidence,
          source: '12-class' as const,
        }));

        return {
          className: className as DrugClass,
          confidence: result.confidence,
          allPredictions: allPredictions.slice(0, 5),
          source: '12-class',
        };
      }

      return null;
    } catch (error: any) {
      // 12 sınıflı model hatası - sessizce null döndür
      return null;
    }
  }

  /**
   * 150 sınıflı model ile crop ile classification
   */
  private async classifyWithCrop150(
    imageUri: string,
    detection: DetectionResult
  ): Promise<ClassificationResult | null> {
    try {
      if (!this.modelsLoaded150) {
        await this.loadModels150();
      }

      let cleanPath = imageUri;
      if (imageUri.startsWith('file://')) {
        cleanPath = imageUri.replace('file://', '');
      }

      const result = await MLTestNativeModule.runClassificationWithCrop150(
        cleanPath,
        detection.x,
        detection.y,
        detection.width,
        detection.height
      );

      if (result && result.classIndex !== undefined) {
        const className = DRUG_CLASSES_150[result.classIndex] || DRUG_CLASSES_150[0];
        
        const allPredictions = result.allPredictions.map((pred: any) => ({
          className: DRUG_CLASSES_150[pred.index] || DRUG_CLASSES_150[0],
          confidence: pred.confidence,
          source: '150-class' as const,
        }));

        return {
          className: className,
          confidence: result.confidence,
          allPredictions: allPredictions.slice(0, 5),
          source: '150-class',
        };
      }

      return null;
    } catch (error: any) {
      // 150 sınıflı model hatası - sessizce null döndür
      return null;
    }
  }

  /**
   * Sonuçları birleştir (12 sınıflı + 150 sınıflı)
   * Optimizasyon: Duplicate'leri kaldır, confidence'a göre sırala
   */
  private mergeResults(
    result12: ClassificationResult | null,
    result150: ClassificationResult | null,
    detection: DetectionResult
  ): InferenceResult {
    const allPredictions: Array<{ className: string; confidence: number; source: '12-class' | '150-class' }> = [];
    const seen = new Set<string>(); // Duplicate kontrolü için

    // 12 sınıflı sonuçları ekle
    if (result12 && result12.allPredictions.length > 0) {
      result12.allPredictions.forEach(pred => {
        const normalizedName = normalizeDrugName(String(pred.className));
        if (!seen.has(normalizedName)) {
          seen.add(normalizedName);
          allPredictions.push({
            className: String(pred.className),
            confidence: pred.confidence,
            source: '12-class',
          });
        }
      });
    }

    // 150 sınıflı sonuçları ekle
    if (result150 && result150.allPredictions.length > 0) {
      result150.allPredictions.forEach(pred => {
        const normalizedName = normalizeDrugName(String(pred.className));
        if (!seen.has(normalizedName)) {
          seen.add(normalizedName);
          allPredictions.push({
            className: String(pred.className),
            confidence: pred.confidence,
            source: '150-class',
          });
        } else {
          // Duplicate varsa, daha yüksek confidence'ı kullan
          const existingIndex = allPredictions.findIndex(
            p => normalizeDrugName(p.className) === normalizedName
          );
          if (existingIndex >= 0 && pred.confidence > allPredictions[existingIndex].confidence) {
            allPredictions[existingIndex] = {
              className: String(pred.className),
              confidence: pred.confidence,
              source: '150-class', // Daha yüksek confidence varsa 150 sınıflıyı tercih et
            };
          }
        }
      });
    }

    // Confidence'a göre sırala
    allPredictions.sort((a, b) => b.confidence - a.confidence);

    // En yüksek confidence'a sahip sonucu seç
    const bestMatch = allPredictions[0];

    if (!bestMatch) {
      return {
        detected: true,
        detection,
        error: 'Sınıflandırma sonucu bulunamadı',
      };
    }

    const classification: ClassificationResult = {
      className: bestMatch.className,
      confidence: bestMatch.confidence,
      allPredictions: allPredictions.slice(0, 5),
      source: 'combined',
    };

    return {
      detected: true,
      detection,
      classification,
    };
  }

  /**
   * Birleştirilmiş inference (12 sınıflı + 150 sınıflı)
   * Optimizasyon: Mevcut modelleri kullan, hata durumunda fallback
   */
  async inferCombined(imageUri: string): Promise<InferenceResult> {
    try {
      // 1. Detection
      const detection = await this.detectDrug(imageUri);
      
      if (!detection) {
        return {
          detected: false,
          error: 'İlaç tespit edilemedi',
        };
      }

      // 2. Mevcut modelleri paralel çalıştır
      const promises: Array<Promise<ClassificationResult | null>> = [];
      const promiseIndices: { index: number; type: '12' | '150' }[] = [];
      
      if (this.modelsLoaded12) {
        promiseIndices.push({ index: promises.length, type: '12' });
        promises.push(this.classifyWithCrop12(imageUri, detection));
      }
      
      if (this.modelsLoaded150) {
        promiseIndices.push({ index: promises.length, type: '150' });
        promises.push(this.classifyWithCrop150(imageUri, detection));
      }

      // Hiç model yüklü değilse hata döndür
      if (promises.length === 0) {
        return {
          detected: true,
          detection,
          error: 'Hiçbir model yüklü değil',
        };
      }

      // Paralel çalıştır ve sonuçları al
      const results = await Promise.allSettled(promises);
      
      let result12: ClassificationResult | null = null;
      let result150: ClassificationResult | null = null;
      
      promiseIndices.forEach(({ index, type }) => {
        const result = results[index];
        if (result.status === 'fulfilled' && result.value) {
          if (type === '12') {
            result12 = result.value;
          } else {
            result150 = result.value;
          }
        }
      });

      // 3. Sonuçları birleştir
      return this.mergeResults(result12, result150, detection);
    } catch (error: any) {
      console.error('[MLService] Combined inference error:', error);
      return {
        detected: false,
        error: error.message || 'Inference hatası',
      };
    }
  }

  /**
   * Kırpılmış görüntüden ilaç sınıflandırması yap
   * NOT: Bu fonksiyon crop olmadan çalışır, sadece görüntüyü resize eder
   */
  async classifyDrug(imageUri: string): Promise<ClassificationResult> {
    try {
      if (!this.modelsLoaded12) {
        await this.loadModels12();
      }

      // Görüntü yolunu temizle
      let cleanPath = imageUri;
      if (imageUri.startsWith('file://')) {
        cleanPath = imageUri.replace('file://', '');
      }

      const result = await MLTestNativeModule.runClassification(cleanPath);
      
      if (result && result.classIndex !== undefined) {
        const className = DRUG_CLASSES[result.classIndex] || DRUG_CLASSES[0];
        
        const allPredictions = result.allPredictions.map((pred: any) => ({
          className: DRUG_CLASSES[pred.index] || DRUG_CLASSES[0],
          confidence: pred.confidence,
        }));

        return {
          className: className as DrugClass,
          confidence: result.confidence,
          allPredictions: allPredictions.slice(0, 3) as Array<{ className: DrugClass; confidence: number }>,
        };
      }

      throw new Error('Classification sonuç döndürmedi');
    } catch (error: any) {
      console.error('[MLService] Classification error:', error);
      // Hata durumunda ilk ilacı döndür (fallback)
      return {
        className: DRUG_CLASSES[0],
        confidence: 0.0,
        allPredictions: [],
      };
    }
  }

  /**
   * Tam inference pipeline (Detection + Classification with Crop)
   * ÖNEMLİ: Bu fonksiyon detection bounding box'ı kullanarak crop yapar
   * Classification doğruluğu için bu pipeline'ı kullanın
   * NOT: Artık birleştirilmiş model kullanıyor (inferCombined)
   */
  async infer(imageUri: string): Promise<InferenceResult> {
    // Birleştirilmiş inference kullan
    return this.inferCombined(imageUri);
  }

  /**
   * Modeller yüklü mü?
   */
  areModelsLoaded(): boolean {
    return this.modelsLoaded12 || this.modelsLoaded150;
  }

  /**
   * İlaç tanıma (recognizeDrug - DrugVerificationScreen için)
   * Birleştirilmiş pipeline kullanarak en yüksek confidence ile ilaç adını döndürür
   */
  async recognizeDrug(imageUri: string): Promise<string> {
    try {
      const result = await this.inferCombined(imageUri);
      
      if (result.error || !result.classification) {
        // Hata durumunda boş string döndür
        return '';
      }

      return String(result.classification.className);
    } catch (error: any) {
      console.error('[MLService] Recognize drug error:', error);
      // Hata durumunda boş string döndür
      return '';
    }
  }
}

export default new MLService();
