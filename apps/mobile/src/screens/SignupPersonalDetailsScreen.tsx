import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NUMS: Record<string, number> = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1940 + 1 }, (_, i) => String(currentYear - i));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

function calcAge(day: string, month: string, year: string): number | null {
  if (!day || !month || !year || year.length < 4) return null;
  const dob = new Date(Number(year), MONTH_NUMS[month] - 1, Number(day));
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

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
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const age = calcAge(data.dateOfBirth.day, data.dateOfBirth.month, data.dateOfBirth.year);
  const dobUnderAge = age !== null && age < 18;
  const dobComplete = data.dateOfBirth.day && data.dateOfBirth.month && data.dateOfBirth.year;

  const isValid =
    data.gender &&
    dobComplete &&
    !dobUnderAge &&
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
            {/* Day */}
            <Pressable style={[styles.dobDropdown, styles.dobDay]} onPress={() => setShowDayPicker(true)}>
              <Text style={data.dateOfBirth.day ? styles.dobDropdownText : styles.dobDropdownPlaceholder}>
                {data.dateOfBirth.day || 'DD'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={palette.muted} />
            </Pressable>
            {/* Month */}
            <Pressable style={[styles.dobDropdown, styles.dobMonth]} onPress={() => setShowMonthPicker(true)}>
              <Text style={data.dateOfBirth.month ? styles.dobDropdownText : styles.dobDropdownPlaceholder}>
                {data.dateOfBirth.month || 'MMM'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={palette.muted} />
            </Pressable>
            {/* Year */}
            <Pressable style={[styles.dobDropdown, styles.dobYear]} onPress={() => setShowYearPicker(true)}>
              <Text style={data.dateOfBirth.year ? styles.dobDropdownText : styles.dobDropdownPlaceholder}>
                {data.dateOfBirth.year || 'YYYY'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={palette.muted} />
            </Pressable>
          </View>
          {dobUnderAge && (
            <Text style={styles.dobError}>⚠ You must be at least 18 years old to register.</Text>
          )}
          {dobComplete && !dobUnderAge && age !== null && (
            <Text style={styles.dobAge}>Age: {age} years</Text>
          )}
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

      {/* Day Picker Modal */}
      <Modal visible={showDayPicker} transparent animationType="slide" onRequestClose={() => setShowDayPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowDayPicker(false)} />
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Day</Text>
            <Pressable onPress={() => setShowDayPicker(false)}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator>
            {DAYS.map((day) => (
              <Pressable
                key={day}
                style={[styles.pickerItem, data.dateOfBirth.day === day && styles.pickerItemActive]}
                onPress={() => { setData({ ...data, dateOfBirth: { ...data.dateOfBirth, day } }); setShowDayPicker(false); }}
              >
                <Text style={[styles.pickerItemText, data.dateOfBirth.day === day && styles.pickerItemTextActive]}>{day}</Text>
                {data.dateOfBirth.day === day && <Ionicons name="checkmark" size={20} color="#E53935" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} transparent animationType="slide" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowMonthPicker(false)} />
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Month</Text>
            <Pressable onPress={() => setShowMonthPicker(false)}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator>
            {MONTHS.map((month) => (
              <Pressable
                key={month}
                style={[styles.pickerItem, data.dateOfBirth.month === month && styles.pickerItemActive]}
                onPress={() => { setData({ ...data, dateOfBirth: { ...data.dateOfBirth, month } }); setShowMonthPicker(false); }}
              >
                <Text style={[styles.pickerItemText, data.dateOfBirth.month === month && styles.pickerItemTextActive]}>{month}</Text>
                {data.dateOfBirth.month === month && <Ionicons name="checkmark" size={20} color="#E53935" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} transparent animationType="slide" onRequestClose={() => setShowYearPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowYearPicker(false)} />
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Year</Text>
            <Pressable onPress={() => setShowYearPicker(false)}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator>
            {YEARS.map((year) => (
              <Pressable
                key={year}
                style={[styles.pickerItem, data.dateOfBirth.year === year && styles.pickerItemActive]}
                onPress={() => { setData({ ...data, dateOfBirth: { ...data.dateOfBirth, year } }); setShowYearPicker(false); }}
              >
                <Text style={[styles.pickerItemText, data.dateOfBirth.year === year && styles.pickerItemTextActive]}>{year}</Text>
                {data.dateOfBirth.year === year && <Ionicons name="checkmark" size={20} color="#E53935" />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

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
      flexDirection: 'row' as const,
      gap: 10,
      alignItems: 'center' as const,
    },
    dobDropdown: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      paddingVertical: 13,
      paddingHorizontal: 12,
      backgroundColor: palette.cardBg,
    },
    dobDay: { width: 68 },
    dobMonth: { flex: 1 },
    dobYear: { width: 90 },
    dobDropdownText: {
      fontSize: 15,
      color: palette.text,
      fontWeight: '500' as const,
    },
    dobDropdownPlaceholder: {
      fontSize: 15,
      color: palette.muted,
    },
    dobError: {
      marginTop: 8,
      fontSize: 13,
      color: '#E53935',
      fontWeight: '600' as const,
    },
    dobAge: {
      marginTop: 6,
      fontSize: 13,
      color: '#10b981',
      fontWeight: '600' as const,
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
      flex: 1,
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
