import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Callout, Field, Input, PrimaryButton, StepScaffold } from '../components/ui';
import { api } from '../services/api';
import { spacing } from '../theme';
import { useAppLanguage } from '../context/LanguageContext';

interface PhoneLoginScreenProps {
  onLoginSuccess: (token: string, userId: string) => void;
  onBack: () => void;
}

export function PhoneLoginScreen({ onLoginSuccess, onBack }: PhoneLoginScreenProps) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [testOtp, setTestOtp] = useState('');

  const phoneValid = /^[0-9]{10}$/.test(phone.trim());

  const handleSendOtp = async () => {
    if (!phoneValid) {
      Alert.alert(t('phErrInvalidNumberTitle'), t('phErrInvalidNumberBody'));
      return;
    }

    try {
      setLoading(true);
      const response = await api.requestPhoneOtp(phone.trim());
      if (response.mockOtp) setTestOtp(response.mockOtp);
      setStep('otp');
    } catch (err) {
      Alert.alert(t('phErrSendFailed'), (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert(t('phErrInvalidCodeTitle'), t('phErrInvalidCodeBody'));
      return;
    }

    try {
      setLoading(true);
      const response = await api.verifyPhoneOtp(phone.trim(), otp.trim());
      if (response.token && response.userId) {
        onLoginSuccess(response.token, response.userId);
      } else {
        Alert.alert(t('phErrWrongCodeTitle'), t('phErrWrongCodeBody'));
      }
    } catch (err) {
      Alert.alert(t('phErrVerifyFailed'), (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <StepScaffold
          eyebrow={t('phLoginTitle')}
          title={t('phEnterMobile')}
          subtitle={t('phOtpIntro')}
          onBack={onBack}
          footer={
            <PrimaryButton
              label={t('phSendCode')}
              onPress={handleSendOtp}
              disabled={!phoneValid}
              loading={loading}
            />
          }
        >
          <Field label={t('phMobileNumber')} hint={t('phRegisteredHint')}>
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
        eyebrow={t('phVerifyTitle')}
        title={t('phEnterCode')}
        subtitle={t('phSentTo', { phone })}
        onBack={() => setStep('phone')}
        footer={
          <View style={styles.footerStack}>
            <PrimaryButton
              label={t('phVerifyLogin')}
              onPress={handleVerifyOtp}
              disabled={otp.trim().length !== 6}
              loading={loading}
            />
            <Pressable onPress={handleSendOtp} hitSlop={8}>
              <Text style={styles.resend}>{t('phResendCode')}</Text>
            </Pressable>
          </View>
        }
      >
        {testOtp ? <Callout icon="flask-outline" text={`Test mode code: ${testOtp}`} /> : null}

        <Field label={t('phOtpLabel')}>
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
