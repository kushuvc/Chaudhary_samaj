import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Chip,
  ChipGroup,
  PrimaryButton,
  SectionHeading,
  SegmentedTabs,
  StepScaffold,
  TextButton,
} from '../components/ui';
import { useAppTheme } from '../context/ThemeContext';
import { CUISINES, HOBBIES, MUSIC_GENRES, SPORTS } from '../constants/signupOptions';
import { subjectFor, type ProfileSubject } from '../constants/profileSubject';

export interface InterestsData {
  hobbies: string[];
  music: string[];
  sports: string[];
  cuisine: string[];
}

interface SignupInterestsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onNext: (data: InterestsData) => void;
  onSkip: () => void;
}

type TabId = keyof InterestsData;

const TABS: { id: TabId; label: string; heading: string; caption: string; options: string[] }[] = [
  {
    id: 'hobbies',
    label: 'Hobbies',
    heading: 'Hobbies & interests',
    caption: 'Pick anything you genuinely enjoy.',
    options: HOBBIES,
  },
  {
    id: 'music',
    label: 'Music',
    heading: 'Music you listen to',
    caption: 'Choose the genres you come back to.',
    options: MUSIC_GENRES,
  },
  {
    id: 'sports',
    label: 'Sports',
    heading: 'Sports & fitness',
    caption: 'Activities, games, or ways you stay active.',
    options: SPORTS,
  },
  {
    id: 'cuisine',
    label: 'Food',
    heading: 'Favourite cuisine',
    caption: 'What you love to eat, or cook.',
    options: CUISINES,
  },
];

export function SignupInterestsScreen({ subject: subjectProp, onBack, onNext, onSkip }: SignupInterestsScreenProps) {
  const subject = subjectProp ?? subjectFor(null);
  const { palette } = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabId>('hobbies');
  const [data, setData] = useState<InterestsData>({ hobbies: [], music: [], sports: [], cuisine: [] });

  const toggle = (category: TabId, value: string) => {
    setData((prev) => {
      const current = prev[category];
      return {
        ...prev,
        [category]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  };

  const tab = TABS.find((item) => item.id === activeTab)!;
  const totalSelected = Object.values(data).reduce((sum, list) => sum + list.length, 0);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Interests"
      title={`What ${subject.verb} ${subject.pronoun} into?`}
      subtitle={`These appear on ${subject.possessive} profile and help spark conversations.`}
      footer={
        <>
          <PrimaryButton
            label={totalSelected > 0 ? `Save ${totalSelected} selected` : 'Save and continue'}
            disabled={totalSelected === 0}
            onPress={() => onNext(data)}
          />
          <TextButton label="I'll do this later" onPress={onSkip} />
        </>
      }
    >
      <SegmentedTabs
        tabs={TABS.map((item) => ({
          id: item.id,
          label: data[item.id].length > 0 ? `${item.label} (${data[item.id].length})` : item.label,
        }))}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <View style={{ gap: 14 }}>
        <SectionHeading title={tab.heading} caption={tab.caption} />
        <ChipGroup>
          {tab.options.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={data[activeTab].includes(option)}
              onPress={() => toggle(activeTab, option)}
            />
          ))}
        </ChipGroup>
      </View>

      <Text style={{ fontSize: 12.5, color: palette.muted }}>
        Selected so far — hobbies {data.hobbies.length}, music {data.music.length}, sports{' '}
        {data.sports.length}, food {data.cuisine.length}.
      </Text>
    </StepScaffold>
  );
}
