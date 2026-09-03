import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../utils/alert';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Field, GradientFill, Input, PrimaryButton } from '../components/ui';
import { radius, shadow, spacing } from '../theme';

interface LoginScreenProps {
  onPhoneLogin?: () => void;
  onSignup?: () => void;
}

export function LoginScreen({ onPhoneLogin, onSignup }: LoginScreenProps) {
  const { login } = useAuth();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email.trim());
  const emailError = touched && email.length > 0 && !emailValid ? 'Enter a valid Gmail address.' : undefined;

  const handleSubmit = async () => {
    setTouched(true);
    if (!emailValid) {
      showAlert('Invalid email', 'Please enter a valid Gmail address.');
      return;
    }
    if (!password) {
      showAlert('Password required', 'Please enter your password.');
      return;
    }

    try {
      setSubmitting(true);
      await login({ email: email.trim(), password });
    } catch (error) {
      const msg = ((error as Error).message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist')) {
        showAlert('Account not found', 'No account exists with this email. Create a profile first.');
      } else {
        showAlert('Login failed', 'That email and password combination did not work. Please try again.');
      }
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
      >
        <Field label="Email address" error={emailError}>
          <Input
            placeholder="you@gmail.com"
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
            secureTextEntry
          />
        </Field>

        <View style={styles.cta}>
          <PrimaryButton label="Log in" onPress={handleSubmit} loading={submitting} />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.phoneButton, pressed && styles.phoneButtonPressed]}
          onPress={onPhoneLogin}
        >
          <Ionicons name="phone-portrait-outline" size={18} color={palette.primary} />
          <Text style={styles.phoneButtonText}>Continue with phone number</Text>
        </Pressable>

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
    phoneButtonPressed: { opacity: 0.85 },
    phoneButtonText: { color: palette.text, fontSize: 15, fontWeight: '700' },

    footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
    footerText: { color: palette.muted, fontSize: 14.5 },
    footerLink: { color: palette.primary, fontSize: 14.5, fontWeight: '800' },
  });
}
