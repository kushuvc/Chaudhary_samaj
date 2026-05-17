import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

export interface BasicDetailsData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  agreeToTerms: boolean;
}

interface SignupBasicDetailsScreenProps {
  onBack: () => void;
  onSubmit: (data: BasicDetailsData) => Promise<void> | void;
}

export function SignupBasicDetailsScreen({ onBack, onSubmit }: SignupBasicDetailsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<BasicDetailsData>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [mockOtpHint, setMockOtpHint] = useState('');

  const handleSendOtp = async () => {
    if (!isValid || otpSending) return;
    setOtpSending(true);
    setError(null);
    try {
      const response = await api.requestPhoneOtp(data.phone);
      if (response.mockOtp) {
        setMockOtpHint(response.mockOtp);
        Alert.alert('Test Mode OTP', `Your OTP is: ${response.mockOtp}`);
      }
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async () => {
    if (otp.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Verify OTP first (verifyOnly = true, don't create user yet)
      await api.verifyPhoneOtp(data.phone, otp, true);
      // OTP verified, proceed with full signup
      await onSubmit(data);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string) => /^[^\s@]+@gmail\.com$/i.test(email);
  
  const isValid = 
    data.fullName.trim().length > 0 &&
    validateEmail(data.email) &&
    data.password.length >= 6 &&
    data.phone.length === 10 &&
    data.agreeToTerms;

  if (step === 'otp') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => { setStep('details'); setOtp(''); setError(null); }}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Verify Phone</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <Text style={[styles.hintText, { fontSize: 16, marginBottom: 8, color: palette.text }]}>
            Enter the 6-digit OTP sent to
          </Text>
          <Text style={[styles.hintText, { fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 24 }]}>
            +91 {data.phone}
          </Text>

          {!!mockOtpHint && (
            <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ color: '#856404', fontSize: 14 }}>
                Test Mode OTP: <Text style={{ fontWeight: '700' }}>{mockOtpHint}</Text>
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, { fontSize: 24, textAlign: 'center', letterSpacing: 8 }]}
              placeholder="000000"
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={palette.muted}
            />
          </View>

          <Pressable onPress={handleSendOtp} disabled={otpSending}>
            <Text style={[styles.termsLink, { textAlign: 'center', marginTop: 8 }]}>
              {otpSending ? 'Sending...' : 'Resend OTP'}
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.submitButton, (otp.length !== 6 || loading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={otp.length !== 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Verify & Register</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Basic Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Name */}
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={data.fullName}
            onChangeText={(text) => setData({ ...data, fullName: text })}
            placeholderTextColor={palette.muted}
          />
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={data.email}
            onChangeText={(text) => setData({ ...data, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={palette.muted}
          />
          {data.email.length > 0 && !validateEmail(data.email) && (
            <Text style={styles.errorText}>Only Gmail addresses are allowed</Text>
          )}
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Create password"
              value={data.password}
              onChangeText={(text) => setData({ ...data, password: text })}
              secureTextEntry={!showPassword}
              placeholderTextColor={palette.muted}
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={22} 
                color={palette.muted} 
              />
            </Pressable>
          </View>
          <Text style={styles.hintText}>Your password must be within 8-20 characters</Text>
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <View style={styles.phoneContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.codeText}>+91</Text>
              <Ionicons name="chevron-down" size={16} color={palette.text} />
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Enter mobile number"
              value={data.phone}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, '').slice(0, 10);
                setData({ ...data, phone: cleaned });
              }}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor={palette.muted}
            />
          </View>
          <Text style={styles.hintText}>Phone number is required for account recovery</Text>
        </View>

        {/* Terms Checkbox */}
        <Pressable 
          style={styles.termsRow}
          onPress={() => setData({ ...data, agreeToTerms: !data.agreeToTerms })}
        >
          <View style={[styles.checkbox, data.agreeToTerms && styles.checkboxChecked]}>
            {data.agreeToTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.termsText}>
            By registering, I agree to the{' '}
            <Text style={styles.termsLink}>T&C</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy policy</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable
          style={[styles.submitButton, (!isValid || otpSending) && styles.submitButtonDisabled]}
          onPress={handleSendOtp}
          disabled={!isValid || otpSending}
        >
          {otpSending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Send OTP</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
    },
    inputGroup: {
      marginBottom: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
      backgroundColor: palette.cardBg,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      backgroundColor: palette.cardBg,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
    },
    eyeButton: {
      padding: 14,
    },
    phoneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    countryCode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: palette.cardBg,
    },
    flag: {
      fontSize: 20,
    },
    codeText: {
      fontSize: 16,
      color: palette.text,
      fontWeight: '500',
    },
    phoneInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
      backgroundColor: palette.cardBg,
    },
    hintText: {
      fontSize: 12,
      color: palette.muted,
      marginTop: 6,
    },
    errorText: {
      fontSize: 12,
      color: '#E53935',
      marginTop: 6,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 16,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: palette.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: palette.primary,
    },
    termsText: {
      flex: 1,
      fontSize: 13,
      color: palette.muted,
      lineHeight: 20,
    },
    termsLink: {
      color: palette.primary,
      fontWeight: '600',
    },
    footer: {
      padding: 24,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    submitButton: {
      backgroundColor: palette.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: palette.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    submitButtonDisabled: {
      backgroundColor: palette.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
