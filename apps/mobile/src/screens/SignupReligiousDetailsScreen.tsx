import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface ReligiousDetailsData {
  religion: string;
  caste: string;
  subcaste: string;
  openToAnySubcaste: boolean;
  dosh: 'no' | 'yes' | 'dont_know' | null;
}

interface SignupReligiousDetailsScreenProps {
  onBack: () => void;
  onNext: (data: ReligiousDetailsData) => void;
}

const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Jewish', 'Other'];
const castes = ['Chaudhary', 'Patel', 'Brahmin', 'Kshatriya', 'Vaishya', 'Shudra', 'Scheduled Caste', 'Scheduled Tribe', 'Other'];

export function SignupReligiousDetailsScreen({ onBack, onNext }: SignupReligiousDetailsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [data, setData] = useState<ReligiousDetailsData>({
    religion: 'Hindu',
    caste: 'Chaudhary',
    subcaste: '',
    openToAnySubcaste: false,
    dosh: null,
  });
  const [showReligionPicker, setShowReligionPicker] = useState(false);
  const [showCastePicker, setShowCastePicker] = useState(false);

  const isValid = data.religion && data.caste && data.dosh;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Religious Details (2/5)</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '40%' }]} />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Religion */}
        <View style={styles.section}>
          <Text style={styles.label}>Religion</Text>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowReligionPicker(!showReligionPicker)}
          >
            <Text style={styles.selectorText}>{data.religion}</Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showReligionPicker && (
            <View style={styles.dropdown}>
              {religions.map((religion) => (
                <Pressable
                  key={religion}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setData({ ...data, religion });
                    setShowReligionPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownText, data.religion === religion && styles.dropdownTextActive]}>
                    {religion}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Caste */}
        <View style={styles.section}>
          <Pressable 
            style={styles.selector}
            onPress={() => setShowCastePicker(!showCastePicker)}
          >
            <Text style={styles.floatingLabel}>Caste</Text>
            <Text style={styles.selectorText}>{data.caste}</Text>
            <Ionicons name="chevron-down" size={20} color={palette.muted} />
          </Pressable>
          {showCastePicker && (
            <View style={styles.dropdown}>
              {castes.map((caste) => (
                <Pressable
                  key={caste}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setData({ ...data, caste });
                    setShowCastePicker(false);
                  }}
                >
                  <Text style={[styles.dropdownText, data.caste === caste && styles.dropdownTextActive]}>
                    {caste}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Gol (Subcaste as text input) */}
        <View style={styles.section}>
          <Text style={styles.label}>Gol</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your Gol (subcaste)"
            placeholderTextColor={palette.muted}
            value={data.subcaste}
            onChangeText={(text) => setData({ ...data, subcaste: text })}
          />
        </View>

        {/* Open to any subcaste checkbox */}
        <Pressable 
          style={styles.checkboxRow}
          onPress={() => setData({ ...data, openToAnySubcaste: !data.openToAnySubcaste })}
        >
          <View style={[styles.checkbox, data.openToAnySubcaste && styles.checkboxChecked]}>
            {data.openToAnySubcaste && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxText}>Open to marry from any subcaste</Text>
        </Pressable>

        {/* Dosh */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Do you have any dosh? <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <View style={styles.row}>
            {(['no', 'yes', 'dont_know'] as const).map((dosh) => {
              const labels: Record<string, string> = {
                no: 'No',
                yes: 'Yes',
                dont_know: "Don't know",
              };
              const isSelected = data.dosh === dosh;
              return (
                <Pressable
                  key={dosh}
                  style={[styles.choiceButton, isSelected && styles.choiceButtonActive]}
                  onPress={() => setData({ ...data, dosh })}
                >
                  <Text style={[styles.choiceText, isSelected && styles.choiceTextActive]}>
                    {labels[dosh]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
          onPress={() => isValid && onNext(data)}
          disabled={!isValid}
        >
          <Text style={styles.nextButtonText}>Next</Text>
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
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 8,
    },
    optional: {
      fontSize: 14,
      color: palette.muted,
      fontWeight: '400',
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
    dropdown: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 8,
      backgroundColor: palette.cardBg,
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: '#E53935',
      borderColor: '#E53935',
    },
    checkboxText: {
      fontSize: 14,
      color: palette.text,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    choiceButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E53935',
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
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
      marginBottom: 16,
    },
    nextButtonDisabled: {
      backgroundColor: '#F5F5F5',
    },
    nextButtonText: {
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
  });
}
