"""
Detection Model ile Görüntü Kırpma
YOLOv8 detection modeli ile tespit edilen ilaç kutularını kırpar ve sınıf bazında kaydeder.
"""

import yaml
from pathlib import Path
from ultralytics import YOLO
from PIL import Image
import numpy as np
import torch
from tqdm import tqdm

def load_config():
    """Config dosyasını yükle"""
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def load_class_names(data_yaml_path):
    """data.yaml'dan sınıf isimlerini yükle"""
    with open(data_yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        return data['names']

def crop_image_with_bbox(image, bbox, padding=10):
    """
    Bounding box ile görüntüyü kırp
    bbox: [x1, y1, x2, y2] formatında (piksel koordinatları)
    padding: Kırpma sırasında eklenen padding (piksel)
    """
    img_width, img_height = image.size
    
    # YOLOv8 zaten piksel koordinatları döndürüyor, direkt kullan
    x1 = int(bbox[0])
    y1 = int(bbox[1])
    x2 = int(bbox[2])
    y2 = int(bbox[3])
    
    # Koordinatları kontrol et ve düzelt
    x1, x2 = min(x1, x2), max(x1, x2)
    y1, y2 = min(y1, y2), max(y1, y2)
    
    # Padding ekle
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(img_width, x2 + padding)
    y2 = min(img_height, y2 + padding)
    
    # Geçerlilik kontrolü
    if x2 <= x1 or y2 <= y1:
        raise ValueError(f"Geçersiz bounding box: ({x1}, {y1}, {x2}, {y2})")
    
    # Kırp
    cropped = image.crop((x1, y1, x2, y2))
    return cropped

def process_dataset(model, dataset_path, split='train', output_path=None, conf_threshold=0.5):
    """
    Veri setindeki görüntüleri işle ve kırp
    """
    if output_path is None:
        config = load_config()
        output_path = Path(config['data']['cropped_path']) / split
    
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Sınıf isimlerini yükle
    data_yaml = Path(dataset_path) / 'data.yaml'
    class_names = load_class_names(data_yaml)
    
    # Her sınıf için klasör oluştur
    for class_name in class_names:
        (output_path / class_name).mkdir(exist_ok=True)
    
    # Görüntü ve label yolları
    images_dir = Path(dataset_path) / split / 'images'
    labels_dir = Path(dataset_path) / split / 'labels'
    
    if not images_dir.exists():
        print(f"⚠ Klasör bulunamadı: {images_dir}")
        return
    
    image_files = list(images_dir.glob('*.jpg')) + list(images_dir.glob('*.png'))
    
    print(f"\n{split.upper()} seti işleniyor...")
    print(f"Toplam görüntü: {len(image_files)}")
    
    cropped_count = 0
    failed_count = 0
    
    for img_path in tqdm(image_files, desc=f"Kırpılıyor ({split})"):
        try:
            # Görüntüyü yükle
            image = Image.open(img_path).convert('RGB')
            
            # Detection yap
            results = model(str(img_path), conf=conf_threshold, verbose=False)
            
            if len(results) == 0 or results[0].boxes is None or len(results[0].boxes) == 0:
                failed_count += 1
                continue
            
            # En yüksek confidence'lı box'ı al
            boxes = results[0].boxes
            if len(boxes) == 0:
                failed_count += 1
                continue
                
            best_box_idx = boxes.conf.argmax().item()
            box = boxes.xyxy[best_box_idx].cpu().numpy()  # [x1, y1, x2, y2]
            
            # Görüntüyü kırp
            try:
                cropped = crop_image_with_bbox(image, box, padding=10)
            except (ValueError, Exception) as e:
                print(f"\n⚠ Hata ({img_path.name}): {e}")
                failed_count += 1
                continue
            
            # Label dosyasını oku (sınıf bilgisi için)
            label_path = labels_dir / (img_path.stem + '.txt')
            class_id = None
            
            if label_path.exists():
                with open(label_path, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        # İlk satırdaki class_id'yi al
                        class_id = int(lines[0].split()[0])
            
            # Eğer label'da sınıf yoksa, detection'dan al
            if class_id is None and len(boxes.cls) > 0:
                class_id = int(boxes.cls[best_box_idx].item())
            
            if class_id is not None and 0 <= class_id < len(class_names):
                class_name = class_names[class_id]
                save_path = output_path / class_name / f"{img_path.stem}_cropped.jpg"
                cropped.save(save_path, quality=95)
                cropped_count += 1
            else:
                failed_count += 1
                
        except Exception as e:
            print(f"\n⚠ Hata ({img_path.name}): {e}")
            failed_count += 1
            continue
    
    print(f"\n✓ Tamamlandı!")
    print(f"  Kırpılan görüntü: {cropped_count}")
    print(f"  Başarısız: {failed_count}")
    print(f"  Kayıt yeri: {output_path}")

def main():
    """Ana fonksiyon"""
    config = load_config()
    
    # Model yolu
    model_path = Path(config['models']['detection'])
    if not model_path.exists():
        # Eğer model yoksa, runs klasöründen dene
        runs_path = Path(config['detection']['project']) / config['detection']['name'] / 'weights' / 'best.pt'
        if runs_path.exists():
            model_path = runs_path
        else:
            raise FileNotFoundError(f"Detection model bulunamadı: {model_path}")
    
    print(f"Model yükleniyor: {model_path}")
    model = YOLO(str(model_path))
    
    # Veri seti yolu
    dataset_path = Path(config['data']['dataset_path'])
    
    # Her split için işle
    for split in ['train', 'valid']:
        process_dataset(
            model=model,
            dataset_path=dataset_path,
            split=split,
            conf_threshold=0.5
        )
    
    print("\n" + "="*50)
    print("Tüm görüntüler kırpıldı!")
    print("="*50)

if __name__ == '__main__':
    if torch.cuda.is_available():
        print(f"✓ CUDA kullanılabilir: {torch.cuda.get_device_name(0)}")
    else:
        print("⚠ CUDA kullanılamıyor, CPU kullanılacak")
    
    main()

