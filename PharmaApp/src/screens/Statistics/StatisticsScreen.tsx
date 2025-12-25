/**
 * StatisticsScreen - İstatistik ekranı (Geliştirilmiş)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, SegmentedButtons, ProgressBar, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import LocalDatabase, { History, Drug } from '../../services/database/LocalDatabase';

type PeriodType = 'today' | 'week' | 'month' | 'all';

interface DrugStats {
  drugId: string;
  drugName: string;
  total: number;
  taken: number;
  missed: number;
  successRate: number;
}

interface DailyTrend {
  date: string;
  taken: number;
  missed: number;
  total: number;
  successRate: number;
}

interface TimeBasedStats {
  morning: { total: number; taken: number; missed: number; successRate: number };
  afternoon: { total: number; taken: number; missed: number; successRate: number };
  evening: { total: number; taken: number; missed: number; successRate: number };
  night: { total: number; taken: number; missed: number; successRate: number };
}

interface BestDay {
  date: string;
  successRate: number;
  taken: number;
  total: number;
}

interface WeekComparison {
  thisWeek: { total: number; taken: number; missed: number; successRate: number };
  lastWeek: { total: number; taken: number; missed: number; successRate: number };
  change: number; // Yüzde değişim
}

type TabType = 'summary' | 'trend' | 'drugs' | 'details';

const StatisticsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [stats, setStats] = useState({
    total: 0,
    taken: 0,
    missed: 0,
    pending: 0,
    successRate: 0,
    todayTotal: 0,
    todayTaken: 0,
    todayMissed: 0,
  });
  const [drugStats, setDrugStats] = useState<DrugStats[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [avgDailyDrugs, setAvgDailyDrugs] = useState<number>(0);
  const [timeBasedStats, setTimeBasedStats] = useState<TimeBasedStats | null>(null);
  const [bestDays, setBestDays] = useState<BestDay[]>([]);
  const [weekComparison, setWeekComparison] = useState<WeekComparison | null>(null);
  const [currentWeekRange, setCurrentWeekRange] = useState<{ start: string; end: string } | null>(null);

  const calculateStats = useCallback(async (periodType: PeriodType, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const allHistory = await LocalDatabase.getAllHistory();
      const allDrugs = await LocalDatabase.getAllDrugs();
      
      // Tarih aralığını hesapla
      const now = new Date();
      let startDate: Date;
      
      switch (periodType) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'all':
          startDate = new Date(0); // Tüm zamanlar
          break;
      }

      const startTime = startDate.getTime();
      const endTime = now.getTime();

      // Filtrele
      const filteredHistory = allHistory.filter(
        (item) => item.taken_at >= startTime && item.taken_at <= endTime
      );

      // İstatistikleri hesapla
      const total = filteredHistory.length;
      const taken = filteredHistory.filter((item) => item.status === 'taken').length;
      const missed = filteredHistory.filter((item) => item.status === 'missed').length;
      const pending = filteredHistory.filter((item) => item.status === 'pending').length;
      const successRate = total > 0 ? Math.round((taken / total) * 100) : 0;

      // Bugünkü istatistikler
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const todayHistory = allHistory.filter(
        (item) => item.taken_at >= todayStart.getTime() && item.taken_at <= todayEnd.getTime()
      );

      const todayTotal = todayHistory.length;
      const todayTaken = todayHistory.filter((item) => item.status === 'taken').length;
      const todayMissed = todayHistory.filter((item) => item.status === 'missed').length;

      // İlaç bazlı istatistikler
      const drugStatsMap = new Map<string, DrugStats>();
      
      filteredHistory.forEach((item) => {
        if (!drugStatsMap.has(item.drug_id)) {
          const drug = allDrugs.find((d) => d.id === item.drug_id);
          drugStatsMap.set(item.drug_id, {
            drugId: item.drug_id,
            drugName: drug?.name || 'Bilinmeyen İlaç',
            total: 0,
            taken: 0,
            missed: 0,
            successRate: 0,
          });
        }
        
        const drugStat = drugStatsMap.get(item.drug_id)!;
        drugStat.total++;
        if (item.status === 'taken') drugStat.taken++;
        if (item.status === 'missed') drugStat.missed++;
      });

      // İlaç başarı oranlarını hesapla
      const drugStatsArray = Array.from(drugStatsMap.values())
        .map((stat) => ({
          ...stat,
          successRate: stat.total > 0 ? Math.round((stat.taken / stat.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total) // En çok kullanılan ilaçlar önce
        .slice(0, 10); // En fazla 10 ilaç göster

      // Günlük trend analizi (hafta bazlı - ilk kayıt tarihinden itibaren)
      const trendDays: DailyTrend[] = [];
      
      // İlk kayıt tarihini bul (en eski history kaydı veya 9 Aralık 2024 - ilk test tarihi)
      let firstRecordDate: Date;
      if (allHistory.length > 0) {
        // En eski kaydı bul
        const oldestHistory = allHistory.reduce((oldest, current) => 
          current.taken_at < oldest.taken_at ? current : oldest
        );
        firstRecordDate = new Date(oldestHistory.taken_at);
      } else {
        // Eğer hiç kayıt yoksa, ilk test tarihini kullan (9 Aralık 2024)
        firstRecordDate = new Date(2024, 11, 9); // month 0-indexed, 11 = Aralık
      }
      firstRecordDate.setHours(0, 0, 0, 0);
      
      // Bugünün tarihi
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // İlk kayıt tarihinden bugüne kadar geçen gün sayısı
      const daysSinceFirstRecord = Math.floor((today.getTime() - firstRecordDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Hafta numarası (0'dan başlar: ilk hafta = 0, ikinci hafta = 1, vs.)
      const weekNumber = Math.floor(daysSinceFirstRecord / 7);
      
      // Mevcut haftanın başlangıç tarihi (ilk kayıt + hafta sayısı * 7 gün)
      const currentWeekStart = new Date(firstRecordDate);
      currentWeekStart.setDate(currentWeekStart.getDate() + (weekNumber * 7));
      
      // Hafta aralığını state'e kaydet (başlık için)
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
      setCurrentWeekRange({
        start: currentWeekStart.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        end: currentWeekEnd.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      });
      
      // Mevcut haftanın 7 gününü hesapla
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayHistory = allHistory.filter(
          (item) => item.taken_at >= date.getTime() && item.taken_at <= dayEnd.getTime()
        );
        
        const dayTaken = dayHistory.filter((item) => item.status === 'taken').length;
        const dayMissed = dayHistory.filter((item) => item.status === 'missed').length;
        const dayTotal = dayHistory.length;
        const daySuccessRate = dayTotal > 0 ? Math.round((dayTaken / dayTotal) * 100) : 0;
        
        trendDays.push({
          date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
          taken: dayTaken,
          missed: dayMissed,
          total: dayTotal,
          successRate: daySuccessRate,
        });
      }

      // Streak hesapla (kaç gün üst üste başarılı - %100 başarı)
      let currentStreak = 0;
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() - i);
        checkDate.setHours(0, 0, 0, 0);
        const checkEnd = new Date(checkDate);
        checkEnd.setHours(23, 59, 59, 999);
        
        const dayHistory = allHistory.filter(
          (item) => item.taken_at >= checkDate.getTime() && item.taken_at <= checkEnd.getTime()
        );
        
        if (dayHistory.length === 0) {
          if (i === 0) continue; // Bugün için veri yoksa devam et
          break; // Veri yoksa streak'i durdur
        }
        
        const dayTaken = dayHistory.filter((item) => item.status === 'taken').length;
        const dayTotal = dayHistory.length;
        const daySuccessRate = dayTotal > 0 ? (dayTaken / dayTotal) * 100 : 0;
        
        if (daySuccessRate === 100) {
          currentStreak++;
        } else {
          if (i === 0) continue; // Bugün %100 değilse ama veri varsa devam et
          break;
        }
      }

      // Ortalama günlük ilaç sayısı (son 30 gün)
      const last30Days = allHistory.filter((item) => {
        const itemDate = new Date(item.taken_at);
        const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 30;
      });
      
      const uniqueDays = new Set<string>();
      last30Days.forEach((item) => {
        const date = new Date(item.taken_at);
        date.setHours(0, 0, 0, 0);
        uniqueDays.add(date.toISOString());
      });
      
      const avgDaily = uniqueDays.size > 0 ? Math.round((last30Days.length / uniqueDays.size) * 10) / 10 : 0;

      // Zaman bazlı analiz (sabah: 06-12, öğle: 12-18, akşam: 18-22, gece: 22-06)
      const timeBased: TimeBasedStats = {
        morning: { total: 0, taken: 0, missed: 0, successRate: 0 },
        afternoon: { total: 0, taken: 0, missed: 0, successRate: 0 },
        evening: { total: 0, taken: 0, missed: 0, successRate: 0 },
        night: { total: 0, taken: 0, missed: 0, successRate: 0 },
      };
      
      filteredHistory.forEach((item) => {
        const itemDate = new Date(item.taken_at);
        const hour = itemDate.getHours();
        
        let timeSlot: keyof TimeBasedStats;
        if (hour >= 6 && hour < 12) timeSlot = 'morning';
        else if (hour >= 12 && hour < 18) timeSlot = 'afternoon';
        else if (hour >= 18 && hour < 22) timeSlot = 'evening';
        else timeSlot = 'night';
        
        timeBased[timeSlot].total++;
        if (item.status === 'taken') timeBased[timeSlot].taken++;
        if (item.status === 'missed') timeBased[timeSlot].missed++;
      });
      
      Object.keys(timeBased).forEach((key) => {
        const slot = timeBased[key as keyof TimeBasedStats];
        slot.successRate = slot.total > 0 ? Math.round((slot.taken / slot.total) * 100) : 0;
      });

      // En iyi günler (son 30 gün içinde en yüksek başarı oranına sahip günler)
      const bestDaysMap = new Map<string, { taken: number; total: number }>();
      const last30DaysHistory = allHistory.filter((item) => {
        const itemDate = new Date(item.taken_at);
        const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 30;
      });
      
      last30DaysHistory.forEach((item) => {
        const date = new Date(item.taken_at);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split('T')[0];
        
        if (!bestDaysMap.has(dateKey)) {
          bestDaysMap.set(dateKey, { taken: 0, total: 0 });
        }
        
        const dayStat = bestDaysMap.get(dateKey)!;
        dayStat.total++;
        if (item.status === 'taken') dayStat.taken++;
      });
      
      const bestDaysArray: BestDay[] = Array.from(bestDaysMap.entries())
        .map(([dateKey, stat]) => ({
          date: new Date(dateKey).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          successRate: stat.total > 0 ? Math.round((stat.taken / stat.total) * 100) : 0,
          taken: stat.taken,
          total: stat.total,
        }))
        .filter((day) => day.total > 0)
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5);

      // Haftalık karşılaştırma
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - now.getDay()); // Bu haftanın başlangıcı (Pazar)
      thisWeekStart.setHours(0, 0, 0, 0);
      
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);
      
      const thisWeekHistory = allHistory.filter(
        (item) => item.taken_at >= thisWeekStart.getTime() && item.taken_at <= now.getTime()
      );
      
      const lastWeekHistory = allHistory.filter(
        (item) => item.taken_at >= lastWeekStart.getTime() && item.taken_at <= lastWeekEnd.getTime()
      );
      
      const thisWeekStats = {
        total: thisWeekHistory.length,
        taken: thisWeekHistory.filter((item) => item.status === 'taken').length,
        missed: thisWeekHistory.filter((item) => item.status === 'missed').length,
        successRate: thisWeekHistory.length > 0
          ? Math.round((thisWeekHistory.filter((item) => item.status === 'taken').length / thisWeekHistory.length) * 100)
          : 0,
      };
      
      const lastWeekStats = {
        total: lastWeekHistory.length,
        taken: lastWeekHistory.filter((item) => item.status === 'taken').length,
        missed: lastWeekHistory.filter((item) => item.status === 'missed').length,
        successRate: lastWeekHistory.length > 0
          ? Math.round((lastWeekHistory.filter((item) => item.status === 'taken').length / lastWeekHistory.length) * 100)
          : 0,
      };
      
      const weekChange = lastWeekStats.successRate > 0
        ? Math.round(((thisWeekStats.successRate - lastWeekStats.successRate) / lastWeekStats.successRate) * 100)
        : thisWeekStats.successRate > 0 ? 100 : 0;

      setStats({
        total,
        taken,
        missed,
        pending,
        successRate,
        todayTotal,
        todayTaken,
        todayMissed,
      });
      setDrugStats(drugStatsArray);
      setDailyTrend(trendDays);
      setStreak(currentStreak);
      setAvgDailyDrugs(avgDaily);
      setTimeBasedStats(timeBased);
      setBestDays(bestDaysArray);
      setWeekComparison({
        thisWeek: thisWeekStats,
        lastWeek: lastWeekStats,
        change: weekChange,
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    calculateStats(period, true);
  }, [period, calculateStats]);

  useFocusEffect(
    useCallback(() => {
      calculateStats(period);
    }, [period, calculateStats])
  );

  const getPeriodText = (periodType: PeriodType): string => {
    switch (periodType) {
      case 'today':
        return 'Bugün';
      case 'week':
        return 'Son 7 Gün';
      case 'month':
        return 'Son 30 Gün';
      case 'all':
        return 'Tüm Zamanlar';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200ee']} />
      }>
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          İstatistikler
        </Text>

        {/* Periyot Seçimi */}
        <SegmentedButtons
          value={period}
          onValueChange={(value) => setPeriod(value as PeriodType)}
          buttons={[
            { value: 'today', label: 'Bugün' },
            { value: 'week', label: '7 Gün' },
            { value: 'month', label: '30 Gün' },
            { value: 'all', label: 'Tümü' },
          ]}
          style={styles.segmentedButtons}
        />

        {/* Tab Seçimi */}
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabType)}
          buttons={[
            { value: 'summary', label: 'Özet', icon: 'chart-box' },
            { value: 'trend', label: 'Trend', icon: 'trending-up' },
            { value: 'drugs', label: 'İlaçlar', icon: 'pill' },
            { value: 'details', label: 'Detaylar', icon: 'information' },
          ]}
          style={styles.tabButtons}
        />

        {/* Tab İçeriği */}
        {activeTab === 'summary' && (
          <>
            {/* Streak (Seri) */}
            {streak > 0 && (
              <Card style={[styles.card, styles.streakCard]}>
                <Card.Content>
                  <View style={styles.streakContainer}>
                    <Text variant="headlineLarge" style={styles.streakNumber}>
                      🔥 {streak}
                    </Text>
                    <Text variant="titleMedium" style={styles.streakLabel}>
                      Gün Üst Üste Başarılı!
                    </Text>
                    <Text variant="bodySmall" style={styles.streakSubtext}>
                      Harika bir seri yakaladınız! 🎉
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Bugünkü Özet */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Bugünkü Özet
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={styles.statNumber}>
                      {stats.todayTotal}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Toplam
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statNumber, styles.successColor]}>
                      {stats.todayTaken}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Alındı
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statNumber, styles.errorColor]}>
                      {stats.todayMissed}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Kaçırıldı
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Başarı Oranı */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Başarı Oranı
                </Text>
                <View style={styles.successRateContainer}>
                  <Text variant="displaySmall" style={styles.successRateText}>
                    %{stats.successRate}
                  </Text>
                  <ProgressBar
                    progress={stats.successRate / 100}
                    color={
                      stats.successRate >= 80
                        ? '#4CAF50'
                        : stats.successRate >= 50
                        ? '#FF9800'
                        : '#f44336'
                    }
                    style={styles.progressBar}
                  />
                  <Chip
                    icon={stats.successRate >= 80 ? 'check-circle' : stats.successRate >= 50 ? 'alert-circle' : 'close-circle'}
                    style={[
                      styles.successRateChip,
                      stats.successRate >= 80
                        ? styles.successChip
                        : stats.successRate >= 50
                        ? styles.warningChip
                        : styles.errorChip,
                    ]}>
                    {stats.successRate >= 80
                      ? 'Mükemmel'
                      : stats.successRate >= 50
                      ? 'İyi'
                      : 'Geliştirilmeli'}
                  </Chip>
                </View>
                {stats.total === 0 && (
                  <Text variant="bodySmall" style={styles.emptyText}>
                    Henüz veri yok
                  </Text>
                )}
              </Card.Content>
            </Card>

            {/* Seçili Periyot İstatistikleri */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  {getPeriodText(period)} İstatistikleri
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={styles.statNumber}>
                      {stats.total}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Toplam
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statNumber, styles.successColor]}>
                      {stats.taken}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Alındı
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statNumber, styles.errorColor]}>
                      {stats.missed}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      Kaçırıldı
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Ortalama Günlük İlaç Sayısı */}
            {avgDailyDrugs > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Ortalama Günlük İlaç
                  </Text>
                  <View style={styles.avgContainer}>
                    <Text variant="displaySmall" style={styles.avgNumber}>
                      {avgDailyDrugs}
                    </Text>
                    <Text variant="bodyMedium" style={styles.avgLabel}>
                      ilaç/gün (son 30 gün)
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {activeTab === 'trend' && (
          <>
            {/* Günlük Trend Analizi */}
            {dailyTrend.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    {currentWeekRange ? `Haftalık Trend (${currentWeekRange.start} - ${currentWeekRange.end})` : 'Haftalık Trend'}
                  </Text>
                  {dailyTrend.map((day, index) => (
                    <View key={index} style={styles.trendItem}>
                      <View style={styles.trendHeader}>
                        <Text variant="bodyMedium" style={styles.trendDate}>
                          {day.date}
                        </Text>
                        <Text variant="bodySmall" style={styles.trendRate}>
                          %{day.successRate}
                        </Text>
                      </View>
                      <View style={styles.trendBarContainer}>
                        <View
                          style={[
                            styles.trendBar,
                            { width: `${day.total > 0 ? (day.taken / day.total) * 100 : 0}%` },
                            styles.trendBarSuccess,
                          ]}
                        />
                        <View
                          style={[
                            styles.trendBar,
                            { width: `${day.total > 0 ? (day.missed / day.total) * 100 : 0}%` },
                            styles.trendBarError,
                          ]}
                        />
                      </View>
                      <View style={styles.trendStats}>
                        <Text variant="bodySmall" style={styles.successColor}>
                          ✓ {day.taken}
                        </Text>
                        <Text variant="bodySmall" style={styles.errorColor}>
                          ✗ {day.missed}
                        </Text>
                        <Text variant="bodySmall" style={styles.statLabel}>
                          Toplam: {day.total}
                        </Text>
                      </View>
                      {index < dailyTrend.length - 1 && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {/* Haftalık Karşılaştırma */}
            {weekComparison && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Haftalık Karşılaştırma
                  </Text>
                  <View style={styles.comparisonContainer}>
                    <View style={styles.comparisonItem}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        Bu Hafta
                      </Text>
                      <Text variant="headlineMedium" style={styles.comparisonValue}>
                        %{weekComparison.thisWeek.successRate}
                      </Text>
                      <Text variant="bodySmall" style={styles.comparisonDetails}>
                        {weekComparison.thisWeek.taken}/{weekComparison.thisWeek.total}
                      </Text>
                    </View>
                    <View style={styles.comparisonDivider} />
                    <View style={styles.comparisonItem}>
                      <Text variant="bodySmall" style={styles.comparisonLabel}>
                        Geçen Hafta
                      </Text>
                      <Text variant="headlineMedium" style={styles.comparisonValue}>
                        %{weekComparison.lastWeek.successRate}
                      </Text>
                      <Text variant="bodySmall" style={styles.comparisonDetails}>
                        {weekComparison.lastWeek.taken}/{weekComparison.lastWeek.total}
                      </Text>
                    </View>
                  </View>
                  {weekComparison.change !== 0 && (
                    <Chip
                      icon={weekComparison.change > 0 ? 'trending-up' : 'trending-down'}
                      style={[
                        styles.comparisonChip,
                        weekComparison.change > 0 ? styles.successChip : styles.errorChip,
                      ]}
                      textStyle={styles.chipText}>
                      {weekComparison.change > 0 ? '+' : ''}
                      {weekComparison.change}% değişim
                    </Chip>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* En İyi Günler */}
            {bestDays.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    En İyi Günler
                  </Text>
                  {bestDays.map((day, index) => (
                    <View key={index} style={styles.bestDayItem}>
                      <View style={styles.bestDayHeader}>
                        <Text variant="bodyLarge" style={styles.bestDayDate}>
                          {day.date}
                        </Text>
                        <Chip
                          style={[
                            styles.bestDayChip,
                            day.successRate === 100
                              ? styles.successChip
                              : day.successRate >= 80
                              ? styles.warningChip
                              : styles.errorChip,
                          ]}
                          textStyle={styles.chipText}>
                          %{day.successRate}
                        </Chip>
                      </View>
                      <Text variant="bodySmall" style={styles.bestDayDetails}>
                        {day.taken}/{day.total} ilaç alındı
                      </Text>
                      {index < bestDays.length - 1 && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {activeTab === 'drugs' && (
          <>
            {/* İlaç Bazlı İstatistikler */}
            {drugStats.length > 0 ? (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    İlaç Bazlı İstatistikler
                  </Text>
                  {drugStats.map((drugStat, index) => (
                    <View key={drugStat.drugId} style={styles.drugStatItem}>
                      <View style={styles.drugStatHeader}>
                        <Text variant="bodyLarge" style={styles.drugName}>
                          {drugStat.drugName}
                        </Text>
                        <Chip
                          style={[
                            styles.drugStatChip,
                            drugStat.successRate >= 80
                              ? styles.successChip
                              : drugStat.successRate >= 50
                              ? styles.warningChip
                              : styles.errorChip,
                          ]}
                          textStyle={styles.chipText}>
                          %{drugStat.successRate}
                        </Chip>
                      </View>
                      <View style={styles.drugStatDetails}>
                        <Text variant="bodySmall" style={styles.successColor}>
                          Alındı: {drugStat.taken}
                        </Text>
                        <Text variant="bodySmall" style={styles.errorColor}>
                          Kaçırıldı: {drugStat.missed}
                        </Text>
                        <Text variant="bodySmall" style={styles.statLabel}>
                          Toplam: {drugStat.total}
                        </Text>
                      </View>
                      {index < drugStats.length - 1 && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </Card.Content>
              </Card>
            ) : (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    Henüz ilaç bazlı veri yok
                  </Text>
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {activeTab === 'details' && (
          <>
            {/* Zaman Bazlı Analiz */}
            {timeBasedStats && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Zaman Bazlı Performans
                  </Text>
                  <View style={styles.timeBasedContainer}>
                    {[
                      { key: 'morning', label: 'Sabah (06-12)', icon: 'weather-sunny' },
                      { key: 'afternoon', label: 'Öğle (12-18)', icon: 'weather-partly-cloudy' },
                      { key: 'evening', label: 'Akşam (18-22)', icon: 'weather-sunset' },
                      { key: 'night', label: 'Gece (22-06)', icon: 'weather-night' },
                    ].map((timeSlot) => {
                      const slot = timeBasedStats[timeSlot.key as keyof TimeBasedStats];
                      return (
                        <View key={timeSlot.key} style={styles.timeSlotItem}>
                          <View style={styles.timeSlotHeader}>
                            <Text variant="bodyMedium" style={styles.timeSlotLabel}>
                              {timeSlot.label}
                            </Text>
                            <Text variant="bodySmall" style={styles.timeSlotRate}>
                              %{slot.successRate}
                            </Text>
                          </View>
                          <View style={styles.timeSlotBarContainer}>
                            <View
                              style={[
                                styles.timeSlotBar,
                                {
                                  width: `${slot.total > 0 ? (slot.taken / slot.total) * 100 : 0}%`,
                                },
                                styles.trendBarSuccess,
                              ]}
                            />
                            <View
                              style={[
                                styles.timeSlotBar,
                                {
                                  width: `${slot.total > 0 ? (slot.missed / slot.total) * 100 : 0}%`,
                                },
                                styles.trendBarError,
                              ]}
                            />
                          </View>
                          <Text variant="bodySmall" style={styles.timeSlotDetails}>
                            {slot.taken} alındı, {slot.missed} kaçırıldı ({slot.total} toplam)
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Detaylı Bilgiler */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Detaylı Bilgiler
                </Text>
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">Toplam Kayıt:</Text>
                  <Text variant="bodyMedium" style={styles.detailValue}>
                    {stats.total}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">Başarılı:</Text>
                  <Chip style={[styles.detailChip, styles.successChip]} textStyle={styles.chipText}>
                    {stats.taken}
                  </Chip>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="bodyMedium">Kaçırılan:</Text>
                  <Chip style={[styles.detailChip, styles.errorChip]} textStyle={styles.chipText}>
                    {stats.missed}
                  </Chip>
                </View>
                {stats.pending > 0 && (
                  <View style={styles.detailRow}>
                    <Text variant="bodyMedium">Beklemede:</Text>
                    <Chip style={[styles.detailChip, styles.warningChip]} textStyle={styles.chipText}>
                      {stats.pending}
                    </Chip>
                  </View>
                )}
              </Card.Content>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  tabButtons: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: 'gray',
  },
  successColor: {
    color: '#4CAF50',
  },
  errorColor: {
    color: '#f44336',
  },
  successRateContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  successRateText: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#6200ee',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    width: '100%',
    marginBottom: 12,
  },
  successRateChip: {
    marginTop: 8,
  },
  successChip: {
    backgroundColor: '#c8e6c9',
  },
  warningChip: {
    backgroundColor: '#fff9c4',
  },
  errorChip: {
    backgroundColor: '#ffcdd2',
  },
  emptyText: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailValue: {
    fontWeight: 'bold',
  },
  detailChip: {
    minWidth: 60,
  },
  chipText: {
    color: '#000',
    fontWeight: 'bold',
  },
  trendItem: {
    marginBottom: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendDate: {
    fontWeight: 'bold',
  },
  trendRate: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  trendBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    marginBottom: 4,
  },
  trendBar: {
    height: '100%',
  },
  trendBarSuccess: {
    backgroundColor: '#4CAF50',
  },
  trendBarError: {
    backgroundColor: '#f44336',
  },
  trendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 12,
  },
  drugStatItem: {
    marginBottom: 12,
  },
  drugStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drugName: {
    fontWeight: 'bold',
    flex: 1,
  },
  drugStatChip: {
    marginLeft: 8,
  },
  drugStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakCard: {
    backgroundColor: '#fff3e0',
    borderWidth: 2,
    borderColor: '#ff9800',
  },
  streakContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  streakNumber: {
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 4,
  },
  streakLabel: {
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 4,
  },
  streakSubtext: {
    color: '#bf360c',
    textAlign: 'center',
  },
  comparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 16,
  },
  comparisonItem: {
    alignItems: 'center',
    flex: 1,
  },
  comparisonLabel: {
    color: 'gray',
    marginBottom: 4,
  },
  comparisonValue: {
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 4,
  },
  comparisonDetails: {
    color: 'gray',
  },
  comparisonDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#e0e0e0',
  },
  comparisonChip: {
    marginTop: 8,
    alignSelf: 'center',
  },
  avgContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avgNumber: {
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 4,
  },
  avgLabel: {
    color: 'gray',
  },
  timeBasedContainer: {
    marginTop: 8,
  },
  timeSlotItem: {
    marginBottom: 16,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeSlotLabel: {
    fontWeight: 'bold',
    flex: 1,
  },
  timeSlotRate: {
    fontWeight: 'bold',
    color: '#6200ee',
  },
  timeSlotBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
    marginBottom: 4,
  },
  timeSlotBar: {
    height: '100%',
  },
  timeSlotDetails: {
    color: 'gray',
    fontSize: 12,
  },
  bestDayItem: {
    marginBottom: 12,
  },
  bestDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bestDayDate: {
    fontWeight: 'bold',
    flex: 1,
  },
  bestDayChip: {
    marginLeft: 8,
  },
  bestDayDetails: {
    color: 'gray',
  },
});

export default StatisticsScreen;
