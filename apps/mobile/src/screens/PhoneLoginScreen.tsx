import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Callout, Field, Input, PrimaryButton, StepScaffold } from '../components/ui';
import { api } from '../services/api';
import { spacing } from '../theme';

interface PhoneLoginScreenProps {
  onLoginSuccess: (token: string, userId: string) => void;
  onBack: () => void;
}

export function PhoneLoginScreen({ onLoginSuccess, onBack }: PhoneLoginScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [testOtp, setTestOtp] = useState('');

  const phoneValid = /^[0-9]{10}$/.test(phone.trim());

  const handleSendOtp = async () => {
    if (!phoneValid) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.requestPhoneOtp(phone.trim());
      if (response.mockOtp) setTestOtp(response.mockOtp);
      setStep('otp');
    } catch (err) {
      Alert.alert('Could not send code', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.verifyPhoneOtp(phone.trim(), otp.trim());
      if (response.token && response.userId) {
        onLoginSuccess(response.token, response.userId);
      } else {
        Alert.alert('Incorrect code', 'That code did not match. Please try again.');
      }
    } catch (err) {
      Alert.alert('Verification failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <StepScaffold
          eyebrow="Phone login"
          title="Enter your mobile number"
          subtitle="We'll text you a one-time code to sign in."
          onBack={onBack}
          footer={
            <PrimaryButton
              label="Send code"
              onPress={handleSendOtp}
              disabled={!phoneValid}
              loading={loading}
            />
          }
        >
          <Field label="Mobile number" hint="Registered with your Chaudhary Samaj account.">
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="98xxxxxxxx"
              keyboardType="phone-pad"
              maxLength={10}
              prefix={<Text style={styles.prefix}>+91</Text>}
            />
          </Field>
        </StepScaffold>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <StepScaffold
        eyebrow="Verify"
        title="Enter the 6-digit code"
        subtitle={`Sent to +91 ${phone}`}
        onBack={() => setStep('phone')}
        footer={
          <View style={styles.footerStack}>
            <PrimaryButton
              label="Verify and log in"
              onPress={handleVerifyOtp}
              disabled={otp.trim().length !== 6}
              loading={loading}
            />
            <Pressable onPress={handleSendOtp} hitSlop={8}>
              <Text style={styles.resend}>Resend code</Text>
            </Pressable>
          </View>
        }
      >
        {testOtp ? <Callout icon="flask-outline" text={`Test mode code: ${testOtp}`} /> : null}

        <Field label="One-time password">
          <Input
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
        </Field>
      </StepScaffold>
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: palette.bg },
    prefix: { color: palette.text, fontWeight: '700', fontSize: 15 },
    footerStack: { gap: spacing.sm },
    resend: {
      color: palette.primary,
      fontWeight: '700',
      fontSize: 14.5,
      textAlign: 'center',
      paddingVertical: spacing.xs,
    },
  });
}
