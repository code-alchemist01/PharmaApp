"""
Turkish Pill Model (150 sınıf) → ONNX Dönüştürme Scripti
Hugging Face formatındaki modeli ONNX formatına dönüştürür
"""

import torch
from transformers import ViTForImageClassification, ViTImageProcessor
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType
import os
from pathlib import Path

# Model yolu
MODEL_PATH = r"C:\Users\excalibur\Desktop\Projeler\AI Real Project\turkish_pill\models\classification\checkpoint-10350"
OUTPUT_DIR = r"C:\Users\excalibur\Desktop\Projeler\AI Real Project\turkish_pill\models\classification"
ONNX_MODEL_PATH = os.path.join(OUTPUT_DIR, "classification_150.onnx")
ONNX_QUANTIZED_PATH = os.path.join(OUTPUT_DIR, "classification_150_quantized.onnx")

def convert_to_onnx():
    """Hugging Face modelini ONNX formatına dönüştür"""
    
    print("=" * 60)
    print("Turkish Pill Model → ONNX Dönüştürme")
    print("=" * 60)
    
    # 1. Model yükle
    print("\n[1/5] Model yükleniyor...")
    try:
        model = ViTForImageClassification.from_pretrained(MODEL_PATH)
        model.eval()
        print(f"✅ Model yüklendi: {MODEL_PATH}")
        print(f"   Sınıf sayısı: {model.config.num_labels}")
    except Exception as e:
        print(f"❌ Model yükleme hatası: {e}")
        return False
    
    # 2. Dummy input oluştur
    print("\n[2/5] Dummy input oluşturuluyor...")
    # ViT input: [batch, channels, height, width] = [1, 3, 224, 224]
    dummy_input = torch.randn(1, 3, 224, 224)
    print(f"✅ Dummy input: {dummy_input.shape}")
    
    # 3. ONNX'a dönüştür
    print("\n[3/5] ONNX formatına dönüştürülüyor...")
    try:
        torch.onnx.export(
            model,
            dummy_input,
            ONNX_MODEL_PATH,
            input_names=['pixel_values'],
            output_names=['logits'],
            dynamic_axes={
                'pixel_values': {0: 'batch'},
                'logits': {0: 'batch'}
            },
            opset_version=11,
            do_constant_folding=True,
            verbose=False
        )
        
        # Model boyutunu kontrol et
        model_size_mb = os.path.getsize(ONNX_MODEL_PATH) / (1024 * 1024)
        print(f"✅ ONNX model oluşturuldu: {ONNX_MODEL_PATH}")
        print(f"   Model boyutu: {model_size_mb:.2f} MB")
    except Exception as e:
        print(f"❌ ONNX dönüştürme hatası: {e}")
        return False
    
    # 4. ONNX modelini doğrula
    print("\n[4/5] ONNX model doğrulanıyor...")
    try:
        onnx_model = onnx.load(ONNX_MODEL_PATH)
        onnx.checker.check_model(onnx_model)
        print("✅ ONNX model geçerli")
    except Exception as e:
        print(f"⚠️ ONNX doğrulama uyarısı: {e}")
    
    # 5. Quantization (opsiyonel ama önerilir)
    print("\n[5/5] Quantization yapılıyor (INT8)...")
    try:
        quantize_dynamic(
            ONNX_MODEL_PATH,
            ONNX_QUANTIZED_PATH,
            weight_type=QuantType.QUInt8
        )
        
        quantized_size_mb = os.path.getsize(ONNX_QUANTIZED_PATH) / (1024 * 1024)
        reduction = ((model_size_mb - quantized_size_mb) / model_size_mb) * 100
        print(f"✅ Quantized model oluşturuldu: {ONNX_QUANTIZED_PATH}")
        print(f"   Quantized boyut: {quantized_size_mb:.2f} MB")
        print(f"   Boyut azalması: %{reduction:.1f}")
    except Exception as e:
        print(f"⚠️ Quantization hatası: {e}")
        print("   Quantization olmadan devam edilebilir")
    
    print("\n" + "=" * 60)
    print("✅ Dönüştürme tamamlandı!")
    print("=" * 60)
    print(f"\n📁 Çıktı dosyaları:")
    print(f"   - Full model: {ONNX_MODEL_PATH}")
    if os.path.exists(ONNX_QUANTIZED_PATH):
        print(f"   - Quantized model: {ONNX_QUANTIZED_PATH} (ÖNERİLEN)")
    print(f"\n💡 Sonraki adım: Model dosyasını PharmaApp/assets/ klasörüne kopyalayın")
    
    return True

if __name__ == "__main__":
    success = convert_to_onnx()
    if not success:
        print("\n❌ Dönüştürme başarısız!")
        exit(1)

