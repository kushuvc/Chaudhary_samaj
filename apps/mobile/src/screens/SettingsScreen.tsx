import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { loadJson, saveJson } from '../services/localData';
import { radius, spacing, type } from '../theme';
import type {
  MobileAccountSettings,
  MobileNotificationSettings,
  MobilePrivacySettings,
  MobileSettingsState,
  ThemeMode,
} from '../types';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import type { ThemePalette } from '../context/ThemeContext';

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
  const { palette, themeMode, setThemeMode } = useAppTheme();
  const { language, setLanguage } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [account, setAccount] = useState<MobileAccountSettings>(defaultAccount);
  const [notifications, setNotifications] = useState<MobileNotificationSettings>(defaultNotifications);
  const [privacy, setPrivacy] = useState<MobilePrivacySettings>(defaultPrivacy);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
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
      if (language && state.account.language !== language) {
        setAccount((prev) => ({ ...prev, language }));
      }
      await setThemeMode(state.theme);
      setLoaded(true);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async (nextTheme: ThemeMode = themeMode) => {
    setSaving(true);
    const state: MobileSettingsState = {
      account,
      notifications,
      privacy,
      theme: nextTheme,
    };

    await saveJson<MobileSettingsState>(STORAGE_KEY, state);
    setSavedAt(new Date().toLocaleTimeString());
    setSaving(false);
  };

  useEffect(() => {
    if (!loaded) {
      return;
    }
    const timer = setTimeout(() => {
      void saveSettings();
    }, 350);
    return () => clearTimeout(timer);
  }, [account, notifications, privacy, themeMode, loaded]);

  const toggleNotification = (key: keyof MobileNotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof MobilePrivacySettings) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetSettings = async () => {
    setAccount(defaultAccount);
    setNotifications(defaultNotifications);
    setPrivacy(defaultPrivacy);
    await setThemeMode('light');
    await saveJson<MobileSettingsState>(STORAGE_KEY, {
      account: defaultAccount,
      notifications: defaultNotifications,
      privacy: defaultPrivacy,
      theme: 'light',
    });
    setSavedAt(new Date().toLocaleTimeString());
  };

  const cycleLanguage = () => {
    const values = ['en-IN', 'hi-IN', 'pa-IN'];
    const index = values.indexOf(account.language);
    const next = values[(index + 1) % values.length];
    void setLanguage(next as 'en-IN' | 'hi-IN' | 'pa-IN');
    setAccount((prev) => ({ ...prev, language: next }));
  };

  const cycleTimezone = () => {
    const values = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London'];
    const index = values.indexOf(account.timezone);
    const next = values[(index + 1) % values.length];
    setAccount((prev) => ({ ...prev, timezone: next }));
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <SectionCard>
        <ScreenTitle title="Settings" subtitle="Manage preferences and privacy controls" />
        <View style={styles.actionRow}>
          <PrimaryButton label="Save Changes" onPress={() => void saveSettings()} disabled={saving} />
          <Pressable style={styles.resetButton} onPress={() => void resetSettings()}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        </View>
        <View style={styles.savedRow}>
          {saving ? <ActivityIndicator size="small" color={palette.primary} /> : null}
          {savedAt ? <Text style={[styles.savedText, { color: palette.primary }]}>Saved at {savedAt}</Text> : null}
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Account Preferences</Text>

        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={cycleLanguage}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Language</Text>
          <Text style={[styles.rowValue, { color: palette.text }]}>{account.language}</Text>
        </Pressable>

        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={cycleTimezone}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Timezone</Text>
          <Text style={[styles.rowValue, { color: palette.text }]}>{account.timezone}</Text>
        </Pressable>

        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => setAccount((prev) => ({ ...prev, publicProfile: !prev.publicProfile }))}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Public profile visibility</Text>
          <Switch
            value={account.publicProfile}
            onValueChange={() => setAccount((prev) => ({ ...prev, publicProfile: !prev.publicProfile }))}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Notification Preferences</Text>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => toggleNotification('communityAnnouncements')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Community announcements</Text>
          <Switch
            value={notifications.communityAnnouncements}
            onValueChange={() => toggleNotification('communityAnnouncements')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => toggleNotification('matrimonyMatches')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Matrimony match alerts</Text>
          <Switch
            value={notifications.matrimonyMatches}
            onValueChange={() => toggleNotification('matrimonyMatches')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => toggleNotification('eventReminders')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Event reminders</Text>
          <Switch
            value={notifications.eventReminders}
            onValueChange={() => toggleNotification('eventReminders')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => toggleNotification('securityAlerts')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Security alerts</Text>
          <Switch
            value={notifications.securityAlerts}
            onValueChange={() => toggleNotification('securityAlerts')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => toggleNotification('marketingUpdates')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Marketing updates</Text>
          <Switch
            value={notifications.marketingUpdates}
            onValueChange={() => toggleNotification('marketingUpdates')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Privacy and Security</Text>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('showPhoneToConnections')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Show phone to accepted connections</Text>
          <Switch
            value={privacy.showPhoneToConnections}
            onValueChange={() => togglePrivacy('showPhoneToConnections')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('showLocationPublicly')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Show location publicly</Text>
          <Switch
            value={privacy.showLocationPublicly}
            onValueChange={() => togglePrivacy('showLocationPublicly')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('profileSearchable')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Allow profile in search</Text>
          <Switch
            value={privacy.profileSearchable}
            onValueChange={() => togglePrivacy('profileSearchable')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('twoFactorEnabled')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Two-factor auth</Text>
          <Switch
            value={privacy.twoFactorEnabled}
            onValueChange={() => togglePrivacy('twoFactorEnabled')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Appearance</Text>
        <View style={styles.themeRow}>
          {(['light', 'dark', 'system'] as const).map((item) => (
            <Pressable
              key={item}
              style={[
                styles.themeBtn,
                { borderColor: palette.border, backgroundColor: palette.surface },
                themeMode === item ? [styles.themeBtnActive, { backgroundColor: palette.text, borderColor: palette.text }] : null,
              ]}
              onPress={() => void setThemeMode(item)}
            >
              <Text style={[styles.themeBtnText, { color: themeMode === item ? palette.surface : palette.text }, themeMode === item ? styles.themeBtnTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.noteText, { color: palette.muted }]}>Theme is applied app-wide and stored automatically.</Text>
      </SectionCard>
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
    actionRow: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    resetButton: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: palette.surface,
    },
    resetButtonText: {
      fontWeight: '700',
      color: palette.accent,
    },
    savedRow: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    savedText: {
      marginTop: 0,
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
      borderColor: palette.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
      backgroundColor: palette.surface,
    },
    rowLabel: {
      ...type.body,
      color: palette.text,
      flex: 1,
      paddingRight: spacing.xs,
    },
    rowValue: {
      fontWeight: '700',
    },
    themeRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    themeBtn: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: palette.surface,
    },
    themeBtnActive: {
      backgroundColor: palette.text,
      borderColor: palette.text,
    },
    themeBtnText: {
      textTransform: 'capitalize',
      color: palette.accent,
      fontWeight: '600',
    },
    themeBtnTextActive: {
      color: palette.surface,
    },
    noteText: {
      marginTop: spacing.sm,
      ...type.caption,
    },
  });
}
