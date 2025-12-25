"""
ViT Classification Model Eğitimi
Kırpılmış ilaç kutusu görüntüleri ile Vision Transformer modeli eğitir.
"""

import yaml
from pathlib import Path
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from transformers import ViTForImageClassification, ViTImageProcessor, TrainingArguments, Trainer
from PIL import Image
import numpy as np
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from collections import Counter
import os

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
    """
    Sınıf ağırlıklarını hesapla (imbalanced data için)
    """
    class_counts = Counter()
    total = 0
    
    for class_idx, class_name in enumerate(class_names):
        class_dir = Path(dataset_path) / 'train' / class_name
        if class_dir.exists():
            count = len(list(class_dir.glob('*.jpg')) + list(class_dir.glob('*.png')))
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
    
    def __init__(self, dataset_path, split='train', processor=None, class_names=None):
        self.dataset_path = Path(dataset_path)
        self.split = split
        self.processor = processor
        self.class_names = class_names or []
        
        # Görüntüleri ve etiketleri yükle
        self.images = []
        self.labels = []
        
        for class_idx, class_name in enumerate(self.class_names):
            class_dir = self.dataset_path / split / class_name
            if class_dir.exists():
                image_files = list(class_dir.glob('*.jpg')) + list(class_dir.glob('*.png'))
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

def train_classification_model():
    """ViT classification modelini eğit"""
    config = load_config()
    
    # Veri yolu
    cropped_path = Path(config['data']['cropped_path'])
    data_yaml = Path(config['data']['dataset_path']) / 'data.yaml'
    
    if not cropped_path.exists():
        raise FileNotFoundError(f"Kırpılmış görüntüler bulunamadı: {cropped_path}")
    
    # Sınıf isimlerini yükle
    class_names = load_class_names(data_yaml)
    num_classes = len(class_names)
    
    print(f"\nSınıf sayısı: {num_classes}")
    print(f"Sınıflar: {', '.join(class_names)}")
    
    # Model ve processor yükle
    model_name = config['classification']['model_name']
    print(f"\nModel yükleniyor: {model_name}")
    
    processor = ViTImageProcessor.from_pretrained(model_name)
    model = ViTForImageClassification.from_pretrained(
        model_name,
        num_labels=num_classes,
        ignore_mismatched_sizes=True
    )
    
    # Class weights hesapla
    if config['classification']['use_class_weights']:
        class_weights, class_counts = compute_class_weights(cropped_path, class_names)
        print("\nSınıf dağılımı:")
        for idx, (name, count) in enumerate(zip(class_names, [class_counts[i] for i in range(num_classes)])):
            print(f"  {idx}: {name} - {count} görüntü (weight: {class_weights[idx]:.3f})")
    else:
        class_weights = None
    
    # Dataset'leri oluştur
    train_dataset = MedicineDataset(cropped_path, split='train', processor=processor, class_names=class_names)
    valid_dataset = MedicineDataset(cropped_path, split='valid', processor=processor, class_names=class_names)
    
    # Custom loss function (class weights ile)
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels = inputs.get("labels")
            outputs = model(**inputs)
            logits = outputs.get("logits")
            
            if class_weights is not None:
                loss_fct = torch.nn.CrossEntropyLoss(weight=class_weights.to(model.device))
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
        fp16=torch.cuda.is_available(),
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
    print("\n" + "="*50)
    print("ViT Classification Model Eğitimi Başlıyor...")
    print("="*50 + "\n")
    
    trainer.train()
    
    # Modeli kaydet
    trainer.save_model()
    processor.save_pretrained(output_dir)
    
    print(f"\n✓ Model kaydedildi: {output_dir}")
    print("\n" + "="*50)
    print("Eğitim Tamamlandı!")
    print("="*50)

if __name__ == '__main__':
    if torch.cuda.is_available():
        print(f"✓ CUDA kullanılabilir: {torch.cuda.get_device_name(0)}")
    else:
        print("⚠ CUDA kullanılamıyor, CPU kullanılacak")
    
    train_classification_model()

