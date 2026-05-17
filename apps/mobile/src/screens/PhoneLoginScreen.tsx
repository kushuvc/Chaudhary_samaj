import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';

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
  const [mockOtp, setMockOtp] = useState(''); // For testing without Firebase

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setLoading(true);
      const response = await api.requestPhoneOtp(phone);
      
      // For testing: show the mock OTP
      if (response.mockOtp) {
        setMockOtp(response.mockOtp);
        Alert.alert('Test Mode', `OTP for testing: ${response.mockOtp}`);
      }
      
      setStep('otp');
    } catch (err) {
      Alert.alert('Error', 'Failed to send OTP: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await api.verifyPhoneOtp(phone, otp);
      
      if (response.token && response.userId) {
        onLoginSuccess(response.token, response.userId);
      } else {
        Alert.alert('Error', 'Invalid OTP');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to verify OTP: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Phone Login</Text>
        
        {step === 'phone' ? (
          <>
            <Text style={styles.subtitle}>Enter your mobile number to receive OTP</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor={palette.muted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
              />
            </View>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : 'Send OTP'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Enter OTP sent to +91 {phone}</Text>
            
            {mockOtp && (
              <View style={styles.mockOtpBox}>
                <Text style={styles.mockOtpLabel}>Test OTP:</Text>
                <Text style={styles.mockOtpValue}>{mockOtp}</Text>
              </View>
            )}
            
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={palette.muted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              editable={!loading}
            />

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.resendButton}
              onPress={() => setStep('phone')}
              disabled={loading}
            >
              <Text style={styles.resendText}>Change Number</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>← Back to Login Options</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: palette.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: palette.muted,
      textAlign: 'center',
      marginBottom: 32,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      backgroundColor: palette.cardBg,
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    countryCode: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginRight: 8,
      paddingRight: 8,
      borderRightWidth: 1,
      borderRightColor: palette.border,
    },
    input: {
      flex: 1,
      height: 56,
      fontSize: 16,
      color: palette.text,
    },
    otpInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      backgroundColor: palette.cardBg,
      height: 56,
      fontSize: 20,
      textAlign: 'center',
      letterSpacing: 8,
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    mockOtpBox: {
      backgroundColor: '#FFF3E0',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      alignItems: 'center',
    },
    mockOtpLabel: {
      fontSize: 12,
      color: '#E65100',
      marginBottom: 4,
    },
    mockOtpValue: {
      fontSize: 24,
      fontWeight: '700',
      color: '#E65100',
      letterSpacing: 4,
    },
    button: {
      backgroundColor: palette.primary,
      borderRadius: 12,
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    resendButton: {
      alignItems: 'center',
      padding: 8,
    },
    resendText: {
      color: palette.primary,
      fontSize: 14,
    },
    backButton: {
      marginTop: 32,
      alignItems: 'center',
    },
    backText: {
      color: palette.muted,
      fontSize: 14,
    },
  });
}
