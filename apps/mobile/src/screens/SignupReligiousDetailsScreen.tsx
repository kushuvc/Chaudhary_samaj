import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Checkbox,
  Chip,
  ChipGroup,
  Field,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { CASTES, DOSH_OPTIONS, RELIGIONS, SUBCASTES } from '../constants/signupOptions';
import { subjectFor, type ProfileSubject } from '../constants/profileSubject';
import { useAppLanguage } from '../context/LanguageContext';

export interface ReligiousDetailsData {
  religion: string;
  caste: string;
  subcaste: string;
  openToAnySubcaste: boolean;
  dosh: string;
}

interface SignupReligiousDetailsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onNext: (data: ReligiousDetailsData) => void;
}

export function SignupReligiousDetailsScreen({ subject: subjectProp, onBack, onNext }: SignupReligiousDetailsScreenProps) {
  const { t, language } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null, language);
  const [religion, setReligion] = useState<string | null>(null);
  const [caste, setCaste] = useState<string | null>(null);
  const [subcaste, setSubcaste] = useState<string | null>(null);
  const [openToAnySubcaste, setOpenToAnySubcaste] = useState(true);
  const [dosh, setDosh] = useState<string>('no');

  const subcasteOptions = useMemo(() => {
    const list = (caste && SUBCASTES[caste]) || ['Other'];
    return list.map((item) => ({ id: item, label: item }));
  }, [caste]);

  const canContinue = Boolean(religion && caste && subcaste);

  return (
    <StepScaffold
      onBack={onBack}
      step={2}
      totalSteps={5}
      eyebrow={t('suReligiousDetails')}
      title={t('suFaithAndCommunity')}
      subtitle={t('suSubReligious', { possessive: subject.possessive })}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (religion && caste && subcaste) {
              onNext({ religion, caste, subcaste, openToAnySubcaste, dosh });
            }
          }}
        />
      }
    >
      <Field label={t('suReligion')}>
        <Select
          value={religion}
          placeholder={t('suSelectReligion')}
          title={t('suReligion')}
          options={RELIGIONS.map((item) => ({ id: item, label: item }))}
          onChange={setReligion}
        />
      </Field>

      <Field label={t('suCaste')}>
        <Select
          value={caste}
          placeholder={t('suSelectCaste')}
          title={t('suCaste')}
          options={CASTES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setCaste(next);
            setSubcaste(null);
          }}
        />
      </Field>

      <Field label={t('suSubcaste')} hint={!caste ? t('suChooseCasteFirst') : undefined}>
        <Select
          value={subcaste}
          placeholder={t('suSelectSubcaste')}
          title={t('suSubcaste')}
          options={subcasteOptions}
          onChange={setSubcaste}
          disabled={!caste}
        />
      </Field>

      <Checkbox
        label={t('suOpenToMarryFromAnySubcaste')}
        checked={openToAnySubcaste}
        onPress={() => setOpenToAnySubcaste((prev) => !prev)}
      />

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suDoYouHaveAnyDosh')} caption={t('hintOptionalNo')} />
        <ChipGroup>
          {DOSH_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={dosh === option.id}
              onPress={() => setDosh(option.id)}
            />
          ))}
        </ChipGroup>
      </View>
    </StepScaffold>
  );
}
