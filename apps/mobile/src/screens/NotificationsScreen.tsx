import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '../components/AppFeedback';
import { PrimaryButton, ScreenTitle, SecondaryButton, SectionCard } from '../components/AppPrimitives';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { loadJson, saveJson } from '../services/localData';
import { radius, spacing, type } from '../theme';
import type { MobileNotificationState, NotificationItem, NotificationType } from '../types';

const STORAGE_KEY = 'chaudhary_mobile_notifications_state';

const fallbackNotifications: NotificationItem[] = [
  {
    id: 'ntf-1',
    title: 'General Meeting Reminder',
    message: 'Community general meeting starts tomorrow at 6:30 PM.',
    type: 'announcement',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: 'ntf-2',
    title: 'New Matrimony Match',
    message: 'You have new compatibility matches based on your filters.',
    type: 'event',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: 'ntf-3',
    title: 'Security Update',
    message: 'Your account settings were updated successfully.',
    type: 'security',
    createdAt: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
];

export function NotificationsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | NotificationType>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const state = await loadJson<MobileNotificationState>(STORAGE_KEY, {
        notifications: fallbackNotifications,
      });
      if (mounted) {
        setNotifications(state.notifications);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void saveJson<MobileNotificationState>(STORAGE_KEY, { notifications });
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesRead = !showUnreadOnly || !item.read;
      return matchesType && matchesRead;
    });
  }, [filterType, notifications, showUnreadOnly]);

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const clearRead = () => {
    setNotifications((prev) => prev.filter((item) => !item.read));
  };

  const formatTimeAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return `${mins}${t('minutesShort')} ${t('agoSuffix')}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t('hoursShort')} ${t('agoSuffix')}`;
    return `${Math.floor(hrs / 24)}${t('daysShort')} ${t('agoSuffix')}`;
  };

  const typeLabel = (item: 'all' | NotificationType) => {
    if (item === 'all') return t('allTab');
    if (item === 'announcement') return t('announcementType');
    if (item === 'message') return t('messageType');
    if (item === 'security') return t('securityType');
    return t('eventType');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard>
        <ScreenTitle title={t('notificationsTitle')} subtitle={`${unreadCount} ${t('unreadNotifications')}`} />
        <View style={styles.headerActions}>
          <PrimaryButton label={t('markAllRead')} onPress={markAllRead} />
          <SecondaryButton label={t('clearRead')} onPress={clearRead} />
        </View>
      </SectionCard>

      <SectionCard>
        <View style={styles.chipsRow}>
          {(['all', 'announcement', 'message', 'security', 'event'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilterType(item)}
              style={[styles.chip, filterType === item ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, filterType === item ? styles.chipTextActive : null]}>{typeLabel(item)}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.toggleRow, showUnreadOnly ? styles.toggleRowActive : null]}
          onPress={() => setShowUnreadOnly((prev) => !prev)}
        >
          <Text style={styles.toggleText}>{t('unreadOnly')}</Text>
        </Pressable>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('noNotificationsFound')}
          subtitle={t('changeFiltersHint')}
        />
      ) : null}

      {filtered.map((notification) => (
        <View key={notification.id} style={[styles.itemCard, notification.read ? null : styles.unreadCard]}>
          <View style={styles.itemHead}>
            <Text style={styles.itemTitle}>{notification.title}</Text>
            <Text style={styles.timeText}>{formatTimeAgo(notification.createdAt)}</Text>
          </View>
          <Text style={styles.typeTag}>{typeLabel(notification.type)}</Text>
          <Text style={styles.itemMessage}>{notification.message}</Text>
          {!notification.read ? (
            <PrimaryButton label={t('markRead')} onPress={() => markAsRead(notification.id)} />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surface,
  },
  chipActive: {
    backgroundColor: palette.text,
    borderColor: palette.text,
  },
  chipText: {
    ...type.caption,
    color: palette.textSoft,
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: palette.surface,
  },
  toggleRow: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surface,
  },
  toggleRowActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  toggleText: {
    ...type.body,
    fontWeight: '600',
    color: palette.text,
  },
  itemCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  unreadCard: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  itemHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemTitle: {
    flex: 1,
    ...type.body,
    fontWeight: '700',
    color: palette.text,
  },
  timeText: {
    ...type.caption,
  },
  typeTag: {
    ...type.caption,
    color: palette.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  itemMessage: {
    ...type.body,
    color: palette.textSoft,
  },
  });
}
