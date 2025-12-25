"""
ViT Classification Inference
Eğitilmiş model ile ilaç tanıma
"""

import yaml
from pathlib import Path
import torch
from transformers import ViTForImageClassification, ViTImageProcessor
from PIL import Image
import numpy as np

# CUDA ayarları
if torch.cuda.is_available():
    device = torch.device("cuda")
    print(f"[OK] CUDA kullaniliyor: {torch.cuda.get_device_name(0)}")
else:
    device = torch.device("cpu")
    print("[WARN] CPU kullaniliyor")

class PillClassifier:
    """İlaç sınıflandırıcı"""
    
    def __init__(self, config_path='config.yaml'):
        """Modeli yükle"""
        self.config = self._load_config(config_path)
        self.model = None
        self.processor = None
        self.class_names = None
        
        self._load_model()
    
    def _load_config(self, config_path):
        """Config dosyasını yükle"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _load_class_names(self):
        """Sınıf isimlerini yükle"""
        data_yaml = Path(self.config['data']['data_yaml'])
        with open(data_yaml, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data['names']
    
    def _load_model(self):
        """Modeli yükle"""
        models_dir = Path(self.config['models']['classification'])
        
        # En son checkpoint'i bul
        checkpoints = sorted(
            [d for d in models_dir.iterdir() 
             if d.is_dir() and d.name.startswith('checkpoint-')],
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        if not checkpoints:
            raise FileNotFoundError(f"Checkpoint bulunamadı: {models_dir}")
        
        model_path = checkpoints[0]
        print(f"Model yükleniyor: {model_path.name}")
        
        self.model = ViTForImageClassification.from_pretrained(str(model_path))
        
        # Processor'ı orijinal modelden yükle
        model_name = self.config['classification']['model_name']
        self.processor = ViTImageProcessor.from_pretrained(model_name)
        
        self.model.to(device)
        self.model.eval()
        
        # Sınıf isimlerini yükle
        self.class_names = self._load_class_names()
        
        print(f"[OK] Model yuklendi ({len(self.class_names)} sinif)")
    
    def predict(self, image_path_or_pil, top_k=5):
        """
        Tahmin yap
        
        Args:
            image_path_or_pil: Görüntü yolu (str/Path) veya PIL Image
            top_k: En yüksek k olasılığı döndür
        
        Returns:
            dict: {
                'class_name': str,
                'confidence': float,
                'top_k': list of (class_name, confidence)
            }
        """
        # Görüntüyü yükle
        if isinstance(image_path_or_pil, (str, Path)):
            image = Image.open(image_path_or_pil).convert('RGB')
        else:
            image = image_path_or_pil.convert('RGB')
        
        # Preprocess
        inputs = self.processor(image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
        
        # En yüksek olasılıklı sınıfı bul
        predicted_idx = probs.argmax().item()
        confidence = float(probs[0][predicted_idx].item())
        class_name = self.class_names[predicted_idx]
        
        # Top-k olasılıkları al
        top_k_probs, top_k_indices = torch.topk(probs[0], min(top_k, len(self.class_names)))
        top_k_results = [
            (self.class_names[idx], float(prob.item()))
            for prob, idx in zip(top_k_probs, top_k_indices)
        ]
        
        return {
            'class_name': class_name,
            'confidence': confidence,
            'top_k': top_k_results,
            'all_probs': {self.class_names[i]: float(probs[0][i].item()) 
                         for i in range(len(self.class_names))}
        }

def main():
    """Test için main fonksiyonu"""
    import sys
    
    if len(sys.argv) < 2:
        print("Kullanım: python inference.py <görüntü_yolu>")
        return
    
    image_path = sys.argv[1]
    
    # Classifier'ı başlat
    classifier = PillClassifier()
    
    # Tahmin yap
    result = classifier.predict(image_path, top_k=5)
    
    print("\n" + "="*60)
    print("TAHMIN SONUÇLARI")
    print("="*60)
    print(f"Sınıf: {result['class_name']}")
    print(f"Güven: {result['confidence']:.2%}")
    print("\nTop 5 Tahmin:")
    for i, (class_name, prob) in enumerate(result['top_k'], 1):
        print(f"  {i}. {class_name}: {prob:.2%}")

if __name__ == '__main__':
    main()

