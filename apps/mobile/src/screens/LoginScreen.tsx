import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '../utils/alert';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { BrandArtwork } from '../components/BrandArtwork';

interface LoginScreenProps {
  onPhoneLogin?: () => void;
}

export function LoginScreen({ onPhoneLogin }: LoginScreenProps) {
  const { login, signup } = useAuth();
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Signup only fields
  const [phone, setPhone] = useState('');

  const validateEmail = (value: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim());
  const validatePhone = (value: string) => /^[0-9]{10}$/.test(value.trim());

  const handleSubmit = async () => {
    try {
      if (!validateEmail(email)) {
        showAlert('Invalid Email', 'Please enter a valid Gmail address.');
        return;
      }
      if (!password) {
        showAlert('Missing Fields', 'Password is required.');
        return;
      }
      setSubmitting(true);
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        if (!validatePhone(phone)) {
          showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
          return;
        }
        await signup({
          name: email.trim().split('@')[0],
          email: email.trim(),
          password,
          phone: phone.trim(),
        });
      }
    } catch (error) {
      const msg = (error as Error).message || '';
      if (mode === 'login') {
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password')) {
          showAlert('Login Failed', 'Account not found or incorrect password. Please check your credentials and try again.');
        } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist')) {
          showAlert('Account Not Found', 'No account exists with this email. Please sign up first.');
        } else {
          showAlert('Login Failed', msg || 'Unable to login. Please try again.');
        }
      } else {
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
          showAlert('Account Already Exists', 'An account with this email already exists. Please login instead.');
        } else {
          showAlert('Signup Failed', msg || 'Unable to create account. Please try again.');
        }
      }
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

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>

          <View style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Don't have an account? </Text>
            <Pressable onPress={() => { setMode('signup'); setEmail(''); setPassword(''); setPhone(''); }}>
              <Text style={styles.signupLinkButton}>Sign up</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.phoneButton} onPress={onPhoneLogin}>
            <Text style={styles.phoneButtonText}>📱 Login with Phone Number</Text>
          </Pressable>
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

          <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>

          <View style={styles.signupLink}>
            <Text style={styles.signupLinkText}>Already have an account? </Text>
            <Pressable onPress={() => { setMode('login'); setEmail(''); setPassword(''); setPhone(''); }}>
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
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: palette.border,
    },
    dividerText: {
      color: palette.muted,
      marginHorizontal: 12,
      fontSize: 12,
      fontWeight: '600',
    },
    phoneButton: {
      backgroundColor: palette.cardBg,
      borderRadius: 10,
      padding: 14,
      borderWidth: 2,
      borderColor: palette.primary,
      alignItems: 'center',
    },
    phoneButtonText: {
      color: palette.primary,
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
