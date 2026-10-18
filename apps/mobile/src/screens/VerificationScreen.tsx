import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AadhaarVerify } from '../components/AadhaarVerify';
import { InlineError, ScreenLoader } from '../components/AppFeedback';
import { Input, PrimaryButton, TextButton } from '../components/ui';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api, type VerificationSummary } from '../services/api';
import { radius, spacing } from '../theme';

/*
 * Email and Aadhaar verification, after signup.
 *
 * Signup offers the Aadhaar step once, with a skip. This screen, reached from
 * the Profile tab, is where a member who skipped comes back to it, and where
 * an older account whose email was never proved can prove it.
 */
export function VerificationScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSummary(await api.getVerification());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const sendEmailCode = async () => {
    if (!summary?.email.address) return;
    setEmailBusy(true);
    setError(null);
    try {
      await api.requestOtp(summary.email.address, 'login');
      setCodeSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmEmailCode = async () => {
    if (!summary?.email.address) return;
    setEmailBusy(true);
    setError(null);
    try {
      await api.verifyOtp(summary.email.address, 'login', code.trim());
      setCodeSent(false);
      setCode('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEmailBusy(false);
    }
  };

  if (loading) return <ScreenLoader message={t('verifyTitle')} />;

  const email = summary?.email;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={8} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('verifyTitle')}</Text>
          <Text style={styles.subtitle}>{t('verifySubtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {error ? <InlineError message={error} /> : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="id-card-outline" size={22} color={palette.primary} />
            <Text style={styles.cardTitle}>{t('verifyAadhaarTitle')}</Text>
          </View>
          <AadhaarVerify aadhaar={summary?.aadhaar || null} onResult={setSummary} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="mail-outline" size={22} color={palette.primary} />
            <Text style={styles.cardTitle}>{t('verifyEmailTitle')}</Text>
          </View>

          {!email?.address ? (
            <Text style={styles.body}>{t('verifyEmailNone')}</Text>
          ) : email.verified ? (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={26} color={palette.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: palette.success }]}>{t('verifyEmailDone')}</Text>
                <Text style={styles.body}>{email.address}</Text>
              </View>
            </View>
          ) : codeSent ? (
            <>
              <Text style={styles.body}>{t('verifyEmailCodeSent', { email: email.address })}</Text>
              <Input
                value={code}
                onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('verifyEmailCodePlaceholder')}
                keyboardType="number-pad"
                maxLength={6}
              />
              <PrimaryButton
                label={t('verifyEmailConfirm')}
                loading={emailBusy}
                disabled={code.length !== 6}
                onPress={() => void confirmEmailCode()}
              />
              <TextButton label={t('verifyEmailSendCode')} onPress={() => void sendEmailCode()} />
            </>
          ) : (
            <>
              <Text style={styles.body}>{`${t('verifyEmailPending')} · ${email.address}`}</Text>
              <PrimaryButton label={t('verifyEmailSendCode')} loading={emailBusy} onPress={() => void sendEmailCode()} />
            </>
          )}
        </View>
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
    content: { padding: spacing.md, gap: spacing.md },
    card: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardTitle: { fontSize: 17, fontWeight: '800', color: palette.text },
    body: { fontSize: 14, lineHeight: 20, color: palette.textSoft },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    statusTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  });
}
