import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export function ProfileSetupScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const { completeProfileSetup } = useAuth();
  const [loading, setLoading] = useState(false);

  // Personal Info
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [occupation, setOccupation] = useState('');
  const [designation, setDesignation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [nativeLocation, setNativeLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [bio, setBio] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [gol, setGol] = useState('');

  // Family Info
  const [fatherName, setFatherName] = useState('');
  const [fatherLocation, setFatherLocation] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherLocation, setMotherLocation] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // TODO: Save profile data to backend
      await completeProfileSetup();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    content: {
      flexGrow: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      paddingBottom: 8,
    },
    formGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.surface,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    button: {
      backgroundColor: palette.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 32,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionTitle, { borderBottomWidth: 0, marginBottom: 24 }]}>
            {t('profileCompletion')}
          </Text>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('basicInformation')}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fullNameLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('fullNamePlaceholder')}
                placeholderTextColor={palette.muted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={[styles.row, styles.formGroup]}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('ageLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldAge')}
                  placeholderTextColor={palette.muted}
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('genderLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldGender')}
                  placeholderTextColor={palette.muted}
                  value={gender}
                  onChangeText={setGender}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldDob')}</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={palette.muted}
                value={dob}
                onChangeText={setDob}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('occupationLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('occupationLabel')}
                placeholderTextColor={palette.muted}
                value={occupation}
                onChangeText={setOccupation}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldDesignationCompany')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('fldDesignation')}
                placeholderTextColor={palette.muted}
                value={designation}
                onChangeText={setDesignation}
              />
            </View>

            <View style={[styles.row, styles.formGroup]}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('locationLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldCurrentLocation')}
                  placeholderTextColor={palette.muted}
                  value={currentLocation}
                  onChangeText={setCurrentLocation}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('fldNativeLocation')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldNativeLocation')}
                  placeholderTextColor={palette.muted}
                  value={nativeLocation}
                  onChangeText={setNativeLocation}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldSalaryOptional')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('fldAnnualSalary')}
                placeholderTextColor={palette.muted}
                keyboardType="number-pad"
                value={salary}
                onChangeText={setSalary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldBio')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('hintTellAbout')}
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={4}
                value={bio}
                onChangeText={setBio}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldHobbies')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('hintYourHobbies')}
                placeholderTextColor={palette.muted}
                value={hobbies}
                onChangeText={setHobbies}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldGoal')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('hintYourGoal')}
                placeholderTextColor={palette.muted}
                value={gol}
                onChangeText={setGol}
              />
            </View>
          </View>

          {/* Family Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('secFamilyInfo')}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldFatherName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('fldFatherName')}
                placeholderTextColor={palette.muted}
                value={fatherName}
                onChangeText={setFatherName}
              />
            </View>

            <View style={[styles.row, styles.formGroup]}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('fldFatherLocation')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldLocation')}
                  placeholderTextColor={palette.muted}
                  value={fatherLocation}
                  onChangeText={setFatherLocation}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('fldFatherOccupation')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldOccupation')}
                  placeholderTextColor={palette.muted}
                  value={fatherOccupation}
                  onChangeText={setFatherOccupation}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('fldMotherName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('fldMotherName')}
                placeholderTextColor={palette.muted}
                value={motherName}
                onChangeText={setMotherName}
              />
            </View>

            <View style={[styles.row, styles.formGroup]}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('fldMotherLocation')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldLocation')}
                  placeholderTextColor={palette.muted}
                  value={motherLocation}
                  onChangeText={setMotherLocation}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>{t('fldMotherOccupation')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('fldOccupation')}
                  placeholderTextColor={palette.muted}
                  value={motherOccupation}
                  onChangeText={setMotherOccupation}
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('saveChanges')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
