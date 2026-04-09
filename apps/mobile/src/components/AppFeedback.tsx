import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

export function ScreenLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0f766e" />
      <Text style={styles.helperText}>{message}</Text>
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
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

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  helperText: {
    marginTop: spacing.sm,
    ...type.caption,
  },
  errorText: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderColor: '#fecaca',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyTitle: {
    ...type.h2,
  },
  emptySubtitle: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    color: colors.surface,
    fontWeight: '600',
  },
});
