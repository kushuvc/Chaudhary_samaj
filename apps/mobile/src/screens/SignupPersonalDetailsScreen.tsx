import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface PersonalDetailsData {
  gender: 'male' | 'female' | null;
  dateOfBirth: {
    day: string;
    month: string;
    year: string;
  };
  height: string;
  physicalStatus: 'normal' | 'physically_challenged' | null;
  maritalStatus: 'never_married' | 'widower' | 'awaiting_divorce' | 'divorced' | null;
}

interface SignupPersonalDetailsScreenProps {
  onBack: () => void;
  onNext: (data: PersonalDetailsData) => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const heights = [
  '4 ft 0 in (122 cm)',
  '4 ft 1 in (124 cm)',
  '4 ft 2 in (127 cm)',
  '4 ft 3 in (130 cm)',
  '4 ft 4 in (132 cm)',
  '4 ft 5 in (135 cm)',
  '4 ft 6 in (137 cm)',
  '4 ft 7 in (140 cm)',
  '4 ft 8 in (142 cm)',
  '4 ft 9 in (145 cm)',
  '4 ft 10 in (147 cm)',
  '4 ft 11 in (150 cm)',
  '5 ft 0 in (152 cm)',
  '5 ft 1 in (155 cm)',
  '5 ft 2 in (157 cm)',
  '5 ft 3 in (160 cm)',
  '5 ft 4 in (163 cm)',
  '5 ft 5 in (165 cm)',
  '5 ft 6 in (168 cm)',
  '5 ft 7 in (170 cm)',
  '5 ft 8 in (173 cm)',
  '5 ft 9 in (175 cm)',
  '5 ft 10 in (178 cm)',
  '5 ft 11 in (180 cm)',
  '6 ft 0 in (183 cm)',
  '6 ft 1 in (185 cm)',
  '6 ft 2 in (188 cm)',
  '6 ft 3 in (191 cm)',
  '6 ft 4 in (193 cm)',
  '6 ft 5 in (196 cm)',
  '6 ft 6 in (198 cm)',
  '6 ft 7 in (201 cm)',
  '6 ft 8 in (203 cm)',
  '6 ft 9 in (206 cm)',
  '6 ft 10 in (208 cm)',
  '6 ft 11 in (211 cm)',
  '7 ft 0 in (213 cm)',
];

export function SignupPersonalDetailsScreen({ onBack, onNext }: SignupPersonalDetailsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<PersonalDetailsData>({
    gender: null,
    dateOfBirth: { day: '', month: 'Jan', year: '' },
    height: '',
    physicalStatus: null,
    maritalStatus: null,
  });
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const isValid = 
    data.gender &&
    data.dateOfBirth.day &&
    data.dateOfBirth.year &&
    data.height &&
    data.physicalStatus &&
    data.maritalStatus;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Personal Details (1/5)</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '20%' }]} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Gender */}
        <View style={styles.section}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.choiceButton, data.gender === 'male' && styles.choiceButtonActive]}
              onPress={() => setData({ ...data, gender: 'male' })}
            >
              <Text style={[styles.choiceText, data.gender === 'male' && styles.choiceTextActive]}>
                Male
              </Text>
            </Pressable>
            <Pressable
              style={[styles.choiceButton, data.gender === 'female' && styles.choiceButtonActive]}
              onPress={() => setData({ ...data, gender: 'female' })}
            >
              <Text style={[styles.choiceText, data.gender === 'female' && styles.choiceTextActive]}>
                Female
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Date of Birth */}
        <View style={styles.section}>
          <Text style={styles.label}>Date of birth</Text>
          <View style={styles.dobRow}>
            <TextInput
              style={[styles.dobInput, styles.dayInput]}
              placeholder="DD"
              value={data.dateOfBirth.day}
              onChangeText={(text) => setData({ ...data, dateOfBirth: { ...data.dateOfBirth, day: text } })}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Pressable style={styles.monthPicker} onPress={() => setShowMonthPicker(true)}>
              <Text style={styles.monthText}>{data.dateOfBirth.month}</Text>
              <Ionicons name="chevron-down" size={16} color={palette.text} />
            </Pressable>
            <TextInput
              style={[styles.dobInput, styles.yearInput]}
              placeholder="YYYY"
              value={data.dateOfBirth.year}
              onChangeText={(text) => setData({ ...data, dateOfBirth: { ...data.dateOfBirth, year: text } })}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>

        {/* Height */}
        <View style={styles.section}>
          <Text style={styles.label}>Height</Text>
          <Pressable 
            style={styles.heightSelector}
            onPress={() => setShowHeightPicker(true)}
          >
            <Text style={data.height ? styles.heightText : styles.heightPlaceholder}>
              {data.height || 'Your height'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
        </View>

        {/* Physical Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Your physical status</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.choiceButton, data.physicalStatus === 'normal' && styles.choiceButtonActive]}
              onPress={() => setData({ ...data, physicalStatus: 'normal' })}
            >
              <Text style={[styles.choiceText, data.physicalStatus === 'normal' && styles.choiceTextActive]}>
                Normal
              </Text>
            </Pressable>
            <Pressable
              style={[styles.choiceButton, data.physicalStatus === 'physically_challenged' && styles.choiceButtonActive]}
              onPress={() => setData({ ...data, physicalStatus: 'physically_challenged' })}
            >
              <Text style={[styles.choiceText, data.physicalStatus === 'physically_challenged' && styles.choiceTextActive]}>
                Physically challenged
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Marital Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Your marital status</Text>
          <View style={styles.maritalRow}>
            {(['never_married', 'widower', 'awaiting_divorce', 'divorced'] as const).map((status) => {
              const labels: Record<string, string> = {
                never_married: 'Never married',
                widower: 'Widower',
                awaiting_divorce: 'Awaiting divorce',
                divorced: 'Divorced',
              };
              return (
                <Pressable
                  key={status}
                  style={[styles.choiceButton, data.maritalStatus === status && styles.choiceButtonActive]}
                  onPress={() => setData({ ...data, maritalStatus: status })}
                >
                  <Text style={[styles.choiceText, data.maritalStatus === status && styles.choiceTextActive]}>
                    {labels[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Height Picker Modal */}
      {showHeightPicker && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowHeightPicker(false)} />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Height</Text>
              <Pressable onPress={() => setShowHeightPicker(false)}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={true}>
              {heights.map((height) => (
                <Pressable
                  key={height}
                  style={[styles.pickerItem, data.height === height && styles.pickerItemActive]}
                  onPress={() => {
                    setData({ ...data, height });
                    setShowHeightPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, data.height === height && styles.pickerItemTextActive]}>
                    {height}
                  </Text>
                  {data.height === height && <Ionicons name="checkmark" size={20} color="#E53935" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Month Picker Modal */}
      {showMonthPicker && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowMonthPicker(false)} />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Month</Text>
              <Pressable onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={true}>
              {months.map((month) => (
                <Pressable
                  key={month}
                  style={[styles.pickerItem, data.dateOfBirth.month === month && styles.pickerItemActive]}
                  onPress={() => {
                    setData({ ...data, dateOfBirth: { ...data.dateOfBirth, month } });
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, data.dateOfBirth.month === month && styles.pickerItemTextActive]}>
                    {month}
                  </Text>
                  {data.dateOfBirth.month === month && <Ionicons name="checkmark" size={20} color="#E53935" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
          onPress={() => isValid && onNext(data)}
          disabled={!isValid}
        >
          <Text style={styles.nextButtonText}>Next</Text>
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
      marginBottom: 28,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    maritalRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    choiceButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E53935',
      backgroundColor: '#FFFFFF',
    },
    choiceButtonActive: {
      backgroundColor: '#E53935',
      borderColor: '#E53935',
    },
    choiceText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#E53935',
    },
    choiceTextActive: {
      color: '#FFFFFF',
    },
    dobRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    dobInput: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: palette.text,
      backgroundColor: palette.cardBg,
      textAlign: 'center',
    },
    dayInput: {
      width: 60,
    },
    yearInput: {
      width: 80,
    },
    monthPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: palette.cardBg,
      minWidth: 80,
    },
    monthText: {
      fontSize: 16,
      color: palette.text,
    },
    heightSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: palette.cardBg,
    },
    heightText: {
      fontSize: 16,
      color: palette.text,
    },
    heightPlaceholder: {
      fontSize: 16,
      color: palette.muted,
    },
    heightList: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      backgroundColor: palette.cardBg,
      maxHeight: 200,
    },
    heightOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    heightOptionText: {
      fontSize: 14,
      color: palette.text,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    pickerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: palette.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    pickerList: {
      maxHeight: 400,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    pickerItemActive: {
      backgroundColor: '#FFEBEE',
    },
    pickerItemText: {
      fontSize: 16,
      color: palette.text,
    },
    pickerItemTextActive: {
      color: '#E53935',
      fontWeight: '600',
    },
    footer: {
      padding: 24,
      paddingBottom: 40,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    nextButton: {
      backgroundColor: '#E53935',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
    },
    nextButtonDisabled: {
      backgroundColor: '#F5F5F5',
    },
    nextButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
