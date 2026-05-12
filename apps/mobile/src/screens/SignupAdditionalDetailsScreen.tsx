import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface AdditionalDetailsData {
  familyStatus: 'middle_class' | 'upper_middle_class' | 'rich_affluent' | null;
  familyType: 'joint' | 'nuclear' | 'extended' | null;
  familyWealth: string;
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  motherOccupation: string;
  siblings: string;
  aboutMyself: string;
}

interface SignupAdditionalDetailsScreenProps {
  onBack: () => void;
  onSubmit: (data: AdditionalDetailsData) => void;
}

const familyTypes = [
  { id: 'joint', label: 'Joint Family' },
  { id: 'nuclear', label: 'Nuclear Family' },
  { id: 'extended', label: 'Extended Family' },
];

const familyStatuses = [
  { id: 'middle_class', label: 'Middle class' },
  { id: 'upper_middle_class', label: 'Upper middle class' },
  { id: 'rich_affluent', label: 'Rich / Affluent (Elite)' },
];

const familyWealthOptions = [
  'Below ₹10 Lakhs',
  '₹10-25 Lakhs',
  '₹25-50 Lakhs',
  '₹50 Lakhs - 1 Crore',
  '₹1-5 Crores',
  '₹5-10 Crores',
  '₹10-25 Crores',
  '₹25-50 Crores',
  'Above ₹50 Crores',
  'Prefer not to say',
];

export function SignupAdditionalDetailsScreen({ onBack, onSubmit }: SignupAdditionalDetailsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<AdditionalDetailsData>({
    familyStatus: null,
    familyType: null,
    familyWealth: '',
    fatherName: '',
    motherName: '',
    fatherOccupation: '',
    motherOccupation: '',
    siblings: '',
    aboutMyself: '',
  });
  const [showWealthPicker, setShowWealthPicker] = useState(false);

  const isValid = data.familyStatus;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Additional Details (5/5)</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Family Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Family status</Text>
          <View style={styles.statusRow}>
            {familyStatuses.map((status) => {
              const isSelected = data.familyStatus === status.id;
              return (
                <Pressable
                  key={status.id}
                  style={[styles.statusButton, isSelected && styles.statusButtonActive]}
                  onPress={() => setData({ ...data, familyStatus: status.id as any })}
                >
                  <Text style={[styles.statusText, isSelected && styles.statusTextActive]}>
                    {status.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Family Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Family type</Text>
          <View style={styles.statusRow}>
            {familyTypes.map((type) => {
              const isSelected = data.familyType === type.id;
              return (
                <Pressable
                  key={type.id}
                  style={[styles.statusButton, isSelected && styles.statusButtonActive]}
                  onPress={() => setData({ ...data, familyType: type.id as any })}
                >
                  <Text style={[styles.statusText, isSelected && styles.statusTextActive]}>
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Family Wealth */}
        <View style={styles.section}>
          <Text style={styles.label}>Family wealth / Net worth</Text>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowWealthPicker(!showWealthPicker)}
          >
            <Text style={data.familyWealth ? styles.selectorText : styles.selectorPlaceholder}>
              {data.familyWealth || 'Select family wealth / net worth'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showWealthPicker && (
            <View style={styles.dropdown}>
              {familyWealthOptions.map((wealth) => (
                <Pressable
                  key={wealth}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setData({ ...data, familyWealth: wealth });
                    setShowWealthPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownText, data.familyWealth === wealth && styles.dropdownTextActive]}>
                    {wealth}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Father Details */}
        <View style={styles.section}>
          <Text style={styles.label}>Father's details</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Father's name"
            placeholderTextColor="#9E9E9E"
            value={data.fatherName}
            onChangeText={(text) => setData({ ...data, fatherName: text })}
          />
          <TextInput
            style={[styles.textInput, { marginTop: 10 }]}
            placeholder="Father's occupation (e.g. Farmer, Business)"
            placeholderTextColor="#9E9E9E"
            value={data.fatherOccupation}
            onChangeText={(text) => setData({ ...data, fatherOccupation: text })}
          />
        </View>

        {/* Mother Details */}
        <View style={styles.section}>
          <Text style={styles.label}>Mother's details</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Mother's name"
            placeholderTextColor="#9E9E9E"
            value={data.motherName}
            onChangeText={(text) => setData({ ...data, motherName: text })}
          />
          <TextInput
            style={[styles.textInput, { marginTop: 10 }]}
            placeholder="Mother's occupation (e.g. Homemaker, Teacher)"
            placeholderTextColor="#9E9E9E"
            value={data.motherOccupation}
            onChangeText={(text) => setData({ ...data, motherOccupation: text })}
          />
        </View>

        {/* Siblings */}
        <View style={styles.section}>
          <Text style={styles.label}>Siblings <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 1 Brother, 2 Sisters"
            placeholderTextColor="#9E9E9E"
            value={data.siblings}
            onChangeText={(text) => setData({ ...data, siblings: text })}
          />
        </View>

        {/* About Myself */}
        <View style={styles.section}>
          <Text style={styles.label}>A few words about myself <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput
            style={styles.bioInput}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholder="Write about yourself, your education, profession, hobbies, and what you're looking for..."
            value={data.aboutMyself}
            onChangeText={(text) => setData({ ...data, aboutMyself: text })}
            maxLength={500}
          />
          <Text style={styles.charCount}>{data.aboutMyself.length}/500 characters</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={() => isValid && onSubmit(data)}
          disabled={!isValid}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </Pressable>
        
        <View style={styles.helpRow}>
          <Text style={styles.helpText}>Need help? Call</Text>
          <Pressable>
            <Text style={styles.helpPhone}>📞 8144-77-88-66</Text>
          </Pressable>
        </View>
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
    progressContainer: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: palette.bg,
    },
    progressBar: {
      height: 4,
      backgroundColor: palette.border,
      borderRadius: 2,
    },
    progressFill: {
      height: 4,
      backgroundColor: '#E53935',
      borderRadius: 2,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 12,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statusButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E53935',
      backgroundColor: '#FFFFFF',
    },
    statusButtonActive: {
      backgroundColor: '#FFEBEE',
      borderColor: '#E53935',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#E53935',
    },
    statusTextActive: {
      color: '#E53935',
      fontWeight: '600',
    },
    selector: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: palette.cardBg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectorText: {
      fontSize: 16,
      color: palette.text,
    },
    selectorPlaceholder: {
      fontSize: 16,
      color: palette.muted,
    },
    dropdown: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      backgroundColor: palette.cardBg,
      maxHeight: 250,
    },
    dropdownItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    dropdownText: {
      fontSize: 14,
      color: palette.text,
    },
    dropdownTextActive: {
      color: '#E53935',
      fontWeight: '600',
    },
    bioInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      padding: 16,
      fontSize: 14,
      color: palette.text,
      backgroundColor: palette.cardBg,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      color: palette.muted,
      marginTop: 8,
    },
    errorText: {
      fontSize: 12,
      color: '#E53935',
      marginTop: 4,
    },
    footer: {
      padding: 24,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    submitButton: {
      backgroundColor: '#E53935',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    submitButtonDisabled: {
      backgroundColor: '#E0E0E0',
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    helpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    helpText: {
      fontSize: 13,
      color: palette.muted,
    },
    helpPhone: {
      fontSize: 13,
      color: '#E53935',
      fontWeight: '600',
    },
    textInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
      backgroundColor: palette.cardBg,
    },
    optional: {
      fontSize: 14,
      color: palette.muted,
      fontWeight: '400',
    },
  });
}
