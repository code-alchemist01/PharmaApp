"""
ViT Classification Model Eğitimi
150 sınıf ilaç tanıma için Vision Transformer modeli eğitir
"""

import yaml
from pathlib import Path
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from transformers import (
    ViTForImageClassification, 
    ViTImageProcessor, 
    TrainingArguments, 
    Trainer
)
from PIL import Image
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from collections import Counter
import os
from tqdm import tqdm

# CUDA ayarları - RTX 5060 için
torch.backends.cudnn.benchmark = True
# CUDA ayarları - RTX 5060 için
torch.backends.cudnn.benchmark = True
if torch.cuda.is_available():
    try:
        device_name = torch.cuda.get_device_name(0)
        device_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"[OK] CUDA kullanilabilir: {device_name}")
        print(f"[OK] CUDA Memory: {device_memory:.1f} GB")
        print(f"[OK] CUDA Version: {torch.version.cuda}")
        device = torch.device("cuda")
    except Exception as e:
        print(f"[WARN] CUDA hatasi: {e}")
        print("[INFO] CPU kullanilacak")
        device = torch.device("cpu")
else:
    print("[WARN] CUDA kullanilamiyor, CPU kullanilacak")
    device = torch.device("cpu")

def load_config():
    """Config dosyasını yükle"""
    with open('config.yaml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def load_class_names(data_yaml_path):
    """data.yaml'dan sınıf isimlerini yükle"""
    with open(data_yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        return data['names']

def compute_class_weights(dataset_path, class_names):
    """Sınıf ağırlıklarını hesapla (imbalanced data için)"""
    class_counts = Counter()
    total = 0
    
    for class_idx, class_name in enumerate(class_names):
        class_dir = Path(dataset_path) / 'train' / class_name
        if class_dir.exists():
            count = len(list(class_dir.glob('*.jpg')) + list(class_dir.glob('*.JPG')))
            class_counts[class_idx] = count
            total += count
    
    # Inverse frequency weighting
    weights = []
    for class_idx in range(len(class_names)):
        if class_counts[class_idx] > 0:
            weight = total / (len(class_names) * class_counts[class_idx])
        else:
            weight = 1.0
        weights.append(weight)
    
    # Normalize
    weights = torch.tensor(weights, dtype=torch.float32)
    weights = weights / weights.sum() * len(weights)
    
    return weights, class_counts

class MedicineDataset(Dataset):
    """İlaç görüntüleri için Dataset sınıfı"""
    
    def __init__(self, dataset_path, split='train', processor=None, class_names=None, augment=False):
        self.dataset_path = Path(dataset_path)
        self.split = split
        self.processor = processor
        self.class_names = class_names or []
        self.augment = augment and (split == 'train')
        
        # Görüntüleri ve etiketleri yükle
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
        
        # Görüntüyü yükle
        image = Image.open(image_path).convert('RGB')
        
        # Augmentation (sadece train için)
        if self.augment:
            # Basit augmentation
            transform = transforms.Compose([
                transforms.RandomRotation(15),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
            ])
            image = transform(image)
        
        # Processor ile işle
        if self.processor:
            inputs = self.processor(image, return_tensors="pt")
            pixel_values = inputs['pixel_values'].squeeze(0)
        else:
            # Fallback: Basit transform
            transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            pixel_values = transform(image)
        
        return {
            'pixel_values': pixel_values,
            'labels': torch.tensor(label, dtype=torch.long)
        }

def compute_metrics(eval_pred):
    """Metrikleri hesapla"""
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=1)
    
    accuracy = accuracy_score(labels, predictions)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, predictions, average='weighted')
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }

