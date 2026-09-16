import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppLanguage } from '../context/LanguageContext';
import { InlineError } from '../components/AppFeedback';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { api } from '../services/api';
import { useKeyboard } from '../components/ui';
import { loadJson, saveJson } from '../services/localData';
import { radius, spacing, type } from '../theme';
import type {
  MobileAccountSettings,
  MobileNotificationSettings,
  MobilePrivacySettings,
  MobileSettingsState,
  ThemeMode,
} from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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

const LANGUAGE_OPTIONS: Array<{ key: AppLanguage; label: string; nativeLabel: string }> = [
  { key: 'en-IN', label: 'English', nativeLabel: 'English' },
  { key: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { key: 'gu-IN', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
];

export function SettingsScreen() {
  const { palette, themeMode, setThemeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useAppLanguage();
  const { logout } = useAuth();
  const keyboard = useKeyboard();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [account, setAccount] = useState<MobileAccountSettings>(defaultAccount);
  const [notifications, setNotifications] = useState<MobileNotificationSettings>(defaultNotifications);
  const [privacy, setPrivacy] = useState<MobilePrivacySettings>(defaultPrivacy);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentLangOption = LANGUAGE_OPTIONS.find((o) => o.key === (language ?? 'en-IN'));

  const persistSettings = async (state: MobileSettingsState) => {
    await Promise.race([
      saveJson<MobileSettingsState>(STORAGE_KEY, state),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Saving settings timed out. Please try again.')), 8000);
      }),
    ]);
  };

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
      setLoaded(true);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const saveSettings = async (nextTheme: ThemeMode = themeMode) => {
    setSaving(true);
    setSaveError(null);
    try {
      const state: MobileSettingsState = {
        account,
        notifications,
        privacy,
        theme: nextTheme,
      };

      await persistSettings(state);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: keyof MobileNotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof MobilePrivacySettings) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetSettings = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      setAccount(defaultAccount);
      setNotifications(defaultNotifications);
      setPrivacy(defaultPrivacy);
      await setThemeMode('light');
      await persistSettings({
        account: defaultAccount,
        notifications: defaultNotifications,
        privacy: defaultPrivacy,
        theme: 'light',
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to reset settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectLanguage = (lang: AppLanguage) => {
    void setLanguage(lang);
    setAccount((prev) => ({ ...prev, language: lang }));
    setShowLangPicker(false);
  };

  const cycleTimezone = () => {
    const values = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London'];
    const index = values.indexOf(account.timezone);
    const next = values[(index + 1) % values.length];
    setAccount((prev) => ({ ...prev, timezone: next }));
  };

  if (!loaded) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="small" color={palette.primary} />
      </View>
    );
  }

  return (
    <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <SectionCard>
        <ScreenTitle title={t('settings')} subtitle={t('settingsSubtitle')} />
        <View style={styles.actionRow}>
          <PrimaryButton label={t('saveChanges')} onPress={() => void saveSettings()} disabled={saving} />
          <Pressable style={styles.resetButton} onPress={() => void resetSettings()}>
            <Text style={styles.resetButtonText}>{t('reset')}</Text>
          </Pressable>
        </View>
        <View style={styles.savedRow}>
          {saving ? <ActivityIndicator size="small" color={palette.primary} /> : null}
          {savedAt ? <Text style={[styles.savedText, { color: palette.primary }]}>{t('savedAt')} {savedAt}</Text> : null}
        </View>
        {saveError ? <InlineError message={saveError} /> : null}
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('accountPreferences')}</Text>

        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => setShowLangPicker(true)}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>{t('languageFieldLabel')}</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: palette.primary }]}>
              {currentLangOption ? `${currentLangOption.nativeLabel} (${currentLangOption.label})` : language}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={palette.muted} />
          </View>
        </Pressable>

        {/* Language Picker Modal */}
        <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowLangPicker(false)}>
            <View style={[styles.modalSheet, { backgroundColor: palette.cardBg }]}>
              <View style={styles.modalHandle} />
              <Text style={[styles.modalTitle, { color: palette.text }]}>{t('languageFieldLabel')}</Text>
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = (language ?? 'en-IN') === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.langOption, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primarySoft : palette.surface }]}
                    onPress={() => selectLanguage(opt.key)}
                  >
                    <View style={styles.langOptionLeft}>
                      <Text style={[styles.langNative, { color: active ? palette.primary : palette.text }]}>{opt.nativeLabel}</Text>
                      <Text style={[styles.langEnglish, { color: palette.muted }]}>{opt.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={palette.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Modal>

        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={cycleTimezone}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>{t('timezoneLabel')}</Text>
          <Text style={[styles.rowValue, { color: palette.text }]}>{account.timezone}</Text>
        </Pressable>

      </SectionCard>

      {/*
        * Notification preferences removed: the app sends no notifications,
        * so every switch here was a promise it could not keep.
        */}

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('privacyAndSecurity')}</Text>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('showPhoneToConnections')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>{t('showPhoneToConnections')}</Text>
          <Switch
            value={privacy.showPhoneToConnections}
            onValueChange={() => togglePrivacy('showPhoneToConnections')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('showLocationPublicly')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>{t('showLocationPublicly')}</Text>
          <Switch
            value={privacy.showLocationPublicly}
            onValueChange={() => togglePrivacy('showLocationPublicly')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        <Pressable style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={() => togglePrivacy('profileSearchable')}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>{t('allowProfileInSearch')}</Text>
          <Switch
            value={privacy.profileSearchable}
            onValueChange={() => togglePrivacy('profileSearchable')}
            trackColor={{ false: palette.border, true: palette.primary }}
          />
        </Pressable>
        {/*
          * Two-factor auth removed: the server has no column for it, so the
          * switch flipped and changed nothing. Sign-in already uses an emailed
          * code, which is the second factor.
          */}
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.danger }]}>{t('dangerZone')}</Text>
        <Text style={[styles.noteText, { color: palette.muted, marginTop: 4 }]}>{t('dangerZoneSubtitle')}</Text>
        <Pressable
          style={[styles.deleteBtn, { borderColor: palette.danger }]}
          onPress={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(null); }}
        >
          <Text style={[styles.deleteBtnText, { color: palette.danger }]}>{t('deleteMyAccount')}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('appearanceLabel')}</Text>
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
        <Text style={[styles.noteText, { color: palette.muted }]}>{t('themeAppliedNote')}</Text>
      </SectionCard>
      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteModal(false)}>
          {/*
            * The confirmation box asks you to type DELETE, and the keyboard
            * covered the very field it was asking about.
            */}
          <View
            style={[
              styles.deleteModalSheet,
              { backgroundColor: palette.cardBg },
              keyboard.height > 0 && { marginBottom: keyboard.height },
            ]}
          >
            <Text style={[styles.deleteModalTitle, { color: palette.danger }]}>{t('deleteAccountTitle')}</Text>
            <Text style={[styles.deleteModalWarning, { color: palette.text }]}>{t('deleteAccountWarning')}</Text>
            <Text style={[styles.deleteModalLabel, { color: palette.text }]}>{t('typeDeleteToConfirm')}</Text>
            <TextInput
              style={[styles.deleteInput, { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={t('typeDeletePlaceholder')}
              placeholderTextColor={palette.muted}
              autoCapitalize="characters"
            />
            {deleteError ? <Text style={styles.deleteErrorText}>{deleteError}</Text> : null}
            <View style={styles.deleteModalButtons}>
              <Pressable
                style={[styles.deleteCancelBtn, { borderColor: palette.border, backgroundColor: palette.surface }]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={[styles.deleteCancelText, { color: palette.text }]}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteConfirmBtn, { backgroundColor: deleteConfirmText === 'DELETE' && !deleting ? palette.danger : palette.border }]}
                onPress={async () => {
                  if (deleteConfirmText !== 'DELETE' || deleting) return;
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    // Delete first, then end the session. Signing out on its
                    // own used to be the whole of this handler, so the warning
                    // above was untrue and nothing was ever removed.
                    await api.deleteAccount();
                    setShowDeleteModal(false);
                    await logout();
                  } catch (err) {
                    setDeleteError(
                      (err as Error).message || 'Failed to delete account. Please try again.'
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                <Text style={styles.deleteConfirmText}>{deleting ? t('deleting') : t('deleteForever')}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
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
      color: palette.textSoft,
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
      color: palette.textSoft,
      fontWeight: '600',
    },
    themeBtnTextActive: {
      color: palette.surface,
    },
    noteText: {
      marginTop: spacing.sm,
      ...type.caption,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      gap: 10,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#ccc',
      alignSelf: 'center',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    langOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 2,
      borderRadius: 14,
      padding: 16,
    },
    langOptionLeft: {
      gap: 2,
    },
    langNative: {
      fontSize: 18,
      fontWeight: '700',
    },
    langEnglish: {
      fontSize: 13,
    },
    deleteBtn: {
      marginTop: spacing.sm,
      borderWidth: 1.5,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignSelf: 'flex-start' as const,
    },
    deleteBtnText: {
      fontWeight: '700',
      fontSize: 14,
    },
    deleteModalSheet: {
      margin: spacing.md,
      borderRadius: 20,
      padding: spacing.md,
      gap: spacing.xs,
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
    },
    deleteModalWarning: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
    },
    deleteModalLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginTop: 4,
    },
    deleteInput: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 15,
      marginTop: 4,
    },
    deleteErrorText: {
      color: palette.danger,
      fontSize: 13,
      marginTop: 4,
    },
    deleteModalButtons: {
      flexDirection: 'row' as const,
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    deleteCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center' as const,
    },
    deleteCancelText: {
      fontWeight: '600',
      fontSize: 14,
    },
    deleteConfirmBtn: {
      flex: 1,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center' as const,
    },
    deleteConfirmText: {
      fontWeight: '700',
      fontSize: 14,
      color: '#ffffff',
    },
  });
}
