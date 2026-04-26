import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import type { AppLanguage } from '../context/LanguageContext';
import { radius, spacing, type } from '../theme';

const options: Array<{ key: AppLanguage; label: string }> = [
  { key: 'en-IN', label: 'English' },
  { key: 'hi-IN', label: 'हिंदी' },
  { key: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
];

export function LanguageSelectionScreen() {
  const { palette } = useAppTheme();
  const { setLanguage, t } = useAppLanguage();
  const [selected, setSelected] = useState<AppLanguage>('en-IN');
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('selectLanguage')}</Text>
        <View style={styles.optionsWrap}>
          {options.map((item) => {
            const active = selected === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.optionBtn, active ? styles.optionBtnActive : null]}
                onPress={() => setSelected(item.key)}
              >
                <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.ctaBtn} onPress={() => void setLanguage(selected)}>
          <Text style={styles.ctaText}>{t('continue')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: palette.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      ...type.h2,
      color: palette.text,
      textAlign: 'center',
    },
    optionsWrap: {
      gap: spacing.xs,
    },
    optionBtn: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
    },
    optionBtnActive: {
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
    },
    optionText: {
      ...type.body,
      color: palette.text,
      fontWeight: '600',
    },
    optionTextActive: {
      color: palette.primary,
      fontWeight: '700',
    },
    ctaBtn: {
      marginTop: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: palette.primary,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    ctaText: {
      color: palette.surface,
      fontWeight: '700',
    },
  });
}
