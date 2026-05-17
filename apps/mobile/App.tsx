import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, StyleSheet } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { AppNavigator } from './src/navigation/AppNavigator';

function AppRoot() {
  const { resolvedTheme, palette } = useAppTheme();

  return (
    <NavigationContainer
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
    </NavigationContainer>
  );
}

function ErrorDisplay({ error }: { error: Error }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>App Error</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Text style={styles.errorStack}>{error.stack}</Text>
    </View>
  );
}

export default function App() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (err: Error) => {
      console.error('Caught error:', err);
      setError(err);
    };
    
    // @ts-ignore
    if (window && window.addEventListener) {
      // @ts-ignore
      window.addEventListener('error', (e) => handleError(e.error));
      // @ts-ignore
      window.addEventListener('unhandledrejection', (e) => handleError(e.reason));
    }
  }, []);

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  try {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppRoot />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  } catch (err) {
    return <ErrorDisplay error={err as Error} />;
  }
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
