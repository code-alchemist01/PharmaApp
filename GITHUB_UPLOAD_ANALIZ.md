# 📊 GitHub Upload Analizi ve Öneriler

## 🔍 Mevcut Durum

### Toplam Workspace Boyutu
- **Toplam**: ~11.14 GB
- **GitHub'a yüklenmemesi gerekenler**: ~10 GB
- **GitHub'a yüklenebilecekler**: ~1 GB

### Büyük Dosya ve Klasörler

#### ❌ GitHub'a YÜKLENMEMELİ (10 GB)

1. **node_modules/** (2.67 GB)
   - Neden: `npm install` ile indirilir
   - Çözüm: `.gitignore`'a ekle

2. **android/app/build/** (7.33 GB)
   - Neden: Build çıktıları, tekrar oluşturulabilir
   - Çözüm: `.gitignore`'a ekle

3. **APK Dosyaları** (~100-200 MB)
   - Neden: Build edilir, tekrar oluşturulabilir
   - Çözüm: `.gitignore`'a ekle

#### ⚠️ DİKKATLİ YÜKLENMELİ (100MB+ dosyalar)

1. **ONNX Model Dosyaları**
   - `classification.onnx.data`: ~100-300 MB
   - `classification_150.onnx`: ~100-300 MB
   - `detection.onnx`: ~10-50 MB
   - **Çözüm**: Git LFS kullanılmalı

2. **Native Library Dosyaları** (.so dosyaları)
   - `libreactnative.so`: ~100+ MB
   - Build çıktıları, yüklenmemeli

## ✅ GitHub'a Yüklenebilecekler (~1 GB)

- ✅ Tüm kaynak kodlar (Python, TypeScript, Kotlin)
- ✅ Konfigürasyon dosyaları
- ✅ README ve dokümantasyon
- ✅ Eğitim scriptleri
- ✅ Küçük model dosyaları (<100MB)
- ✅ Test dosyaları

## 🚀 Önerilen Çözüm

### Seçenek 1: Git LFS ile ONNX Modelleri Yükleme (Önerilen)

**Avantajlar:**
- ONNX modeller GitHub'da saklanır
- Kullanıcılar modelleri direkt indirebilir
- Repository temiz kalır

**Adımlar:**
1. Git LFS kurulumu
2. ONNX dosyalarını LFS'e ekle
3. `.gitignore`'u güncelle

### Seçenek 2: ONNX Modelleri GitHub Releases'a Yükleme

**Avantajlar:**
- Repository küçük kalır
- Modeller ayrı indirilebilir

**Adımlar:**
1. ONNX dosyalarını `.gitignore`'a ekle
2. GitHub Releases'da model dosyalarını yayınla
3. README'de indirme linki ver

### Seçenek 3: ONNX Modelleri Kaggle'da Bırakma (Mevcut Durum)

**Avantajlar:**
- Repository çok küçük
- Kaggle'da zaten mevcut

**Dezavantajlar:**
- Kullanıcılar Kaggle'dan indirmek zorunda

## 📋 Yapılacaklar

### 1. .gitignore Güncellemesi

Şu klasörler/dosyalar eklenmeli:
```
# Build outputs
PharmaApp/android/app/build/
PharmaApp/android/build/
PharmaApp/ios/build/

# Node modules
PharmaApp/node_modules/

# APK files
*.apk
*.aab

# Large binary files (use Git LFS if needed)
*.so
*.jar
```

### 2. Git LFS Kurulumu (ONNX için)

```bash
# Git LFS kur
git lfs install

# ONNX dosyalarını LFS'e ekle
git lfs track "*.onnx"
git lfs track "*.onnx.data"

# .gitattributes dosyası oluşturulacak
```

### 3. Repository Boyutu Optimizasyonu

**Yüklenecekler:**
- ✅ Kaynak kodlar: ~50-100 MB
- ✅ ONNX modeller (LFS ile): ~600 MB (LFS storage)
- ✅ Dokümantasyon: ~5-10 MB
- **Toplam**: ~700 MB (LFS dahil)

**Yüklenmeyecekler:**
- ❌ node_modules: 2.67 GB
- ❌ build klasörleri: 7.33 GB
- ❌ APK dosyaları: ~200 MB

## ⚠️ GitHub Limitleri

- **Tek dosya limiti**: 100 MB (hard limit)
- **100MB+ dosyalar**: Git LFS gerekli
- **Repository limiti**: 1 GB (önerilen), 100 GB (maksimum)
- **Git LFS limiti**: 1 GB (ücretsiz), 50 GB (Pro)

## 🎯 Sonuç ve Öneri

**ÖNERİLEN YAKLAŞIM:**

1. **ONNX modelleri Git LFS ile yükle** (kullanıcılar için kolay)
2. **node_modules ve build klasörlerini ignore et** (zaten ignore edilmiş)
3. **APK dosyalarını ignore et** (build edilir)

Bu yaklaşımla:
- Repository boyutu: ~700 MB (kabul edilebilir)
- Kullanıcılar modelleri direkt kullanabilir
- Repository temiz ve profesyonel kalır

