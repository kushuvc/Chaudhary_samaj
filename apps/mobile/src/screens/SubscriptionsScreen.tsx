import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { ScreenTitle } from '../components/AppPrimitives';

export function SubscriptionsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.page}>
      <ScreenTitle title="Subscriptions" />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.comingSoon}>Coming Soon</Text>
        <Text style={styles.description}>
          Subscribe to unlock premium features like viewing phone numbers, unlimited interests, and more!
        </Text>

        <View style={styles.plansContainer}>
          <View style={styles.planCard}>
            <Text style={styles.planName}>Basic Pack</Text>
            <Text style={styles.planPrice}>₹50</Text>
            <Text style={styles.planFeatures}>• Unlock 5 phone numbers</Text>
            <Text style={styles.planFeatures}>• Valid for 7 days</Text>
          </View>

          <View style={styles.planCard}>
            <Text style={styles.planName}>Premium Pack</Text>
            <Text style={styles.planPrice}>₹200</Text>
            <Text style={styles.planFeatures}>• View all phone numbers</Text>
            <Text style={styles.planFeatures}>• Unlimited interests</Text>
            <Text style={styles.planFeatures}>• Priority listing</Text>
            <Text style={styles.planFeatures}>• Valid for 30 days</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Note: These plans will be available for purchase soon. Stay tuned!
        </Text>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 16,
    },
    comingSoon: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.primary,
      textAlign: 'center',
      marginTop: 20,
    },
    description: {
      fontSize: 16,
      color: palette.text,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
    },
    plansContainer: {
      marginTop: 24,
      gap: 16,
    },
    planCard: {
      backgroundColor: palette.cardBg,
      borderRadius: 12,
      padding: 20,
      borderWidth: 2,
      borderColor: palette.border,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 8,
    },
    planPrice: {
      fontSize: 32,
      fontWeight: '700',
      color: palette.primary,
      marginBottom: 12,
    },
    planFeatures: {
      fontSize: 14,
      color: palette.text,
      marginBottom: 4,
      lineHeight: 20,
    },
    note: {
      fontSize: 14,
      color: palette.muted,
      textAlign: 'center',
      marginTop: 24,
      fontStyle: 'italic',
    },
  });
}
