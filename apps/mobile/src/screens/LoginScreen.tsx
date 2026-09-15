import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Callout, Field, GradientFill, Input, PrimaryButton, TextButton } from '../components/ui';
import { radius, shadow, spacing } from '../theme';

interface LoginScreenProps {
  onPhoneLogin?: () => void;
  onSignup?: () => void;
}

export function LoginScreen({ onPhoneLogin, onSignup }: LoginScreenProps) {
  const { requestOtp, verifyOtp, login, loginWithToken } = useAuth();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

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
  const emailError = touched && email.length > 0 && !emailValid ? 'Enter a valid email address.' : undefined;

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
          ? 'No account exists with this email. Create a profile first.'
          : message || 'Could not send the code. Please try again.'
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
      setError((err as Error).message || 'Could not sign in. Please check your details.');
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
      setNotice('If that email has an account, a reset code is on its way. Not in your inbox? Check the spam or junk folder — it can land there.');
      setCode('');
      setStage('reset');
    } catch (err) {
      setError((err as Error).message || 'Could not start the reset. Please try again.');
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
      setError((err as Error).message || 'That code did not work. Please try again.');
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
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSub}>Sign in to pick up where you left off.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetInner}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {stage === 'signIn' ? (
          <>
            <Field label="Email address" error={emailError}>
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

            <Field label="Password">
              <Input
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                secureTextEntry
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.cta}>
              <PrimaryButton
                label="Log in"
                icon="arrow-forward"
                disabled={!emailValid || password.length < 1}
                loading={submitting}
                onPress={handlePasswordLogin}
              />
            </View>

            <TextButton label="Forgot password?" onPress={() => { setError(null); setStage('forgot'); }} />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
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
              <Text style={styles.phoneButtonText}>Email me a code instead</Text>
            </Pressable>
          </>
        ) : stage === 'forgot' ? (
          <>
            <Field label="Email address" hint="We'll send a code to reset your password." error={emailError}>
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
                label="Send reset code"
                icon="arrow-forward"
                disabled={!emailValid}
                loading={submitting}
                onPress={handleForgot}
              />
            </View>

            <TextButton label="Back to sign in" onPress={backToSignIn} />
          </>
        ) : stage === 'reset' ? (
          <>
            {devCode ? <Callout icon="flask-outline" text={`Test mode code: ${devCode}`} /> : null}
            {notice ? <Callout icon="mail-outline" text={notice} /> : null}

            <Field label="6-digit code" hint="Not in your inbox? Check the spam or junk folder — it can land there.">
              <Input
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </Field>

            <Field label="New password" hint="Between 8 and 20 characters.">
              <Input
                placeholder="New password"
                value={newPassword}
                onChangeText={(text) => setNewPassword(text.slice(0, 20))}
                autoCapitalize="none"
                secureTextEntry
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.cta}>
              <PrimaryButton
                label="Set new password"
                disabled={code.length !== 6 || newPassword.length < 8}
                loading={submitting}
                onPress={handleReset}
              />
            </View>

            <TextButton label="Back to sign in" onPress={backToSignIn} />
          </>
        ) : (
          <>
            {devCode ? <Callout icon="flask-outline" text={`Test mode code: ${devCode}`} /> : null}

            <Field
              label="6-digit code"
              hint={`Sent to ${email.trim()}. Not in your inbox? Check the spam or junk folder — it can land there.`}
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
                label="Log in"
                disabled={code.length !== 6}
                loading={submitting}
                onPress={handleVerify}
              />
            </View>

            <TextButton label="Use a different email" onPress={backToSignIn} />
          </>
        )}

        {/*
          * Phone sign-in is hidden, not removed: the screen and the API route
          * both still work, and MSG91 is not configured, so offering it would
          * be a dead end. Restore this block when SMS is live.
          */}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here? </Text>
          <Pressable onPress={onSignup} hitSlop={8}>
            <Text style={styles.footerLink}>Create a profile</Text>
          </Pressable>
        </View>
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
