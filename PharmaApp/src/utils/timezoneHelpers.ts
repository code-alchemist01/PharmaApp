/**
 * Timezone Helpers - Türkiye saat dilimi için yardımcı fonksiyonlar
 * MainActivity.kt'de TimeZone.setDefault() ile saat dilimi zaten ayarlanmış
 * Bu fonksiyonlar sadece tutarlılık için
 */

/**
 * Şu anki zamanı al (Türkiye saat dilimi zaten ayarlı)
 */
export const getTurkeyTime = (): Date => {
  // MainActivity'de TimeZone.setDefault() ile zaten ayarlanmış
  // Bu yüzden new Date() direkt Türkiye saat dilimini kullanır
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMilliseconds(0);
  return now;
};

/**
 * Belirli bir saat ve dakikayı bugünün Türkiye saat diliminde Date objesi olarak oluştur
 */
export const createTurkeyDateTime = (hours: number, minutes: number): Date => {
  const now = new Date(); // Türkiye saat dilimi zaten ayarlı
  const alarmDate = new Date(now);
  alarmDate.setHours(hours, minutes, 0, 0);
  alarmDate.setSeconds(0, 0);
  alarmDate.setMilliseconds(0);
  return alarmDate;
};

/**
 * Bugünün başlangıcını Türkiye saat diliminde al (00:00:00)
 */
export const getTurkeyTodayStart = (): Date => {
  const now = new Date(); // Türkiye saat dilimi zaten ayarlı
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  todayStart.setMilliseconds(0);
  return todayStart;
};

/**
 * Bugünün sonunu Türkiye saat diliminde al (23:59:59)
 */
export const getTurkeyTodayEnd = (): Date => {
  const todayStart = getTurkeyTodayStart();
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  return todayEnd;
};

