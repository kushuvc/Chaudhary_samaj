import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, type ThemePalette } from '../context/ThemeContext';
import { GradientFill, PrimaryButton } from '../components/ui';
import { useAppLanguage } from '../context/LanguageContext';

interface WelcomeScreenProps {
  onCreateProfile: () => void;
  onLogin: () => void;
}

// Keys rather than text: these are rendered through t() below, so the list
// follows the language the member chose on the first screen.
const highlights = [
  { icon: 'shield-checkmark-outline' as const, label: 'welcomeVerified' },
  { icon: 'sparkles-outline' as const, label: 'welcomeMatches' },
  { icon: 'lock-closed-outline' as const, label: 'welcomeControl' },
];

export function WelcomeScreen({ onCreateProfile, onLogin }: WelcomeScreenProps) {
  const { t } = useAppLanguage();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    /*
     * Scrolls only when the content is taller than the screen. With the
     * phone's font size or display size turned up, the fixed layout ran off the
     * bottom and "Create your profile" sat under the navigation bar with no way
     * to reach it. flexGrow keeps the normal-size layout exactly as it was.
     */
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <GradientFill colors={palette.gradient} />
        <View style={[styles.heroInner, { paddingTop: insets.top + 44 }]}>
          <View style={styles.mark}>
            <Ionicons name="infinite" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Chaudhary Samaj</Text>
          <Text style={styles.heroSubtitle}>
            {t('welcomeTagline')}
          </Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.highlights}>
          {highlights.map((item) => (
            <View key={item.label} style={styles.highlightRow}>
              <View style={styles.highlightIcon}>
                <Ionicons name={item.icon} size={17} color={palette.primary} />
              </View>
              <Text style={styles.highlightLabel}>{t(item.label)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <PrimaryButton label={t('welcomeCreate')} onPress={onCreateProfile} icon="arrow-forward" />

          <Pressable accessibilityRole="button" style={styles.loginButton} onPress={onLogin}>
            <Text style={styles.loginLabel}>
              {t('welcomeAlready')}<Text style={styles.loginLabelStrong}>{t('welcomeLogIn')}</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    scrollContent: {
      flexGrow: 1,
    },
    hero: {
      flex: 1,
      minHeight: 320,
      justifyContent: 'flex-end',
    },
    heroInner: {
      paddingHorizontal: 26,
      paddingBottom: 56,
      gap: 14,
    },
    mark: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -1,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      fontSize: 15.5,
      lineHeight: 23,
      color: 'rgba(255,255,255,0.86)',
      maxWidth: 320,
    },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      marginTop: -28,
      paddingHorizontal: 26,
      paddingTop: 28,
    },
    highlights: {
      gap: 16,
      marginBottom: 28,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
    },
    highlightIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primarySoft,
    },
    highlightLabel: {
      flex: 1,
      fontSize: 14.5,
      color: palette.textSoft,
      fontWeight: '600',
    },
    actions: {
      gap: 4,
    },
    loginButton: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    loginLabel: {
      fontSize: 14.5,
      color: palette.muted,
    },
    loginLabelStrong: {
      color: palette.primary,
      fontWeight: '800',
    },
  });
}
