import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Chip,
  ChipGroup,
  Field,
  Input,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { useAppTheme } from '../context/ThemeContext';
import { FAMILY_STATUSES, FAMILY_TYPES, FAMILY_WEALTH, MOTHER_OCCUPATIONS, OCCUPATIONS } from '../constants/signupOptions';
import { subjectFor, type ProfileSubject } from '../constants/profileSubject';
import { useAppLanguage } from '../context/LanguageContext';

export interface AdditionalDetailsData {
  familyStatus: string;
  familyType: string;
  familyWealth: string;
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  motherOccupation: string;
  siblings: string;
  bio: string;
}

interface SignupAdditionalDetailsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onSubmit: (data: AdditionalDetailsData) => void;
}

const MIN_BIO = 50;

const SIBLING_OPTIONS = ['None', '1', '2', '3', '4', '5 or more'].map((item) => ({ id: item, label: item }));

export function SignupAdditionalDetailsScreen({ subject: subjectProp, onBack, onSubmit }: SignupAdditionalDetailsScreenProps) {
  const { t, language } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null, language);
  const { palette } = useAppTheme();
  const [familyStatus, setFamilyStatus] = useState<string | null>(null);
  const [familyType, setFamilyType] = useState<string | null>(null);
  const [familyWealth, setFamilyWealth] = useState<string | null>(null);
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState<string | null>(null);
  const [motherOccupation, setMotherOccupation] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<string | null>(null);
  const [bio, setBio] = useState('');

  const bioRemaining = Math.max(0, MIN_BIO - bio.trim().length);
  const canContinue = Boolean(familyStatus) && bio.trim().length >= MIN_BIO;

  return (
    <StepScaffold
      onBack={onBack}
      step={5}
      totalSteps={5}
      eyebrow={t('suAdditionalDetails')}
      title={t('suTitleFamily', { possessive: subject.possessive })}
      subtitle={t('suTheLastStepBeforeWeCreate')}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (familyStatus) {
              onSubmit({
                familyStatus,
                familyType: familyType || '',
                familyWealth: familyWealth || '',
                fatherName,
                motherName,
                fatherOccupation: fatherOccupation || '',
                motherOccupation: motherOccupation || '',
                siblings: siblings || '',
                bio: bio.trim(),
              });
            }
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suFamilyStatus')} />
        <ChipGroup>
          {FAMILY_STATUSES.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={familyStatus === option.id}
              onPress={() => setFamilyStatus(option.id)}
            />
          ))}
        </ChipGroup>
      </View>

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suFamilyType')} />
        <ChipGroup>
          {FAMILY_TYPES.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={familyType === option.id}
              onPress={() => setFamilyType(option.id)}
            />
          ))}
        </ChipGroup>
      </View>

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suFamilyWealth')} />
        <ChipGroup>
          {FAMILY_WEALTH.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={familyWealth === option.id}
              onPress={() => setFamilyWealth(option.id)}
            />
          ))}
        </ChipGroup>
      </View>

      <SectionHeading title={t('suParents')} caption={t('hintOptional')} />

      <Field label={t('suFatherSName')}>
        <Input value={fatherName} onChangeText={setFatherName} placeholder={t('suFullName')} autoCapitalize="words" />
      </Field>

      <Field label={t('suFatherSOccupation')}>
        <Select
          value={fatherOccupation}
          placeholder={t('suSelectOccupation')}
          title={t('suFatherSOccupation')}
          options={OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setFatherOccupation}
        />
      </Field>

      <Field label={t('suMotherSName')}>
        <Input value={motherName} onChangeText={setMotherName} placeholder={t('suFullName')} autoCapitalize="words" />
      </Field>

      <Field label={t('suMotherSOccupation')}>
        <Select
          value={motherOccupation}
          placeholder={t('suSelectOccupation')}
          title={t('suMotherSOccupation')}
          options={MOTHER_OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setMotherOccupation}
        />
      </Field>

      <Field label={t('suNumberOfSiblings')}>
        <Select
          value={siblings}
          placeholder={t('suSelect')}
          title={t('suSiblings')}
          options={SIBLING_OPTIONS}
          onChange={setSiblings}
          searchable={false}
        />
      </Field>

      <Field
        label={t('suAFewWordsAboutYourself')}
        hint={
          bioRemaining > 0
            ? `${bioRemaining} more character${bioRemaining === 1 ? '' : 's'} needed`
            : undefined
        }
      >
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder={t('suShareYourInterestsWhatYouValue')}
          multiline
          maxLength={1000}
          autoCapitalize="sentences"
        />
        <Text style={{ fontSize: 12, color: palette.muted, textAlign: 'right' }}>
          {bio.trim().length}/{MIN_BIO} minimum
        </Text>
      </Field>
    </StepScaffold>
  );
}
