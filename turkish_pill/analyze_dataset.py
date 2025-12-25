import os
from pathlib import Path
from PIL import Image
import numpy as np
from collections import Counter

# Veri seti yolu
dataset_path = Path("Mobile-Captured Pharmaceutical Medication Packages")

# Klasörleri listele
folders = [f for f in os.listdir(dataset_path) 
           if os.path.isdir(dataset_path / f) and f != '__pycache__']

print("=" * 80)
print("VERİ SETİ ANALİZ RAPORU")
print("=" * 80)
print(f"\nToplam Klasör Sayısı (Sınıf): {len(folders)}")
print(f"Toplam Görüntü Sayısı: {len(folders) * 26}")

# Görüntü sayılarını kontrol et
image_counts = []
for folder in folders[:10]:  # İlk 10 klasörü kontrol et
    folder_path = dataset_path / folder
    images = list(folder_path.glob("*.jpg")) + list(folder_path.glob("*.JPG"))
    image_counts.append(len(images))
    if len(images) > 0:
        print(f"\n{folder}: {len(images)} görüntü")

# Örnek görüntüleri analiz et
print("\n" + "=" * 80)
print("GÖRÜNTÜ ANALİZİ (İlk 5 örnek)")
print("=" * 80)

widths = []
heights = []
sizes = []
formats = []

sample_count = 0
for folder in folders[:5]:
    folder_path = dataset_path / folder
    images = list(folder_path.glob("*.jpg")) + list(folder_path.glob("*.JPG"))
    
    for img_path in images[:3]:  # Her klasörden 3 görüntü
        try:
            with Image.open(img_path) as img:
                widths.append(img.width)
                heights.append(img.height)
                sizes.append(os.path.getsize(img_path) / (1024 * 1024))  # MB
                formats.append(img.format)
                sample_count += 1
                if sample_count <= 5:
                    print(f"\n{img_path.name}:")
                    print(f"  Boyut: {img.width}x{img.height} piksel")
                    print(f"  Format: {img.format}")
                    print(f"  Dosya Boyutu: {os.path.getsize(img_path) / (1024 * 1024):.2f} MB")
        except Exception as e:
            print(f"Hata ({img_path}): {e}")

if widths:
    print("\n" + "=" * 80)
    print("İSTATİSTİKLER")
    print("=" * 80)
    print(f"\nAnaliz edilen örnek sayısı: {len(widths)}")
    print(f"\nGenişlik (Width):")
    print(f"  Ortalama: {np.mean(widths):.0f} px")
    print(f"  Min: {min(widths)} px")
    print(f"  Max: {max(widths)} px")
    
    print(f"\nYükseklik (Height):")
    print(f"  Ortalama: {np.mean(heights):.0f} px")
    print(f"  Min: {min(heights)} px")
    print(f"  Max: {max(heights)} px")
    
    print(f"\nDosya Boyutu:")
    print(f"  Ortalama: {np.mean(sizes):.2f} MB")
    print(f"  Min: {min(sizes):.2f} MB")
    print(f"  Max: {max(sizes):.2f} MB")
    
    print(f"\nFormat Dağılımı:")
    format_counts = Counter(formats)
    for fmt, count in format_counts.items():
        print(f"  {fmt}: {count}")

print("\n" + "=" * 80)
print("YOLOV8 + VIT İÇİN DEĞERLENDİRME")
print("=" * 80)

