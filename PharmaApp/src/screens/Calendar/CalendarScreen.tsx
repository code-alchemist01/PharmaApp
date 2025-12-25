/**
 * CalendarScreen - Takvim görünümü ekranı
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Calendar, DateData, MarkedDates } from 'react-native-calendars';
import {
  Text,
  Card,
  FAB,
  Chip,
  ActivityIndicator,
  Divider,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LocalDatabase, { Alarm, History, Drug } from '../../services/database/LocalDatabase';
import {
  getAlarmsForDate,
  getMarkedDates,
  formatDateForCalendar,
  formatDateTurkish,
  CalendarAlarm,
} from '../../utils/calendarHelpers';

type CalendarScreenNavigationProp = StackNavigationProp<any, 'Calendar'>;

const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateForCalendar(new Date())
  );
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [dayAlarms, setDayAlarms] = useState<CalendarAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [allAlarms, allHistory, allDrugs] = await Promise.all([
        LocalDatabase.getAllAlarms(),
        LocalDatabase.getAllHistory(),
        LocalDatabase.getAllDrugs(),
      ]);

      setAlarms(allAlarms);
      setHistory(allHistory);
      setDrugs(allDrugs);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  // Marked dates'i güncelle
  useEffect(() => {
    if (alarms.length > 0 || history.length > 0) {
      const marked = getMarkedDates(alarms, history, drugs);
      setMarkedDates(marked);
    }
  }, [alarms, history, drugs]);

  // Seçilen günün alarmlarını güncelle
  useEffect(() => {
    if (selectedDate && alarms.length > 0 && drugs.length > 0) {
      const dayAlarmsList = getAlarmsForDate(selectedDate, alarms, history, drugs);
      setDayAlarms(dayAlarmsList);
    }
  }, [selectedDate, alarms, history, drugs]);

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const handleAddAlarm = () => {
    // AlarmStack'e navigate et
    (navigation as any).navigate('Alarms', {
      screen: 'AlarmSetting',
      params: { selectedDate },
    });
  };

  const handleAlarmPress = (alarm: CalendarAlarm) => {
    if (alarm.alarmId) {
      // AlarmStack'e navigate et
      (navigation as any).navigate('Alarms', {
        screen: 'AlarmSetting',
        params: { alarmId: alarm.alarmId },
      });
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'taken':
        return '#4CAF50';
      case 'missed':
        return '#f44336';
      case 'pending':
        return '#FF9800';
      default:
        return '#6200ee';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'taken':
        return 'Alındı';
      case 'missed':
        return 'Kaçırıldı';
      case 'pending':
        return 'Bekliyor';
      default:
        return 'Bilinmiyor';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'taken':
        return 'check-circle';
      case 'missed':
        return 'cancel';
      case 'pending':
        return 'schedule';
      default:
        return 'help';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          todayTextColor: '#6200ee',
          selectedDayBackgroundColor: '#6200ee',
          selectedDayTextColor: '#ffffff',
          arrowColor: '#6200ee',
          monthTextColor: '#212121',
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 13,
        }}
        style={styles.calendar}
      />

      <Divider />

      <ScrollView
        style={styles.alarmsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }>
        <View style={styles.dateHeader}>
          <Text variant="titleLarge" style={styles.dateTitle}>
            {formatDateTurkish(selectedDate)}
          </Text>
          {dayAlarms.length > 0 && (
            <Chip icon="alarm" style={styles.alarmCountChip}>
              {dayAlarms.length} alarm
            </Chip>
          )}
        </View>

        {dayAlarms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="bodyLarge" style={styles.emptyText}>
                Bu tarihte alarm bulunmuyor
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                Yeni alarm eklemek için + butonuna basın
              </Text>
            </Card.Content>
          </Card>
        ) : (
          dayAlarms.map((alarm) => (
            <Card
              key={alarm.id}
              style={styles.alarmCard}
              onPress={() => handleAlarmPress(alarm)}>
              <Card.Content style={styles.alarmCardContent}>
                <View style={styles.alarmInfo}>
                  <View style={styles.alarmHeader}>
                    <Text variant="titleMedium" style={styles.drugName}>
                      {alarm.drugName}
                    </Text>
                    <Chip
                      icon={getStatusIcon(alarm.status)}
                      style={[
                        styles.statusChip,
                        { backgroundColor: getStatusColor(alarm.status) + '20' },
                      ]}
                      textStyle={{ color: getStatusColor(alarm.status) }}>
                      {getStatusText(alarm.status)}
                    </Chip>
                  </View>
                  <View style={styles.alarmTimeRow}>
                    <IconButton icon="clock-outline" size={16} iconColor="#757575" />
                    <Text variant="bodyLarge" style={styles.alarmTime}>
                      {alarm.time}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={handleAddAlarm} label="Alarm Ekle" />
    </View>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  calendar: {
    backgroundColor: '#ffffff',
    paddingBottom: 10,
  },
  alarmsList: {
    flex: 1,
    padding: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateTitle: {
    fontWeight: 'bold',
    color: '#212121',
  },
  alarmCountChip: {
    backgroundColor: '#6200ee20',
  },
  emptyCard: {
    marginTop: 8,
    backgroundColor: '#ffffff',
  },
  emptyText: {
    textAlign: 'center',
    color: '#757575',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#9e9e9e',
  },
  alarmCard: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  alarmCardContent: {
    padding: 16,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drugName: {
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
  },
  statusChip: {
    height: 28,
  },
  alarmTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alarmTime: {
    color: '#757575',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
});

export default CalendarScreen;

