/**
 * DrugNameNormalizer - İlaç adı normalizasyonu ve eşleştirme
 * 12 sınıflı ve 150 sınıflı modellerden gelen farklı formatları normalize eder
 */

/**
 * İlaç adını normalize et
 * - Küçük harfe çevir
 * - Sayıları kaldır
 * - Birimleri kaldır (tablets, ml, g, cream, syrup, vb.)
 * - Özel karakterleri temizle
 */
export function normalizeDrugName(drugName: string): string {
  if (!drugName) return '';

  return drugName
    .toLowerCase()
    .replace(/\d+/g, '') // Sayıları kaldır
    .replace(/\s+(tablets?|capsules?|ml|g|mg|gm|cream|syrup|ointment|gel|spray|solution|drops|sachets|caplets|tape|nan|elixir|paint|mouth\s+wash|oral\s+(gel|drops|suspension|inhalation)|eye\s+drops|ear\s+drops)/gi, '') // Birimleri kaldır
    .replace(/[^\w\s]/g, '') // Özel karakterleri kaldır
    .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
    .trim();
}

/**
 * İki ilaç adının eşleşip eşleşmediğini kontrol et
 * Normalize edilmiş adları karşılaştırır
 */
export function findMatchingDrug(recognizedName: string, expectedName: string): boolean {
  if (!recognizedName || !expectedName) return false;

  const normalizedRecognized = normalizeDrugName(recognizedName);
  const normalizedExpected = normalizeDrugName(expectedName);

  // Tam eşleşme
  if (normalizedRecognized === normalizedExpected) {
    return true;
  }

  // Kısmi eşleşme (bir isim diğerini içeriyorsa)
  if (normalizedRecognized.includes(normalizedExpected) || 
      normalizedExpected.includes(normalizedRecognized)) {
    return true;
  }

  // Kelime bazlı eşleşme (ör: "brufen" ve "brufen 30 tablets")
  const recognizedWords = normalizedRecognized.split(' ').filter(w => w.length > 2);
  const expectedWords = normalizedExpected.split(' ').filter(w => w.length > 2);
  
  if (recognizedWords.length > 0 && expectedWords.length > 0) {
    // Her iki tarafta da ortak kelimeler varsa eşleşme say
    const commonWords = recognizedWords.filter(w => expectedWords.includes(w));
    if (commonWords.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * İlaç adından ana ismi çıkar
 * Örnek: "Brufen 30 tablets" -> "brufen"
 */
export function extractMainDrugName(drugName: string): string {
  if (!drugName) return '';

  const normalized = normalizeDrugName(drugName);
  const words = normalized.split(' ').filter(w => w.length > 2);
  
  // İlk anlamlı kelimeyi döndür (genellikle ilaç adı)
  return words[0] || normalized;
}

/**
 * İlaç adlarını benzerlik skoruna göre sırala
 * Levenshtein distance kullanarak benzerlik hesaplar
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeDrugName(str1);
  const s2 = normalizeDrugName(str2);

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Basit benzerlik hesaplama (kelime bazlı)
  const words1 = s1.split(' ').filter(w => w.length > 2);
  const words2 = s2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}

