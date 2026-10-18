import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';

/**
 * The ✓ shown next to a member's name once their Aadhaar is verified.
 * `compact` is the bare icon, for tight rows like the listing card.
 */
export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();

  if (compact) {
    return (
      <Ionicons
        name="shield-checkmark"
        size={18}
        color={palette.success}
        accessibilityLabel={t('verifiedBadge')}
      />
    );
  }

  return (
    <View style={[styles.pill, { backgroundColor: palette.successSoft }]} accessibilityLabel={t('verifiedBadge')}>
      <Ionicons name="shield-checkmark" size={13} color={palette.success} />
      <Text style={[styles.label, { color: palette.success }]}>{t('verifiedBadge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '700' },
});
