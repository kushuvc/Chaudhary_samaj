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
import { loadJson, saveJson } from '../services/localData';
import { colors, radius, spacing, type } from '../theme';
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
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard>
        <ScreenTitle title="Notifications" subtitle={`${unreadCount} unread notifications`} />
        <View style={styles.headerActions}>
          <PrimaryButton label="Mark All Read" onPress={markAllRead} />
          <SecondaryButton label="Clear Read" onPress={clearRead} />
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
              <Text style={[styles.chipText, filterType === item ? styles.chipTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.toggleRow, showUnreadOnly ? styles.toggleRowActive : null]}
          onPress={() => setShowUnreadOnly((prev) => !prev)}
        >
          <Text style={styles.toggleText}>Unread only</Text>
        </Pressable>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState
          title="No notifications found"
          subtitle="Try changing your filters."
        />
      ) : null}

      {filtered.map((notification) => (
        <View key={notification.id} style={[styles.itemCard, notification.read ? null : styles.unreadCard]}>
          <View style={styles.itemHead}>
            <Text style={styles.itemTitle}>{notification.title}</Text>
            <Text style={styles.timeText}>{formatTimeAgo(notification.createdAt)}</Text>
          </View>
          <Text style={styles.typeTag}>{notification.type}</Text>
          <Text style={styles.itemMessage}>{notification.message}</Text>
          {!notification.read ? (
            <PrimaryButton label="Mark Read" onPress={() => markAsRead(notification.id)} />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipText: {
    ...type.caption,
    color: '#334155',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: colors.surface,
  },
  toggleRow: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  toggleRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  toggleText: {
    ...type.body,
    fontWeight: '600',
    color: colors.text,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  unreadCard: {
    borderColor: '#a5b4fc',
    backgroundColor: '#eef2ff',
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
    color: colors.text,
  },
  timeText: {
    ...type.caption,
  },
  typeTag: {
    ...type.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  itemMessage: {
    ...type.body,
    color: '#334155',
  },
});
