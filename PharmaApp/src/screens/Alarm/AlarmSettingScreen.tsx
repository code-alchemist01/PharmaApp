/**
 * AlarmSettingScreen - Alarm ekleme/düzenleme ekranı
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  SegmentedButtons,
  Checkbox,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LocalDatabase, { Alarm, Drug } from '../../services/database/LocalDatabase';
import FirestoreService from '../../services/database/FirestoreService';
import NotificationService from '../../services/notification/NotificationService';
import { ALARM_REPEAT_TYPES, DEFAULT_REMINDER_BEFORE } from '../../utils/constants';
import { generateId } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

type AlarmSettingScreenNavigationProp = StackNavigationProp<any, 'AlarmSetting'>;

interface RouteParams {
  alarmId?: string;
  drugId?: string;
}

const AlarmSettingScreen: React.FC = () => {
  const navigation = useNavigation<AlarmSettingScreenNavigationProp>();
  const route = useRoute();
  const { user } = useAuth();
  const params = (route.params as RouteParams) || {};

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [selectedDrugId, setSelectedDrugId] = useState<string>(params.drugId || '');
  const [time, setTime] = useState({ hours: 9, minutes: 0 });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempHours, setTempHours] = useState('09');
  const [tempMinutes, setTempMinutes] = useState('00');
  const [repeatType, setRepeatType] = useState<'daily' | 'custom' | 'interval'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0=Pazar, 1=Pazartesi, ...
  const [intervalHours, setIntervalHours] = useState<string>('24');
  const [reminderBefore, setReminderBefore] = useState<string>(String(DEFAULT_REMINDER_BEFORE));
  const [soundPath, setSoundPath] = useState<string | undefined>(undefined);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Alarm sesleri listesi
  const alarmSounds = [
    { value: 'default', label: 'Varsayılan' },
    { value: 'gentle', label: 'Yumuşak' },
    { value: 'classic', label: 'Klasik' },
    { value: 'modern', label: 'Modern' },
  ];

  const weekDays = [
    { label: 'Paz', value: 0 },
    { label: 'Pzt', value: 1 },
    { label: 'Sal', value: 2 },
    { label: 'Çar', value: 3 },
    { label: 'Per', value: 4 },
    { label: 'Cum', value: 5 },
    { label: 'Cmt', value: 6 },
  ];

  useEffect(() => {
    loadDrugs();
    if (params.alarmId) {
      loadAlarm(params.alarmId);
    }
  }, []);

  const loadDrugs = async () => {
    try {
      const allDrugs = await LocalDatabase.getAllDrugs();
      setDrugs(allDrugs);
    } catch (error) {
      console.error('Error loading drugs:', error);
    }
  };

  const loadAlarm = async (alarmId: string) => {
    try {
      const alarms = await LocalDatabase.getAllAlarms();
      const alarm = alarms.find((a) => a.id === alarmId);
      if (alarm) {
        setIsEditing(true);
        setSelectedDrugId(alarm.drug_id);
        const [hours, minutes] = alarm.time.split(':').map(Number);
        setTime({ hours, minutes });
        setTempHours(String(hours).padStart(2, '0'));
        setTempMinutes(String(minutes).padStart(2, '0'));
        setRepeatType(alarm.repeat_type);
        if (alarm.repeat_days) {
          setSelectedDays(JSON.parse(alarm.repeat_days));
        }
        if (alarm.interval_hours) {
          setIntervalHours(String(alarm.interval_hours));
        }
        setReminderBefore(String(alarm.reminder_before));
        setSoundPath(alarm.sound_path || undefined);
        setIsActive(alarm.is_active === 1);
      }
    } catch (error) {
      console.error('Error loading alarm:', error);
    }
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!selectedDrugId) {
      return;
    }

    setLoading(true);

    try {
      const timeString = `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
      const alarmId = isEditing && params.alarmId ? params.alarmId : generateId();

      const alarm: Alarm = {
        id: alarmId,
        drug_id: selectedDrugId,
        time: timeString,
        repeat_type: repeatType,
        repeat_days: repeatType === 'custom' ? JSON.stringify(selectedDays) : undefined,
        interval_hours: repeatType === 'interval' ? parseInt(intervalHours) : undefined,
        reminder_before: parseInt(reminderBefore) || DEFAULT_REMINDER_BEFORE,
        sound_path: soundPath || undefined,
        is_active: isActive ? 1 : 0,
        created_at: isEditing ? Date.now() : Date.now(),
      };

      if (isEditing) {
        await LocalDatabase.updateAlarm(alarm);
        await LocalDatabase.updateSyncStatus('alarms', alarmId, false);
      } else {
        await LocalDatabase.addAlarm(alarm);
        await LocalDatabase.updateSyncStatus('alarms', alarmId, false);
      }

      // Firestore'a senkronize et
      try {
        if (isEditing) {
          await FirestoreService.updateAlarm(alarm);
        } else {
          await FirestoreService.addAlarm(alarm);
        }
        await LocalDatabase.updateSyncStatus('alarms', alarmId, true);
      } catch (error) {
        console.error('Firestore sync error:', error);
      }

      // Bildirimi zamanla
      if (selectedDrug && isActive) {
        NotificationService.cancelAlarmNotification(alarmId);
        await NotificationService.scheduleAlarmNotification(alarm, selectedDrug.name);
      } else if (!isActive) {
        NotificationService.cancelAlarmNotification(alarmId);
      }

      setLoading(false);
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving alarm:', error);
      Alert.alert('Hata', error.message || 'Alarm kaydedilemedi');
      setLoading(false);
    }
  };

  const selectedDrug = drugs.find((d) => d.id === selectedDrugId);

  // Tekrarlı alarm önizleme hesapla
  const getAlarmPreview = (): string[] => {
    const previews: string[] = [];
    const now = new Date();
    const [hours, minutes] = [time.hours, time.minutes];
    
    if (repeatType === 'daily') {
      // Günlük tekrar - sonraki 5 gün
      for (let i = 0; i < 5; i++) {
        const alarmDate = new Date(now);
        alarmDate.setDate(alarmDate.getDate() + i);
        alarmDate.setHours(hours, minutes, 0, 0);
        
        // Eğer bugünün saati geçtiyse, yarın için göster
        if (i === 0 && alarmDate <= now) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        
        previews.push(
          alarmDate.toLocaleDateString('tr-TR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          }) + ` ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        );
      }
    } else if (repeatType === 'custom' && selectedDays.length > 0) {
      // Özel günler - sonraki 7 gün içinde seçili günler
      let count = 0;
      for (let i = 0; i < 14 && count < 5; i++) {
        const alarmDate = new Date(now);
        alarmDate.setDate(alarmDate.getDate() + i);
        const dayOfWeek = alarmDate.getDay();
        
        if (selectedDays.includes(dayOfWeek)) {
          alarmDate.setHours(hours, minutes, 0, 0);
          
          // Eğer bugünün saati geçtiyse, sonraki seçili güne geç
          if (i === 0 && alarmDate <= now) {
            continue;
          }
          
          previews.push(
            alarmDate.toLocaleDateString('tr-TR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
            }) + ` ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
          );
          count++;
        }
      }
    } else if (repeatType === 'interval') {
      // Aralıklı - sonraki 5 alarm
      const interval = parseInt(intervalHours) || 24;
      let nextAlarm = new Date(now);
      nextAlarm.setHours(hours, minutes, 0, 0);
      
      // Eğer bugünün saati geçtiyse, ilk alarmı hesapla
      if (nextAlarm <= now) {
        nextAlarm.setTime(nextAlarm.getTime() + interval * 60 * 60 * 1000);
      }
      
      for (let i = 0; i < 5; i++) {
        const alarmTime = new Date(nextAlarm.getTime() + i * interval * 60 * 60 * 1000);
        previews.push(
          alarmTime.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
          }) + ` ${String(alarmTime.getHours()).padStart(2, '0')}:${String(alarmTime.getMinutes()).padStart(2, '0')}`
        );
      }
    }
    
    return previews.length > 0 ? previews : ['Alarm ayarlarını tamamlayın'];
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              {isEditing ? 'Alarmı Düzenle' : 'Yeni Alarm'}
            </Text>

            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                İlaç Seç
              </Text>
              {selectedDrug ? (
                <Card style={styles.drugCard}>
                  <Card.Content>
                    <Text variant="titleMedium">{selectedDrug.name}</Text>
                    {selectedDrug.dosage && (
                      <Text variant="bodySmall" style={styles.dosageText}>
                        {selectedDrug.dosage}
                      </Text>
                    )}
                  </Card.Content>
                  <Card.Actions>
                    <Button onPress={() => setSelectedDrugId('')}>Değiştir</Button>
                  </Card.Actions>
                </Card>
              ) : (
                <View>
                  <Text variant="bodyMedium" style={styles.placeholderText}>
                    İlaç seçilmedi
                  </Text>
                  <View style={styles.drugList}>
                    {drugs.map((drug) => (
                      <Button
                        key={drug.id}
                        mode="outlined"
                        onPress={() => setSelectedDrugId(drug.id)}
                        style={styles.drugButton}>
                        {drug.name}
                      </Button>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                Saat
              </Text>
              <Button
                mode="outlined"
                onPress={() => {
                  setTempHours(String(time.hours).padStart(2, '0'));
                  setTempMinutes(String(time.minutes).padStart(2, '0'));
                  setShowTimePicker(true);
                }}
                icon="clock">
                {String(time.hours).padStart(2, '0')}:{String(time.minutes).padStart(2, '0')}
              </Button>
              <Portal>
                <Dialog visible={showTimePicker} onDismiss={() => setShowTimePicker(false)}>
                  <Dialog.Title>Saat Seç</Dialog.Title>
                  <Dialog.Content>
                    <View style={styles.timePickerContainer}>
                      <View style={styles.timeInputContainer}>
                        <TextInput
                          label="Saat"
                          value={tempHours}
                          onChangeText={(text) => {
                            // Sadece rakamları al
                            const cleaned = text.replace(/[^0-9]/g, '');
                            
                            // Boşsa 00 yap
                            if (cleaned === '') {
                              setTempHours('');
                              return;
                            }
                            
                            // Maksimum 2 karakter
                            const limited = cleaned.substring(0, 2);
                            
                            // Eğer 2 karakter varsa ve geçerli bir saat değilse, sadece ilk karakteri al
                            if (limited.length === 2) {
                              const num = parseInt(limited);
                              if (num >= 0 && num <= 23) {
                                setTempHours(limited);
                              } else {
                                // Geçersizse, sadece ilk karakteri al
                                setTempHours(limited[0]);
                              }
                            } else {
                              // Tek karakter ise direkt kullan
                              setTempHours(limited);
                            }
                          }}
                          keyboardType="number-pad"
                          mode="outlined"
                          style={styles.timeInput}
                          maxLength={2}
                        />
                        <Text variant="headlineMedium" style={styles.timeSeparator}>
                          :
                        </Text>
                        <TextInput
                          label="Dakika"
                          value={tempMinutes}
                          onChangeText={(text) => {
                            // Sadece rakamları al
                            const cleaned = text.replace(/[^0-9]/g, '');
                            
                            // Boşsa boş bırak
                            if (cleaned === '') {
                              setTempMinutes('');
                              return;
                            }
                            
                            // Maksimum 2 karakter
                            const limited = cleaned.substring(0, 2);
                            
                            // Eğer 2 karakter varsa ve geçerli bir dakika değilse, sadece ilk karakteri al
                            if (limited.length === 2) {
                              const num = parseInt(limited);
                              if (num >= 0 && num <= 59) {
                                setTempMinutes(limited);
                              } else {
                                // Geçersizse, sadece ilk karakteri al
                                setTempMinutes(limited[0]);
                              }
                            } else {
                              // Tek karakter ise direkt kullan
                              setTempMinutes(limited);
                            }
                          }}
                          keyboardType="number-pad"
                          mode="outlined"
                          style={styles.timeInput}
                          maxLength={2}
                        />
                      </View>
                    </View>
                  </Dialog.Content>
                  <Dialog.Actions>
                    <Button onPress={() => setShowTimePicker(false)}>İptal</Button>
                    <Button
                      onPress={() => {
                        const hours = parseInt(tempHours) || 0;
                        const minutes = parseInt(tempMinutes) || 0;
                        // Validasyon
                        const validHours = Math.min(23, Math.max(0, hours));
                        const validMinutes = Math.min(59, Math.max(0, minutes));
                        setTime({
                          hours: validHours,
                          minutes: validMinutes,
                        });
                        setShowTimePicker(false);
                      }}>
                      Tamam
                    </Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
            </View>

            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                Tekrar
              </Text>
              <SegmentedButtons
                value={repeatType}
                onValueChange={(value) => setRepeatType(value as any)}
                buttons={[
                  { value: 'daily', label: 'Günlük' },
                  { value: 'custom', label: 'Özel' },
                  { value: 'interval', label: 'Aralıklı' },
                ]}
              />

              {repeatType === 'custom' && (
                <View style={styles.daysContainer}>
                  {weekDays.map((day) => (
                    <Checkbox.Item
                      key={day.value}
                      label={day.label}
                      status={selectedDays.includes(day.value) ? 'checked' : 'unchecked'}
                      onPress={() => handleDayToggle(day.value)}
                    />
                  ))}
                </View>
              )}

              {repeatType === 'interval' && (
                <TextInput
                  label="Aralık (saat)"
                  value={intervalHours}
                  onChangeText={setIntervalHours}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                />
              )}
            </View>

            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                Hatırlatma (dakika önce)
              </Text>
              <TextInput
                label="Dakika"
                value={reminderBefore}
                onChangeText={setReminderBefore}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
              />
            </View>

            <View style={styles.section}>
              <Text variant="labelLarge" style={styles.label}>
                Alarm Sesi
              </Text>
              <Button
                mode="outlined"
                onPress={() => setShowSoundPicker(true)}
                icon="music-note"
                style={styles.soundButton}>
                {soundPath ? alarmSounds.find((s) => s.value === soundPath)?.label || 'Özel' : 'Varsayılan'}
              </Button>
              <Portal>
                <Dialog visible={showSoundPicker} onDismiss={() => setShowSoundPicker(false)}>
                  <Dialog.Title>Alarm Sesi Seç</Dialog.Title>
                  <Dialog.Content>
                    {alarmSounds.map((sound) => (
                      <Button
                        key={sound.value}
                        mode={soundPath === sound.value ? 'contained' : 'outlined'}
                        onPress={() => {
                          setSoundPath(sound.value);
                          setShowSoundPicker(false);
                        }}
                        style={styles.soundOption}>
                        {sound.label}
                      </Button>
                    ))}
                  </Dialog.Content>
                  <Dialog.Actions>
                    <Button onPress={() => setShowSoundPicker(false)}>Kapat</Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
            </View>

            {/* Tekrarlı Alarm Önizleme */}
            {selectedDrugId && (
              <View style={styles.section}>
                <Text variant="labelLarge" style={styles.label}>
                  Alarm Önizleme
                </Text>
                <Card style={styles.previewCard}>
                  <Card.Content>
                    <Text variant="bodySmall" style={styles.previewTitle}>
                      Sonraki Alarm Zamanları:
                    </Text>
                    {getAlarmPreview().map((preview, index) => (
                      <Text key={index} variant="bodySmall" style={styles.previewItem}>
                        {preview}
                      </Text>
                    ))}
                  </Card.Content>
                </Card>
              </View>
            )}

            <View style={styles.section}>
              <Checkbox.Item
                label="Aktif"
                status={isActive ? 'checked' : 'unchecked'}
                onPress={() => setIsActive(!isActive)}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              loading={loading}
              disabled={loading || !selectedDrugId}
              style={styles.saveButton}>
              {isEditing ? 'Güncelle' : 'Kaydet'}
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  drugCard: {
    marginTop: 8,
  },
  dosageText: {
    color: 'gray',
    marginTop: 4,
  },
  placeholderText: {
    color: 'gray',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  drugList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  drugButton: {
    margin: 4,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  input: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 16,
  },
  timePickerContainer: {
    paddingVertical: 16,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInput: {
    width: 80,
  },
  timeSeparator: {
    marginHorizontal: 16,
  },
  soundButton: {
    marginTop: 8,
  },
  soundOption: {
    marginBottom: 8,
  },
  previewCard: {
    marginTop: 8,
    backgroundColor: '#f0f0f0',
  },
  previewTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewItem: {
    marginBottom: 4,
    color: '#6200ee',
  },
});

export default AlarmSettingScreen;

