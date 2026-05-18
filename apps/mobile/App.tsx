import React, { Component } from 'react';
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
