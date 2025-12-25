"""
YOLOv8+ViT+PaddleOCR Inference Pipeline
İlaç kutusu tespiti, sınıflandırma ve OCR işlemlerini yapar.
"""

import yaml
from pathlib import Path
from ultralytics import YOLO
from transformers import ViTForImageClassification, ViTImageProcessor
from PIL import Image
import torch
import numpy as np

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("⚠ PaddleOCR yüklü değil")

try:
    import pytesseract
    import os
    from pathlib import Path
    
    # Windows'ta Tesseract yolunu otomatik ayarla
    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    
    # Eğer yol ayarlanmamışsa ve Tesseract bulunamıyorsa, otomatik ayarla
    current_path = getattr(pytesseract.pytesseract, 'tesseract_cmd', None)
    if not current_path or not Path(current_path).exists():
        for path in possible_paths:
            if Path(path).exists():
                pytesseract.pytesseract.tesseract_cmd = path
                break
    
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("⚠ pytesseract yüklü değil")

class MedicineInference:
    """İlaç tanıma inference sınıfı"""
    
    def __init__(self, config_path='config.yaml'):
        """Inference pipeline'ı başlat"""
        self.config = self._load_config(config_path)
        self.detection_model = None
        self.classification_model = None
        self.classification_processor = None
        self.ocr_engine = None
        self.class_names = None
        
        # Modelleri yükle
        self._load_models()
        
        # OCR'ı başlat (opsiyonel - lazy loading için şimdilik başlatmıyoruz)
        # OCR sadece use_ocr=True olduğunda başlatılacak
        engine = self.config['ocr'].get('engine', 'paddleocr')
        if engine == 'paddleocr':
            self.ocr_available = PADDLEOCR_AVAILABLE
        elif engine == 'tesseract':
            self.ocr_available = TESSERACT_AVAILABLE
        else:
            self.ocr_available = False
        
        if self.config['ocr']['use_ocr'] and self.ocr_available:
            self._init_ocr()
    
    def _load_config(self, config_path):
        """Config dosyasını yükle"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _load_class_names(self):
        """Sınıf isimlerini yükle"""
        data_yaml = Path(self.config['data']['dataset_path']) / 'data.yaml'
        with open(data_yaml, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data['names']
    
    def _load_models(self):
        """Detection ve classification modellerini yükle"""
        # Detection model
        detection_path = Path(self.config['models']['detection'])
        if not detection_path.exists():
            # Alternatif yol dene
            runs_path = Path(self.config['detection']['project']) / self.config['detection']['name'] / 'weights' / 'best.pt'
            if runs_path.exists():
                detection_path = runs_path
            else:
                raise FileNotFoundError(f"Detection model bulunamadı: {detection_path}")
        
        print(f"Detection model yükleniyor: {detection_path}")
        self.detection_model = YOLO(str(detection_path))
        
        # Classification model
        classification_path = Path(self.config['models']['classification'])
        if not classification_path.exists():
            raise FileNotFoundError(f"Classification model bulunamadı: {classification_path}")
        
        print(f"Classification model yükleniyor: {classification_path}")
        self.classification_model = ViTForImageClassification.from_pretrained(str(classification_path))
        self.classification_processor = ViTImageProcessor.from_pretrained(str(classification_path))
        self.classification_model.eval()
        
        # Sınıf isimlerini yükle
        self.class_names = self._load_class_names()
        
        # Device ayarla
        self.device = torch.device(self.config['classification']['device'] if torch.cuda.is_available() else 'cpu')
        self.classification_model.to(self.device)
        
        print(f"✓ Modeller yüklendi (Device: {self.device})")
    
    def _init_ocr(self):
        """OCR engine'ini başlat"""
        engine = self.config['ocr']['engine']
        
        if engine == 'paddleocr':
            if not PADDLEOCR_AVAILABLE:
                print("⚠ PaddleOCR yüklü değil")
                self.ocr_engine = None
                return
            
            languages = self.config['ocr']['languages']
            print(f"PaddleOCR başlatılıyor (Diller: {', '.join(languages)})...")
            try:
                # PaddleOCR use_gpu parametresi yerine device kullanıyor
                if torch.cuda.is_available():
                    self.ocr_engine = PaddleOCR(use_angle_cls=True, lang='tr')
                else:
                    self.ocr_engine = PaddleOCR(use_angle_cls=True, lang='tr', use_gpu=False)
                print("✓ PaddleOCR hazır")
            except Exception as e:
                print(f"⚠ PaddleOCR başlatılamadı: {e}")
                self.ocr_engine = None
        
        elif engine == 'tesseract':
            if not TESSERACT_AVAILABLE:
                print("⚠ pytesseract yüklü değil")
                self.ocr_engine = None
                return
            
            # Tesseract'ın kurulu olup olmadığını kontrol et
            try:
                pytesseract.get_tesseract_version()
                self.ocr_engine = 'tesseract'
                languages = self.config['ocr'].get('languages', ['tr', 'eng'])
                print(f"✓ Tesseract hazır (Diller: {', '.join(languages)})")
            except Exception as e:
                print(f"⚠ Tesseract bulunamadı: {e}")
                print("💡 Tesseract'ı sisteminize kurmanız gerekiyor: https://github.com/tesseract-ocr/tesseract")
                self.ocr_engine = None
        else:
            print(f"⚠ Desteklenmeyen OCR engine: {engine}")
            self.ocr_engine = None
    
    def detect_box(self, image, conf_threshold=0.5):
        """
        YOLOv8 ile ilaç kutusunu tespit et
        Returns: (bbox, confidence) veya (None, None)
        """
        results = self.detection_model(image, conf=conf_threshold, verbose=False)
        
        if len(results) == 0 or results[0].boxes is None or len(results[0].boxes) == 0:
            return None, None
        
        # En yüksek confidence'lı box'ı al
        boxes = results[0].boxes
        best_idx = boxes.conf.argmax().item()
        box = boxes.xyxy[best_idx].cpu().numpy()  # [x1, y1, x2, y2]
        confidence = float(boxes.conf[best_idx].item())
        
        return box, confidence
    
    def crop_image(self, image, bbox, padding=10):
        """Bounding box ile görüntüyü kırp"""
        img_width, img_height = image.size
        
        x1 = max(0, int(bbox[0]) - padding)
        y1 = max(0, int(bbox[1]) - padding)
        x2 = min(img_width, int(bbox[2]) + padding)
        y2 = min(img_height, int(bbox[3]) + padding)
        
        return image.crop((x1, y1, x2, y2))
    
    def classify(self, cropped_image):
        """
        ViT ile kırpılmış görüntüyü sınıflandır
        Returns: (class_name, confidence, all_probs)
        """
        # Preprocess
        inputs = self.classification_processor(cropped_image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Inference
        with torch.no_grad():
            outputs = self.classification_model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
        
        # En yüksek olasılıklı sınıfı bul
        predicted_idx = probs.argmax().item()
        confidence = float(probs[0][predicted_idx].item())
        class_name = self.class_names[predicted_idx]
        
        # Tüm olasılıkları al
        all_probs = {self.class_names[i]: float(probs[0][i].item()) 
                     for i in range(len(self.class_names))}
        
        return class_name, confidence, all_probs
    
    def _check_medicine_in_text(self, text):
        """OCR metninde desteklenen ilaç isimlerinden birini ara"""
        if not text:
            return None
        
        text_lower = text.lower()
        # Özel karakterleri temizle ve sadece harf/rakam bırak
        import re
        text_clean = re.sub(r'[^\w\s]', ' ', text_lower)
        text_clean = ' '.join(text_clean.split())  # Fazla boşlukları temizle
        
        # Desteklenen ilaç isimleri (küçük harf)
        medicine_names_lower = [name.lower() for name in self.class_names]
        
        # Her ilaç ismini kontrol et
        for idx, medicine in enumerate(medicine_names_lower):
            # İlaç ismini metinde ara (kelime sınırları ile veya kelime içinde)
            # Önce tam kelime olarak ara
            pattern = r'\b' + re.escape(medicine) + r'\b'
            if re.search(pattern, text_clean):
                return self.class_names[idx]
            
            # Eğer tam kelime bulunamazsa, kelime içinde ara (daha esnek)
            if medicine in text_clean:
                return self.class_names[idx]
        
        return None
    
    def extract_text(self, image):
        """OCR ile metin çıkar ve sadece desteklenen ilaç isimlerini döndür"""
        if self.ocr_engine is None:
            return None
        
        try:
            raw_text = None
            
            if self.ocr_engine == 'tesseract':
                # Tesseract OCR
                # Türkçe ve İngilizce için dil ayarı
                languages = self.config['ocr'].get('languages', ['tr', 'eng'])
                lang_str = '+'.join(languages)
                
                # Tesseract config
                custom_config = r'--oem 3 --psm 6'  # oem 3: LSTM, psm 6: Tek düzgün metin bloğu
                
                raw_text = pytesseract.image_to_string(image, lang=lang_str, config=custom_config)
                raw_text = raw_text.strip() if raw_text else None
            
            else:
                # PaddleOCR
                img_array = np.array(image)
                result = self.ocr_engine.ocr(img_array, cls=True)
                
                if result and result[0]:
                    # Tüm metinleri birleştir
                    texts = [line[1][0] for line in result[0]]
                    raw_text = ' '.join(texts)
            
            if not raw_text:
                return None
            
            # Desteklenen ilaç isimlerinden birini ara
            found_medicine = self._check_medicine_in_text(raw_text)
            
            if found_medicine:
                return found_medicine
            else:
                return "Belirtilen ilaç metni bulunamadı"
                
        except Exception as e:
            print(f"⚠ OCR hatası: {e}")
            return None
    
    def predict(self, image_path_or_pil, return_image=False, use_ocr=False, conf_threshold=0.5):
        """
        Ana tahmin fonksiyonu
        Args:
            image_path_or_pil: Görüntü yolu (str/Path) veya PIL Image
            return_image: Kırpılmış görüntüyü de döndür
            use_ocr: OCR kullanılsın mı
            conf_threshold: Detection için güven eşiği
        Returns:
            dict: {
                'class_name': str,
                'confidence': float,
                'detection_confidence': float,
                'bbox': [x1, y1, x2, y2],
                'all_probs': dict,
                'ocr_text': str (opsiyonel),
                'cropped_image': PIL Image (opsiyonel)
            }
        """
        # Görüntüyü yükle
        if isinstance(image_path_or_pil, (str, Path)):
            image = Image.open(image_path_or_pil).convert('RGB')
        else:
            image = image_path_or_pil.convert('RGB')
        
        # 1. Detection
        bbox, det_confidence = self.detect_box(image, conf_threshold=conf_threshold)
        
        if bbox is None:
            return {
                'class_name': None,
                'confidence': 0.0,
                'detection_confidence': 0.0,
                'bbox': None,
                'all_probs': {},
                'ocr_text': None,
                'cropped_image': None if not return_image else image,
                'error': 'İlaç kutusu tespit edilemedi'
            }
        
        # 2. Crop
        cropped = self.crop_image(image, bbox)
        
        # 3. Classification
        class_name, cls_confidence, all_probs = self.classify(cropped)
        
        # 4. OCR (opsiyonel)
        ocr_text = None
        if use_ocr:
            # OCR engine henüz başlatılmamışsa başlat
            if self.ocr_engine is None and self.ocr_available:
                try:
                    self._init_ocr()
                except Exception as e:
                    print(f"⚠ OCR başlatılamadı: {e}")
                    self.ocr_available = False
            
            if self.ocr_engine is not None:
                ocr_text = self.extract_text(cropped)
            elif not self.ocr_available:
                ocr_text = "OCR engine kullanılamıyor (PaddleOCR yüklü değil)"
        
        result = {
            'class_name': class_name,
            'confidence': cls_confidence,
            'detection_confidence': det_confidence,
            'bbox': bbox.tolist() if isinstance(bbox, np.ndarray) else bbox,
            'all_probs': all_probs,
            'ocr_text': ocr_text,
        }
        
        if return_image:
            result['cropped_image'] = cropped
        
        return result

def main():
    """Test için main fonksiyonu"""
    import sys
    
    if len(sys.argv) < 2:
        print("Kullanım: python inference.py <görüntü_yolu>")
        return
    
    image_path = sys.argv[1]
    
    # Inference pipeline'ı başlat
    inference = MedicineInference()
    
    # Tahmin yap
    result = inference.predict(image_path, return_image=True, use_ocr=True)
    
    print("\n" + "="*50)
    print("TAHMIN SONUÇLARI")
    print("="*50)
    print(f"Sınıf: {result['class_name']}")
    print(f"Güven: {result['confidence']:.2%}")
    print(f"Detection Güven: {result['detection_confidence']:.2%}")
    if result['ocr_text']:
        print(f"OCR Metni: {result['ocr_text']}")
    print("\nTüm Olasılıklar:")
    for class_name, prob in sorted(result['all_probs'].items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  {class_name}: {prob:.2%}")

if __name__ == '__main__':
    main()

