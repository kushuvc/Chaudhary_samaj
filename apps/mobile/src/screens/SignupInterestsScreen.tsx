import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface InterestsData {
  hobbies: string[];
  music: string[];
  sports: string[];
}

interface SignupInterestsScreenProps {
  onBack: () => void;
  onNext: (data: InterestsData) => void;
  onSkip: () => void;
}

type TabType = 'hobbies' | 'music' | 'sports';

const hobbiesList = [
  'Art / Handicraft',
  'Cooking',
  'Dancing',
  'Gardening / Landscaping',
  'Nature',
  'Painting',
  'Pets',
  'Photography',
  'Playing Musical Instruments',
  'Puzzles',
  'Reading',
  'Traveling',
  'Writing',
  'Yoga / Meditation',
  'Movies',
  'Theatre',
];

const musicList = [
  'Film Songs',
  'Indian/Classical Music',
  'Western Music',
  'Pop Music',
  'Rock Music',
  'Jazz',
  'Blues',
  'Ghazals',
  'Qawwali',
  'Devotional',
  'Folk Music',
];

const sportsList = [
  'Cricket',
  'Football',
  'Badminton',
  'Tennis',
  'Swimming',
  'Running/Jogging',
  'Gym/Fitness',
  'Yoga',
  'Cycling',
  'Hiking/Trekking',
  'Table Tennis',
  'Basketball',
  'Volleyball',
  'Chess',
  'Carrom',
];

export function SignupInterestsScreen({ onBack, onNext, onSkip }: SignupInterestsScreenProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [activeTab, setActiveTab] = useState<TabType>('hobbies');
  const [data, setData] = useState<InterestsData>({
    hobbies: [],
    music: [],
    sports: [],
  });
  const [showMoreHobbies, setShowMoreHobbies] = useState(false);

  const toggleItem = (category: keyof InterestsData, item: string) => {
    const current = data[category];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setData({ ...data, [category]: updated });
  };

  const displayedHobbies = showMoreHobbies ? hobbiesList : hobbiesList.slice(0, 10);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'hobbies', label: 'Hobbies & Interests' },
    { id: 'music', label: 'Music' },
    { id: 'sports', label: 'Sports And Fitness' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hobbies':
        return (
          <>
            <Text style={styles.sectionTitle}>Choose your Hobbies & Interests</Text>
            <View style={styles.chipGrid}>
              {displayedHobbies.map((hobby) => {
                const isSelected = data.hobbies.includes(hobby);
                return (
                  <Pressable
                    key={hobby}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleItem('hobbies', hobby)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {hobby}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!showMoreHobbies && hobbiesList.length > 10 && (
              <Pressable 
                style={styles.showMoreButton}
                onPress={() => setShowMoreHobbies(true)}
              >
                <Text style={styles.showMoreText}>Show more</Text>
                <Ionicons name="chevron-down" size={16} color="#E53935" />
              </Pressable>
            )}
          </>
        );
      case 'music':
        return (
          <>
            <Text style={styles.sectionTitle}>Choose the music genres you listen to</Text>
            <View style={styles.chipGrid}>
              {musicList.map((music) => {
                const isSelected = data.music.includes(music);
                return (
                  <Pressable
                    key={music}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleItem('music', music)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {music}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        );
      case 'sports':
        return (
          <>
            <Text style={styles.sectionTitle}>Select Sports/ Fitness Activities/ Games</Text>
            <View style={styles.chipGrid}>
              {sportsList.map((sport) => {
                const isSelected = data.sports.includes(sport);
                return (
                  <Pressable
                    key={sport}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleItem('sports', sport)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {sport}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        );
    }
  };

  const hasSelections = data.hobbies.length > 0 || data.music.length > 0 || data.sports.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Select your interests</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '80%' }]} />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {renderTabContent()}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, !hasSelections && styles.submitButtonDisabled]}
          onPress={() => onNext(data)}
          disabled={!hasSelections}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
    },
    progressContainer: {
      paddingHorizontal: 24,
      paddingVertical: 8,
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
    tabContainer: {
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    tabScroll: {
      paddingHorizontal: 16,
      gap: 24,
    },
    tab: {
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: '#E53935',
    },
    tabText: {
      fontSize: 14,
      color: palette.muted,
      fontWeight: '500',
    },
    tabTextActive: {
      color: '#E53935',
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
      marginBottom: 16,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: '#E53935',
      backgroundColor: '#FFFFFF',
    },
    chipSelected: {
      backgroundColor: '#E53935',
      borderColor: '#E53935',
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#E53935',
    },
    chipTextSelected: {
      color: '#FFFFFF',
    },
    showMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 16,
      paddingVertical: 8,
    },
    showMoreText: {
      fontSize: 14,
      color: '#E53935',
      fontWeight: '600',
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
