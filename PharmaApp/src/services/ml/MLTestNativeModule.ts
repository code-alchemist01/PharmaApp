/**
 * MLTestNativeModule - React Native Native Module Interface (Test için)
 */

import { NativeModules, Platform } from 'react-native';

const { MLTestModule } = NativeModules;

// Debug: Native modül kontrolü (sadece geliştirme modunda)
if (__DEV__ && false) { // Debug log'ları kapatıldı
  console.log('[MLTestNativeModule] Available native modules:', Object.keys(NativeModules));
  console.log('[MLTestNativeModule] MLTestModule:', MLTestModule);
}

export interface DetectionResult {
  detected: boolean;
  detection?: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    classIndex?: number;
  };
}

export interface ClassificationResult {
  classIndex: number;
  confidence: number;
  allPredictions: Array<{
    index: number;
    confidence: number;
  }>;
}

class MLTestNativeModule {
  /**
   * Native modül mevcut mu?
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && MLTestModule != null;
  }

  /**
   * Detection modelini yükle
   */
  async loadDetectionModel(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.loadDetectionModel();
  }

  /**
   * Classification modelini yükle (12 sınıf)
   */
  async loadClassificationModel(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.loadClassificationModel();
  }

  /**
   * 150 sınıflı classification modelini yükle
   */
  async loadClassificationModel150(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.loadClassificationModel150();
  }

  /**
   * Detection inference
   */
  async runDetection(imagePath: string): Promise<DetectionResult> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.runDetection(imagePath);
  }

  /**
   * Classification inference (12 sınıf)
   */
  async runClassification(imagePath: string): Promise<ClassificationResult> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.runClassification(imagePath);
  }

  /**
   * Classification inference (150 sınıf)
   */
  async runClassification150(imagePath: string): Promise<ClassificationResult> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.runClassification150(imagePath);
  }

  /**
   * Classification inference with crop (using detection bounding box) - 12 sınıf
   */
  async runClassificationWithCrop(
    imagePath: string,
    bboxX: number,
    bboxY: number,
    bboxWidth: number,
    bboxHeight: number
  ): Promise<ClassificationResult> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.runClassificationWithCrop(
      imagePath,
      bboxX,
      bboxY,
      bboxWidth,
      bboxHeight
    );
  }

  /**
   * Classification inference with crop (using detection bounding box) - 150 sınıf
   */
  async runClassificationWithCrop150(
    imagePath: string,
    bboxX: number,
    bboxY: number,
    bboxWidth: number,
    bboxHeight: number
  ): Promise<ClassificationResult> {
    if (!this.isAvailable()) {
      throw new Error('MLTest native module not available');
    }
    return await MLTestModule.runClassificationWithCrop150(
      imagePath,
      bboxX,
      bboxY,
      bboxWidth,
      bboxHeight
    );
  }

  /**
   * Modelleri temizle
   */
  dispose(): void {
    if (this.isAvailable()) {
      MLTestModule.dispose();
    }
  }
}

export default new MLTestNativeModule();

