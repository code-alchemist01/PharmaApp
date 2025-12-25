# 📤 GitHub'a Yükleme Rehberi

## 📊 Mevcut Durum Analizi

### Workspace Boyutu
- **Toplam**: ~11.14 GB
- **GitHub'a yüklenecek**: ~700 MB (Git LFS ile)
- **Ignore edilecek**: ~10.4 GB

### Büyük Dosyalar

#### ONNX Model Dosyaları (PharmaApp/android/app/src/main/assets/)
- `classification.onnx`: 1.22 MB ✅ (Normal Git)
- `classification.onnx.data`: **327.38 MB** ⚠️ (Git LFS gerekli!)
- `classification_150.onnx`: **327.82 MB** ⚠️ (Git LFS gerekli!)
- `detection.onnx`: 11.71 MB ✅ (Normal Git)

**GitHub Limitleri:**
- Tek dosya limiti: **100 MB** (hard limit)
- 100MB+ dosyalar için: **Git LFS** gerekli
- Repository limiti: 1 GB (önerilen), 100 GB (maksimum)

### Ignore Edilecek Klasörler
- `node_modules/`: 2.67 GB (npm install ile indirilir)
- `android/app/build/`: 7.33 GB (build çıktıları)
- `android/build/`: Build çıktıları
- APK dosyaları: Build edilir

## 🚀 GitHub'a Yükleme Adımları

### Adım 1: Git LFS Kurulumu

**Windows:**
```bash
# Git LFS'i indirin ve kurun
# https://git-lfs.github.com/

# Kurulumu doğrulayın
git lfs version
```

**Linux/Mac:**
```bash
# Linux
sudo apt install git-lfs  # Ubuntu/Debian
# veya
brew install git-lfs      # macOS

# Kurulumu doğrulayın
git lfs version
```

### Adım 2: Git LFS'i Projeye Ekleyin

```bash
cd C:\PHARMA_APP

# Git LFS'i başlat
git lfs install

# ONNX dosyalarını LFS'e ekle
git lfs track "*.onnx"
git lfs track "*.onnx.data"

# .gitattributes dosyası oluşturulacak (zaten oluşturuldu)
```

### Adım 3: .gitignore Kontrolü

`.gitignore` dosyası güncellendi. Şu klasörler ignore edilecek:
- ✅ `node_modules/`
- ✅ `android/app/build/`
- ✅ `android/build/`
- ✅ `*.apk`, `*.aab`
- ✅ `__pycache__/`
- ✅ Veri setleri (Kaggle'da)

### Adım 4: Git Repository Hazırlığı

```bash
# Git repository başlat (eğer yoksa)
git init

# Tüm dosyaları ekle
git add .

# İlk commit
git commit -m "Initial commit: PharmaApp with ML models"

# Remote repository ekle
git remote add origin <your-github-repo-url>

# Branch oluştur
git branch -M main

# Push yap (Git LFS dosyaları otomatik olarak LFS'e yüklenecek)
git push -u origin main
```

### Adım 5: Git LFS Push Kontrolü

```bash
# LFS dosyalarının doğru yüklendiğini kontrol edin
git lfs ls-files

# Şu dosyaları görmelisiniz:
# - classification.onnx.data
# - classification_150.onnx
```

## ⚠️ Önemli Notlar

### Git LFS Kullanımı

**Git LFS Nedir?**
- Büyük dosyaları (100MB+) GitHub'da saklamak için kullanılır
- Dosyalar LFS storage'da saklanır, repository'de pointer tutulur
- Ücretsiz plan: 1 GB LFS storage
- Pro plan: 50 GB LFS storage

**Maliyet:**
- 2 ONNX dosyası: ~655 MB
- Ücretsiz plan yeterli ✅

### Alternatif Çözümler

**Seçenek 1: Git LFS (Önerilen)**
- ✅ Modeller direkt repository'de
- ✅ Kullanıcılar kolayca indirebilir
- ✅ Repository temiz kalır

**Seçenek 2: GitHub Releases**
- ONNX dosyalarını Releases'a yükle
- README'de indirme linki ver
- Repository küçük kalır

**Seçenek 3: Kaggle'da Bırakma**
- Modeller Kaggle'da kalır
- README'de Kaggle linki ver
- Repository çok küçük kalır

## 📋 Kontrol Listesi

Yüklemeden önce kontrol edin:

- [ ] Git LFS kurulu mu? (`git lfs version`)
- [ ] `.gitignore` güncel mi?
- [ ] `.gitattributes` dosyası var mı?
- [ ] `node_modules/` ignore ediliyor mu?
- [ ] `build/` klasörleri ignore ediliyor mu?
- [ ] ONNX dosyaları LFS'e eklenmiş mi? (`git lfs ls-files`)
- [ ] Repository boyutu makul mu? (~700 MB)

## 🎯 Beklenen Sonuç

**GitHub Repository:**
- Kaynak kodlar: ~50-100 MB
- ONNX modeller (LFS): ~655 MB
- Dokümantasyon: ~5-10 MB
- **Toplam**: ~700 MB ✅

**Ignore Edilenler:**
- node_modules: 2.67 GB ❌
- build klasörleri: 7.33 GB ❌
- APK dosyaları: ~200 MB ❌

## 🚨 Hata Durumları

### "File too large" Hatası

**Sorun:** 100MB+ dosya normal Git'e eklenmeye çalışılıyor.

**Çözüm:**
```bash
# Git LFS'i kontrol edin
git lfs install

# Dosyayı LFS'e ekleyin
git lfs track "dosya.onnx"
git add .gitattributes
git add dosya.onnx
```

### "LFS storage limit exceeded" Hatası

**Sorun:** Git LFS storage limiti aşıldı.

**Çözüm:**
- GitHub Pro plan'a geçin (50 GB)
- Veya ONNX dosyalarını GitHub Releases'a yükleyin
- Veya Kaggle'da bırakın

### Push Çok Yavaş

**Sorun:** Git LFS dosyaları yavaş yükleniyor.

**Çözüm:**
- Normal, LFS dosyaları büyük olduğu için yavaş olabilir
- İlk push: ~10-30 dakika sürebilir
- Sonraki push'lar: Sadece değişen dosyalar yüklenir

## ✅ Sonuç

Git LFS ile ONNX modelleri GitHub'a yükleyebilirsiniz. Repository boyutu ~700 MB olacak, bu kabul edilebilir bir boyut.

**Önerilen Yaklaşım:**
1. Git LFS kur
2. ONNX dosyalarını LFS'e ekle
3. .gitignore'u güncelle
4. Push yap

Bu şekilde hem modeller GitHub'da olur hem de repository temiz kalır! 🎉

