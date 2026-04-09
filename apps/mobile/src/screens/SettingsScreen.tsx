import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { loadJson, saveJson } from '../services/localData';
import { colors, radius, spacing, type } from '../theme';
import type {
  MobileAccountSettings,
  MobileNotificationSettings,
  MobilePrivacySettings,
  MobileSettingsState,
  ThemeMode,
} from '../types';

const STORAGE_KEY = 'chaudhary_mobile_settings_state';

const defaultAccount: MobileAccountSettings = {
  language: 'en-IN',
  timezone: 'Asia/Kolkata',
  publicProfile: true,
};

const defaultNotifications: MobileNotificationSettings = {
  communityAnnouncements: true,
  matrimonyMatches: true,
  eventReminders: true,
  securityAlerts: true,
  marketingUpdates: false,
};

const defaultPrivacy: MobilePrivacySettings = {
  showPhoneToConnections: false,
  showLocationPublicly: true,
  profileSearchable: true,
  twoFactorEnabled: false,
};

export function SettingsScreen() {
  const [account, setAccount] = useState<MobileAccountSettings>(defaultAccount);
  const [notifications, setNotifications] = useState<MobileNotificationSettings>(defaultNotifications);
  const [privacy, setPrivacy] = useState<MobilePrivacySettings>(defaultPrivacy);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [savedAt, setSavedAt] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const state = await loadJson<MobileSettingsState>(STORAGE_KEY, {
        account: defaultAccount,
        notifications: defaultNotifications,
        privacy: defaultPrivacy,
        theme: 'light',
      });

      if (!mounted) {
        return;
      }

      setAccount(state.account);
      setNotifications(state.notifications);
      setPrivacy(state.privacy);
      setTheme(state.theme);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async () => {
    const state: MobileSettingsState = {
      account,
      notifications,
      privacy,
      theme,
    };

    await saveJson<MobileSettingsState>(STORAGE_KEY, state);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const toggleNotification = (key: keyof MobileNotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof MobilePrivacySettings) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleLanguage = () => {
    const values = ['en-IN', 'hi-IN', 'pa-IN'];
    const index = values.indexOf(account.language);
    const next = values[(index + 1) % values.length];
    setAccount((prev) => ({ ...prev, language: next }));
  };

  const cycleTimezone = () => {
    const values = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London'];
    const index = values.indexOf(account.timezone);
    const next = values[(index + 1) % values.length];
    setAccount((prev) => ({ ...prev, timezone: next }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionCard>
        <ScreenTitle title="Settings" subtitle="Manage preferences and privacy controls" />
        <PrimaryButton label="Save Changes" onPress={() => void saveSettings()} />
        {savedAt ? <Text style={styles.savedText}>Saved at {savedAt}</Text> : null}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Account Preferences</Text>

        <Pressable style={styles.row} onPress={cycleLanguage}>
          <Text style={styles.rowLabel}>Language</Text>
          <Text style={styles.rowValue}>{account.language}</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={cycleTimezone}>
          <Text style={styles.rowLabel}>Timezone</Text>
          <Text style={styles.rowValue}>{account.timezone}</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => setAccount((prev) => ({ ...prev, publicProfile: !prev.publicProfile }))}>
          <Text style={styles.rowLabel}>Public profile visibility</Text>
          <Text style={styles.rowValue}>{account.publicProfile ? 'On' : 'Off'}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>
        <Pressable style={styles.row} onPress={() => toggleNotification('communityAnnouncements')}>
          <Text style={styles.rowLabel}>Community announcements</Text>
          <Text style={styles.rowValue}>{notifications.communityAnnouncements ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => toggleNotification('matrimonyMatches')}>
          <Text style={styles.rowLabel}>Matrimony match alerts</Text>
          <Text style={styles.rowValue}>{notifications.matrimonyMatches ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => toggleNotification('eventReminders')}>
          <Text style={styles.rowLabel}>Event reminders</Text>
          <Text style={styles.rowValue}>{notifications.eventReminders ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => toggleNotification('securityAlerts')}>
          <Text style={styles.rowLabel}>Security alerts</Text>
          <Text style={styles.rowValue}>{notifications.securityAlerts ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => toggleNotification('marketingUpdates')}>
          <Text style={styles.rowLabel}>Marketing updates</Text>
          <Text style={styles.rowValue}>{notifications.marketingUpdates ? 'On' : 'Off'}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Privacy and Security</Text>
        <Pressable style={styles.row} onPress={() => togglePrivacy('showPhoneToConnections')}>
          <Text style={styles.rowLabel}>Show phone to accepted connections</Text>
          <Text style={styles.rowValue}>{privacy.showPhoneToConnections ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => togglePrivacy('showLocationPublicly')}>
          <Text style={styles.rowLabel}>Show location publicly</Text>
          <Text style={styles.rowValue}>{privacy.showLocationPublicly ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => togglePrivacy('profileSearchable')}>
          <Text style={styles.rowLabel}>Allow profile in search</Text>
          <Text style={styles.rowValue}>{privacy.profileSearchable ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => togglePrivacy('twoFactorEnabled')}>
          <Text style={styles.rowLabel}>Two-factor auth placeholder</Text>
          <Text style={styles.rowValue}>{privacy.twoFactorEnabled ? 'On' : 'Off'}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeRow}>
          {(['light', 'dark', 'system'] as const).map((item) => (
            <Pressable
              key={item}
              style={[styles.themeBtn, theme === item ? styles.themeBtnActive : null]}
              onPress={() => setTheme(item)}
            >
              <Text style={[styles.themeBtnText, theme === item ? styles.themeBtnTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.noteText}>Theme preference is stored locally and ready for API sync later.</Text>
      </SectionCard>
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
  savedText: {
    marginTop: spacing.xs,
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    ...type.h2,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  rowLabel: {
    ...type.body,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.xs,
  },
  rowValue: {
    color: '#334155',
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  themeBtnActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  themeBtnText: {
    textTransform: 'capitalize',
    color: '#334155',
    fontWeight: '600',
  },
  themeBtnTextActive: {
    color: '#fff',
  },
  noteText: {
    marginTop: spacing.sm,
    ...type.caption,
  },
});
