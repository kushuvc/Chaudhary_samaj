import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export type EatingHabit = 'vegetarian' | 'non_vegetarian' | 'eggetarian';

interface SignupEatingHabitsScreenProps {
  onBack: () => void;
  onNext: (habit: EatingHabit) => void;
  onSkip: () => void;
}

const eatingOptions: { id: EatingHabit; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'non_vegetarian', label: 'Non-Vegetarian' },
  { id: 'eggetarian', label: 'Eggetarian' },
];

export function SignupEatingHabitsScreen({ onBack, onNext, onSkip }: SignupEatingHabitsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [selectedHabit, setSelectedHabit] = useState<EatingHabit | null>(null);

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
            <Ionicons name="restaurant" size={40} color="#E53935" />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Select eating habit</Text>

        <View style={styles.optionsContainer}>
          {eatingOptions.map((option) => {
            const isSelected = selectedHabit === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                onPress={() => setSelectedHabit(option.id)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, !selectedHabit && styles.submitButtonDisabled]}
          onPress={() => selectedHabit && onNext(selectedHabit)}
          disabled={!selectedHabit}
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
      padding: 24,
      paddingTop: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 32,
    },
    optionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    optionButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E0E0E0',
      backgroundColor: '#FFFFFF',
    },
    optionButtonActive: {
      borderColor: '#E53935',
      backgroundColor: '#FFEBEE',
    },
    optionText: {
      fontSize: 14,
      fontWeight: '500',
      color: palette.text,
    },
    optionTextActive: {
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
