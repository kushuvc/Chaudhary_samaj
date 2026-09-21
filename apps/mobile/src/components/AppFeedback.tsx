import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { FadeInView } from './Motion';
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

/**
 * The app's mark — two joined rings around a heart — drawn at whatever size
 * the caller asks for.
 *
 * An empty screen that is only two lines of grey text reads as a dead end.
 * This is the same shape as the launcher icon, so an empty list still looks
 * like part of the app rather than a failure.
 */
export function EmptyArt({ size = 132, tint, soft }: { size?: number; tint: string; soft: string }) {
  return (
    <Svg width={size} height={size * 0.72} viewBox="0 0 180 130">
      <Defs>
        <LinearGradient id="emptyRing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity="0.9" />
          <Stop offset="1" stopColor={tint} stopOpacity="0.45" />
        </LinearGradient>
      </Defs>
      {/* ground */}
      <Circle cx="90" cy="70" r="52" fill={soft} />
      <Circle cx="38" cy="30" r="5" fill={tint} fillOpacity="0.25" />
      <Circle cx="150" cy="38" r="3.5" fill={tint} fillOpacity="0.3" />
      <Circle cx="142" cy="102" r="4.5" fill={tint} fillOpacity="0.2" />
      {/* the two rings */}
      <Circle cx="74" cy="70" r="27" stroke="url(#emptyRing)" strokeWidth="5" fill="none" />
      <Circle cx="106" cy="70" r="27" stroke="url(#emptyRing)" strokeWidth="5" fill="none" />
      {/* heart where they meet */}
      <Path
        d="M90 79c-7-5.5-11-9.2-11-14a6.4 6.4 0 0 1 11-4.3 6.4 6.4 0 0 1 11 4.3c0 4.8-4 8.5-11 14z"
        fill={tint}
      />
    </Svg>
  );
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  showArt = true,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  showArt?: boolean;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <FadeInView>
      <View style={styles.emptyCard}>
        {showArt ? (
          <View style={styles.emptyArt}>
            <EmptyArt tint={palette.primary} soft={palette.primarySoft} />
          </View>
        ) : null}
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
        {actionLabel && onAction ? (
          <Pressable style={styles.actionButton} onPress={onAction}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </FadeInView>
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
      borderRadius: radius.lg,
      backgroundColor: palette.surface,
      padding: spacing.lg,
      alignItems: 'center',
      gap: 4,
    },
    emptyArt: { marginBottom: spacing.sm },
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
    /* Was palette.text — a near-black slab that read as a system dialog
       button rather than as part of the app. */
    actionButton: {
      marginTop: spacing.md,
      backgroundColor: palette.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    actionText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14.5,
    },
  });
}
