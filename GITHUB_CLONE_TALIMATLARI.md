# 📥 GitHub'dan Clone ve Kurulum Talimatları

## 🎯 Senaryo: Birisi Repository'yi Clone Ettiğinde

### Durum 1: Sadece Uygulamayı Çalıştırmak İstiyor (Model Eğitimi Yapmayacak)

**Adım 1: Repository'yi Clone Et**
```bash
git clone <repository-url>
cd PHARMA_APP
```

**Adım 2: Git LFS Dosyalarını İndir (ONNX Modeller)**
```bash
# Git LFS kurulu olmalı (git lfs version ile kontrol edin)
git lfs pull

# ONNX dosyalarının indirildiğini kontrol edin
ls PharmaApp/android/app/src/main/assets/*.onnx
```

**Adım 3: Node Modüllerini Yükle**
```bash
cd PharmaApp
npm install
```

**Adım 4: Android Uygulamasını Çalıştır**
```bash
npm start        # Metro bundler
npm run android  # Android uygulaması
```

**✅ Sonuç:** Uygulama çalışır, ONNX modeller mevcut, model eğitimi gerekmez!

---

### Durum 2: Model Eğitimi Yapmak İstiyor

**Adım 1: Repository'yi Clone Et**
```bash
git clone <repository-url>
cd PHARMA_APP
```

**Adım 2: Git LFS Dosyalarını İndir (Opsiyonel - Sadece uygulamayı çalıştırmak için)**
```bash
git lfs pull
```

**Adım 3: Veri Setlerini İndir (Kaggle'dan)**
```bash
# Kaggle API kurulumu (README'de detaylı)
kaggle datasets download -d kutayahin/12-class-turkish-drug-detection-dataset -p ilacverisi/
kaggle datasets download -d kutayahin/150-class-pharmaceutical-medication-dataset -p turkish_pill/
```

**Adım 4: Model Eğitimi Yap**
```bash
# README.md'deki "Model Eğitimi" bölümünü takip et
```

**✅ Sonuç:** Kendi modellerini eğitebilir, ONNX'e dönüştürebilir!

---

## 📋 Clone Sonrası Kontrol Listesi

### ✅ Otomatik Olarak Gelecekler (Git Clone ile)

- ✅ Tüm kaynak kodlar (Python, TypeScript, Kotlin)
- ✅ Konfigürasyon dosyaları
- ✅ README ve dokümantasyon
- ✅ Eğitim scriptleri
- ✅ ONNX modeller (Git LFS ile - `git lfs pull` gerekli)

### ❌ Gelmeyecekler (Manuel İndirme/Build Gerekli)

- ❌ `node_modules/` → `npm install` ile indirilir
- ❌ Veri setleri → Kaggle'dan indirilir
- ❌ Build klasörleri → Build edilir
- ❌ APK dosyaları → Build edilir

### ⚠️ Dikkat: Git LFS Dosyaları

**Normal Git Clone:**
```bash
git clone <url>
# ONNX dosyaları GELMEZ (sadece pointer'lar gelir)
```

**Git LFS Pull Gerekli:**
```bash
git clone <url>
cd PHARMA_APP
git lfs pull  # ONNX dosyalarını indirir
```

**ONNX Dosyaları Kontrol:**
```bash
# Dosyalar var mı kontrol et
ls PharmaApp/android/app/src/main/assets/*.onnx

# Eğer yoksa:
git lfs pull
```

---

## 🚨 Sık Karşılaşılan Sorunlar

### Sorun 1: "ONNX dosyaları yok"

**Neden:** Git LFS pull yapılmamış.

**Çözüm:**
```bash
git lfs pull
```

### Sorun 2: "git lfs: command not found"

**Neden:** Git LFS kurulu değil.

**Çözüm:**
- Windows: https://git-lfs.github.com/ indirin ve kurun
- Linux: `sudo apt install git-lfs`
- Mac: `brew install git-lfs`

### Sorun 3: "node_modules yok"

**Neden:** Normal, ignore edilmiş.

**Çözüm:**
```bash
cd PharmaApp
npm install
```

### Sorun 4: "Uygulama çalışmıyor, model bulunamadı"

**Neden:** ONNX dosyaları assets klasöründe yok.

**Çözüm:**
```bash
# Git LFS pull yap
git lfs pull

# Veya manuel olarak ONNX dosyalarını assets klasörüne kopyala
# (Model eğitimi yaptıysanız)
```

---

## ✅ Özet

**Git LFS ile yüklediğinizde:**

1. ✅ **Tüm kaynak kodlar** gelecek
2. ✅ **ONNX modeller** gelecek (git lfs pull ile)
3. ✅ **Eğitim scriptleri** gelecek
4. ✅ **Konfigürasyon dosyaları** gelecek
5. ❌ **node_modules** gelmeyecek (npm install gerekli)
6. ❌ **Veri setleri** gelmeyecek (Kaggle'dan indirilmeli)
7. ❌ **Build klasörleri** gelmeyecek (build edilmeli)

**Kullanıcı için gerekenler:**
- Git LFS kurulu olmalı
- `git lfs pull` komutunu çalıştırmalı
- `npm install` yapmalı (mobil uygulama için)
- Veri setlerini Kaggle'dan indirmeli (model eğitimi için)

**Sonuç:** Evet, workspace göründüğü gibi görünecek ve kurulum için gereken her şey olacak! 🎉

