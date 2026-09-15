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
  const subject = subjectProp ?? subjectFor(null);
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
      eyebrow="Religious details"
      title="Faith and community"
      subtitle={`Used to find matches who share ${subject.possessive} background.`}
      footer={
        <PrimaryButton
          label="Continue"
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
      <Field label="Religion">
        <Select
          value={religion}
          placeholder="Select religion"
          title="Religion"
          options={RELIGIONS.map((item) => ({ id: item, label: item }))}
          onChange={setReligion}
        />
      </Field>

      <Field label="Caste">
        <Select
          value={caste}
          placeholder="Select caste"
          title="Caste"
          options={CASTES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setCaste(next);
            setSubcaste(null);
          }}
        />
      </Field>

      <Field label="Subcaste" hint={!caste ? 'Choose a caste first' : undefined}>
        <Select
          value={subcaste}
          placeholder="Select subcaste"
          title="Subcaste"
          options={subcasteOptions}
          onChange={setSubcaste}
          disabled={!caste}
        />
      </Field>

      <Checkbox
        label="Open to marry from any subcaste"
        checked={openToAnySubcaste}
        onPress={() => setOpenToAnySubcaste((prev) => !prev)}
      />

      <View style={{ gap: 14 }}>
        <SectionHeading title="Do you have any dosh?" caption="Optional — leave as No if unsure." />
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
