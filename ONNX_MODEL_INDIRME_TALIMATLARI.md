# 📥 ONNX Model Dosyalarını İndirme Talimatları

## ⚠️ Önemli Not

ONNX model dosyaları GitHub repository'sine yüklenmemiştir çünkü:
- GitHub'ın tek dosya limiti: 100 MB
- ONNX dosyaları: ~327-328 MB (100MB limitini aşıyor)
- Git LFS budget limiti aşıldı

## 📦 ONNX Model Dosyaları

Uygulamayı çalıştırmak için şu ONNX dosyalarına ihtiyacınız var:

1. `detection.onnx` (11.71 MB)
2. `classification.onnx` (1.22 MB)
3. `classification.onnx.data` (327.38 MB)
4. `classification_150.onnx` (327.82 MB)

**Hedef Klasör:** `PharmaApp/android/app/src/main/assets/`

## 🚀 İndirme Yöntemleri

### Yöntem 1: Model Eğitimi Yaparak Oluşturma (Önerilen)

Model eğitimi yaparak kendi ONNX dosyalarınızı oluşturun:

1. README.md'deki "Model Eğitimi" bölümünü takip edin
2. Veri setlerini Kaggle'dan indirin
3. Modelleri eğitin
4. ONNX'e dönüştürün
5. Assets klasörüne kopyalayın

**Detaylı talimatlar:** README.md → "Model Eğitimi" bölümü

### Yöntem 2: GitHub Releases'dan İndirme

1. GitHub repository sayfasına gidin
2. "Releases" sekmesine tıklayın
3. En son release'i bulun
4. ONNX model dosyalarını indirin
5. Dosyaları `PharmaApp/android/app/src/main/assets/` klasörüne kopyalayın

### Yöntem 3: Manuel Olarak Oluşturma

Eğer model eğitimi yaptıysanız:

```bash
# Ana klasöre gidin
cd C:\PHARMA_APP

# ONNX dosyalarını assets klasörüne kopyala
copy ilacverisi\models\detection\detection.onnx PharmaApp\android\app\src\main\assets\
copy ilacverisi\models\classification\classification.onnx PharmaApp\android\app\src\main\assets\
copy ilacverisi\models\classification\classification.onnx.data PharmaApp\android\app\src\main\assets\
copy turkish_pill\models\classification\classification_150_merged.onnx PharmaApp\android\app\src\main\assets\classification_150.onnx
```

## ✅ Kontrol

ONNX dosyalarının doğru yerde olduğunu kontrol edin:

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

## 🚨 Sorun Giderme

### "Model bulunamadı" Hatası

**Neden:** ONNX dosyaları assets klasöründe yok.

**Çözüm:**
1. Dosyaların varlığını kontrol edin (yukarıdaki komut)
2. Dosyaları doğru klasöre kopyalayın
3. Android uygulamasını yeniden build edin

### "File too large" Hatası (Git Push)

**Neden:** ONNX dosyaları GitHub'a push edilmeye çalışılıyor.

**Çözüm:**
- ONNX dosyaları `.gitignore`'da olmalı
- Dosyaları manuel olarak assets klasörüne kopyalayın
- Git'e commit etmeyin

## 📝 Not

ONNX dosyaları olmadan uygulama çalışmaz. Mutlaka bu dosyaları assets klasörüne yerleştirmeniz gerekir!

