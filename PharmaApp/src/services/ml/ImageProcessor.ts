/**
 * ImageProcessor - Görüntü işleme servisi
 * Görüntü boyutları ve temel işlemler
 */

import { Image } from 'react-native';
import RNFS from 'react-native-fs';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

class ImageProcessor {
  /**
   * Görüntü boyutlarını al
   */
  async getImageDimensions(imageUri: string): Promise<ImageDimensions> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        imageUri,
        (width, height) => {
          resolve({ width, height });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Bounding box'a göre görüntüyü kırp (placeholder)
   */
  async cropImage(
    imageUri: string,
    cropBox: CropBox,
    originalDimensions: ImageDimensions
  ): Promise<string> {
    // Placeholder: Orijinal görüntüyü döndür
    console.log(`[ImageProcessor] Crop requested: x=${cropBox.x}, y=${cropBox.y}, w=${cropBox.width}, h=${cropBox.height}`);
    return imageUri;
  }

  /**
   * Görüntüyü base64'e çevir
   */
  async imageToBase64(imageUri: string): Promise<string> {
    try {
      // File URI'yi base64'e çevir
      if (imageUri.startsWith('file://')) {
        const base64 = await RNFS.readFile(imageUri, 'base64');
        return `data:image/jpeg;base64,${base64}`;
      }
      // Zaten base64 veya data URI ise direkt döndür
      if (imageUri.startsWith('data:')) {
        return imageUri;
      }
      // Diğer durumlarda orijinal URI'yi döndür
      return imageUri;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return imageUri;
    }
  }
}

export default new ImageProcessor();

