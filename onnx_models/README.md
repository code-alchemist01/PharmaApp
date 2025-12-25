# 📦 ONNX Model Dosyaları

Bu klasör, PharmaApp uygulaması için gerekli ONNX model dosyalarını içerir.

## 📋 Dosyalar

1. **detection.onnx** (11.71 MB)
   - 12-class ilaç tespiti için YOLOv8 modeli
   - Kullanım: İlaç kutularını görüntüde tespit etme

2. **classification.onnx** (1.22 MB)
   - 12-class ilaç sınıflandırması için Vision Transformer modeli
   - Kullanım: Tespit edilen ilaçları sınıflandırma

3. **classification.onnx.data** (327.38 MB)
   - classification.onnx modelinin veri dosyası
   - Büyük model parametreleri

4. **classification_150.onnx** (327.82 MB)
   - 150-class ilaç sınıflandırması için Vision Transformer modeli
   - Kullanım: Genişletilmiş ilaç sınıflandırması

## 📥 İndirme ve Kurulum

### Yöntem 1: Dış Depolamadan İndirme

Bu dosyalar GitHub'a yüklenemiyor (100MB limit). Dış depolamadan indirin:

1. **Kaggle Dataset** (Önerilen)
   - Dataset: `PharmaApp-ONNX-Models`
   - Link: [Kaggle Dataset Linki Eklenecek]

2. **Google Drive / Dropbox / OneDrive**
   - Paylaşım linki: [Link Eklenecek]

3. **GitHub Releases**
   - Releases sayfasından indirin: [GitHub Releases Linki]

### Yöntem 2: Model Eğitimi Yaparak Oluşturma

Kendi modellerinizi eğiterek oluşturabilirsiniz:

1. Ana dizindeki `README.md` dosyasındaki "Model Eğitimi" bölümünü takip edin
2. Veri setlerini Kaggle'dan indirin
3. Modelleri eğitin
4. ONNX'e dönüştürün
5. Bu klasöre kopyalayın

## 🚀 Mobil Uygulamaya Kopyalama

ONNX dosyalarını mobil uygulamaya kopyalamak için:

```bash
# Windows
copy onnx_models\*.onnx* PharmaApp\android\app\src\main\assets\

# Linux/Mac
cp onnx_models/*.onnx* PharmaApp/android/app/src/main/assets/
```

Veya `README.md` dosyasındaki "Adım 4: Model Dosyalarını Mobil Uygulamaya Kopyalama" bölümünü takip edin.

## ✅ Kontrol

Dosyaların doğru yerde olduğunu kontrol edin:

```bash
# Windows
dir PharmaApp\android\app\src\main\assets\*.onnx*

# Linux/Mac
ls PharmaApp/android/app/src/main/assets/*.onnx*
```

**Görmeniz gerekenler:**
- detection.onnx
- classification.onnx
- classification.onnx.data
- classification_150.onnx

## 📝 Not

- Bu dosyalar GitHub repository'sine yüklenmemiştir (`.gitignore`'da)
- Dış depolamadan indirip bu klasöre koyabilirsiniz
- Veya model eğitimi yaparak kendiniz oluşturabilirsiniz

## 🔗 İlgili Dosyalar

- `README.md` - Ana kurulum rehberi
- `ONNX_MODEL_INDIRME_TALIMATLARI.md` - Detaylı indirme talimatları
- `ONNX_YUKLEME_ALTERNATIFLERI.md` - Alternatif yükleme yöntemleri

