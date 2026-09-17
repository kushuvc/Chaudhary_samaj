import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import type { AppLanguage } from '../context/LanguageContext';

const options: Array<{
  key: AppLanguage;
  label: string;
  nativeLabel: string;
  greeting: string;
  flag: string;
}> = [
  { key: 'en-IN', label: 'English', nativeLabel: 'English', greeting: 'Welcome', flag: '🇮🇳' },
  { key: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी', greeting: 'स्वागत है', flag: '🙏' },
  { key: 'gu-IN', label: 'Gujarati', nativeLabel: 'ગુજરાતી', greeting: 'સ્વાગત છે', flag: '🌸' },
];

export function LanguageSelectionScreen() {
  const { palette } = useAppTheme();
  const { setLanguage, t } = useAppLanguage();
  const [selected, setSelected] = useState<AppLanguage>('en-IN');
  const styles = useMemo(() => createStyles(palette), [palette]);

  const selectedOption = options.find((o) => o.key === selected)!;

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Svg style={StyleSheet.absoluteFill as any} width="100%" height="100%" viewBox="0 0 390 340" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="lgBg" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor="#6D6BE2" />
              <Stop offset="0.5" stopColor="#7C4DDA" />
              <Stop offset="1" stopColor="#3D3B9E" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="390" height="340" fill="url(#lgBg)" />
          <Circle cx="350" cy="50" r="100" fill="#fff" fillOpacity="0.05" />
          <Circle cx="30" cy="300" r="90" fill="#fff" fillOpacity="0.05" />
          <Circle cx="200" cy="10" r="50" fill="#fff" fillOpacity="0.04" />
          <Path d="M0 280 C 100 255, 200 295, 300 270 C 350 258, 375 275, 390 268 L390 340 L0 340 Z" fill="#fff" fillOpacity="0.06" />
        </Svg>

        <View style={styles.heroContent}>
          <View style={styles.logoBadge}>
            <Ionicons name="heart" size={28} color={palette.primary} />
          </View>
          <Text style={styles.appName}>Chaudhary Samaj</Text>
          <Text style={styles.heroGreeting}>{selectedOption.greeting}</Text>
          <Text style={styles.heroSub}>{t('langSubtitle')}</Text>
          <Text style={styles.heroSubNative}>अपनी भाषा चुनें • તમારી ભાષા પસંદ કરો</Text>
        </View>

        <View style={styles.notch} />
      </View>

      {/* Language Options */}
      <View style={styles.body}>
        <Text style={styles.sectionLabel}>{t('langChoose')}</Text>

        <View style={styles.optionsList}>
          {options.map((item) => {
            const active = selected === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.optionCard, active && styles.optionCardActive]}
                onPress={() => setSelected(item.key)}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionFlag}>{item.flag}</Text>
                  <View>
                    <Text style={[styles.optionNative, active && styles.optionNativeActive]}>
                      {item.nativeLabel}
                    </Text>
                    <Text style={[styles.optionEnglish, active && styles.optionEnglishActive]}>
                      {item.label}
                    </Text>
                  </View>
                </View>
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.continueBtn} onPress={() => void setLanguage(selected)}>
          <Text style={styles.continueBtnText}>
            {selected === 'hi-IN' ? 'आगे बढ़ें' : selected === 'gu-IN' ? 'આગળ વધો' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },
    hero: {
      height: 300,
      position: 'relative',
      overflow: 'hidden',
    },
    heroContent: {
      flex: 1,
      paddingHorizontal: 28,
      paddingTop: 70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoBadge: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    appName: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    heroGreeting: {
      fontSize: 32,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.5,
    },
    heroSub: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 6,
    },
    heroSubNative: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
      marginTop: 4,
    },
    notch: {
      height: 28,
      backgroundColor: palette.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    body: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: palette.muted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 14,
    },
    optionsList: {
      gap: 10,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 2,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    optionCardActive: {
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    optionFlag: {
      fontSize: 28,
    },
    optionNative: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
    },
    optionNativeActive: {
      color: palette.primary,
    },
    optionEnglish: {
      fontSize: 13,
      color: palette.muted,
      marginTop: 2,
    },
    optionEnglishActive: {
      color: palette.primary,
      opacity: 0.8,
    },
    radioOuter: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioOuterActive: {
      borderColor: palette.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: palette.primary,
    },
    continueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: palette.primary,
      borderRadius: 14,
      paddingVertical: 16,
      marginTop: 24,
      shadowColor: palette.primary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    continueBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
