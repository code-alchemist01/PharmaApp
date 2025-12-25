"""
Model Test Scripti
Test ve Validation setlerinde model performansını değerlendirir
"""

import yaml
from pathlib import Path
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import ViTForImageClassification, ViTImageProcessor
from PIL import Image
import numpy as np
from sklearn.metrics import (
    accuracy_score, 
    precision_recall_fscore_support, 
    confusion_matrix,
    classification_report
)
from collections import Counter
import pandas as pd
from tqdm import tqdm
import json

# CUDA ayarları
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

def load_config():
    """Config dosyasını yükle"""
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def load_class_names(data_yaml_path):
    """Sınıf isimlerini yükle"""
    with open(data_yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        return data['names']

def find_latest_checkpoint(models_dir):
    """En son checkpoint'i bul"""
    checkpoints = sorted(
        [d for d in Path(models_dir).iterdir() 
         if d.is_dir() and d.name.startswith('checkpoint-')],
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )
    if checkpoints:
        return checkpoints[0]
    return None

class MedicineDataset(Dataset):
    """Test için Dataset"""
    
    def __init__(self, dataset_path, split='test', processor=None, class_names=None):
        self.dataset_path = Path(dataset_path)
        self.split = split
        self.processor = processor
        self.class_names = class_names or []
        
        self.images = []
        self.labels = []
        
        for class_idx, class_name in enumerate(self.class_names):
            class_dir = self.dataset_path / split / class_name
            if class_dir.exists():
                image_files = list(class_dir.glob('*.jpg')) + list(class_dir.glob('*.JPG'))
                for img_path in image_files:
                    self.images.append(img_path)
                    self.labels.append(class_idx)
        
        print(f"{split.upper()} seti: {len(self.images)} görüntü, {len(self.class_names)} sınıf")
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        image_path = self.images[idx]
        label = self.labels[idx]
        
        image = Image.open(image_path).convert('RGB')
        
        if self.processor:
            inputs = self.processor(image, return_tensors="pt")
            pixel_values = inputs['pixel_values'].squeeze(0)
        else:
            from torchvision import transforms
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            pixel_values = transform(image)
        
        return {
            'pixel_values': pixel_values,
            'labels': torch.tensor(label, dtype=torch.long),
            'image_path': str(image_path)
        }

def test_model(model, processor, dataset, class_names, split_name):
    """Modeli test et"""
    model.eval()
    
    all_predictions = []
    all_labels = []
    all_probs = []
    all_paths = []
    
    dataloader = DataLoader(dataset, batch_size=16, shuffle=False, num_workers=0)
    
    print(f"\n{split_name} seti test ediliyor...")
    with torch.no_grad():
        for batch in tqdm(dataloader, desc=f"Testing {split_name}"):
            pixel_values = batch['pixel_values'].to(device)
            labels = batch['labels'].to(device)
            paths = batch['image_path']
            
            outputs = model(pixel_values=pixel_values)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
            predictions = torch.argmax(logits, dim=-1)
            
            all_predictions.extend(predictions.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            all_probs.extend(probs.cpu().numpy())
            all_paths.extend(paths)
    
    # Metrikleri hesapla
    accuracy = accuracy_score(all_labels, all_predictions)
    precision, recall, f1, support = precision_recall_fscore_support(
        all_labels, all_predictions, average=None, zero_division=0
    )
    
    # Weighted averages
    precision_weighted = precision_recall_fscore_support(
        all_labels, all_predictions, average='weighted', zero_division=0
    )[0]
    recall_weighted = precision_recall_fscore_support(
        all_labels, all_predictions, average='weighted', zero_division=0
    )[1]
    f1_weighted = precision_recall_fscore_support(
        all_labels, all_predictions, average='weighted', zero_division=0
    )[2]
    
    # Confusion matrix
    cm = confusion_matrix(all_labels, all_predictions)
    
    # Sınıf bazında detaylar
    class_results = []
    for i, class_name in enumerate(class_names):
        if i < len(precision):
            class_results.append({
                'class': class_name,
                'precision': precision[i],
                'recall': recall[i],
                'f1': f1[i],
                'support': support[i] if i < len(support) else 0
            })
    
    # Hatalı tahminler
    errors = []
    for i, (true_label, pred_label, path, prob) in enumerate(zip(all_labels, all_predictions, all_paths, all_probs)):
        if true_label != pred_label:
            errors.append({
                'image_path': path,
                'true_class': class_names[true_label],
                'predicted_class': class_names[pred_label],
                'confidence': float(prob[pred_label]),
                'true_class_prob': float(prob[true_label])
            })
    
    return {
        'accuracy': accuracy,
        'precision_weighted': precision_weighted,
        'recall_weighted': recall_weighted,
        'f1_weighted': f1_weighted,
        'precision_per_class': precision,
        'recall_per_class': recall,
        'f1_per_class': f1,
        'support': support,
        'confusion_matrix': cm,
        'class_results': class_results,
        'errors': errors,
        'total_samples': len(all_labels),
        'correct_predictions': sum(1 for t, p in zip(all_labels, all_predictions) if t == p),
        'wrong_predictions': len(errors)
    }

def generate_report(test_results, val_results, class_names, output_file='test_report.md'):
    """Detaylı rapor oluştur"""
    
    report = []
    report.append("# Model Test Raporu\n")
    report.append("="*80 + "\n")
    
    # Genel Özet
    report.append("## Genel Özet\n")
    report.append(f"- **Toplam Sınıf Sayısı**: {len(class_names)}\n")
    report.append(f"- **Test Seti Örnek Sayısı**: {test_results['total_samples']}\n")
    report.append(f"- **Validation Seti Örnek Sayısı**: {val_results['total_samples']}\n\n")
    
    # Test Seti Sonuçları
    report.append("## Test Seti Sonuçları\n")
    report.append(f"- **Accuracy**: {test_results['accuracy']:.4f} ({test_results['accuracy']*100:.2f}%)\n")
    report.append(f"- **Precision (Weighted)**: {test_results['precision_weighted']:.4f}\n")
    report.append(f"- **Recall (Weighted)**: {test_results['recall_weighted']:.4f}\n")
    report.append(f"- **F1 Score (Weighted)**: {test_results['f1_weighted']:.4f}\n")
    report.append(f"- **Doğru Tahmin**: {test_results['correct_predictions']}/{test_results['total_samples']}\n")
    report.append(f"- **Yanlış Tahmin**: {test_results['wrong_predictions']}/{test_results['total_samples']}\n\n")
    
    # Validation Seti Sonuçları
    report.append("## Validation Seti Sonuçları\n")
    report.append(f"- **Accuracy**: {val_results['accuracy']:.4f} ({val_results['accuracy']*100:.2f}%)\n")
    report.append(f"- **Precision (Weighted)**: {val_results['precision_weighted']:.4f}\n")
    report.append(f"- **Recall (Weighted)**: {val_results['recall_weighted']:.4f}\n")
    report.append(f"- **F1 Score (Weighted)**: {val_results['f1_weighted']:.4f}\n")
    report.append(f"- **Doğru Tahmin**: {val_results['correct_predictions']}/{val_results['total_samples']}\n")
    report.append(f"- **Yanlış Tahmin**: {val_results['wrong_predictions']}/{val_results['total_samples']}\n\n")
    
    # Sınıf Bazında Performans (Test)
    report.append("## Sınıf Bazında Performans (Test Seti)\n")
    report.append("| Sınıf | Precision | Recall | F1 | Support |\n")
    report.append("|-------|-----------|--------|----|---------|\n")
    
    for result in test_results['class_results']:
        report.append(f"| {result['class']} | {result['precision']:.4f} | {result['recall']:.4f} | {result['f1']:.4f} | {result['support']} |\n")
    
    # Hatalı Tahminler (Test)
    if test_results['errors']:
        report.append("\n## Hatalı Tahminler (Test Seti - İlk 20)\n")
        report.append("| Görüntü | Gerçek Sınıf | Tahmin Edilen | Güven | Gerçek Sınıf Güveni |\n")
        report.append("|---------|--------------|---------------|-------|---------------------|\n")
        
        for error in test_results['errors'][:20]:
            img_name = Path(error['image_path']).name
            report.append(f"| {img_name} | {error['true_class']} | {error['predicted_class']} | {error['confidence']:.4f} | {error['true_class_prob']:.4f} |\n")
        
        if len(test_results['errors']) > 20:
            report.append(f"\n*Toplam {len(test_results['errors'])} hatalı tahmin var (sadece ilk 20 gösterildi)*\n")
    
    # Değerlendirme
    report.append("\n## Değerlendirme\n")
    
    if test_results['accuracy'] >= 0.95:
        report.append("✓ **MÜKEMMEL**: Model %95+ accuracy ile çok iyi performans gösteriyor.\n")
    elif test_results['accuracy'] >= 0.90:
        report.append("✓ **ÇOK İYİ**: Model %90+ accuracy ile iyi performans gösteriyor.\n")
    elif test_results['accuracy'] >= 0.80:
        report.append("⚠ **İYİ**: Model %80+ accuracy ile kabul edilebilir performans gösteriyor.\n")
    else:
        report.append("⚠ **DÜŞÜK**: Model accuracy %80'in altında, iyileştirme gerekebilir.\n")
    
    # Öneriler
    report.append("\n## Öneriler\n")
    if test_results['wrong_predictions'] > 0:
        report.append(f"- {test_results['wrong_predictions']} hatalı tahmin var, bu görüntüleri inceleyin\n")
        report.append("- Hatalı tahminlerin çoğu belirli sınıflarda mı? (Confusion matrix'e bakın)\n")
        report.append("- Düşük confidence'lı tahminleri filtreleyin\n")
    
    report.append("="*80 + "\n")
    
    # Raporu kaydet
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(report))
    
    print(f"\nRapor kaydedildi: {output_file}")

def main():
    """Ana test fonksiyonu"""
    config = load_config()
    
    # Model yolu
    models_dir = Path(config['classification']['save_dir'])
    checkpoint = find_latest_checkpoint(models_dir)
    
    if checkpoint is None:
        print("HATA: Checkpoint bulunamadı!")
        return
    
    print(f"Checkpoint bulundu: {checkpoint.name}")
    
    # Sınıf isimlerini yükle
    data_yaml = Path(config['data']['data_yaml'])
    class_names = load_class_names(data_yaml)
    num_classes = len(class_names)
    
    print(f"Sınıf sayısı: {num_classes}")
    
    # Model ve processor yükle
    print(f"Model yükleniyor: {checkpoint}")
    model = ViTForImageClassification.from_pretrained(str(checkpoint))
    
    # Processor'ı orijinal modelden yükle (checkpoint'te yok)
    model_name = config['classification']['model_name']
    print(f"Processor yükleniyor: {model_name}")
    processor = ViTImageProcessor.from_pretrained(model_name)
    
    model.to(device)
    model.eval()
    
    # Dataset'leri oluştur
    data_path = Path(config['data']['dataset_path'])
    
    print("\n" + "="*80)
    print("TEST SETİ TEST EDİLİYOR")
    print("="*80)
    test_dataset = MedicineDataset(data_path, split='test', processor=processor, class_names=class_names)
    test_results = test_model(model, processor, test_dataset, class_names, "Test")
    
    print("\n" + "="*80)
    print("VALIDATION SETİ TEST EDİLİYOR")
    print("="*80)
    val_dataset = MedicineDataset(data_path, split='valid', processor=processor, class_names=class_names)
    val_results = test_model(model, processor, val_dataset, class_names, "Validation")
    
    # Sonuçları yazdır
    print("\n" + "="*80)
    print("TEST SETİ SONUÇLARI")
    print("="*80)
    print(f"Accuracy: {test_results['accuracy']:.4f} ({test_results['accuracy']*100:.2f}%)")
    print(f"Precision: {test_results['precision_weighted']:.4f}")
    print(f"Recall: {test_results['recall_weighted']:.4f}")
    print(f"F1 Score: {test_results['f1_weighted']:.4f}")
    print(f"Doğru: {test_results['correct_predictions']}/{test_results['total_samples']}")
    print(f"Yanlış: {test_results['wrong_predictions']}/{test_results['total_samples']}")
    
    print("\n" + "="*80)
    print("VALIDATION SETİ SONUÇLARI")
    print("="*80)
    print(f"Accuracy: {val_results['accuracy']:.4f} ({val_results['accuracy']*100:.2f}%)")
    print(f"Precision: {val_results['precision_weighted']:.4f}")
    print(f"Recall: {val_results['recall_weighted']:.4f}")
    print(f"F1 Score: {val_results['f1_weighted']:.4f}")
    print(f"Doğru: {val_results['correct_predictions']}/{val_results['total_samples']}")
    print(f"Yanlış: {val_results['wrong_predictions']}/{val_results['total_samples']}")
    
    # Sınıf bazında özet
    print("\n" + "="*80)
    print("SINIF BAZINDA PERFORMANS (Test Seti - İlk 10)")
    print("="*80)
    for result in test_results['class_results'][:10]:
        print(f"{result['class']}: Precision={result['precision']:.4f}, Recall={result['recall']:.4f}, F1={result['f1']:.4f}")
    
    # Hatalı tahminler
    if test_results['errors']:
        print(f"\nHatalı tahmin sayısı: {len(test_results['errors'])}")
        print("\nİlk 5 hatalı tahmin:")
        for error in test_results['errors'][:5]:
            print(f"  {Path(error['image_path']).name}: {error['true_class']} -> {error['predicted_class']} (güven: {error['confidence']:.4f})")
    
    # Rapor oluştur
    generate_report(test_results, val_results, class_names)
    
    print("\n" + "="*80)
    print("TEST TAMAMLANDI!")
    print("="*80)

if __name__ == '__main__':
    main()

