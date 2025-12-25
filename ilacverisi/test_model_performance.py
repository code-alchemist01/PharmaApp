"""
Model Performans Test Scripti
Test setindeki tüm görüntüleri test eder ve detaylı rapor hazırlar.
"""

import yaml
from pathlib import Path
from PIL import Image
import torch
import numpy as np
from collections import defaultdict, Counter
from sklearn.metrics import confusion_matrix, classification_report, accuracy_score
import sys
from tqdm import tqdm
import pandas as pd

# src klasörünü path'e ekle
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from inference import MedicineInference

def load_class_names(data_yaml_path):
    """Sınıf isimlerini yükle"""
    with open(data_yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return data['names']

def load_test_labels(labels_dir, class_names):
    """Test setindeki label dosyalarını yükle"""
    labels = {}
    label_files = list(labels_dir.glob('*.txt'))
    
    for label_file in label_files:
        image_name = label_file.stem
        with open(label_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if lines:
            # İlk satırdaki class_id'yi al (YOLO formatı: class_id x_center y_center width height)
            first_line = lines[0].strip().split()
            if first_line:
                class_id = int(first_line[0])
                class_name = class_names[class_id]
                labels[image_name] = class_name
    
    return labels

def test_model_on_test_set():
    """Test setinde model performansını test et"""
    
    print("="*70)
    print("MODEL PERFORMANS TESTİ BAŞLIYOR")
    print("="*70)
    
    # Config ve yolları yükle
    config_path = Path('config.yaml')
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    dataset_path = Path(config['data']['dataset_path'])
    data_yaml_path = dataset_path / 'data.yaml'
    test_images_dir = dataset_path / 'test' / 'images'
    test_labels_dir = dataset_path / 'test' / 'labels'
    
    # Sınıf isimlerini yükle
    class_names = load_class_names(data_yaml_path)
    num_classes = len(class_names)
    print(f"\n✓ Sınıf sayısı: {num_classes}")
    print(f"✓ Sınıflar: {', '.join(class_names)}")
    
    # Test label'larını yükle
    print(f"\n📂 Test label'ları yükleniyor...")
    true_labels = load_test_labels(test_labels_dir, class_names)
    print(f"✓ {len(true_labels)} görüntü için label bulundu")
    
    # Test görüntülerini yükle
    image_files = list(test_images_dir.glob('*.jpg')) + list(test_images_dir.glob('*.png'))
    print(f"✓ {len(image_files)} test görüntüsü bulundu")
    
    # Inference pipeline'ı başlat
    print(f"\n🤖 Inference modeli yükleniyor...")
    try:
        inference = MedicineInference()
        print("✓ Model yüklendi")
    except Exception as e:
        print(f"❌ Model yükleme hatası: {e}")
        return
    
    # Test işlemi
    print(f"\n🧪 Test işlemi başlıyor...")
    print("-"*70)
    
    results = []
    correct_predictions = 0
    total_predictions = 0
    failed_detections = 0
    
    # Her görüntü için test yap
    for img_path in tqdm(image_files, desc="Test ediliyor"):
        image_name = img_path.stem
        
        # Gerçek sınıf
        if image_name not in true_labels:
            continue
        
        true_class = true_labels[image_name]
        
        # Görüntüyü yükle
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"⚠ Görüntü yükleme hatası ({image_name}): {e}")
            continue
        
        # Tahmin yap
        try:
            result = inference.predict(
                image,
                return_image=False,
                use_ocr=False,
                conf_threshold=0.3  # Düşük threshold ile daha fazla tespit
            )
        except Exception as e:
            print(f"⚠ Tahmin hatası ({image_name}): {e}")
            continue
        
        # Sonuçları kaydet
        predicted_class = result.get('class_name')
        confidence = result.get('confidence', 0.0)
        det_confidence = result.get('detection_confidence', 0.0)
        has_error = result.get('error') is not None
        
        if has_error or predicted_class is None:
            failed_detections += 1
            predicted_class = "DETECTION_FAILED"
            is_correct = False
        else:
            is_correct = (predicted_class == true_class)
            if is_correct:
                correct_predictions += 1
            total_predictions += 1
        
        results.append({
            'image_name': image_name,
            'true_class': true_class,
            'predicted_class': predicted_class,
            'is_correct': is_correct,
            'confidence': confidence,
            'detection_confidence': det_confidence,
            'failed_detection': has_error
        })
    
    # Rapor hazırlama
    print("\n" + "="*70)
    print("TEST SONUÇLARI")
    print("="*70)
    
    total_images = len(results)
    successful_detections = total_predictions
    accuracy = (correct_predictions / successful_detections * 100) if successful_detections > 0 else 0
    
    print(f"\n📊 Genel İstatistikler:")
    print(f"  • Toplam test görüntüsü: {total_images}")
    print(f"  • Başarılı tespit: {successful_detections}")
    print(f"  • Tespit başarısız: {failed_detections}")
    print(f"  • Doğru tahmin: {correct_predictions}")
    print(f"  • Yanlış tahmin: {successful_detections - correct_predictions}")
    print(f"  • Genel Doğruluk: {accuracy:.2f}%")
    print(f"  • Tespit Başarı Oranı: {(successful_detections/total_images*100):.2f}%")
    
    # Sınıf bazında analiz
    print(f"\n📈 Sınıf Bazında Performans:")
    print("-"*70)
    
    class_stats = defaultdict(lambda: {'correct': 0, 'total': 0, 'failed': 0, 'wrong_predictions': []})
    
    for result in results:
        true_class = result['true_class']
        predicted_class = result['predicted_class']
        is_correct = result['is_correct']
        failed = result['failed_detection']
        
        class_stats[true_class]['total'] += 1
        if failed:
            class_stats[true_class]['failed'] += 1
        else:
            if is_correct:
                class_stats[true_class]['correct'] += 1
            else:
                class_stats[true_class]['wrong_predictions'].append({
                    'image': result['image_name'],
                    'predicted': predicted_class,
                    'confidence': result['confidence']
                })
    
    # Sınıf bazında detaylı rapor
    class_report_data = []
    for class_name in sorted(class_names):
        stats = class_stats[class_name]
        total = stats['total']
        correct = stats['correct']
        failed = stats['failed']
        successful = total - failed
        class_accuracy = (correct / successful * 100) if successful > 0 else 0
        
        class_report_data.append({
            'Sınıf': class_name,
            'Toplam': total,
            'Başarılı Tespit': successful,
            'Tespit Başarısız': failed,
            'Doğru': correct,
            'Yanlış': successful - correct,
            'Doğruluk (%)': f"{class_accuracy:.2f}%"
        })
        
        print(f"\n  {class_name}:")
        print(f"    • Toplam: {total}")
        print(f"    • Başarılı tespit: {successful} ({(successful/total*100):.1f}%)")
        print(f"    • Tespit başarısız: {failed} ({(failed/total*100):.1f}%)")
        print(f"    • Doğru tahmin: {correct}/{successful} ({class_accuracy:.1f}%)")
        if stats['wrong_predictions']:
            print(f"    • Yanlış tahminler:")
            for wrong in stats['wrong_predictions'][:5]:  # İlk 5 yanlış tahmin
                print(f"      - {wrong['image']}: {wrong['predicted']} (güven: {wrong['confidence']:.2%})")
            if len(stats['wrong_predictions']) > 5:
                print(f"      ... ve {len(stats['wrong_predictions']) - 5} tane daha")
    
    # Confusion Matrix (sadece başarılı tespitler için)
    print(f"\n📊 Confusion Matrix:")
    print("-"*70)
    
    y_true = []
    y_pred = []
    
    for result in results:
        if not result['failed_detection']:
            y_true.append(result['true_class'])
            y_pred.append(result['predicted_class'])
    
    if y_true and y_pred:
        cm = confusion_matrix(y_true, y_pred, labels=class_names)
        cm_df = pd.DataFrame(cm, index=class_names, columns=class_names)
        print("\n" + cm_df.to_string())
        
        # Classification Report
        print(f"\n📋 Detaylı Classification Report:")
        print("-"*70)
        report = classification_report(y_true, y_pred, labels=class_names, target_names=class_names, zero_division=0)
        print(report)
    
    # Hata analizi
    print(f"\n❌ Hata Analizi:")
    print("-"*70)
    
    wrong_predictions = [r for r in results if not r['is_correct'] and not r['failed_detection']]
    failed_predictions = [r for r in results if r['failed_detection']]
    
    print(f"\n  Yanlış Tahminler ({len(wrong_predictions)} adet):")
    error_patterns = defaultdict(int)
    for result in wrong_predictions:
        pattern = f"{result['true_class']} -> {result['predicted_class']}"
        error_patterns[pattern] += 1
    
    for pattern, count in sorted(error_patterns.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"    • {pattern}: {count} kez")
    
    print(f"\n  Tespit Başarısız ({len(failed_predictions)} adet):")
    failed_by_class = Counter([r['true_class'] for r in failed_predictions])
    for class_name, count in sorted(failed_by_class.items(), key=lambda x: x[1], reverse=True):
        print(f"    • {class_name}: {count} kez")
    
    # Raporu dosyaya kaydet
    report_path = Path('MODEL_TEST_RAPORU.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# Model Performans Test Raporu\n\n")
        f.write("## Genel İstatistikler\n\n")
        f.write(f"- **Toplam Test Görüntüsü:** {total_images}\n")
        f.write(f"- **Başarılı Tespit:** {successful_detections} ({(successful_detections/total_images*100):.2f}%)\n")
        f.write(f"- **Tespit Başarısız:** {failed_detections} ({(failed_detections/total_images*100):.2f}%)\n")
        f.write(f"- **Doğru Tahmin:** {correct_predictions}\n")
        f.write(f"- **Yanlış Tahmin:** {successful_detections - correct_predictions}\n")
        f.write(f"- **Genel Doğruluk:** {accuracy:.2f}%\n\n")
        
        f.write("## Sınıf Bazında Performans\n\n")
        f.write("| Sınıf | Toplam | Başarılı Tespit | Tespit Başarısız | Doğru | Yanlış | Doğruluk (%) |\n")
        f.write("|-------|--------|-----------------|------------------|-------|--------|-------------|\n")
        for row in class_report_data:
            f.write(f"| {row['Sınıf']} | {row['Toplam']} | {row['Başarılı Tespit']} | {row['Tespit Başarısız']} | {row['Doğru']} | {row['Yanlış']} | {row['Doğruluk (%)']} |\n")
        
        f.write("\n## Hata Analizi\n\n")
        f.write("### En Sık Yapılan Yanlış Tahminler\n\n")
        for pattern, count in sorted(error_patterns.items(), key=lambda x: x[1], reverse=True)[:10]:
            f.write(f"- {pattern}: {count} kez\n")
        
        f.write("\n### Tespit Başarısız Olan Sınıflar\n\n")
        for class_name, count in sorted(failed_by_class.items(), key=lambda x: x[1], reverse=True):
            f.write(f"- {class_name}: {count} kez\n")
    
    print(f"\n✓ Rapor kaydedildi: {report_path}")
    
    # CSV olarak da kaydet
    results_df = pd.DataFrame(results)
    csv_path = Path('test_results.csv')
    results_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"✓ Detaylı sonuçlar CSV olarak kaydedildi: {csv_path}")
    
    print("\n" + "="*70)
    print("TEST TAMAMLANDI!")
    print("="*70)

if __name__ == '__main__':
    test_model_on_test_set()

