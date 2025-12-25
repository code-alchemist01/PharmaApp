/**
 * AppNavigator - Ana uygulama navigator (Auth durumuna göre yönlendirme)
 */

import React, { forwardRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';

// Screens
import HomeScreen from '../screens/Home/HomeScreen';
import DrugListScreen from '../screens/Home/DrugListScreen';
import AddDrugScreen from '../screens/Drug/AddDrugScreen';
import DrugDetailScreen from '../screens/Drug/DrugDetailScreen';
import AlarmListScreen from '../screens/Alarm/AlarmListScreen';
import AlarmSettingScreen from '../screens/Alarm/AlarmSettingScreen';
import DrugVerificationScreen from '../screens/Drug/DrugVerificationScreen';
import HistoryScreen from '../screens/History/HistoryScreen';
import StatisticsScreen from '../screens/Statistics/StatisticsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import CalendarScreen from '../screens/Calendar/CalendarScreen';

export type MainTabParamList = {
  Home: undefined;
  Drugs: undefined;
  Calendar: undefined;
  Alarms: undefined;
  History: undefined;
  Statistics: undefined;
  Profile: undefined;
};

export type DrugStackParamList = {
  DrugList: undefined;
  AddDrug: { drugId?: string }; // drugId varsa edit modu
  DrugDetail: { drugId: string };
  DrugVerification: { alarmId?: string; drugId?: string; drugName?: string };
};

export type AlarmStackParamList = {
  AlarmList: undefined;
  AlarmSetting: { alarmId?: string; drugId?: string; selectedDate?: string };
};

const DrugStack = createStackNavigator<DrugStackParamList>();
const AlarmStack = createStackNavigator<AlarmStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const DrugNavigator: React.FC = () => {
  return (
    <DrugStack.Navigator
      initialRouteName="DrugList"
      screenOptions={{
        headerShown: true,
      }}>
      <DrugStack.Screen
        name="DrugList"
        component={DrugListScreen}
        options={{ title: 'İlaçlarım' }}
      />
      <DrugStack.Screen
        name="AddDrug"
        component={AddDrugScreen}
        options={{ title: 'Yeni İlaç Ekle' }}
      />
      <DrugStack.Screen
        name="DrugDetail"
        component={DrugDetailScreen}
        options={{ title: 'İlaç Detayı' }}
      />
      <DrugStack.Screen
        name="DrugVerification"
        component={DrugVerificationScreen}
        options={{ title: 'İlaç Doğrulama' }}
      />
    </DrugStack.Navigator>
  );
};

const AlarmNavigator: React.FC = () => {
  return (
    <AlarmStack.Navigator>
      <AlarmStack.Screen
        name="AlarmList"
        component={AlarmListScreen}
        options={{ title: 'Alarmlarım' }}
      />
      <AlarmStack.Screen
        name="AlarmSetting"
        component={AlarmSettingScreen}
        options={{ title: 'Alarm Ayarları' }}
      />
    </AlarmStack.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let icon: string;

          if (route.name === 'Home') {
            icon = '🏠';
          } else if (route.name === 'Drugs') {
            icon = '💊';
          } else if (route.name === 'Calendar') {
            icon = '📅';
          } else if (route.name === 'Alarms') {
            icon = '⏰';
          } else if (route.name === 'History') {
            icon = '📜';
          } else if (route.name === 'Statistics') {
            icon = '📊';
          } else if (route.name === 'Profile') {
            icon = '👤';
          } else {
            icon = '❓';
          }

          return <Text style={{ fontSize: size, color: color }}>{icon}</Text>;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen
        name="Drugs"
        component={DrugNavigator}
        options={{ title: 'İlaçlarım', headerShown: false }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Takvim' }} />
      <Tab.Screen
        name="Alarms"
        component={AlarmNavigator}
        options={{ title: 'Alarmlar', headerShown: false }}
      />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Geçmiş' }} />
      <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'İstatistikler' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = forwardRef<NavigationContainerRef<any>>((props, ref) => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator] Auth state:', { loading, hasUser: !!user });

  if (loading) {
    console.log('[AppNavigator] Auth loading, showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ marginTop: 16, color: '#666' }}>Yükleniyor...</Text>
      </View>
    );
  }

  console.log('[AppNavigator] Rendering navigation:', user ? 'MainNavigator' : 'AuthNavigator');
  return (
    <NavigationContainer ref={ref}>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
});

AppNavigator.displayName = 'AppNavigator';

export default AppNavigator;

