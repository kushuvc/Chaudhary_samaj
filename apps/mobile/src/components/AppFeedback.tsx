import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type } from '../theme';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';

export function ScreenLoader({ message }: { message?: string }) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.helperText}>{message ?? t('loadingGeneric')}</Text>
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return <Text style={styles.errorText}>{message}</Text>;
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
      padding: spacing.lg,
    },
    helperText: {
      marginTop: spacing.sm,
      ...type.caption,
      color: palette.muted,
    },
    errorText: {
      color: palette.danger,
      backgroundColor: palette.dangerSoft,
      borderColor: palette.danger,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    emptyCard: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      padding: spacing.md,
      alignItems: 'center',
    },
    emptyTitle: {
      ...type.h2,
      color: palette.text,
    },
    emptySubtitle: {
      ...type.body,
      color: palette.muted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    actionButton: {
      marginTop: spacing.sm,
      backgroundColor: palette.text,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    actionText: {
      color: palette.surface,
      fontWeight: '600',
    },
  });
}
