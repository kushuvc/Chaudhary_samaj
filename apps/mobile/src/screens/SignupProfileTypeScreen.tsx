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
import { useAppLanguage } from '../context/LanguageContext';

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
  const { t } = useAppLanguage();
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [motherTongue, setMotherTongue] = useState<string | null>(null);

  const canContinue = Boolean(selectedType && motherTongue);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow={t('suGetStarted')}
      title={t('suWhoIsThisProfileFor')}
      subtitle={t('suThisHelpsUsSetTheRight')}
      footer={
        <PrimaryButton
          label={t('suStartRegistration')}
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
        <SectionHeading title={t('suCreatingThisProfileFor')} />
        <ChipGroup>
          {PROFILE_TYPES.map((type) => (
            <Chip
              key={type.id}
              label={t(type.label)}
              icon={type.icon}
              selected={selectedType === type.id}
              onPress={() => setSelectedType(type.id as ProfileType)}
            />
          ))}
        </ChipGroup>
      </View>

      <Field label={t('suMotherTongue')}>
        <Select
          value={motherTongue}
          placeholder={t('suSelectMotherTongue')}
          title={t('suMotherTongue')}
          options={MOTHER_TONGUES.map((item) => ({ id: item, label: item }))}
          onChange={setMotherTongue}
        />
      </Field>
    </StepScaffold>
  );
}
