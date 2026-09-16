import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import {
  Callout,
  Field,
  GradientFill,
  Input,
  KeyboardScrollContext,
  PrimaryButton,
  TextButton,
  useKeyboardAwareScroll,
} from '../components/ui';
import { radius, shadow, spacing } from '../theme';
import { useAppLanguage } from '../context/LanguageContext';

interface LoginScreenProps {
  onPhoneLogin?: () => void;
  onSignup?: () => void;
}

export function LoginScreen({ onPhoneLogin, onSignup }: LoginScreenProps) {
  const { requestOtp, verifyOtp, login, loginWithToken } = useAuth();
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const keyboardScroll = useKeyboardAwareScroll();

  /*
   * Four stages rather than two: members can sign in with the password they
   * set at signup, fall back to an emailed code, or reset a forgotten
   * password without leaving the screen.
   */
  const [stage, setStage] = useState<'signIn' | 'code' | 'forgot' | 'reset'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState('');

  // Any deliverable-looking address. The account used to be restricted to
  // Gmail, which locked out anyone on Outlook, Yahoo or a work domain.
  const emailValid = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim());
  const emailError = touched && email.length > 0 && !emailValid ? t('loginEmailInvalid') : undefined;

  const handleSendCode = async () => {
    setTouched(true);
    if (!emailValid || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await requestOtp(email.trim(), 'login');
      if (result.debugOtp) {
        setDevCode(result.debugOtp);
      }
      setStage('code');
    } catch (err) {
      const message = (err as Error).message || '';
      setError(
        message.toLowerCase().includes('not found')
          ? t('loginNoAccount')
          : message || t('loginSendFailed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordLogin = async () => {
    setTouched(true);
    if (!emailValid || password.length < 1 || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError((err as Error).message || t('loginSignInFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    setTouched(true);
    if (!emailValid || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.forgotPassword(email.trim());
      if (result.debugOtp) {
        setDevCode(result.debugOtp);
      }
      // The server answers the same way whether or not the address has an
      // account, so the wording here must not imply one exists.
      setNotice(t('loginResetNotice'));
      setCode('');
      setStage('reset');
    } catch (err) {
      setError((err as Error).message || t('loginResetFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 6 || newPassword.length < 8 || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await api.resetPassword(email.trim(), code, newPassword);
      await loginWithToken(token, '');
    } catch (err) {
      setError((err as Error).message || t('loginCodeFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setStage('signIn');
    setCode('');
    setNewPassword('');
    setError(null);
    setNotice(null);
    setDevCode('');
  };

  const handleVerify = async () => {
    if (code.length !== 6 || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(email.trim(), 'login', code);
    } catch (err) {
      setError((err as Error).message || 'That code did not work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <GradientFill colors={palette.gradient} />
        <View style={styles.heroContent}>
          <View style={styles.logoBadge}>
            <Ionicons name="infinite" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t('loginTitle')}</Text>
          <Text style={styles.heroSub}>{t('loginSubtitle')}</Text>
        </View>
      </View>

      <ScrollView
        {...keyboardScroll.scrollProps}
        style={styles.sheet}
        contentContainerStyle={[
          styles.sheetInner,
          keyboardScroll.keyboardHeight > 0 && { paddingBottom: keyboardScroll.keyboardHeight + 24 },
        ]}
        automaticallyAdjustKeyboardInsets
      >
        <KeyboardScrollContext.Provider value={keyboardScroll.contextValue}>
        {stage === 'signIn' ? (
          <>
            <Field label={t('loginEmailLabel')} error={emailError}>
              <Input
                placeholder={t('loginEmailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched(true)}
                autoCapitalize="none"
                keyboardType="email-address"
                invalid={Boolean(emailError)}
              />
            </Field>

            <Field label={t('loginPasswordLabel')}>
              <Input
                placeholder={t('loginPasswordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.cta}>
              <PrimaryButton
                label={t('loginButton')}
                icon="arrow-forward"
                disabled={!emailValid || password.length < 1}
                loading={submitting}
                onPress={handlePasswordLogin}
              />
            </View>

            <TextButton label={t('loginForgot')} onPress={() => { setError(null); setStage('forgot'); }} />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('loginOr')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.phoneButton,
                pressed && styles.phoneButtonPressed,
                !emailValid && styles.secondaryDisabled,
              ]}
              disabled={!emailValid || submitting}
              onPress={handleSendCode}
            >
              <Ionicons name="mail-outline" size={18} color={palette.primary} />
              <Text style={styles.phoneButtonText}>{t('loginCodeInstead')}</Text>
            </Pressable>
          </>
        ) : stage === 'forgot' ? (
          <>
            <Field label={t('loginEmailLabel')} hint={t('loginResetHint')} error={emailError}>
              <Input
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched(true)}
                autoCapitalize="none"
                keyboardType="email-address"
                invalid={Boolean(emailError)}
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.cta}>
              <PrimaryButton
                label={t('loginSendResetCode')}
                icon="arrow-forward"
                disabled={!emailValid}
                loading={submitting}
                onPress={handleForgot}
              />
            </View>

            <TextButton label={t('loginBackToSignIn')} onPress={backToSignIn} />
          </>
        ) : stage === 'reset' ? (
          <>
            {devCode ? <Callout icon="flask-outline" text={t('testModeCode', { code: devCode })} /> : null}
            {notice ? <Callout icon="mail-outline" text={notice} /> : null}

            <Field label={t('loginCodeLabel')} hint={t('loginSpamHint')}>
              <Input
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </Field>

            <Field label={t('loginNewPassword')} hint={t('loginNewPasswordHint')}>
              <Input
                placeholder={t('loginNewPassword')}
                value={newPassword}
                onChangeText={(text) => setNewPassword(text.slice(0, 20))}
                autoCapitalize="none"
                secureTextEntry
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.cta}>
              <PrimaryButton
                label={t('loginSetNewPassword')}
                disabled={code.length !== 6 || newPassword.length < 8}
                loading={submitting}
                onPress={handleReset}
              />
            </View>

            <TextButton label={t('loginBackToSignIn')} onPress={backToSignIn} />
          </>
        ) : (
          <>
            {devCode ? <Callout icon="flask-outline" text={`Test mode code: ${devCode}`} /> : null}

            <Field
              label={t('loginCodeLabel')}
              hint={t('loginCodeSentTo', { email: email.trim() })}
              error={error}
            >
              <Input
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </Field>

            <View style={styles.cta}>
              <PrimaryButton
                label={t('loginButton')}
                disabled={code.length !== 6}
                loading={submitting}
                onPress={handleVerify}
              />
            </View>

            <TextButton label={t('loginDifferentEmail')} onPress={backToSignIn} />
          </>
        )}

        {/*
          * Phone sign-in is hidden, not removed: the screen and the API route
          * both still work, and MSG91 is not configured, so offering it would
          * be a dead end. Restore this block when SMS is live.
          */}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t('loginNewHere')}</Text>
          <Pressable onPress={onSignup} hitSlop={8}>
            <Text style={styles.footerLink}>{t('loginCreateProfile')}</Text>
          </Pressable>
        </View>
        </KeyboardScrollContext.Provider>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },

    hero: {
      paddingTop: 84,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      overflow: 'hidden',
    },
    heroContent: { gap: spacing.xs },
    logoBadge: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
    heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 21 },

    sheet: {
      flex: 1,
      backgroundColor: palette.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      marginTop: -spacing.lg,
    },
    sheetInner: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },

    cta: { marginTop: spacing.xs },
    error: { fontSize: 13.5, color: palette.danger, fontWeight: '600' },

    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
    dividerLine: { flex: 1, height: 1, backgroundColor: palette.border },
    dividerText: { fontSize: 12.5, color: palette.muted, fontWeight: '600' },

    phoneButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 15,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      ...shadow.card,
    },
    secondaryDisabled: { opacity: 0.45 },
    phoneButtonPressed: { opacity: 0.85 },
    phoneButtonText: { color: palette.text, fontSize: 15, fontWeight: '700' },

    footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
    footerText: { color: palette.muted, fontSize: 14.5 },
    footerLink: { color: palette.primary, fontSize: 14.5, fontWeight: '800' },
  });
}
