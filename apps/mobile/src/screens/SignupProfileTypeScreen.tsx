import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Chip,
  ChipGroup,
  Field,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { MOTHER_TONGUES, PROFILE_TYPES } from '../constants/signupOptions';

export type ProfileType = 'myself' | 'son' | 'daughter' | 'brother' | 'sister' | 'friend' | 'relative';

export interface ProfileTypeData {
  profileType: ProfileType;
  motherTongue: string;
}

interface SignupProfileTypeScreenProps {
  onBack: () => void;
  onNext: (data: ProfileTypeData) => void;
}

export function SignupProfileTypeScreen({ onBack, onNext }: SignupProfileTypeScreenProps) {
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [motherTongue, setMotherTongue] = useState<string | null>(null);

  const canContinue = Boolean(selectedType && motherTongue);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Get started"
      title="Who is this profile for?"
      subtitle="This helps us set the right tone and show relevant matches."
      footer={
        <PrimaryButton
          label="Start registration"
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (selectedType && motherTongue) {
              onNext({ profileType: selectedType, motherTongue });
            }
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <SectionHeading title="Creating this profile for" />
        <ChipGroup>
          {PROFILE_TYPES.map((type) => (
            <Chip
              key={type.id}
              label={type.label}
              icon={type.icon}
              selected={selectedType === type.id}
              onPress={() => setSelectedType(type.id as ProfileType)}
            />
          ))}
        </ChipGroup>
      </View>

      <Field label="Mother tongue">
        <Select
          value={motherTongue}
          placeholder="Select mother tongue"
          title="Mother tongue"
          options={MOTHER_TONGUES.map((item) => ({ id: item, label: item }))}
          onChange={setMotherTongue}
        />
      </Field>
    </StepScaffold>
  );
}
