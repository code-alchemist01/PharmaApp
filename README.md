# 💊 PharmaApp - İlaç Takip ve Tanıma Sistemi

**Yapay Zeka Destekli Mobil İlaç Takip ve Tanıma Uygulaması**

PharmaApp, kullanıcıların ilaç kutusu fotoğraflarından otomatik olarak ilaç tanıma, takip etme ve hatırlatma alabilmelerini sağlayan kapsamlı bir mobil uygulamadır. Sistem, iki aşamalı derin öğrenme yaklaşımı (YOLOv8 + Vision Transformer) kullanarak yüksek doğruluk oranları elde etmektedir.

## 📊 Veri Setleri ve Model Dosyaları

Bu proje aşağıdaki veri setlerini ve model dosyalarını kullanmaktadır:

### 📦 Veri Setleri (Kaggle)

- **12-Class Turkish Drug Detection Dataset**: [Kaggle Dataset](https://www.kaggle.com/datasets/kutayahin/turkish-pharmaceutical-drug-dataset-12-classes)
- **150-Class Pharmaceutical Medication Dataset**: [Kaggle Dataset](https://www.kaggle.com/datasets/kutayahin/150-class-pharmaceutical-medication-dataset)

**Not:** Model eğitimi yapmak istiyorsanız, veri setlerini Kaggle'dan indirip proje klasörlerine yerleştirmeniz gerekmektedir. Detaylı kurulum adımları aşağıda verilmiştir.

### 🤖 ONNX Model Dosyaları (Google Drive)

- **ONNX Model Dosyaları**: [Google Drive Linki](https://drive.google.com/file/d/1WCvGnk7QElLjhcohL-gOdpSy5k4UA_BP/view?usp=sharing)

**Not:** Uygulamayı çalıştırmak için ONNX model dosyalarını Google Drive'dan indirip `PharmaApp/android/app/src/main/assets/` klasörüne yerleştirmeniz gerekmektedir. Detaylı indirme ve kurulum adımları aşağıdaki "Hızlı Başlangıç" bölümünde verilmiştir.

---

## 📋 İçindekiler

- [Veri Setleri](#-veri-setleri)
- [Genel Bakış](#genel-bakış)
- [Özellikler](#özellikler)
- [Sistem Gereksinimleri](#sistem-gereksinimleri)
- [⚡ Hızlı Başlangıç: Sadece Uygulamayı Çalıştırmak](#-hızlı-başlangıç-sadece-uygulamayı-çalıştırmak-istiyorum)
- [Sıfırdan Kurulum Rehberi](#-sıfırdan-kurulum-rehberi)
  - [Ön Hazırlık](#01-ön-hazırlık)
  - [Python Backend Kurulumu](#1-python-backend-kurulumu)
  - [Model Eğitimi](#2-model-eğitimi)
  - [Model Dönüştürme (ONNX)](#23-model-dönüştürme-onnx)
  - [Mobil Uygulama Kurulumu](#3-mobil-uygulama-kurulumu)
- [Kullanım](#kullanım)
- [Proje Yapısı](#proje-yapısı)
- [Sorun Giderme](#sorun-giderme)
- [Performans Metrikleri](#performans-metrikleri)

---

## 🎯 Genel Bakış

PharmaApp, üç ana bileşenden oluşan entegre bir sistemdir:

1. **Python Backend**: Model eğitimi, inference ve web arayüzü (Streamlit)
2. **Mobil Uygulama**: React Native tabanlı cross-platform uygulama (Android/iOS)
3. **Yapay Zeka Modelleri**: YOLOv8 (Detection) + Vision Transformer (Classification)

### Sistem Mimarisi

Sistem, **iki aşamalı (two-stage) derin öğrenme** yaklaşımı kullanmaktadır:

```
Giriş Görüntüsü
    ↓
[YOLOv8 Detection] → İlaç kutusunu tespit et
    ↓
[Görüntü Kırpma] → Tespit edilen bölgeyi kırp
    ↓
[ViT Classification] → İlacı sınıflandır (12 veya 150 sınıf)
    ↓
Sonuç: İlaç adı + Güven skoru
```

### Model Yaklaşımı

Sistem, **hibrit model yaklaşımı** kullanmaktadır:

- **12 Sınıf Yüksek Doğruluk Modeli**: Aferin, Apranax, Arveles, Aspirin, Dolorex, Hametan Krem, Hametan Merhem, Majezik, Metpamid, Parol, Terbisil, Unisom
  - **Doğruluk**: %99.82
  - **Kullanım**: Yüksek güven gereken durumlar
  
- **150 Sınıf Geniş Kapsam Modeli**: 150 farklı Türk ilaç kategorisi
  - **Doğruluk**: %85-90
  - **Kullanım**: Geniş kapsam gereken durumlar

- **Birleştirilmiş Yaklaşım**: Her iki model paralel çalıştırılır, sonuçlar birleştirilir ve en yüksek güven skorlu sonuç seçilir.

---

## ✨ Özellikler

### 🤖 Yapay Zeka Özellikleri

- ✅ **İki Aşamalı Tanıma Sistemi**: YOLOv8 (Detection) + Vision Transformer (Classification)
- ✅ **162 İlaç Sınıfı**: 12 yüksek doğruluk + 150 geniş kapsam ilaç sınıfı
- ✅ **Yüksek Doğruluk**: %99.82 (12 sınıf), %85-90 (150 sınıf)
- ✅ **Gerçek Zamanlı Inference**: Mobil cihazlarda ~150-400ms inference süresi
- ✅ **Hibrit Model Yaklaşımı**: İki model entegrasyonu ile hem yüksek doğruluk hem geniş kapsam
- ✅ **Offline Çalışma**: İnternet bağlantısı olmadan çalışabilme

### 📱 Mobil Uygulama Özellikleri

- ✅ **İlaç Tanıma**: Kamera ile fotoğraf çekerek otomatik ilaç tanıma
- ✅ **İlaç Takibi**: İlaç alım geçmişi ve istatistikler
- ✅ **Alarm Sistemi**: Özelleştirilebilir ilaç hatırlatıcıları
- ✅ **Takvim Entegrasyonu**: İlaç alım takvimi görüntüleme
- ✅ **Offline Çalışma**: SQLite yerel veritabanı ile offline çalışma
- ✅ **Firebase Senkronizasyonu**: Çoklu cihaz senkronizasyonu
- ✅ **Kullanıcı Yönetimi**: Firebase Authentication ile güvenli giriş

---

## 🖥️ Sistem Gereksinimleri

### Python Backend (Model Eğitimi/Inference)

- **Python**: 3.8 veya üzeri
- **CUDA**: 11.0+ (GPU eğitimi için, opsiyonel)
- **RAM**: 8GB+ (16GB önerilir)
- **Disk**: 10GB+ boş alan
- **GPU**: NVIDIA GPU (RTX 3060 veya üzeri önerilir, opsiyonel)

### Mobil Uygulama (React Native)

- **Node.js**: 20 veya üzeri
- **React Native**: 0.82.1
- **Android Studio**: Son sürüm (Android geliştirme için)
- **Xcode**: Son sürüm (iOS geliştirme için, sadece macOS)
- **Java JDK**: 17 veya üzeri
- **Android SDK**: API Level 24+ (Android 7.0+)

---

## 🚀 Sıfırdan Kurulum Rehberi

Bu rehber, projeyi sıfırdan kurmak ve modelleri eğitmek için gerekli tüm adımları içermektedir.

**⚠️ ÖNEMLİ NOTLAR:**
- Bu rehber, hiçbir ön bilgisi olmayan kullanıcılar için hazırlanmıştır
- Her adımı sırayla takip edin
- Bir adımı atlamayın
- Hata alırsanız, önce "Sorun Giderme" bölümüne bakın
- Eğitim süreleri tahminidir ve donanımınıza göre değişebilir

---

## ⚡ Hızlı Başlangıç: Sadece Uygulamayı Çalıştırmak İstiyorum

**Model eğitimi yapmadan, sadece uygulamayı çalıştırmak istiyorsanız:**

### Adım 1: Git Kurulumu ve Repository'yi Clone Et

**Git Kurulumu:**
1. [Git](https://git-scm.com/downloads) indirin ve kurun (eğer yoksa)
2. Kurulumu doğrulayın:
   ```bash
   git --version
   ```

**Repository'yi Clone Et:**
```bash
# Repository'yi klonlayın
git clone https://github.com/code-alchemist01/PharmaAPP.git
cd PharmaAPP
```

### Adım 2: ONNX Model Dosyalarını İndirin (Google Drive)

**⚠️ ÖNEMLİ:** Uygulamanın çalışması için ONNX model dosyaları gereklidir!

**İndirme Adımları:**

1. **Google Drive Linkine Gidin:**
   - Link: [ONNX Model Dosyaları](https://drive.google.com/file/d/1WCvGnk7QElLjhcohL-gOdpSy5k4UA_BP/view?usp=sharing)
   - Tarayıcınızda linki açın

2. **Dosyayı İndirin:**
   - Google Drive sayfasında "İndir" (Download) butonuna tıklayın
   - ZIP dosyası indirilecek (~668 MB)
   - İndirme tamamlanana kadar bekleyin

3. **ZIP Dosyasını Açın:**
   - İndirilen ZIP dosyasını bulun (genellikle İndirilenler klasöründe)
   - ZIP dosyasını sağ tıklayıp "Tümünü çıkart" veya "Extract All" seçin
   - İçerik 4 ONNX dosyası olmalı:
     - `detection.onnx` (~11.71 MB)
     - `classification.onnx` (~1.22 MB)
     - `classification.onnx.data` (~327.38 MB)
     - `classification_150.onnx` (~327.82 MB)

4. **Dosyaları Assets Klasörüne Kopyalayın:**

   **Windows:**
   ```bash
   # Ana klasöre gidin (PharmaAPP klasörü)
   cd PharmaAPP
   
   # Assets klasörünü oluşturun (eğer yoksa)
   mkdir PharmaApp\android\app\src\main\assets
   
   # ONNX dosyalarını kopyalayın
   # ZIP'ten çıkarttığınız dosyaları bulun ve şu komutu kullanın:
   copy "ZIP_TEN_ÇIKARTILAN_KLASÖR\*.onnx*" PharmaApp\android\app\src\main\assets\
   ```

   **Linux/Mac:**
   ```bash
   # Ana klasöre gidin (PharmaAPP klasörü)
   cd PharmaAPP
   
   # Assets klasörünü oluşturun (eğer yoksa)
   mkdir -p PharmaApp/android/app/src/main/assets
   
   # ONNX dosyalarını kopyalayın
   cp "ZIP_TEN_ÇIKARTILAN_KLASÖR/*.onnx*" PharmaApp/android/app/src/main/assets/
   ```

5. **Dosyaları Kontrol Edin:**
   ```bash
   # Windows
   dir PharmaApp\android\app\src\main\assets\*.onnx*
   
   # Linux/Mac
   ls PharmaApp/android/app/src/main/assets/*.onnx*
   
   # Şu 4 dosyayı görmelisiniz:
   # - detection.onnx
   # - classification.onnx
   # - classification.onnx.data
   # - classification_150.onnx
   ```

**✅ Başarılı!** ONNX model dosyaları yerleştirildi.

**❌ Sorun mu yaşıyorsunuz?**
- Dosyaların doğru klasörde olduğundan emin olun: `PharmaApp/android/app/src/main/assets/`
- Tüm 4 dosyanın (`.onnx` ve `.onnx.data` dahil) kopyalandığını kontrol edin
- "Sorun Giderme" bölümüne bakın

### Adım 3: Node.js Kurulumu

1. https://nodejs.org/ adresine gidin
2. "LTS" versiyonunu indirin (20.x veya üzeri)
3. İndirilen dosyayı çalıştırın ve kurulum sihirbazını takip edin
4. Kurulumu doğrulayın:
   ```bash
   node --version
   npm --version
   # Node.js 20.x.x ve npm 10.x.x görmelisiniz
   ```

### Adım 4: Node Modüllerini Yükle

```bash
# PharmaApp klasörüne gidin
cd PharmaApp

# Node modüllerini yükleyin (5-10 dakika sürebilir)
npm install

# Yükleme tamamlandığında "added XXX packages" mesajı göreceksiniz
```

### Adım 5: Android Studio Kurulumu (Android için)

1. https://developer.android.com/studio adresine gidin
2. Android Studio'yu indirin ve kurun
3. İlk açılışta Android SDK'yı kurun
4. Java JDK 17+ otomatik kurulacak

### Adım 6: Firebase Yapılandırması (Opsiyonel - Uygulama çalışır ama Firebase özellikleri çalışmaz)

1. https://console.firebase.google.com/ adresine gidin
2. Yeni proje oluşturun
3. Android uygulaması ekleyin
4. `google-services.json` dosyasını indirin
5. Dosyayı `PharmaApp/android/app/` klasörüne kopyalayın

### Adım 7: Uygulamayı Çalıştır

**Terminal 1 (Metro Bundler):**
```bash
cd PharmaApp
npm start
```

**Terminal 2 (Android Uygulaması):**
```bash
cd PharmaApp
npm run android
```

**✅ Başarılı!** Uygulama Android emülatörde veya bağlı cihazda çalışacak.

**⚠️ İlk çalıştırmada:**
- Android Studio açılabilir
- Gradle build yapılacak (5-10 dakika sürebilir)
- Uygulama otomatik yüklenecek ve çalışacak

---

**📝 Not:** Model eğitimi yapmak istiyorsanız, aşağıdaki "Model Eğitimi" bölümünü takip edin.

### 0. Ön Hazırlık

#### 0.1 Gerekli Yazılımları Kurun

**Python Kurulumu:**
1. [Python 3.8+](https://www.python.org/downloads/) indirin ve kurun
2. Kurulum sırasında "Add Python to PATH" seçeneğini işaretleyin
3. Kurulumu doğrulayın:
   ```bash
   python --version
   # Çıktı: Python 3.8.x veya üzeri olmalı
   ```

**Git Kurulumu (Opsiyonel - Repository'yi klonlamak için):**
1. [Git](https://git-scm.com/downloads) indirin ve kurun
2. Kurulumu doğrulayın:
   ```bash
   git --version
   ```

**CUDA Kurulumu (GPU kullanmak için - Opsiyonel):**
1. [NVIDIA CUDA Toolkit 11.0+](https://developer.nvidia.com/cuda-downloads) indirin ve kurun
2. [cuDNN](https://developer.nvidia.com/cudnn) indirin ve kurun
3. Kurulumu doğrulayın:
   ```bash
   nvidia-smi
   # GPU bilgilerini görmelisiniz
   ```

#### 0.2 Repository'yi Klonlayın veya İndirin

**Git ile Klonlama (Önerilen):**

**Repository'yi Klonlama:**
```bash
# Repository'yi klonlayın
git clone https://github.com/code-alchemist01/PharmaAPP.git
cd PharmaAPP
```

**ONNX Model Dosyalarını İndirin (Google Drive):**

ONNX model dosyaları GitHub'a yüklenemiyor (dosya boyutu limiti nedeniyle). Google Drive'dan indirmeniz gerekiyor:

1. **Google Drive Linkine Gidin:**
   - [ONNX Model Dosyaları](https://drive.google.com/file/d/1WCvGnk7QElLjhcohL-gOdpSy5k4UA_BP/view?usp=sharing)

2. **Dosyayı İndirin:**
   - Google Drive sayfasında "İndir" (Download) butonuna tıklayın
   - ZIP dosyası indirilecek (~668 MB)

3. **ZIP Dosyasını Açın ve Dosyaları Kopyalayın:**

   **Windows:**
   ```bash
   # Assets klasörünü oluşturun (eğer yoksa)
   mkdir PharmaApp\android\app\src\main\assets
   
   # ZIP'ten çıkarttığınız ONNX dosyalarını kopyalayın
   copy "ZIP_TEN_ÇIKARTILAN_KLASÖR\*.onnx*" PharmaApp\android\app\src\main\assets\
   ```

   **Linux/Mac:**
   ```bash
   # Assets klasörünü oluşturun (eğer yoksa)
   mkdir -p PharmaApp/android/app/src/main/assets
   
   # ZIP'ten çıkarttığınız ONNX dosyalarını kopyalayın
   cp "ZIP_TEN_ÇIKARTILAN_KLASÖR/*.onnx*" PharmaApp/android/app/src/main/assets/
   ```

4. **Kontrol Edin:**
   ```bash
   # Windows
   dir PharmaApp\android\app\src\main\assets\*.onnx*
   
   # Linux/Mac
   ls PharmaApp/android/app/src/main/assets/*.onnx*
   
   # Şu 4 dosyayı görmelisiniz:
   # - detection.onnx
   # - classification.onnx
   # - classification.onnx.data
   # - classification_150.onnx
   ```

**Manuel İndirme (ZIP):**
1. Repository'yi ZIP olarak indirin (GitHub'dan "Code" → "Download ZIP")
2. ZIP dosyasını açın
3. **ÖNEMLİ:** ZIP indirme ONNX model dosyalarını içermez!
4. ONNX dosyalarını Google Drive'dan indirin (yukarıdaki adımları takip edin)
5. ONNX dosyalarını `PharmaApp/android/app/src/main/assets/` klasörüne kopyalayın

#### 0.3 Kaggle API Kurulumu (Veri Setlerini İndirmek İçin)

**Kaggle API Token Oluşturma:**
1. [Kaggle](https://www.kaggle.com/) hesabı oluşturun veya giriş yapın
2. Hesap ayarlarına gidin: [Account Settings](https://www.kaggle.com/settings)
3. "API" sekmesine gidin
4. "Create New Token" butonuna tıklayın
5. `kaggle.json` dosyası indirilecek

**Kaggle API Token Yerleştirme:**

**Windows:**
```bash
# Kaggle klasörünü oluşturun
mkdir C:\Users\%USERNAME%\.kaggle

# kaggle.json dosyasını bu klasöre kopyalayın
copy kaggle.json C:\Users\%USERNAME%\.kaggle\
```

**Linux/Mac:**
```bash
# Kaggle klasörünü oluşturun
mkdir -p ~/.kaggle

# kaggle.json dosyasını bu klasöre kopyalayın
cp kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json
```

**Kaggle API Kurulumu:**
```bash
pip install kaggle
```

#### 0.4 Veri Setlerini İndirin

**Yöntem 1: Kaggle API ile İndirme (Önerilen)**

```bash
# 12-Class Dataset
kaggle datasets download -d kutayahin/12-class-turkish-drug-detection-dataset -p ilacverisi/
cd ilacverisi
# ZIP dosyasını açın
# Windows: Expand-Archive veya 7-Zip kullanın
# Linux/Mac: unzip komutu kullanın
unzip 12-class-turkish-drug-detection-dataset.zip -d SAP_BABA_CLEAN/
# veya manuel olarak ZIP'i açıp içeriğini SAP_BABA_CLEAN/ klasörüne kopyalayın

# 150-Class Dataset
cd ../turkish_pill
kaggle datasets download -d kutayahin/150-class-pharmaceutical-medication-dataset -p ./
# ZIP dosyasını açın
unzip 150-class-pharmaceutical-medication-dataset.zip -d "Mobile-Captured Pharmaceutical Medication Packages/"
```

**Yöntem 2: Manuel İndirme (Kaggle Web Sitesi)**

**12-Class Dataset (SAP_BABA_CLEAN):**

**12-Class Dataset (SAP_BABA_CLEAN):**

1. [Kaggle Dataset](https://www.kaggle.com/datasets/kutayahin/turkish-pharmaceutical-drug-dataset-12-classes) sayfasına gidin
2. "Download" butonuna tıklayın
3. ZIP dosyasını indirin
4. ZIP dosyasını açın ve içeriğini `ilacverisi/SAP_BABA_CLEAN/` klasörüne kopyalayın

**Klasör yapısı şöyle olmalı:**
```
ilacverisi/
└── SAP_BABA_CLEAN/
    ├── train/
    │   ├── images/
    │   └── labels/
    ├── valid/
    │   ├── images/
    │   └── labels/
    ├── test/
    │   ├── images/
    │   └── labels/
    └── data.yaml
```

**150-Class Dataset (Mobile-Captured Pharmaceutical Medication Packages):**

1. [Kaggle Dataset](https://www.kaggle.com/datasets/kutayahin/150-class-pharmaceutical-medication-dataset) sayfasına gidin
2. "Download" butonuna tıklayın
3. ZIP dosyasını indirin
4. ZIP dosyasını açın ve içeriğini `turkish_pill/Mobile-Captured Pharmaceutical Medication Packages/` klasörüne kopyalayın

**Klasör yapısı şöyle olmalı:**
```
turkish_pill/
└── Mobile-Captured Pharmaceutical Medication Packages/
    ├── Acretin 30 g cream/
    ├── Adol 24 caplets/
    ├── ... (150 klasör)
    └── drug list.xlsx
```

### 1. Python Backend Kurulumu

#### 1.1 Sanal Ortam Oluşturun (Önerilir)

**Sanal Ortam Nedir?**
Sanal ortam, projenizin bağımlılıklarını sistem Python'undan izole eder. Bu sayede farklı projeler farklı Python paket versiyonlarını kullanabilir.

**Sanal Ortam Oluşturma:**

**Windows:**
```bash
# Ana klasöre gidin
cd C:\PHARMA_APP

# Sanal ortam oluşturun
python -m venv venv

# Sanal ortamı aktifleştirin
venv\Scripts\activate

# Aktifleştirme başarılıysa terminal başında (venv) göreceksiniz
```

**Linux/Mac:**
```bash
# Ana klasöre gidin
cd ~/PHARMA_APP

# Sanal ortam oluşturun
python3 -m venv venv

# Sanal ortamı aktifleştirin
source venv/bin/activate

# Aktifleştirme başarılıysa terminal başında (venv) göreceksiniz
```

**Sanal Ortamı Deaktifleştirme:**
```bash
# Herhangi bir zamanda deaktifleştirmek için
deactivate
```

**Not:** Her yeni terminal açtığınızda sanal ortamı tekrar aktifleştirmeniz gerekir.

#### 1.2 Bağımlılıkları Yükleyin

**ÖNEMLİ:** Sanal ortam aktif olmalı! Terminal başında `(venv)` görmelisiniz.

**12 Sınıf Modeli (ilacverisi workspace):**

```bash
cd ilacverisi
pip install --upgrade pip  # pip'i güncelleyin
pip install -r requirements.txt
```

**Yükleme sırasında hata alırsanız:**
- **CUDA hatası:** GPU kullanmayacaksanız, CPU versiyonunu yükleyin:
  ```bash
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  ```
- **Memory hatası:** Bağımlılıkları tek tek yükleyin veya pip cache'i temizleyin:
  ```bash
  pip cache purge
  pip install -r requirements.txt --no-cache-dir
  ```

**150 Sınıf Modeli (turkish_pill workspace):**

```bash
cd ../turkish_pill
pip install --upgrade pip
pip install -r requirements.txt
```

**Kurulumu Doğrulayın:**
```bash
# PyTorch kurulumunu kontrol edin
python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}')"

# Transformers kurulumunu kontrol edin
python -c "import transformers; print(f'Transformers: {transformers.__version__}')"

# Ultralytics kurulumunu kontrol edin (12 sınıf için)
python -c "import ultralytics; print(f'Ultralytics: {ultralytics.__version__}')"
```

**Beklenen Çıktı:**
- PyTorch versiyonu gösterilmeli
- CUDA Available: True (GPU varsa) veya False (CPU kullanıyorsanız)
- Transformers versiyonu gösterilmeli

### 2. Model Eğitimi

#### 2.1 12 Sınıf Modeli Eğitimi

**Adım 1: Veri Setini Kontrol Edin**

```bash
cd ilacverisi
# Veri setinin doğru yerde olduğunu kontrol edin
dir SAP_BABA_CLEAN\train\images
# Çıktı: 10,443 görüntü dosyası görmelisiniz
```

**Adım 2: Detection Model (YOLOv8) Eğitimi**

**Eğitim Öncesi Kontrol:**
```bash
# ilacverisi klasöründeyken
# config.yaml dosyasını kontrol edin
type config.yaml  # Windows
# veya
cat config.yaml   # Linux/Mac
```

**Eğitimi Başlatın:**
```bash
# ilacverisi klasöründeyken
python src/train_detection.py
```

**Eğitim Sırasında:**
- Terminal'de epoch ilerlemesini göreceksiniz
- Her epoch sonunda validation sonuçları gösterilir
- `runs/detection/train/` klasöründe grafikler ve metrikler kaydedilir
- Eğitim sırasında bilgisayarınızı kapatmayın veya uyku moduna almayın

**Parametreler** (`config.yaml`):
- Model Boyutu: `n` (nano)
- Epochs: 100
- Batch Size: 16
- Image Size: 640x640
- Learning Rate: 0.01

**Beklenen Süre:**
- GPU (RTX 3060+): ~2-4 saat
- CPU: ~10-20 saat

**Eğitim Sırasında Hata Alırsanız:**
- **CUDA out of memory:** `config.yaml` dosyasında `batch_size` değerini küçültün (16 → 8 → 4)
- **Dosya bulunamadı:** Veri seti yolunu kontrol edin
- **Import hatası:** Bağımlılıkları tekrar yükleyin: `pip install -r requirements.txt`

**Çıktı:** `models/detection/best.pt`

**Kontrol:**
```bash
# Model dosyasının oluştuğunu kontrol edin
dir models\detection\best.pt  # Windows
# veya
ls models/detection/best.pt   # Linux/Mac

# Dosya boyutunu kontrol edin (yaklaşık 6-12 MB olmalı)
```

**Adım 3: Görüntü Kırpma (Detection Modeli Kullanarak)**

**ÖNEMLİ:** Bu adım, detection modeli eğitildikten sonra yapılmalıdır!

```bash
# Detection modeli ile eğitim görüntülerini kırp
python src/crop_images.py
```

**Bu işlem ne yapar?**
- Detection modeli ile eğitim görüntülerindeki ilaç kutularını tespit eder
- Tespit edilen bölgeleri kırpar
- Kırpılmış görüntüleri `data/cropped/train/` ve `data/cropped/valid/` klasörlerine kaydeder
- Her sınıf için ayrı klasörler oluşturur

**İşlem Süresi:**
- ~10,443 görüntü için: ~30-60 dakika (GPU) veya ~2-4 saat (CPU)

**Kontrol:**
```bash
# Kırpılmış görüntülerin oluştuğunu kontrol edin
dir data\cropped\train\aferin  # Windows
# veya
ls data/cropped/train/aferin   # Linux/Mac

# Her sınıf için görüntüler görmelisiniz
# Toplam 12 klasör olmalı (her biri bir ilaç sınıfı)
dir data\cropped\train  # Windows
ls data/cropped/train   # Linux/Mac
```

**Hata Alırsanız:**
- **Model bulunamadı:** `models/detection/best.pt` dosyasının varlığını kontrol edin
- **Dosya yolu hatası:** `config.yaml` dosyasındaki yolları kontrol edin

**Adım 4: Classification Model (ViT) Eğitimi**

**ÖNEMLİ:** Bu adım, görüntü kırpma işlemi tamamlandıktan sonra yapılmalıdır!

```bash
# Kırpılmış görüntülerle classification modelini eğit
python src/train_classification.py
```

**Eğitim Sırasında:**
- İlk çalıştırmada Hugging Face'den model indirilecek (~330MB)
- Her epoch sonunda validation accuracy gösterilir
- En iyi model otomatik olarak kaydedilir

**Parametreler:**
- Model: `google/vit-base-patch16-224`
- Epochs: 20
- Batch Size: 32
- Image Size: 224x224
- Learning Rate: 0.00002

**Beklenen Süre:**
- GPU (RTX 3060+): ~1-2 saat
- CPU: ~5-10 saat

**Eğitim Sırasında Hata Alırsanız:**
- **CUDA out of memory:** Batch size'ı küçültün (32 → 16 → 8)
- **Kırpılmış görüntü bulunamadı:** `data/cropped/` klasörünü kontrol edin
- **Internet bağlantısı hatası:** İlk çalıştırmada model indirilir, internet gerekli

**Çıktı:** `models/classification/` klasörü (config.json, model.safetensors, vb.)

**Kontrol:**
```bash
# Model dosyalarının oluştuğunu kontrol edin
dir models\classification  # Windows
# veya
ls models/classification    # Linux/Mac

# Şu dosyaları görmelisiniz:
# - config.json
# - model.safetensors (veya model.pt)
# - preprocessor_config.json
# - training_args.bin
```

#### 2.2 150 Sınıf Modeli Eğitimi

**Adım 1: Veri Setini Kontrol Edin**

```bash
cd turkish_pill
# Veri setinin doğru yerde olduğunu kontrol edin
dir "Mobile-Captured Pharmaceutical Medication Packages"
# 150 klasör görmelisiniz (her biri bir ilaç sınıfı)
```

**Adım 2: Veri Seti Hazırlama**

**ÖNEMLİ:** Veri seti klasörünün doğru yerde olduğundan emin olun!

```bash
# Klasör tabanlı veri setini train/val/test olarak böl
python prepare_dataset.py
```

**Bu script ne yapar?**
- `Mobile-Captured Pharmaceutical Medication Packages/` klasöründeki görüntüleri okur
- Her sınıf için görüntüleri train/valid/test olarak böler (70/15/15 oranında)
- `data/train/`, `data/valid/`, `data/test/` klasörlerini oluşturur
- `data/data.yaml` dosyasını oluşturur

**İşlem Süresi:**
- ~3,900 görüntü için: ~5-10 dakika

**Kontrol:**
```bash
# Veri seti klasörlerinin oluştuğunu kontrol edin
dir data\train    # Windows
dir data\valid
dir data\test
# veya
ls data/train     # Linux/Mac
ls data/valid
ls data/test

# Her klasörde ilaç sınıfları görmelisiniz (150 klasör)
# data.yaml dosyasının oluştuğunu kontrol edin
type data\data.yaml  # Windows
cat data/data.yaml   # Linux/Mac
```

**Hata Alırsanız:**
- **Klasör bulunamadı:** `Mobile-Captured Pharmaceutical Medication Packages/` klasörünün varlığını kontrol edin
- **Görüntü okuma hatası:** Görüntü dosyalarının bozuk olmadığından emin olun

**Adım 3: Classification Model (ViT) Eğitimi**

**ÖNEMLİ:** Veri seti hazırlama işlemi tamamlandıktan sonra bu adıma geçin!

```bash
# 150 sınıflı classification modelini eğit
python train_vit.py
```

**Eğitim Öncesi:**
- İlk çalıştırmada Hugging Face'den model indirilecek (~330MB)
- Internet bağlantısı gerekli (sadece ilk çalıştırmada)

**Eğitim Sırasında:**
- Her epoch sonunda checkpoint kaydedilir
- Validation accuracy ve loss gösterilir
- En iyi model otomatik olarak seçilir

**Parametreler** (`config.yaml`):
- Model: `google/vit-base-patch16-224`
- Epochs: 30
- Batch Size: 16
- Image Size: 224x224
- Learning Rate: 0.00002

**Beklenen Süre:**
- GPU (RTX 3060+): ~2-3 saat
- CPU: ~10-15 saat

**Eğitim Sırasında Hata Alırsanız:**
- **CUDA out of memory:** Batch size'ı küçültün (16 → 8 → 4)
- **Veri seti bulunamadı:** `data/train/` klasörünü kontrol edin
- **Class imbalance uyarısı:** Normal, 150 sınıf için beklenen bir durum

**Çıktı:** `models/classification/checkpoint-XXXXX/` klasörleri

**Kontrol:**
```bash
# Checkpoint klasörlerinin oluştuğunu kontrol edin
dir models\classification\checkpoint-*  # Windows
# veya
ls models/classification/checkpoint-*   # Linux/Mac

# Birden fazla checkpoint görmelisiniz (her epoch sonunda oluşur)
# En iyi model genellikle checkpoint-1725 klasöründe olur
# trainer_state.json dosyasında "best_model_checkpoint" bilgisi var
```

#### 2.3 Model Dönüştürme (ONNX)

**12 Sınıf Modeli - Detection Modeli:**

```bash
cd ilacverisi
# Detection modeli ONNX'e dönüştür
python src/convert_detection_to_onnx.py
```

**Kontrol:**
```bash
# ONNX dosyasının oluştuğunu kontrol edin
dir models\detection\detection.onnx
```

**12 Sınıf Modeli - Classification Modeli:**

```bash
# Classification modeli ONNX'e dönüştür
python src/convert_classification_to_onnx.py
```

**Kontrol:**
```bash
# ONNX dosyasının oluştuğunu kontrol edin
dir models\classification\classification.onnx
```

**150 Sınıf Modeli:**

```bash
cd turkish_pill
# En son checkpoint'i otomatik bulur ve ONNX'e dönüştürür
python convert_to_onnx.py
```

Bu script:
- En son checkpoint'i otomatik bulur (`checkpoint-XXXXX/`)
- Hugging Face modelini ONNX formatına dönüştürür
- Model doğrulaması yapar
- PyTorch ve ONNX inference sonuçlarını karşılaştırır
- External data dosyalarını birleştirir
- `models/classification/classification_150_merged.onnx` dosyası oluşturur

**Kontrol:**
```bash
# ONNX dosyasının oluştuğunu kontrol edin
dir models\classification\classification_150_merged.onnx
```

**Adım 4: Model Dosyalarını Mobil Uygulamaya Kopyalama**

```bash
# Ana klasöre dönün
cd C:\PHARMA_APP

# ONNX dosyalarını assets klasörüne kopyala
copy ilacverisi\models\detection\detection.onnx PharmaApp\android\app\src\main\assets\
copy ilacverisi\models\classification\classification.onnx PharmaApp\android\app\src\main\assets\
copy turkish_pill\models\classification\classification_150_merged.onnx PharmaApp\android\app\src\main\assets\classification_150.onnx
```

**Kontrol:**
```bash
# Tüm ONNX dosyalarının assets klasöründe olduğunu kontrol edin
dir PharmaApp\android\app\src\main\assets\*.onnx  # Windows
# veya
ls PharmaApp/android/app/src/main/assets/*.onnx   # Linux/Mac

# Şu dosyaları görmelisiniz:
# - detection.onnx (11.71 MB)
# - classification.onnx (1.22 MB)
# - classification.onnx.data (327.38 MB) - Git LFS ile
# - classification_150.onnx (327.82 MB) - Git LFS ile
```

**Not:** 
- Eğer repository'yi klonladıysanız, ONNX dosyaları Git LFS ile gelecek. `git lfs pull` komutunu çalıştırmanız gerekebilir.
- Eğer model eğitimi yaptıysanız, `classification.onnx.data` dosyasını da kopyalayın:
```bash
copy ilacverisi\models\classification\classification.onnx.data PharmaApp\android\app\src\main\assets\
```

### 3. Mobil Uygulama Kurulumu

**ÖNEMLİ:** 
- Eğer repository'yi klonladıysanız ve ONNX modelleri Git LFS ile indirdiyseniz, model eğitimi yapmadan direkt bu adıma geçebilirsiniz.
- Eğer model eğitimi yaptıysanız, ONNX dönüştürme işlemlerini tamamladıktan sonra bu adıma geçin.

**ONNX Modelleri Kontrol Edin:**
```bash
# ONNX dosyalarının assets klasöründe olduğunu kontrol edin
dir PharmaApp\android\app\src\main\assets\*.onnx*  # Windows
# veya
ls PharmaApp/android/app/src/main/assets/*.onnx*   # Linux/Mac

# Şu 4 dosyayı görmelisiniz:
# - detection.onnx (11.71 MB)
# - classification.onnx (1.22 MB)
# - classification.onnx.data (327.38 MB)
# - classification_150.onnx (327.82 MB)
```

**Eğer ONNX dosyaları yoksa:**
1. **Google Drive'dan indirin** (Önerilen): Yukarıdaki "Hızlı Başlangıç" bölümündeki "Adım 2: ONNX Model Dosyalarını İndirin" adımlarını takip edin
2. **Veya model eğitimi yapın**: Yukarıdaki "Model Eğitimi" bölümünü takip edin ve eğitilmiş modelleri ONNX'e dönüştürün

#### 3.1 Node.js ve npm Kurulumu

**Node.js Kurulumu:**
1. [Node.js 20+](https://nodejs.org/) indirin ve kurun
2. Kurulumu doğrulayın:
   ```bash
   node --version
   npm --version
   # Node.js 20.x.x ve npm 10.x.x görmelisiniz
   ```

#### 3.2 Node Modüllerini Yükleyin

```bash
cd C:\PHARMA_APP\PharmaApp
npm install
```

**Yükleme Süresi:**
- İlk kurulum: ~5-10 dakika
- ~500MB+ indirme yapılacak

**Hata Alırsanız:**
- **Network hatası:** Internet bağlantınızı kontrol edin
- **Permission hatası:** Terminal'i yönetici olarak çalıştırın (Windows) veya `sudo` kullanın (Linux/Mac)
- **Cache hatası:** npm cache'i temizleyin:
  ```bash
  npm cache clean --force
  npm install
  ```

#### 3.3 Android Studio ve Android SDK Kurulumu

**Android Studio Kurulumu:**
1. [Android Studio](https://developer.android.com/studio) indirin ve kurun
2. Android SDK'yı kurun (Android Studio içinden)
3. Android SDK Platform 24+ kurun
4. Java JDK 17+ kurun (Android Studio ile birlikte gelir)

**Kurulumu Doğrulayın:**
```bash
# Java versiyonunu kontrol edin
java -version
# Java 17 veya üzeri görmelisiniz

# Android SDK yolunu kontrol edin (Windows)
echo %ANDROID_HOME%
# veya (Linux/Mac)
echo $ANDROID_HOME
```

**Android SDK Yolunu Ayarlayın (Gerekirse):**

**Windows:**
```bash
# Environment Variables'a ekleyin:
# ANDROID_HOME = C:\Users\%USERNAME%\AppData\Local\Android\Sdk
# PATH'e ekleyin: %ANDROID_HOME%\platform-tools
```

**Linux/Mac:**
```bash
# ~/.bashrc veya ~/.zshrc dosyasına ekleyin:
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

#### 3.4 Android Kurulumu

```bash
# Android klasörüne gidin
cd android

# Gradle wrapper'ı çalıştırın (ilk kurulum)
./gradlew clean

# Geri dönün
cd ..
```

#### 3.5 iOS Kurulumu (Sadece macOS)

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

#### 3.6 Firebase Yapılandırması

**Firebase Projesi Oluşturma:**
1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. "Add project" butonuna tıklayın
3. Proje adını girin ve "Continue" tıklayın
4. Google Analytics'i etkinleştirin (opsiyonel)
5. "Create project" tıklayın

**Android Uygulaması Ekleme:**
1. Firebase Console'da projenizi seçin
2. "Add app" → "Android" seçin
3. Package name girin: `com.pharmaapp`
4. `google-services.json` dosyasını indirin
5. Dosyayı `PharmaApp/android/app/` klasörüne kopyalayın

**iOS Uygulaması Ekleme (Opsiyonel):**
1. "Add app" → "iOS" seçin
2. Bundle ID girin
3. `GoogleService-Info.plist` dosyasını indirin
4. Dosyayı `PharmaApp/ios/` klasörüne kopyalayın

1. Firebase Console'da yeni bir proje oluşturun
2. Android uygulaması ekleyin
3. `google-services.json` dosyasını `PharmaApp/android/app/` klasörüne kopyalayın
4. iOS uygulaması ekleyin (opsiyonel)
5. `GoogleService-Info.plist` dosyasını `PharmaApp/ios/` klasörüne kopyalayın

#### 3.7 APK Oluşturma

**Debug APK:**

```bash
cd PharmaApp\android
.\gradlew assembleDebug
```

APK dosyası: `android/app/build/outputs/apk/debug/app-debug.apk`

**Release APK:**

```bash
cd PharmaApp\android
.\gradlew clean
.\gradlew assembleRelease
```

APK dosyası: `android/app/build/outputs/apk/release/app-release.apk`

**Not:** Release APK için imzalama gerekir. İlk kez imzalama için:

1. `android/app/build.gradle` dosyasında signing config ekleyin
2. Keystore dosyası oluşturun: `keytool -genkey -v -keystore pharmaapp.keystore -alias pharmaapp -keyalg RSA -keysize 2048 -validity 10000`

---

## 💻 Kullanım

### Python Backend - Streamlit Uygulaması

**12 Sınıf Modeli:**

```bash
cd ilacverisi
streamlit run app.py
```

**150 Sınıf Modeli:**

```bash
cd turkish_pill
streamlit run app.py
```

Tarayıcıda otomatik olarak açılacaktır (genellikle `http://localhost:8501`).

**Kullanım Adımları:**
1. Görüntü yükleyin veya kamera ile fotoğraf çekin
2. "🚀 Tahmin Yap" butonuna tıklayın
3. Sonuçları görüntüleyin:
   - Tespit edilen sınıf ve güven seviyesi
   - Bounding box ile işaretlenmiş görüntü
   - Kırpılmış ilaç kutusu görüntüsü
   - Tüm sınıf olasılıkları

### Komut Satırından Inference

**12 Sınıf Modeli:**

```bash
cd ilacverisi
python src/inference.py <görüntü_yolu>
```

**150 Sınıf Modeli:**

```bash
cd turkish_pill
python inference.py <görüntü_yolu>
```

### Mobil Uygulama

#### Geliştirme Ortamında Çalıştırma

**Android:**

```bash
# Metro bundler'ı başlatın (bir terminal)
cd PharmaApp
npm start

# Android uygulamasını çalıştırın (başka bir terminal)
npm run android
```

**iOS (sadece macOS):**

```bash
# Metro bundler'ı başlatın (bir terminal)
npm start

# iOS uygulamasını çalıştırın (başka bir terminal)
npm run ios
```

#### Uygulama Özellikleri

**Ana Ekranlar:**
- **Home**: İlaç listesi ve hızlı erişim
- **İlaç Ekle**: Kamera ile ilaç tanıma ve ekleme
- **Takvim**: İlaç alım takvimi
- **Alarm**: İlaç hatırlatıcıları
- **İstatistikler**: İlaç alım istatistikleri
- **Profil**: Kullanıcı ayarları

**İlaç Tanıma Akışı:**
1. "İlaç Ekle" ekranına gidin
2. Kamera butonuna tıklayın
3. İlaç kutusu fotoğrafı çekin
4. Sistem otomatik olarak:
   - İlaç kutusunu tespit eder (YOLOv8)
   - Her iki modeli paralel çalıştırır (12 sınıf + 150 sınıf)
   - Sonuçları birleştirir ve en yüksek güven skorlu sonucu gösterir
   - Alternatif tahminleri listeler (top-5)
5. İlaç bilgilerini düzenleyip kaydedin

**İlaç Doğrulama:**
1. Alarm bildirimi geldiğinde "Doğrula" butonuna tıklayın
2. İlaç kutusu fotoğrafı çekin
3. Sistem ilacı tanır ve beklenen ilaçla eşleştirir
4. Eşleşme başarılıysa ilaç alımı kaydedilir

---

## 📁 Proje Yapısı

```
PHARMA_APP/
├── ilacverisi/                      # 12 sınıf model workspace
│   ├── src/                         # Python kaynak kodları
│   │   ├── train_detection.py      # Detection model eğitimi
│   │   ├── train_classification.py # Classification model eğitimi
│   │   ├── crop_images.py          # Görüntü kırpma
│   │   └── inference.py             # Inference pipeline
│   ├── models/                     # Eğitilmiş modeller
│   │   ├── detection/
│   │   │   └── best.pt             # YOLOv8 modeli
│   │   └── classification/         # ViT modeli
│   ├── data/                       # Veri setleri
│   │   ├── cropped/                # Kırpılmış görüntüler
│   │   └── SAP_BABA_CLEAN/         # Ham veri seti
│   ├── app.py                      # Streamlit uygulaması
│   ├── config.yaml                 # Konfigürasyon
│   └── requirements.txt            # Python bağımlılıkları
│
├── turkish_pill/                    # 150 sınıf model workspace
│   ├── Mobile-Captured.../         # Kaynak veri seti
│   ├── data/                       # Hazırlanmış veri seti
│   │   ├── train/                  # Eğitim görüntüleri
│   │   ├── valid/                  # Validation görüntüleri
│   │   ├── test/                   # Test görüntüleri
│   │   └── data.yaml               # Sınıf tanımları
│   ├── models/
│   │   └── classification/         # Eğitilmiş model
│   ├── prepare_dataset.py          # Veri seti hazırlama
│   ├── train_vit.py                # Model eğitimi
│   ├── convert_to_onnx.py          # ONNX dönüştürme
│   ├── inference.py                # Inference script
│   ├── app.py                      # Streamlit uygulaması
│   ├── config.yaml                 # Konfigürasyon
│   └── requirements.txt            # Python bağımlılıkları
│
└── PharmaApp/                       # React Native mobil uygulama
    ├── android/                     # Android native kod
    │   └── app/src/main/
    │       ├── assets/             # ONNX model dosyaları
    │       │   ├── detection.onnx
    │       │   ├── classification.onnx
    │       │   └── classification_150.onnx
    │       └── java/com/pharmaapp/
    │           ├── mltest/          # ML native modülü
    │           │   ├── MLTestModule.kt
    │           │   └── MLTestPackage.kt
    │           ├── MainActivity.kt
    │           └── MainApplication.kt
    ├── ios/                         # iOS native kod
    ├── src/
    │   ├── screens/                 # Uygulama ekranları
    │   ├── services/                # Servisler (ML, Firebase, vb.)
    │   │   ├── ml/
    │   │   │   ├── MLService.ts     # ML servisi
    │   │   │   ├── MLTestNativeModule.ts
    │   │   │   └── DrugNameNormalizer.ts
    │   │   ├── database/
    │   │   │   ├── LocalDatabase.ts
    │   │   │   └── FirestoreService.ts
    │   │   └── notification/
    │   │       └── NotificationService.ts
    │   ├── navigation/              # Navigation yapılandırması
    │   ├── context/                 # Context providers
    │   └── utils/                   # Yardımcı fonksiyonlar
    │       └── constants.ts         # İlaç sınıfları ve ayarlar
    ├── package.json                 # Node.js bağımlılıkları
    └── README.md                    # Bu dosya
```

---

## 🔧 Sorun Giderme

### Model Bulunamadı Hatası

**Sorun:** "Model bulunamadı" hatası alıyorsunuz.

**Çözüm:**
1. **Detection modeli eğitildi mi?**
   ```bash
   # Kontrol edin
   dir ilacverisi\models\detection\best.pt  # Windows
   ls ilacverisi/models/detection/best.pt    # Linux/Mac
   ```
   Eğer yoksa: `python src/train_detection.py` çalıştırın

2. **Classification modeli eğitildi mi?**
   ```bash
   # 12 sınıf için
   dir ilacverisi\models\classification\config.json
   # 150 sınıf için
   dir turkish_pill\models\classification\checkpoint-*
   ```
   Eğer yoksa: İlgili eğitim scriptini çalıştırın

3. **ONNX dosyaları assets klasöründe mi?**
   ```bash
   dir PharmaApp\android\app\src\main\assets\*.onnx
   ```
   Eğer yoksa: Model dönüştürme adımlarını tekrar yapın

4. **config.yaml dosyasındaki yollar doğru mu?**
   - Dosya yollarını kontrol edin
   - Windows'ta `\` kullanın, Linux/Mac'te `/` kullanın

### CUDA Hatası

**Sorun:** CUDA kullanılamıyor hatası.

**Çözüm:**
- CPU kullanmak için `config.yaml` dosyasında:
  ```yaml
  detection:
    device: "cpu"
  classification:
    device: "cpu"
  ```

### Mobil Uygulamada Model Yüklenmiyor

**Sorun:** Mobil uygulamada modeller yüklenmiyor.

**Çözüm:**
1. ONNX dosyaları `assets/` klasöründe mi?
2. Native modül doğru build edildi mi?
3. Android Studio'da "Clean Project" yapın:
   ```bash
   cd android
   ./gradlew clean
   ./gradlew assembleDebug
   ```

### Metro Bundler Hatası

**Sorun:** Metro bundler başlamıyor.

**Çözüm:**
```bash
# Cache'i temizleyin
npm start --reset-cache
```

### Android Build Hatası

**Sorun:** Android build başarısız oluyor.

**Çözüm:**
```bash
cd android
./gradlew clean
./gradlew --stop
cd ..
npm start --reset-cache
npm run android
```

### ONNX Dönüştürme Hatası

**Sorun:** Model ONNX formatına dönüştürülemiyor.

**Çözüm:**
1. **PyTorch ve ONNX sürümlerini kontrol edin:**
   ```bash
   python -c "import torch; import onnx; print(f'PyTorch: {torch.__version__}, ONNX: {onnx.__version__}')"
   ```

2. **Model dosyalarının doğru yolda olduğundan emin olun:**
   - Detection: `ilacverisi/models/detection/best.pt`
   - Classification (12): `ilacverisi/models/classification/`
   - Classification (150): `turkish_pill/models/classification/checkpoint-XXXXX/`

3. **onnxruntime kurulu mu kontrol edin:**
   ```bash
   pip install onnxruntime
   ```

4. **Script'i tekrar çalıştırın:**
   ```bash
   # 12 sınıf için
   python src/convert_detection_to_onnx.py
   python src/convert_classification_to_onnx.py
   
   # 150 sınıf için
   python convert_to_onnx.py
   ```

5. **Hata mesajını okuyun:** Genellikle hangi dosyanın eksik olduğunu söyler

---

## 📊 Performans Metrikleri

### Test Seti Sonuçları

#### 12 Sınıf Modeli (Yüksek Doğruluk)

- **Toplam Test Görüntüsü**: 2,256
- **Başarılı Tespit**: 2,256 (%100)
- **Genel Doğruluk**: %99.82
- **Ortalama Inference Süresi**: ~150ms (GPU), ~2-3s (CPU)
- **Mobil Inference Süresi**: ~300-700ms (Android)

**Sınıf Bazında Doğruluk:**
- Aferin: %100
- Apranax: %100
- Arveles: %100
- Aspirin: %100
- Dolorex: %99.46
- Hametan Krem: %99.46
- Hametan Merhem: %100
- Majezik: %100
- Metpamid: %99.46
- Parol: %99.46
- Terbisil: %100
- Unisom: %100

#### 150 Sınıf Modeli (Geniş Kapsam)

- **Toplam Test Görüntüsü**: ~3,900
- **Başarılı Tespit**: %98+
- **Genel Doğruluk**: %85-90
- **Ortalama Inference Süresi**: ~200-400ms (GPU), ~3-5s (CPU)
- **Mobil Inference Süresi**: ~400-800ms (Android)
- **Kapsam**: 150 farklı Türk ilaç kategorisi

### Model Karşılaştırması

| Özellik | 12 Sınıf Modeli | 150 Sınıf Modeli | Birleştirilmiş Yaklaşım |
|---------|----------------|------------------|------------------------|
| Doğruluk | %99.82 | %85-90 | %90-95 (en yüksek güven skorlu) |
| Kapsam | 12 ilaç | 150 ilaç | 162 ilaç (12 + 150) |
| Inference | ~150ms | ~200-400ms | ~300-700ms (paralel) |
| Model Boyutu | ~330MB | ~330MB | ~660MB (toplam) |
| Kullanım | Yüksek doğruluk gereken durumlar | Geniş kapsam gereken durumlar | Her durum için optimal |

---

## 🚀 Deployment ve Production

### Production APK Oluşturma

**Adım 1: Keystore Oluşturma**

```bash
keytool -genkey -v -keystore pharmaapp.keystore -alias pharmaapp -keyalg RSA -keysize 2048 -validity 10000
```

**Adım 2: Signing Config Ekleme**

`PharmaApp/android/app/build.gradle` dosyasına ekleyin:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('pharmaapp.keystore')
            storePassword 'your-store-password'
            keyAlias 'pharmaapp'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Adım 3: Release APK Oluşturma**

```bash
cd PharmaApp\android
.\gradlew clean
.\gradlew assembleRelease
```

APK dosyası: `android/app/build/outputs/apk/release/app-release.apk`

### Google Play Store'a Yükleme

1. Google Play Console'da yeni uygulama oluşturun
2. APK veya AAB dosyasını yükleyin
3. Uygulama bilgilerini doldurun
4. İçerik derecelendirmesi yapın
5. Yayınlayın

### Firebase Production Yapılandırması

1. Firebase Console'da production projesi oluşturun
2. `google-services.json` dosyasını güncelleyin
3. Firestore security rules'u yapılandırın
4. Firebase Storage rules'u yapılandırın

---

## 📝 Lisans

Bu proje eğitim ve araştırma amaçlı geliştirilmiştir.

---

## 👥 Katkıda Bulunanlar

- Model Eğitimi ve Optimizasyon
- Mobil Uygulama Geliştirme
- Sistem Mimarisi ve Entegrasyon

---

## 📞 İletişim

Sorularınız için issue açabilir veya proje yöneticisi ile iletişime geçebilirsiniz.

---

---

## ✅ Kurulum Kontrol Listesi

Kurulumunuzun tamamlandığını doğrulamak için bu kontrol listesini kullanın:

### Python Backend
- [ ] Python 3.8+ kurulu
- [ ] Sanal ortam oluşturuldu ve aktif
- [ ] 12 sınıf modeli bağımlılıkları yüklendi
- [ ] 150 sınıf modeli bağımlılıkları yüklendi
- [ ] PyTorch kurulu ve çalışıyor
- [ ] CUDA çalışıyor (GPU kullanıyorsanız)

### Veri Setleri
- [ ] 12-Class dataset indirildi ve `ilacverisi/SAP_BABA_CLEAN/` klasörüne yerleştirildi
- [ ] 150-Class dataset indirildi ve `turkish_pill/Mobile-Captured Pharmaceutical Medication Packages/` klasörüne yerleştirildi
- [ ] Veri seti yapıları doğru (klasör yapıları kontrol edildi)

### Model Eğitimi (12 Sınıf)
- [ ] Detection modeli eğitildi (`models/detection/best.pt` mevcut)
- [ ] Görüntü kırpma yapıldı (`data/cropped/` klasörü mevcut)
- [ ] Classification modeli eğitildi (`models/classification/` klasörü mevcut)
- [ ] Detection modeli ONNX'e dönüştürüldü
- [ ] Classification modeli ONNX'e dönüştürüldü

### Model Eğitimi (150 Sınıf)
- [ ] Veri seti hazırlandı (`data/train/`, `data/valid/`, `data/test/` mevcut)
- [ ] Classification modeli eğitildi (`models/classification/checkpoint-*` mevcut)
- [ ] Model ONNX'e dönüştürüldü (`classification_150_merged.onnx` mevcut)

### Mobil Uygulama
- [ ] Node.js 20+ kurulu
- [ ] npm modülleri yüklendi
- [ ] Android Studio kurulu
- [ ] Java JDK 17+ kurulu
- [ ] Android SDK kurulu
- [ ] ONNX dosyaları `PharmaApp/android/app/src/main/assets/` klasöründe
- [ ] Firebase yapılandırıldı (`google-services.json` mevcut)

### Test
- [ ] Streamlit uygulaması çalışıyor (12 sınıf)
- [ ] Streamlit uygulaması çalışıyor (150 sınıf)
- [ ] Android uygulaması build ediliyor
- [ ] Android uygulaması çalışıyor ve modeller yükleniyor

---

**Son Güncelleme**: 2025-12-24