def train_vit_model():
    """ViT classification modelini eğit"""
    config = load_config()
    
    # Veri yolu
    data_path = Path(config['data']['dataset_path'])
    data_yaml = data_path / 'data.yaml'
    
    if not data_path.exists():
        raise FileNotFoundError(f"Veri seti bulunamadı: {data_path}")
    
    # Sınıf isimlerini yükle
    class_names = load_class_names(data_yaml)
    num_classes = len(class_names)
    
    print(f"\n{'='*60}")
    print(f"Sınıf sayısı: {num_classes}")
    print(f"İlk 10 sınıf: {', '.join(class_names[:10])}")
    print(f"{'='*60}\n")
    
    # Model ve processor yükle
    model_name = config['classification']['model_name']
    print(f"Model yükleniyor: {model_name}")
    
    processor = ViTImageProcessor.from_pretrained(model_name)
    model = ViTForImageClassification.from_pretrained(
        model_name,
        num_labels=num_classes,
        ignore_mismatched_sizes=True
    )
    
    # Modeli GPU'ya taşı
    model.to(device)
    
    # Class weights hesapla
    if config['classification']['use_class_weights']:
        class_weights, class_counts = compute_class_weights(data_path, class_names)
        print("\nSınıf dağılımı (ilk 10):")
        for idx in range(min(10, num_classes)):
            name = class_names[idx]
            count = class_counts[idx]
            weight = class_weights[idx].item()
            print(f"  {idx}: {name} - {count} görüntü (weight: {weight:.3f})")
        if num_classes > 10:
            print(f"  ... ve {num_classes - 10} sınıf daha")
    else:
        class_weights = None
    
    # Dataset'leri oluştur
    train_dataset = MedicineDataset(
        data_path, 
        split='train', 
        processor=processor, 
        class_names=class_names,
        augment=config['classification']['use_augmentation']
    )
    valid_dataset = MedicineDataset(
        data_path, 
        split='valid', 
        processor=processor, 
        class_names=class_names,
        augment=False
    )
    
    # Custom loss function (class weights ile)
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels = inputs.get("labels")
            outputs = model(**inputs)
            logits = outputs.get("logits")
            
            if class_weights is not None:
                loss_fct = torch.nn.CrossEntropyLoss(weight=class_weights.to(device))
            else:
                loss_fct = torch.nn.CrossEntropyLoss()
            
            loss = loss_fct(logits.view(-1, num_classes), labels.view(-1))
            return (loss, outputs) if return_outputs else loss
    
    # Training arguments
    output_dir = Path(config['classification']['save_dir'])
    output_dir.mkdir(parents=True, exist_ok=True)
    
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=config['classification']['epochs'],
        per_device_train_batch_size=config['classification']['batch_size'],
        per_device_eval_batch_size=config['classification']['batch_size'],
        learning_rate=config['classification']['learning_rate'],
        weight_decay=0.01,
        logging_dir=str(output_dir / 'logs'),
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        save_total_limit=3,
        fp16=torch.cuda.is_available(),  # Mixed precision (RTX 5060 için)
        dataloader_pin_memory=True,
        dataloader_num_workers=0,  # Windows için 0 (multiprocessing sorunları)
        report_to="none",
    )
    
    # Trainer oluştur
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=valid_dataset,
        compute_metrics=compute_metrics,
    )
    
    # Eğitimi başlat
    print("\n" + "="*60)
    print("ViT Classification Model Eğitimi Başlıyor...")
    print("="*60 + "\n")
    print(f"Device: {device}")
    print(f"Batch size: {config['classification']['batch_size']}")
    print(f"Epochs: {config['classification']['epochs']}")
    print(f"FP16: {torch.cuda.is_available()}\n")
    
    try:
        trainer.train()
    except Exception as e:
        print(f"\n[ERROR] Eğitim hatası: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    # Modeli kaydet
    trainer.save_model()
    processor.save_pretrained(output_dir)
    
    print(f"\n✓ Model kaydedildi: {output_dir}")
    print("\n" + "="*60)
    print("Eğitim Tamamlandı!")
    print("="*60)

if __name__ == '__main__':
    train_vit_model()

