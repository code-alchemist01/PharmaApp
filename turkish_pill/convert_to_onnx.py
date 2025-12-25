"""
Turkish Pill Model (150 sinif) -> ONNX Donusturme Scripti
Hugging Face formatindaki modeli ONNX formatina donusturur ve dogrular

Ozellikler:
- Otomatik en son checkpoint bulma
- Model dogrulama
- PyTorch vs ONNX inference karsilastirmasi
- Detayli hata yonetimi
- Windows encoding sorunlari cozumu
"""

import torch
from transformers import ViTForImageClassification, ViTImageProcessor
import onnx
import onnxruntime as ort
import numpy as np
from pathlib import Path
import yaml
import os
import sys
import io

# Windows konsol encoding sorununu coz
if sys.platform == 'win32':
    import codecs
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def load_config():
    """Config dosyasini yukle"""
    config_path = Path(__file__).parent / 'config.yaml'
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def find_latest_checkpoint(models_dir):
    """En son checkpoint'i bul"""
    models_path = Path(models_dir)
    if not models_path.exists():
        raise FileNotFoundError(f"Model klasoru bulunamadi: {models_dir}")
    
    checkpoints = sorted(
        [d for d in models_path.iterdir() 
         if d.is_dir() and d.name.startswith('checkpoint-')],
        key=lambda x: int(x.name.split('-')[1]) if x.name.split('-')[1].isdigit() else 0,
        reverse=True
    )
    
    if not checkpoints:
        raise FileNotFoundError(f"Checkpoint bulunamadi: {models_dir}")
    
    return checkpoints[0]

def load_model_and_processor(checkpoint_path, model_name):
    """Model ve processor'i yukle"""
    print(f"[1/5] Model yukleniyor: {checkpoint_path.name}")
    
    model = ViTForImageClassification.from_pretrained(
        str(checkpoint_path),
        ignore_mismatched_sizes=True
    )
    model.eval()
    
    processor = ViTImageProcessor.from_pretrained(model_name)
    
    print(f"   [OK] Model yuklendi")
    print(f"   - Sinif sayisi: {model.config.num_labels}")
    print(f"   - Image size: {model.config.image_size}")
    
    return model, processor

def convert_to_onnx(model, processor, output_path, opset_version=17):
    """Modeli ONNX formatina donustur"""
    print(f"\n[2/5] ONNX formatina donusturuluyor...")
    print(f"   Opset version: {opset_version}")
    
    # Dummy input olustur (PIL Image formatinda)
    from PIL import Image
    dummy_image = Image.new('RGB', (224, 224), color='red')
    inputs = processor(dummy_image, return_tensors="pt")
    pixel_values = inputs['pixel_values']
    
    print(f"   Input shape: {pixel_values.shape}")
    
    # ONNX export
    try:
        torch.onnx.export(
            model,
            pixel_values,
            str(output_path),
            input_names=['pixel_values'],
            output_names=['logits'],
            dynamic_axes={
                'pixel_values': {0: 'batch_size'},
                'logits': {0: 'batch_size'}
            },
            opset_version=opset_version,
            do_constant_folding=True,
            export_params=True,
            verbose=False
        )
        
        model_size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"   [OK] ONNX model olusturuldu")
        print(f"   - Dosya: {output_path}")
        print(f"   - Boyut: {model_size_mb:.2f} MB")
        
        return True
    except Exception as e:
        print(f"   [HATA] ONNX donusturme hatasi: {e}")
        # Opset version dusurerek tekrar dene
        if opset_version > 11:
            print(f"   [INFO] Opset {opset_version} basarisiz, opset 11 deneniyor...")
            return convert_to_onnx(model, processor, output_path, opset_version=11)
        raise

def validate_onnx_model(onnx_path):
    """ONNX modelini dogrula"""
    print(f"\n[3/5] ONNX model dogrulanıyor...")
    
    try:
        onnx_model = onnx.load(str(onnx_path))
        onnx.checker.check_model(onnx_model)
        print(f"   [OK] ONNX model gecerli")
        
        # Model bilgileri
        print(f"   - Input sayisi: {len(onnx_model.graph.input)}")
        print(f"   - Output sayisi: {len(onnx_model.graph.output)}")
        
        # Input/Output bilgileri
        for input_tensor in onnx_model.graph.input:
            shape = [dim.dim_value if dim.dim_value > 0 else 'dynamic' 
                    for dim in input_tensor.type.tensor_type.shape.dim]
            print(f"   - Input: {input_tensor.name}, Shape: {shape}")
        
        for output_tensor in onnx_model.graph.output:
            shape = [dim.dim_value if dim.dim_value > 0 else 'dynamic' 
                    for dim in output_tensor.type.tensor_type.shape.dim]
            print(f"   - Output: {output_tensor.name}, Shape: {shape}")
        
        return True
    except Exception as e:
        print(f"   [HATA] ONNX dogrulama hatasi: {e}")
        return False

