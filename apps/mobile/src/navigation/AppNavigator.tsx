import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { MatrimonyScreen } from '../screens/MatrimonyScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { HelpNeedScreen } from '../screens/HelpNeedScreen';
import { BusinessScreen } from '../screens/BusinessScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          minHeight: 64,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="Matrimony" component={MatrimonyScreen} options={{ tabBarIcon: tabIcon('heart-outline') }} />
      <Tabs.Screen name="Events" component={EventsScreen} options={{ tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="Help" component={HelpNeedScreen} options={{ tabBarIcon: tabIcon('medkit-outline') }} />
      <Tabs.Screen name="Business" component={BusinessScreen} options={{ tabBarIcon: tabIcon('briefcase-outline') }} />
      <Tabs.Screen name="Community" component={CommunityScreen} options={{ tabBarIcon: tabIcon('people-outline') }} />
      <Tabs.Screen name="Alerts" component={NotificationsScreen} options={{ tabBarIcon: tabIcon('notifications-outline') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: tabIcon('settings-outline') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline') }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? <Stack.Screen name="Auth" component={LoginScreen} /> : null}
      {session ? <Stack.Screen name="Main" component={MainTabs} /> : null}
    </Stack.Navigator>
  );
}
