import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export type ProfileType = 'myself' | 'son' | 'daughter' | 'brother' | 'sister' | 'friend' | 'relative';

interface SignupProfileTypeScreenProps {
  onBack: () => void;
  onNext: (type: ProfileType) => void;
}

const profileTypes: { id: ProfileType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'myself', label: 'Myself', icon: 'person' },
  { id: 'son', label: 'Son', icon: 'man' },
  { id: 'daughter', label: 'Daughter', icon: 'woman' },
  { id: 'brother', label: 'Brother', icon: 'people' },
  { id: 'sister', label: 'Sister', icon: 'people' },
  { id: 'friend', label: 'Friend', icon: 'happy' },
  { id: 'relative', label: 'Relative', icon: 'people-circle' },
];

export function SignupProfileTypeScreen({ onBack, onNext }: SignupProfileTypeScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Profile</Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="heart" size={40} color="#E53935" />
          </View>
        </View>

        <Text style={styles.welcomeText}>Welcome to Chaudhary Samaj!</Text>
        <Text style={styles.questionText}>I am creating this profile for</Text>

        {/* Profile Type Grid */}
        <View style={styles.grid}>
          {profileTypes.map((type) => {
            const isSelected = selectedType === type.id;
            return (
              <Pressable
                key={type.id}
                style={[
                  styles.typeButton,
                  isSelected && styles.typeButtonSelected,
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={isSelected ? '#FFFFFF' : '#E53935'}
                />
                <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                  {type.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, !selectedType && styles.nextButtonDisabled]}
          onPress={() => selectedType && onNext(selectedType)}
          disabled={!selectedType}
        >
          <Text style={styles.nextButtonText}>Start Registration</Text>
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
    logoContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FFEBEE',
      justifyContent: 'center',
      alignItems: 'center',
    },
    welcomeText: {
      fontSize: 20,
      fontWeight: '600',
      color: palette.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    questionText: {
      fontSize: 16,
      color: palette.text,
      textAlign: 'center',
      marginBottom: 32,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    typeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E53935',
      backgroundColor: '#FFFFFF',
    },
    typeButtonSelected: {
      backgroundColor: '#E53935',
      borderColor: '#E53935',
    },
    typeLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: '#E53935',
    },
    typeLabelSelected: {
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