def compare_inference(pytorch_model, processor, onnx_path, num_tests=3):
    """PyTorch ve ONNX inference sonuclarini karsilastir"""
    print(f"\n[4/5] Inference karsilastirmasi yapiliyor ({num_tests} test)...")
    
    # Test goruntuleri olustur (PIL Image formatinda)
    from PIL import Image
    import numpy as np
    test_images = []
    for _ in range(num_tests):
        # Random RGB image
        img_array = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        img = Image.fromarray(img_array)
        test_images.append(img)
    
    # PyTorch inference
    pytorch_results = []
    with torch.no_grad():
        for img in test_images:
            inputs = processor(img, return_tensors="pt")
            outputs = pytorch_model(**inputs)
            logits = outputs.logits
            pytorch_results.append(logits.numpy())
    
    # ONNX inference
    try:
        ort_session = ort.InferenceSession(str(onnx_path))
        onnx_results = []
        
        for img in test_images:
            inputs = processor(img, return_tensors="pt")
            onnx_input = {ort_session.get_inputs()[0].name: inputs['pixel_values'].numpy()}
            onnx_output = ort_session.run(None, onnx_input)
            onnx_results.append(onnx_output[0])
        
        # Sonuclari karsilastir
        max_diff = 0
        for i, (pt_result, onnx_result) in enumerate(zip(pytorch_results, onnx_results)):
            diff = np.abs(pt_result - onnx_result).max()
            max_diff = max(max_diff, diff)
            
            # En yuksek tahminleri karsilastir
            pt_pred = np.argmax(pt_result, axis=1)[0]
            onnx_pred = np.argmax(onnx_result, axis=1)[0]
            pt_conf = float(np.max(pt_result))
            onnx_conf = float(np.max(onnx_result))
            
            print(f"   Test {i+1}:")
            print(f"     - PyTorch: Sinif {pt_pred}, Confidence {pt_conf:.4f}")
            print(f"     - ONNX:    Sinif {onnx_pred}, Confidence {onnx_conf:.4f}")
            print(f"     - Fark:    {diff:.6f}")
        
        if max_diff < 0.01:
            print(f"   [OK] Inference sonuclari uyumlu (max fark: {max_diff:.6f})")
            return True
        else:
            print(f"   [UYARI] Inference sonuclari farkli (max fark: {max_diff:.6f})")
            return False
            
    except Exception as e:
        print(f"   [HATA] ONNX inference hatasi: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Ana fonksiyon"""
    print("=" * 70)
    print("Turkish Pill Model -> ONNX Donusturme ve Dogrulama")
    print("=" * 70)
    
    try:
        # Config yukle
        config = load_config()
        models_dir = Path(config['models']['classification'])
        model_name = config['classification']['model_name']
        
        # En son checkpoint'i bul
        checkpoint_path = find_latest_checkpoint(models_dir)
        print(f"\nEn son checkpoint: {checkpoint_path.name}")
        
        # Output path
        output_path = models_dir / "classification_150.onnx"
        
        # Model ve processor yukle
        model, processor = load_model_and_processor(checkpoint_path, model_name)
        
        # ONNX'a donustur
        if not convert_to_onnx(model, processor, output_path):
            print("\n[HATA] ONNX donusturme basarisiz!")
            return False
        
        # ONNX modelini dogrula
        if not validate_onnx_model(output_path):
            print("\n[HATA] ONNX dogrulama basarisiz!")
            return False
        
        # Inference karsilastirmasi
        if not compare_inference(model, processor, output_path):
            print("\n[UYARI] Inference karsilastirmasi uyumsuz, ancak model olusturuldu")
        
        # Sonuc
        print("\n" + "=" * 70)
        print("[OK] Donusturme ve dogrulama tamamlandi!")
        print("=" * 70)
        print(f"\nONNX Model: {output_path}")
        print(f"Boyut: {output_path.stat().st_size / (1024 * 1024):.2f} MB")
        print(f"\nSonraki adim:")
        print(f"  Copy-Item \"{output_path}\" \"PharmaApp\\android\\app\\src\\main\\assets\\classification_150.onnx\"")
        
        return True
        
    except Exception as e:
        print(f"\n[HATA] Genel hata: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

