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
import { useAppLanguage } from '../context/LanguageContext';

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

const TABS: { id: TabId; labelKey: string; headingKey: string; captionKey: string; options: string[] }[] = [
  {
    id: 'hobbies',
    labelKey: 'fldHobbies',
    headingKey: 'suHobbiesTitle',
    captionKey: 'suHobbiesSub',
    options: HOBBIES,
  },
  {
    id: 'music',
    labelKey: 'fldMusic',
    headingKey: 'suMusicTitle',
    captionKey: 'suMusicSub',
    options: MUSIC_GENRES,
  },
  {
    id: 'sports',
    labelKey: 'fldSports',
    headingKey: 'suSportsTitle',
    captionKey: 'suSportsSub',
    options: SPORTS,
  },
  {
    id: 'cuisine',
    labelKey: 'subFoodTab',
    headingKey: 'suCuisineTitle',
    captionKey: 'suCuisineSub',
    options: CUISINES,
  },
];

export function SignupInterestsScreen({ subject: subjectProp, onBack, onNext, onSkip }: SignupInterestsScreenProps) {
  const { t, language } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null, language);
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
      eyebrow={t('suInterests')}
      title={t('suTitleInterests', { verb: subject.verb, pronoun: subject.pronoun, possessive: subject.possessive })}
      subtitle={t('suSubInterests', { possessive: subject.possessive })}
      footer={
        <>
          <PrimaryButton
            label={totalSelected > 0 ? `Save ${totalSelected} selected` : t('actSaveContinue')}
            disabled={totalSelected === 0}
            onPress={() => onNext(data)}
          />
          <TextButton label={t('suILlDoThisLater')} onPress={onSkip} />
        </>
      }
    >
      <SegmentedTabs
        tabs={TABS.map((item) => ({
          id: item.id,
          label:
            data[item.id].length > 0 ? `${t(item.labelKey)} (${data[item.id].length})` : t(item.labelKey),
        }))}
        active={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      <View style={{ gap: 14 }}>
        <SectionHeading title={t(tab.headingKey)} caption={t(tab.captionKey)} />
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
        {t('suSelectedSoFar', {
          hobbies: data.hobbies.length,
          music: data.music.length,
          sports: data.sports.length,
          food: data.cuisine.length,
        })}
      </Text>
    </StepScaffold>
  );
}
