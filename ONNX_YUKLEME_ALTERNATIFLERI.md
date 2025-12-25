# 📦 ONNX Modellerini Yükleme Alternatifleri

## ❌ Sorun

ONNX model dosyaları GitHub'a yüklenemiyor çünkü:
- **GitHub dosya limiti:** 100 MB (ONNX dosyaları ~327-328 MB)
- **Git LFS budget limiti:** Ücretsiz planlarda aşıldı
- **Toplam ONNX boyutu:** ~667 MB

## ✅ Alternatif Çözümler

### 1. GitHub Releases (Önerilen - Manuel)

GitHub Releases üzerinden manuel olarak yükleyebilirsiniz:

**Adımlar:**
1. GitHub repository sayfasına gidin: https://github.com/code-alchemist01/PharmaApp
2. "Releases" sekmesine tıklayın
3. "Create a new release" butonuna tıklayın
4. Tag: `v1.0.0`, Title: `ONNX Models v1.0.0`
5. ONNX dosyalarını sürükleyip bırakın:
   - `detection.onnx` (11.71 MB)
   - `classification.onnx` (1.22 MB)
   - `classification.onnx.data` (327.38 MB)
   - `classification_150.onnx` (327.82 MB)
6. "Publish release" butonuna tıklayın

**Not:** GitHub Releases'da da 100MB limiti var, ancak bazı durumlarda daha esnek olabilir.

### 2. Harici Depolama Servisleri

#### A. Google Drive
1. ONNX dosyalarını Google Drive'a yükleyin
2. Paylaşım linkini alın (herkese açık)
3. README.md'ye link ekleyin

#### B. Dropbox
1. ONNX dosyalarını Dropbox'a yükleyin
2. Paylaşım linkini alın
3. README.md'ye link ekleyin

#### C. OneDrive
1. ONNX dosyalarını OneDrive'a yükleyin
2. Paylaşım linkini alın
3. README.md'ye link ekleyin

### 3. Kaggle Datasets (Önerilen)

Kaggle'da bir dataset oluşturup ONNX modellerini oraya yükleyebilirsiniz:

**Avantajlar:**
- Büyük dosya desteği
- Ücretsiz
- Kolay indirme
- Versiyon kontrolü

**Adımlar:**
1. Kaggle hesabınıza giriş yapın
2. "Datasets" → "New Dataset"
3. Dataset adı: `PharmaApp-ONNX-Models`
4. ONNX dosyalarını yükleyin
5. Public olarak paylaşın
6. README.md'ye link ekleyin

### 4. GitHub Pro Plan

GitHub Pro planına geçerek Git LFS storage limitini artırabilirsiniz:
- **Ücretsiz plan:** 1 GB LFS storage
- **Pro plan:** 50 GB LFS storage ($4/ay)

### 5. Model Eğitimi (En İyi Çözüm)

Kullanıcıların modelleri kendilerinin eğitmesi:
- ✅ README.md'de detaylı talimatlar var
- ✅ Veri setleri Kaggle'da mevcut
- ✅ Eğitim scriptleri repository'de
- ✅ Tam kontrol ve özelleştirme imkanı

## 📝 Önerilen Yaklaşım

**En iyi çözüm kombinasyonu:**

1. **Kaggle Dataset oluştur:** ONNX modellerini Kaggle'a yükle
2. **README.md güncelle:** Kaggle dataset linkini ekle
3. **ONNX_MODEL_INDIRME_TALIMATLARI.md güncelle:** Kaggle indirme talimatlarını ekle

Bu yaklaşım:
- ✅ Ücretsiz
- ✅ Kolay erişim
- ✅ Büyük dosya desteği
- ✅ Versiyon kontrolü
- ✅ Otomatik indirme scripti ile kolay kurulum

## 🚀 Hızlı Başlangıç

Eğer Kaggle kullanmak isterseniz:

```bash
# 1. Kaggle API kurulumu (zaten README.md'de var)
pip install kaggle

# 2. Dataset indirme
kaggle datasets download -d YOUR_USERNAME/pharmaapp-onnx-models -p ./models

# 3. Dosyaları çıkart
unzip ./models/pharmaapp-onnx-models.zip -d PharmaApp/android/app/src/main/assets/
```

## 📌 Not

Şu anda repository'de:
- ✅ Tüm eğitim scriptleri mevcut
- ✅ Veri setleri Kaggle'da
- ✅ Detaylı dokümantasyon var
- ❌ ONNX modelleri yok (GitHub limitleri nedeniyle)

Kullanıcılar modelleri:
1. Kaggle'dan indirebilir (eğer yüklerseniz)
2. Kendileri eğitebilir (README.md'deki talimatlarla)
3. Harici linklerden indirebilir (eğer ekleme yaparsanız)

