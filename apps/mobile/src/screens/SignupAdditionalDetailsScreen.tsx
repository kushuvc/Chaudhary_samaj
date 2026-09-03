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
import { FAMILY_STATUSES, FAMILY_TYPES, FAMILY_WEALTH, OCCUPATIONS } from '../constants/signupOptions';

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
  onBack: () => void;
  onSubmit: (data: AdditionalDetailsData) => void;
}

const MIN_BIO = 50;

const SIBLING_OPTIONS = ['None', '1', '2', '3', '4', '5 or more'].map((item) => ({ id: item, label: item }));

export function SignupAdditionalDetailsScreen({ onBack, onSubmit }: SignupAdditionalDetailsScreenProps) {
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
      eyebrow="Additional details"
      title="Family and your story"
      subtitle="The last step before we create your account."
      footer={
        <PrimaryButton
          label="Continue"
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
        <SectionHeading title="Family status" />
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
        <SectionHeading title="Family type" />
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
        <SectionHeading title="Family wealth" />
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

      <SectionHeading title="Parents" caption="Optional." />

      <Field label="Father's name">
        <Input value={fatherName} onChangeText={setFatherName} placeholder="Full name" autoCapitalize="words" />
      </Field>

      <Field label="Father's occupation">
        <Select
          value={fatherOccupation}
          placeholder="Select occupation"
          title="Father's occupation"
          options={OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setFatherOccupation}
        />
      </Field>

      <Field label="Mother's name">
        <Input value={motherName} onChangeText={setMotherName} placeholder="Full name" autoCapitalize="words" />
      </Field>

      <Field label="Mother's occupation">
        <Select
          value={motherOccupation}
          placeholder="Select occupation"
          title="Mother's occupation"
          options={OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setMotherOccupation}
        />
      </Field>

      <Field label="Number of siblings">
        <Select
          value={siblings}
          placeholder="Select"
          title="Siblings"
          options={SIBLING_OPTIONS}
          onChange={setSiblings}
          searchable={false}
        />
      </Field>

      <Field
        label="A few words about yourself"
        hint={
          bioRemaining > 0
            ? `${bioRemaining} more character${bioRemaining === 1 ? '' : 's'} needed`
            : undefined
        }
      >
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="Share your interests, what you value, and what you're looking for."
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
