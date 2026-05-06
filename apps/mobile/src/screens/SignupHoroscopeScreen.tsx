import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface HoroscopeData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
}

interface SignupHoroscopeScreenProps {
  onBack: () => void;
  onNext: (data: HoroscopeData) => void;
  onSkip: () => void;
}

const timeSlots = [
  '12:00 AM - 1:00 AM',
  '1:00 AM - 2:00 AM',
  '2:00 AM - 3:00 AM',
  '3:00 AM - 4:00 AM',
  '4:00 AM - 5:00 AM',
  '5:00 AM - 6:00 AM',
  '6:00 AM - 7:00 AM',
  '7:00 AM - 8:00 AM',
  '8:00 AM - 9:00 AM',
  '9:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 1:00 PM',
  '1:00 PM - 2:00 PM',
  '2:00 PM - 3:00 PM',
  '3:00 PM - 4:00 PM',
  '4:00 PM - 5:00 PM',
  '5:00 PM - 6:00 PM',
  '6:00 PM - 7:00 PM',
  '7:00 PM - 8:00 PM',
  '8:00 PM - 9:00 PM',
  '9:00 PM - 10:00 PM',
  '10:00 PM - 11:00 PM',
  '11:00 PM - 12:00 AM',
];

const countries = ['India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Other'];

export function SignupHoroscopeScreen({ onBack, onNext, onSkip }: SignupHoroscopeScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<HoroscopeData>({
    dateOfBirth: '',
    timeOfBirth: '',
    placeOfBirth: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Sample dates for picker
  const sampleDates = [
    '01-Jan-1990', '15-Jan-1990', '01-Feb-1990', '15-Feb-1990',
    '01-Mar-1990', '15-Mar-1990', '01-Apr-1990', '15-Apr-1990',
    '01-May-1990', '15-May-1990', '01-Jun-1990', '15-Jun-1990',
    '01-Jul-1990', '15-Jul-1990', '01-Aug-1990', '15-Aug-1990',
    '01-Sep-1990', '15-Sep-1990', '01-Oct-1990', '15-Oct-1990',
    '01-Nov-1990', '15-Nov-1990', '01-Dec-1990', '15-Dec-1990',
    '05-Apr-1998', '10-Apr-1998', '15-Apr-1998', '20-Apr-1998',
    '01-Jan-1995', '15-Jan-1995', '01-Feb-1995', '15-Feb-1995',
    '01-Mar-1995', '15-Mar-1995', '01-Apr-1995', '15-Apr-1995',
    '01-May-1995', '15-May-1995', '01-Jun-1995', '15-Jun-1995',
    '01-Jul-1995', '15-Jul-1995', '01-Aug-1995', '15-Aug-1995',
    '01-Sep-1995', '15-Sep-1995', '01-Oct-1995', '15-Oct-1995',
    '01-Nov-1995', '15-Nov-1995', '01-Dec-1995', '15-Dec-1995',
  ];

  const isValid = data.dateOfBirth && data.timeOfBirth && data.placeOfBirth;

  return (
    <View style={styles.container}>
      {/* Header with curved background */}
      <View style={styles.headerBg}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="planet" size={40} color="#E53935" />
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.title}>Add horoscope details</Text>

        {/* Date of Birth */}
        <View style={styles.field}>
          <Text style={styles.label}>Date of birth</Text>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text style={styles.floatingLabel}>Your date of birth</Text>
            <Text style={data.dateOfBirth ? styles.selectorText : styles.selectorPlaceholder}>
              {data.dateOfBirth || 'Select your date of birth'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showDatePicker && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dateList} showsVerticalScrollIndicator={true}>
                {sampleDates.map((date) => (
                  <Pressable
                    key={date}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setData({ ...data, dateOfBirth: date });
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownText, data.dateOfBirth === date && styles.dropdownTextActive]}>
                      {date}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Time of Birth */}
        <View style={styles.field}>
          <Text style={styles.label}>Time of birth</Text>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowTimePicker(!showTimePicker)}
          >
            <Text style={data.timeOfBirth ? styles.selectorText : styles.selectorPlaceholder}>
              {data.timeOfBirth || 'Select your time of birth'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showTimePicker && (
            <View style={styles.dropdown}>
              {timeSlots.map((time) => (
                <Pressable
                  key={time}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setData({ ...data, timeOfBirth: time });
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[styles.dropdownText, data.timeOfBirth === time && styles.dropdownTextActive]}>
                    {time}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Place of Birth */}
        <View style={styles.field}>
          <Text style={styles.label}>Place of birth</Text>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowCountryPicker(!showCountryPicker)}
          >
            <Text style={data.placeOfBirth ? styles.selectorText : styles.selectorPlaceholder}>
              {data.placeOfBirth || 'Select your country of birth'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showCountryPicker && (
            <View style={styles.dropdown}>
              {countries.map((country) => (
                <Pressable
                  key={country}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setData({ ...data, placeOfBirth: country });
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownText, data.placeOfBirth === country && styles.dropdownTextActive]}>
                    {country}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={() => isValid && onNext(data)}
          disabled={!isValid}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>I will do this later</Text>
          <Ionicons name="chevron-forward" size={16} color="#E53935" />
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
    headerBg: {
      backgroundColor: '#E53935',
      borderBottomLeftRadius: 40,
      borderBottomRightRadius: 40,
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginTop: 20,
    },
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
      paddingTop: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 32,
    },
    field: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 8,
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
    floatingLabel: {
      position: 'absolute',
      left: 12,
      top: -10,
      backgroundColor: palette.bg,
      paddingHorizontal: 4,
      fontSize: 12,
      color: palette.muted,
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
    dateList: {
      maxHeight: 200,
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
    footer: {
      padding: 24,
      paddingBottom: 40,
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
    skipButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    skipText: {
      fontSize: 14,
      color: '#E53935',
      fontWeight: '600',
    },
  });
}
