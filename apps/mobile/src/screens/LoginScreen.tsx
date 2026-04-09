import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { OtpPurpose } from '../types';
import { BrandArtwork } from '../components/BrandArtwork';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const MARITAL_STATUS_OPTIONS = ['Never Married', 'Divorced', 'Widowed'];
const COMMUNITY_OPTIONS = ['Chaudhary', 'Jat', 'Gurjar', 'Rajput', 'Other'];
const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Punjabi', 'Haryanvi', 'Other'];
const EDUCATION_OPTIONS = ['High School', 'Diploma', 'Bachelor', 'Master', 'Doctorate', 'Other'];
const OCCUPATION_OPTIONS = ['Business', 'Private Job', 'Government Job', 'Self Employed', 'Student', 'Other'];

function SelectField({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (next: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.selectTrigger} onPress={() => setExpanded((prev) => !prev)}>
        <Text style={[styles.selectTriggerText, !value && styles.placeholderText]}>{value || `Select ${label}`}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.optionsBox}>
          {options.map((option) => (
            <Pressable
              key={`${label}-${option}`}
              style={[styles.optionItem, value === option && styles.optionItemActive]}
              onPress={() => {
                onSelect(option);
                setExpanded(false);
              }}
            >
              <Text style={[styles.optionText, value === option && styles.optionTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LoginScreen() {
  const { requestOtp, login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [subCommunity, setSubCommunity] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('Never Married');
  const [community, setCommunity] = useState('Chaudhary');
  const [language, setLanguage] = useState('Hindi');
  const [education, setEducation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const purpose: OtpPurpose = useMemo(() => (mode === 'login' ? 'login' : 'signup'), [mode]);

  const validateEmail = (value: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim());

  const handleSendOtp = async () => {
    try {
      if (!validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid Gmail address.');
        return;
      }
      setSubmitting(true);
      await requestOtp(email.trim(), purpose);
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your inbox for verification code.');
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
        if (!name.trim()) {
          Alert.alert('Missing Name', 'Name is required for signup.');
          return;
        }
        if (!gender) {
          Alert.alert('Missing Gender', 'Please select gender.');
          return;
        }
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          otpCode: otpCode.trim(),
          phone: phone.trim() || undefined,
          age: age.trim() ? Number(age.trim()) : undefined,
          location: location.trim() || undefined,
          community: community || undefined,
          subCommunity: subCommunity.trim() || undefined,
          education: education || undefined,
          occupation: occupation || undefined,
          maritalStatus: maritalStatus || undefined,
          language: language || undefined,
          gender: gender || undefined,
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

      <View style={styles.switchRow}>
        <Pressable style={[styles.switchButton, mode === 'login' && styles.switchButtonActive]} onPress={() => setMode('login')}>
          <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>Login</Text>
        </Pressable>
        <Pressable style={[styles.switchButton, mode === 'signup' && styles.switchButtonActive]} onPress={() => setMode('signup')}>
          <Text style={[styles.switchText, mode === 'signup' && styles.switchTextActive]}>Signup</Text>
        </Pressable>
      </View>

      {mode === 'signup' ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput placeholder="Enter your full name" value={name} onChangeText={setName} style={styles.input} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              placeholder="Enter phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                placeholder="Age"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Location</Text>
              <TextInput placeholder="City" value={location} onChangeText={setLocation} style={styles.input} />
            </View>
          </View>

          <SelectField label="Gender" value={gender} options={GENDER_OPTIONS} onSelect={setGender} />
          <SelectField
            label="Marital Status"
            value={maritalStatus}
            options={MARITAL_STATUS_OPTIONS}
            onSelect={setMaritalStatus}
          />
          <SelectField label="Community" value={community} options={COMMUNITY_OPTIONS} onSelect={setCommunity} />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sub Community</Text>
            <TextInput
              placeholder="Enter sub community"
              value={subCommunity}
              onChangeText={setSubCommunity}
              style={styles.input}
            />
          </View>

          <SelectField label="Education" value={education} options={EDUCATION_OPTIONS} onSelect={setEducation} />
          <SelectField label="Occupation" value={occupation} options={OCCUPATION_OPTIONS} onSelect={setOccupation} />
          <SelectField label="Language" value={language} options={LANGUAGE_OPTIONS} onSelect={setLanguage} />
        </>
      ) : null}

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
        <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Login' : 'Create Account'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
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
    color: '#cffafe',
    fontWeight: '700',
    letterSpacing: 0.2,
    fontSize: 12,
  },
  heroTitle: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '800',
  },
  heroSub: {
    marginTop: 5,
    color: '#dbeafe',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280,
  },
  switchRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4
  },
  switchButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  switchButtonActive: {
    backgroundColor: '#ffffff'
  },
  switchText: {
    color: '#334155',
    fontWeight: '600'
  },
  switchTextActive: {
    color: '#0f766e'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 2
  },
  fieldGroup: {
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  label: {
    color: '#334155',
    fontWeight: '600',
    marginBottom: 6,
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerText: {
    color: '#0f172a',
  },
  placeholderText: {
    color: '#94a3b8',
  },
  chevron: {
    color: '#64748b',
    fontSize: 12,
  },
  optionsBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginTop: 6,
    overflow: 'hidden',
  },
  optionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  optionItemActive: {
    backgroundColor: '#ecfeff',
  },
  optionText: {
    color: '#0f172a',
  },
  optionTextActive: {
    color: '#0f766e',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryButton: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f766e',
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '700'
  }
});
