import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import type { OtpPurpose } from '../types';
import { BrandArtwork } from '../components/BrandArtwork';

export function LoginScreen() {
  const { requestOtp, login, signup } = useAuth();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Signup only fields
  const [phone, setPhone] = useState('');

  const purpose: OtpPurpose = useMemo(() => (mode === 'login' ? 'login' : 'signup'), [mode]);

  const validateEmail = (value: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim());
  const validatePhone = (value: string) => /^[0-9]{10}$/.test(value.trim());

  const handleSendOtp = async () => {
    try {
      if (!validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid Gmail address.');
        return;
      }
      setSubmitting(true);
      const response = await requestOtp(email.trim(), purpose) as unknown as { message?: string; debugOtp?: string };
      setOtpSent(true);
      if (response?.debugOtp) {
        Alert.alert('OTP Ready', `Use this code for testing: ${response.debugOtp}`);
      } else {
        Alert.alert('OTP Sent', response?.message || 'Check your inbox for verification code.');
      }
    } catch (error) {
      Alert.alert('OTP Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid Gmail address.');
        return;
      }
      if (!password || !otpCode) {
        Alert.alert('Missing Fields', 'Password and OTP are required.');
        return;
      }
      setSubmitting(true);
      if (mode === 'login') {
        await login({ email: email.trim(), password, otpCode: otpCode.trim() });
      } else {
        if (!validatePhone(phone)) {
          Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
          return;
        }
        await signup({
          name: email.trim().split('@')[0],
          email: email.trim(),
          password,
          otpCode: otpCode.trim(),
          phone: phone.trim(),
        });
      }
    } catch (error) {
      Alert.alert('Auth Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heroArtWrap}>
        <BrandArtwork />
        <View style={styles.heroTextLayer}>
          <Text style={styles.heroTag}>Community Platform</Text>
          <Text style={styles.heroTitle}>Chaudhary Samaj</Text>
          <Text style={styles.heroSub}>Secure access for matrimony, events, and community updates.</Text>
        </View>
      </View>

      <Text style={styles.title}>Chaudhary Samaj</Text>
      <Text style={styles.subtitle}>Mobile Access</Text>

      {mode === 'login' ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Gmail Address</Text>
            <TextInput
              placeholder="name@gmail.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput placeholder="Enter password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>OTP Code</Text>
            <TextInput
              placeholder="Enter OTP"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <Pressable style={styles.secondaryButton} onPress={handleSendOtp} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>

          <View style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Don't have an account? </Text>
            <Pressable onPress={() => { setMode('signup'); setOtpSent(false); setEmail(''); setPassword(''); setOtpCode(''); setPhone(''); }}>
              <Text style={styles.signupLinkButton}>Sign up</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.signupTitle}>Create Your Account</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Gmail Address</Text>
            <TextInput
              placeholder="name@gmail.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              placeholder="10-digit phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput placeholder="Enter password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>OTP Code</Text>
            <TextInput
              placeholder="Enter OTP"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <Pressable style={styles.secondaryButton} onPress={handleSendOtp} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>

          <View style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Already have an account? </Text>
            <Pressable onPress={() => { setMode('login'); setOtpSent(false); setEmail(''); setPassword(''); setOtpCode(''); setPhone(''); }}>
              <Text style={styles.signupLinkButton}>Login</Text>
            </Pressable>
          </View>
        </>
      )}
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
      padding: 24,
      paddingBottom: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: palette.text,
    },
    signupTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 20,
    },
    subtitle: {
      fontSize: 14,
      color: palette.muted,
      marginBottom: 16,
      marginTop: 2,
    },
    heroArtWrap: {
      marginBottom: 18,
      position: 'relative',
    },
    heroTextLayer: {
      position: 'absolute',
      left: 16,
      top: 14,
      right: 16,
    },
    heroTag: {
      color: palette.primarySoft,
      fontWeight: '700',
      letterSpacing: 0.2,
      fontSize: 12,
    },
    heroTitle: {
      marginTop: 6,
      color: palette.surface,
      fontSize: 27,
      fontWeight: '800',
    },
    heroSub: {
      marginTop: 5,
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
      maxWidth: 280,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      backgroundColor: palette.surface,
      color: palette.text,
      padding: 12,
      marginBottom: 2
    },
    fieldGroup: {
      marginBottom: 10,
    },
    label: {
      color: palette.accent,
      fontWeight: '600',
      marginBottom: 6,
    },
    primaryButton: {
      backgroundColor: palette.primary,
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      alignItems: 'center'
    },
    primaryButtonText: {
      color: palette.surface,
      fontWeight: '700'
    },
    secondaryButton: {
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.primary,
      alignItems: 'center'
    },
    secondaryButtonText: {
      color: palette.primary,
      fontWeight: '700'
    },
    signupLink: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
    },
    signupLinkText: {
      color: palette.muted,
      fontSize: 14,
    },
    signupLinkButton: {
      color: palette.primary,
      fontWeight: '700',
      fontSize: 14,
    }
  });
}
