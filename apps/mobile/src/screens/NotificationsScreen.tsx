import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api, type AppNotification } from '../services/api';
import { radius, spacing } from '../theme';

/*
 * The list used to be three sample items kept on the phone — a meeting
 * reminder, a match, a security notice — none of them real, and the screen
 * was not reachable from anywhere. It now shows what the server recorded:
 * announcements from the admin, and interests received or accepted.
 */

const TAB_SCREENS = new Set(['Home', 'Matrimony', 'Interests', 'Messages', 'Subscriptions', 'Profile', 'Settings']);

function iconFor(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'interest_received') return 'heart-outline';
  if (type === 'interest_accepted') return 'heart';
  if (type === 'profile_viewed') return 'eye-outline';
  if (type === 'plan_expiring') return 'time-outline';
  if (type === 'welcome') return 'sparkles-outline';
  return 'megaphone-outline';
}

export function NotificationsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.getNotifications());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const unread = items.filter((item) => !item.read).length;

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    await api.markNotificationsRead().catch(() => {});
  };

  const open = (item: AppNotification) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      void api.markNotificationsRead([item.id]).catch(() => {});
    }
    const screen = item.data?.screen;
    if (typeof screen === 'string' && TAB_SCREENS.has(screen)) {
      navigation.navigate('Main', { screen });
    }
  };

  const timeAgo = (iso: string) => {
    const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}${t('minutesShort')} ${t('agoSuffix')}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t('hoursShort')} ${t('agoSuffix')}`;
    return `${Math.floor(hrs / 24)}${t('daysShort')} ${t('agoSuffix')}`;
  };

  if (loading) return <ScreenLoader message={t('notificationsTitle')} />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={8} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('notificationsTitle')}</Text>
          <Text style={styles.subtitle}>
            {unread} {t('unreadNotifications')}
          </Text>
        </View>
        {unread > 0 ? (
          <Pressable onPress={() => void markAllRead()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.markAll}>{t('markAllRead')}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={palette.primary}
          />
        }
      >
        {error ? <InlineError message={error} /> : null}

        {!error && items.length === 0 ? (
          <EmptyState title={t('notifEmptyTitle')} subtitle={t('notifEmptyBody')} />
        ) : null}

        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => open(item)}
            style={({ pressed }) => [styles.card, !item.read && styles.cardUnread, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons name={iconFor(item.type)} size={20} color={item.read ? palette.muted : palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: palette.text },
    subtitle: { fontSize: 12.5, color: palette.muted, marginTop: 1 },
    markAll: { fontSize: 13.5, fontWeight: '700', color: palette.primary },
    content: { padding: spacing.md, gap: spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    cardUnread: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSunken,
    },
    iconWrapUnread: { backgroundColor: palette.surface },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text },
    time: { fontSize: 12, color: palette.muted },
    cardBody: { fontSize: 14, lineHeight: 20, color: palette.textSoft, marginTop: 3 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, marginTop: 6 },
  });
}
