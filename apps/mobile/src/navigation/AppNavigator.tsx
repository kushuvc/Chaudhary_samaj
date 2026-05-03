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
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LanguageSelectionScreen } from '../screens/LanguageSelectionScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { resolvedTheme, palette } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          minHeight: 66,
          height: 58 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 7,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          backgroundColor: palette.tabBg,
          shadowColor: '#000000',
          shadowOpacity: resolvedTheme === 'dark' ? 0.24 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -5 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen name="Home" component={DashboardScreen} options={{ tabBarIcon: tabIcon('home-outline'), tabBarLabel: t('home') }} />
      <Tabs.Screen name="Matrimony" component={MatrimonyScreen} options={{ tabBarIcon: tabIcon('heart-outline'), tabBarLabel: t('matrimony') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline'), tabBarLabel: t('profile') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: tabIcon('settings-outline'), tabBarLabel: t('settings') }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { session, loading, isNewSignup } = useAuth();
  const { ready, language } = useAppLanguage();

  if (loading || !ready) {
    return <LoadingScreen />;
  }

  if (!language) {
    return <LanguageSelectionScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? <Stack.Screen name="Auth" component={LoginScreen} /> : null}
      {session && isNewSignup ? <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} /> : null}
      {session && !isNewSignup ? <Stack.Screen name="Main" component={MainTabs} /> : null}
    </Stack.Navigator>
  );
}
