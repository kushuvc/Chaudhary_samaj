import React, { Component, useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { registerForPush } from './src/services/push';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { UpdatePrompt } from './src/components/UpdatePrompt';

const navigationRef = createNavigationContainerRef<any>();

/*
 * Portrait on phones, free rotation on tablets and foldables.
 *
 * The lock used to live in app.json, which writes screenOrientation="portrait"
 * into the manifest. Play flags that for large screens, and Android 16 ignores
 * it there anyway. Locking at runtime keeps phones exactly as they were while
 * the manifest stays unrestricted.
 */
if (Device.deviceType === Device.DeviceType.PHONE) {
  void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}

const TAB_SCREENS = new Set(['Home', 'Matrimony', 'Interests', 'Messages', 'Subscriptions', 'Profile', 'Settings']);

/** Opens the screen a notification points at. */
function openFromNotification(response: Notifications.NotificationResponse | null) {
  const screen = response?.notification.request.content.data?.screen;
  if (typeof screen !== 'string' || !navigationRef.isReady()) return;
  if (TAB_SCREENS.has(screen)) navigationRef.navigate('Main', { screen });
  else if (screen === 'Notifications') navigationRef.navigate('Notifications');
}

/**
 * Registers this device once a member is signed in, and routes taps.
 *
 * The tap that launched the app arrives before navigation is ready, so it is
 * read back with getLastNotificationResponseAsync once the session is.
 */
function PushBridge() {
  const { session, isNewSignup } = useAuth();
  const signedIn = Boolean(session) && !isNewSignup;

  useEffect(() => {
    if (!signedIn) return;
    void registerForPush();

    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    const timer = setTimeout(() => {
      void Notifications.getLastNotificationResponseAsync().then(openFromNotification).catch(() => {});
    }, 600);
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [signedIn]);

  return null;
}

function AppRoot() {
  const { resolvedTheme, palette } = useAppTheme();

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: resolvedTheme === 'dark',
        colors: {
          primary: palette.primary,
          background: palette.bg,
          card: palette.surface,
          text: palette.text,
          border: palette.border,
          notification: palette.primary,
        },
      }}
    >
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      <PushBridge />
      <UpdatePrompt />
    </NavigationContainer>
  );
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <Text style={styles.errorMessage}>{this.state.error.message}</Text>
          <Text style={styles.errorStack}>{this.state.error.stack}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppRoot />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'red',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  errorStack: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
