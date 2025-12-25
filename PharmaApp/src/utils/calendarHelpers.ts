/**
 * Calendar Helpers - Takvim için yardımcı fonksiyonlar
 */

import { Alarm, History, Drug } from '../services/database/LocalDatabase';
import { MarkedDates } from 'react-native-calendars';

export interface CalendarAlarm {
  id: string;
  drugId: string;
  drugName: string;
  time: string; // HH:MM
  status: 'taken' | 'missed' | 'pending';
  alarmId?: string;
}

/**
 * Tarihi YYYY-MM-DD formatına çevir
 */
export const formatDateForCalendar = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Belirli bir tarih için alarmları getir
 */
export const getAlarmsForDate = (
  dateString: string,
  alarms: Alarm[],
  history: History[],
  drugs: Drug[]
): CalendarAlarm[] => {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay(); // 0 = Pazar, 6 = Cumartesi
  const dateTimestamp = date.getTime();

  const result: CalendarAlarm[] = [];

  // Aktif alarmları kontrol et
  for (const alarm of alarms) {
    if (!alarm.is_active) continue;

    const drug = drugs.find((d) => d.id === alarm.drug_id);
    if (!drug) continue;

    let shouldInclude = false;

    // Tekrar tipine göre kontrol et
    if (alarm.repeat_type === 'daily') {
      // Günlük tekrar: her gün
      shouldInclude = true;
    } else if (alarm.repeat_type === 'custom' && alarm.repeat_days) {
      // Özel günler: belirtilen günlerde
      const repeatDays = JSON.parse(alarm.repeat_days);
      shouldInclude = repeatDays.includes(dayOfWeek);
    } else if (alarm.repeat_type === 'interval' && alarm.interval_hours) {
      // Aralıklı: her X saatte bir (karmaşık hesaplama gerekir)
      // Şimdilik basit kontrol
      shouldInclude = true;
    }

    if (shouldInclude) {
      // Bu tarih için geçmiş kaydı var mı kontrol et
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayHistory = history.filter((h) => {
        if (h.alarm_id !== alarm.id) return false;
        const takenDate = new Date(h.taken_at);
        return takenDate >= dayStart && takenDate <= dayEnd;
      });

      let status: 'taken' | 'missed' | 'pending' = 'pending';

      if (dayHistory.length > 0) {
        const latestHistory = dayHistory[dayHistory.length - 1];
        status = latestHistory.status;
      } else {
        // Geçmiş kaydı yok, zaman kontrolü yap
        const now = new Date();
        const [hours, minutes] = alarm.time.split(':').map(Number);
        const alarmTime = new Date(date);
        alarmTime.setHours(hours, minutes, 0, 0);

        // Eğer alarm zamanı geçmişse ve kayıt yoksa "missed"
        if (now > alarmTime && dateString < formatDateForCalendar(now)) {
          status = 'missed';
        }
      }

      result.push({
        id: alarm.id,
        drugId: alarm.drug_id,
        drugName: drug.name,
        time: alarm.time,
        status,
        alarmId: alarm.id,
      });
    }
  }

  // Sadece alarm olmayan geçmiş kayıtları da ekle (manuel eklenenler)
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayHistoryWithoutAlarm = history.filter((h) => {
    const takenDate = new Date(h.taken_at);
    return (
      takenDate >= dayStart &&
      takenDate <= dayEnd &&
      !h.alarm_id &&
      !result.some((r) => r.drugId === h.drug_id)
    );
  });

  for (const h of dayHistoryWithoutAlarm) {
    const drug = drugs.find((d) => d.id === h.drug_id);
    if (drug) {
      result.push({
        id: h.id,
        drugId: h.drug_id,
        drugName: drug.name,
        time: new Date(h.taken_at).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: h.status,
      });
    }
  }

  // Saate göre sırala
  return result.sort((a, b) => {
    const [aHours, aMinutes] = a.time.split(':').map(Number);
    const [bHours, bMinutes] = b.time.split(':').map(Number);
    const aTime = aHours * 60 + aMinutes;
    const bTime = bHours * 60 + bMinutes;
    return aTime - bTime;
  });
};

/**
 * Takvim için marked dates oluştur
 */
export const getMarkedDates = (
  alarms: Alarm[],
  history: History[],
  drugs: Drug[]
): MarkedDates => {
  const marked: MarkedDates = {};
  const today = new Date();
  const todayString = formatDateForCalendar(today);

  // Son 30 gün ve gelecek 30 günü kontrol et
  for (let i = -30; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateString = formatDateForCalendar(date);

    const dayAlarms = getAlarmsForDate(dateString, alarms, history, drugs);

    if (dayAlarms.length > 0) {
      // Durumlara göre renk belirle
      const hasTaken = dayAlarms.some((a) => a.status === 'taken');
      const hasMissed = dayAlarms.some((a) => a.status === 'missed');
      const hasPending = dayAlarms.some((a) => a.status === 'pending');

      let dotColor = '#6200ee'; // Varsayılan (mavi - sadece alarm var)

      if (hasMissed) {
        dotColor = '#f44336'; // Kırmızı - kaçırılan var
      } else if (hasPending && !hasTaken) {
        dotColor = '#FF9800'; // Sarı - bekleyen var
      } else if (hasTaken && !hasMissed && !hasPending) {
        dotColor = '#4CAF50'; // Yeşil - tümü alındı
      } else if (hasTaken && hasPending) {
        dotColor = '#FF9800'; // Sarı - bazıları alındı, bazıları bekliyor
      }

      // Birden fazla ilaç varsa multi-dot kullan
      if (dayAlarms.length > 1) {
        marked[dateString] = {
          marked: true,
          dots: dayAlarms.map((alarm) => {
            let color = '#6200ee';
            if (alarm.status === 'taken') color = '#4CAF50';
            else if (alarm.status === 'missed') color = '#f44336';
            else if (alarm.status === 'pending') color = '#FF9800';

            return {
              key: alarm.id,
              color,
            };
          }),
        };
      } else {
        // Tek ilaç varsa basit marking
        marked[dateString] = {
          marked: true,
          dotColor,
        };
      }

      // Bugün ise selected olarak işaretle
      if (dateString === todayString) {
        marked[dateString] = {
          ...marked[dateString],
          selected: true,
          selectedColor: '#6200ee',
        };
      }
    }
  }

  return marked;
};

/**
 * Tarihi Türkçe formatla (15 Ocak 2025)
 */
export const formatDateTurkish = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

