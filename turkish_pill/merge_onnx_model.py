"""ONNX modeli tek dosyaya birleştir"""
import onnx
from onnx.external_data_helper import load_external_data_for_model, convert_model_to_external_data
from pathlib import Path

model_path = Path("models/classification/classification_150.onnx")
output_path = Path("models/classification/classification_150_merged.onnx")

print("Model birleştiriliyor...")

# Model yükle
model = onnx.load(str(model_path))

# External data'yı yükle
if Path("models/classification/classification_150.onnx.data").exists():
    load_external_data_for_model(model, "models/classification")
    print("[OK] External data yüklendi")

# Modeli tek dosyaya kaydet (external data olmadan)
onnx.save_model(model, str(output_path), save_as_external_data=False)

size_mb = output_path.stat().st_size / (1024 * 1024)
print(f"[OK] Birleşik model kaydedildi: {output_path}")
print(f"     Boyut: {size_mb:.2f} MB")

