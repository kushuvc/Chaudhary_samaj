import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';

interface WelcomeScreenProps {
  onCreateProfile: () => void;
  onLogin: () => void;
}

export function WelcomeScreen({ onCreateProfile, onLogin }: WelcomeScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Svg style={StyleSheet.absoluteFill as any} width="100%" height="100%" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="bgG" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor="#f97316" />
              <Stop offset="0.45" stopColor="#ea580c" />
              <Stop offset="1" stopColor="#7c2d12" />
            </LinearGradient>
            <LinearGradient id="shineG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
              <Stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="waveG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="390" height="520" fill="url(#bgG)" />
          <Rect x="0" y="0" width="390" height="260" fill="url(#shineG)" />
          {/* Decorative circles */}
          <Circle cx="360" cy="40"  r="90"  fill="#ffffff" fillOpacity="0.05" />
          <Circle cx="380" cy="200" r="60"  fill="#ffffff" fillOpacity="0.04" />
          <Circle cx="20"  cy="460" r="110" fill="#ffffff" fillOpacity="0.05" />
          <Circle cx="-10" cy="120" r="55"  fill="#ffffff" fillOpacity="0.06" />
          <Circle cx="200" cy="20"  r="45"  fill="#ffffff" fillOpacity="0.04" />
          {/* Bottom wave */}
          <Path d="M0 420 C 80 390, 160 445, 240 415 C 300 393, 350 425, 390 408 L390 520 L0 520 Z" fill="url(#waveG)" />
          <Path d="M0 455 C 100 430, 200 468, 300 445 C 340 433, 370 450, 390 442 L390 520 L0 520 Z" fill="#ffffff" fillOpacity="0.04" />
          {/* Accent dots */}
          <Circle cx="55"  cy="80"  r="5"   fill="#ffffff" fillOpacity="0.35" />
          <Circle cx="80"  cy="55"  r="3"   fill="#ffffff" fillOpacity="0.28" />
          <Circle cx="300" cy="350" r="6"   fill="#ffffff" fillOpacity="0.2"  />
          <Circle cx="330" cy="310" r="3.5" fill="#ffffff" fillOpacity="0.22" />
          <Ellipse cx="195" cy="530" rx="180" ry="60" fill="#ffffff" fillOpacity="0.04" />
        </Svg>

        {/* Hero content */}
        <View style={styles.heroContent}>
          {/* Logo badge */}
          <View style={styles.logoBadge}>
            <Ionicons name="heart" size={28} color="#ea580c" />
          </View>

          {/* Headline */}
          <Text style={styles.heroTitle}>Find Your{'\n'}Perfect Match</Text>
          <Text style={styles.heroSubtitle}>
            Trusted matrimony service for{'\n'}the Chaudhary community
          </Text>

          {/* Feature pills */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Ionicons name="shield-checkmark" size={14} color="#ffffff" />
              <Text style={styles.pillText}>Verified Profiles</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="people" size={14} color="#ffffff" />
              <Text style={styles.pillText}>Same Community</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="lock-closed" size={14} color="#ffffff" />
              <Text style={styles.pillText}>100% Private</Text>
            </View>
          </View>
        </View>

        {/* Bottom notch */}
        <View style={styles.heroBottomNotch} />
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {/* Brand name */}
        <Text style={styles.brandName}>Chaudhary Samaj</Text>
        <Text style={styles.brandTagline}>No. 1 matrimony platform for Chaudhary families</Text>

        {/* CTA */}
        <Pressable style={styles.primaryButton} onPress={onCreateProfile}>
          <Ionicons name="person-add" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Create Free Profile</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Already have an account?</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Login */}
        <Pressable style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    heroSection: {
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },
    heroContent: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: 80,
      justifyContent: 'center',
    },
    logoBadge: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 28,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    heroTitle: {
      fontSize: 42,
      fontWeight: '800',
      color: '#ffffff',
      letterSpacing: -1,
      lineHeight: 50,
      marginBottom: 14,
    },
    heroSubtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.82)',
      lineHeight: 24,
      marginBottom: 32,
    },
    pillsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    pillText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
    heroBottomNotch: {
      height: 32,
      backgroundColor: palette.bg,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    bottomCard: {
      backgroundColor: palette.bg,
      paddingHorizontal: 24,
      paddingBottom: 40,
      paddingTop: 4,
    },
    brandName: {
      fontSize: 22,
      fontWeight: '800',
      color: palette.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    brandTagline: {
      fontSize: 13,
      color: palette.muted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 24,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: palette.primary,
      borderRadius: 14,
      paddingVertical: 16,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.38,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 18,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: palette.border,
    },
    dividerText: {
      fontSize: 12,
      color: palette.muted,
      fontWeight: '500',
    },
    loginButton: {
      borderWidth: 1.5,
      borderColor: palette.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    loginButtonText: {
      color: palette.primary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
