"""
YOLOv8 Detection Model Eğitimi
SAP_BABA_CLEAN veri seti ile ilaç kutusu tespiti için YOLOv8 modeli eğitir.
"""

import yaml
from pathlib import Path
from ultralytics import YOLO
import torch

def load_config():
    """Config dosyasını yükle"""
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def train_detection_model():
    """YOLOv8 detection modelini eğit"""
    config = load_config()
    
    # Veri yolu kontrolü
    dataset_path = Path(config['data']['dataset_path'])
    data_yaml = dataset_path / 'data.yaml'
    
    if not data_yaml.exists():
        raise FileNotFoundError(f"data.yaml bulunamadı: {data_yaml}")
    
    print(f"Veri seti yolu: {dataset_path}")
    print(f"data.yaml: {data_yaml}")
    
    # Model oluştur
    model_size = config['detection']['model_size']
    model = YOLO(f'yolov8{model_size}.pt')
    
    print(f"Model: YOLOv8{model_size}")
    print(f"Epochs: {config['detection']['epochs']}")
    print(f"Batch size: {config['detection']['batch_size']}")
    print(f"Image size: {config['detection']['image_size']}")
    
    # Eğitim parametreleri
    train_params = {
        'data': str(data_yaml),
        'epochs': config['detection']['epochs'],
        'batch': config['detection']['batch_size'],
        'imgsz': config['detection']['image_size'],
        'lr0': config['detection']['learning_rate'],
        'device': config['detection']['device'],
        'project': config['detection']['project'],
        'name': config['detection']['name'],
        'save': True,
        'save_period': 10,  # Her 10 epoch'ta bir kaydet
        'val': True,  # Validation yap
        'plots': True,  # Grafikleri oluştur
    }
    
    # Eğitimi başlat
    print("\n" + "="*50)
    print("YOLOv8 Detection Model Eğitimi Başlıyor...")
    print("="*50 + "\n")
    
    results = model.train(**train_params)
    
    # En iyi modeli kaydet
    best_model_path = Path(config['detection']['project']) / config['detection']['name'] / 'weights' / 'best.pt'
    save_dir = Path(config['detection']['save_dir'])
    save_dir.mkdir(parents=True, exist_ok=True)
    
    if best_model_path.exists():
        import shutil
        shutil.copy(best_model_path, save_dir / 'best.pt')
        print(f"\n✓ En iyi model kaydedildi: {save_dir / 'best.pt'}")
    else:
        print(f"\n⚠ UYARI: Best model bulunamadı: {best_model_path}")
    
    print("\n" + "="*50)
    print("Eğitim Tamamlandı!")
    print("="*50)
    
    return results

if __name__ == '__main__':
    # CUDA kontrolü
    if torch.cuda.is_available():
        print(f"✓ CUDA kullanılabilir: {torch.cuda.get_device_name(0)}")
    else:
        print("⚠ CUDA kullanılamıyor, CPU kullanılacak")
    
    train_detection_model()

