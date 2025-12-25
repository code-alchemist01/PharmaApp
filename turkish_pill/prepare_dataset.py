"""
Veri setini train/val/test olarak böl ve organize et
Klasör tabanlı veri setini ImageFolder formatına hazırlar
"""

import os
import shutil
from pathlib import Path
from sklearn.model_selection import train_test_split
import yaml

def prepare_dataset(source_dir, output_dir, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
    """
    Klasör tabanlı veri setini train/val/test olarak böl
    
    Args:
        source_dir: Kaynak klasör (Mobile-Captured Pharmaceutical Medication Packages)
        output_dir: Çıktı klasörü (data/)
        train_ratio: Train oranı (default: 0.7)
        val_ratio: Validation oranı (default: 0.15)
        test_ratio: Test oranı (default: 0.15)
    """
    source_path = Path(source_dir)
    output_path = Path(output_dir)
    
    # Çıktı klasörlerini oluştur
    train_path = output_path / 'train'
    val_path = output_path / 'valid'
    test_path = output_path / 'test'
    
    train_path.mkdir(parents=True, exist_ok=True)
    val_path.mkdir(parents=True, exist_ok=True)
    test_path.mkdir(parents=True, exist_ok=True)
    
    # Tüm sınıf klasörlerini bul
    class_folders = [f for f in source_path.iterdir() if f.is_dir()]
    class_names = sorted([f.name for f in class_folders])
    
    print(f"Toplam sınıf sayısı: {len(class_names)}")
    print(f"Train: {train_ratio*100:.1f}%, Val: {val_ratio*100:.1f}%, Test: {test_ratio*100:.1f}%")
    
    # Her sınıf için işle
    all_stats = []
    
    for class_name in class_names:
        class_folder = source_path / class_name
        
        # Görüntü dosyalarını bul
        image_files = list(class_folder.glob('*.jpg')) + list(class_folder.glob('*.JPG'))
        
        if len(image_files) == 0:
            print(f"[WARN] Uyari: {class_name} klasorunde goruntu bulunamadi")
            continue
        
        # Train/Val/Test split
        # Önce train ve temp (val+test) ayır
        train_files, temp_files = train_test_split(
            image_files, 
            test_size=(val_ratio + test_ratio),
            random_state=42,
            shuffle=True
        )
        
        # Sonra val ve test ayır
        val_size = val_ratio / (val_ratio + test_ratio)
        val_files, test_files = train_test_split(
            temp_files,
            test_size=(1 - val_size),
            random_state=42,
            shuffle=True
        )
        
        # Klasörleri oluştur
        (train_path / class_name).mkdir(parents=True, exist_ok=True)
        (val_path / class_name).mkdir(parents=True, exist_ok=True)
        (test_path / class_name).mkdir(parents=True, exist_ok=True)
        
        # Dosyaları kopyala
        for img_file in train_files:
            shutil.copy2(img_file, train_path / class_name / img_file.name)
        
        for img_file in val_files:
            shutil.copy2(img_file, val_path / class_name / img_file.name)
        
        for img_file in test_files:
            shutil.copy2(img_file, test_path / class_name / img_file.name)
        
        stats = {
            'class': class_name,
            'total': len(image_files),
            'train': len(train_files),
            'val': len(val_files),
            'test': len(test_files)
        }
        all_stats.append(stats)
        
        print(f"[OK] {class_name}: {len(image_files)} goruntu -> Train:{len(train_files)} Val:{len(val_files)} Test:{len(test_files)}")
    
    # data.yaml oluştur
    data_yaml = {
        'names': class_names,
        'nc': len(class_names),
        'train': str(train_path.relative_to(output_path)),
        'val': str(val_path.relative_to(output_path)),
        'test': str(test_path.relative_to(output_path))
    }
    
    yaml_path = output_path / 'data.yaml'
    with open(yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(data_yaml, f, allow_unicode=True, default_flow_style=False)
    
    print(f"\n[OK] data.yaml olusturuldu: {yaml_path}")
    
    # İstatistikleri yazdır
    total_images = sum(s['total'] for s in all_stats)
    total_train = sum(s['train'] for s in all_stats)
    total_val = sum(s['val'] for s in all_stats)
    total_test = sum(s['test'] for s in all_stats)
    
    print("\n" + "="*60)
    print("ÖZET İSTATİSTİKLER")
    print("="*60)
    print(f"Toplam Sınıf: {len(class_names)}")
    print(f"Toplam Görüntü: {total_images}")
    print(f"Train: {total_train} ({total_train/total_images*100:.1f}%)")
    print(f"Validation: {total_val} ({total_val/total_images*100:.1f}%)")
    print(f"Test: {total_test} ({total_test/total_images*100:.1f}%)")
    print("="*60)
    
    return output_path

if __name__ == '__main__':
    source = "Mobile-Captured Pharmaceutical Medication Packages"
    output = "data"
    
    print("Veri seti hazırlanıyor...")
    print(f"Kaynak: {source}")
    print(f"Çıktı: {output}\n")
    
    prepare_dataset(source, output)

