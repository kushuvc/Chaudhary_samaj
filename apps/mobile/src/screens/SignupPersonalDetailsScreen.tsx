import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Callout,
  Chip,
  ChipGroup,
  Field,
  OptionCard,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { HEIGHTS, MARITAL_STATUSES, PHYSICAL_STATUSES } from '../constants/signupOptions';
import { subjectFor, type ProfileSubject } from '../constants/profileSubject';
import { useAppLanguage } from '../context/LanguageContext';

export interface PersonalDetailsData {
  gender: string;
  dateOfBirth: { day: string; month: string; year: string };
  height: string;
  physicalStatus: string;
  maritalStatus: string;
}

interface SignupPersonalDetailsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onNext: (data: PersonalDetailsData) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  id: String(i + 1).padStart(2, '0'),
  label: String(i + 1).padStart(2, '0'),
}));

const MONTH_OPTIONS = MONTHS.map((label, index) => ({
  id: String(index + 1).padStart(2, '0'),
  label,
}));

const YEAR_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const year = currentYear - 18 - i;
  return { id: String(year), label: String(year) };
});

/** Whole years elapsed, or null until a full date is chosen. */
function calculateAge(day: string | null, month: string | null, year: string | null): number | null {
  if (!day || !month || !year) {
    return null;
  }
  const birth = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function SignupPersonalDetailsScreen({ subject: subjectProp, onBack, onNext }: SignupPersonalDetailsScreenProps) {
  const { t } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null);
  const [gender, setGender] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [height, setHeight] = useState<string | null>(null);
  const [physicalStatus, setPhysicalStatus] = useState<string>('normal');
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);

  const age = useMemo(() => calculateAge(day, month, year), [day, month, year]);
  const canContinue = Boolean(gender && day && month && year && height && maritalStatus && age !== null && age >= 18);

  return (
    <StepScaffold
      onBack={onBack}
      step={1}
      totalSteps={5}
      eyebrow={t('suPersonalDetails')}
      title={`Tell us about ${subject.full}`}
      subtitle={`These basics power the matches ${subject.isSelf ? "you'll" : `${subject.pronoun}'ll`} see.`}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (gender && day && month && year && height && maritalStatus) {
              onNext({
                gender,
                dateOfBirth: { day, month, year },
                height,
                physicalStatus,
                maritalStatus,
              });
            }
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suGender')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <OptionCard
            label={t('suMale')}
            icon="male-outline"
            selected={gender === 'male'}
            onPress={() => setGender('male')}
          />
          <OptionCard
            label={t('suFemale')}
            icon="female-outline"
            selected={gender === 'female'}
            onPress={() => setGender('female')}
          />
        </View>
      </View>

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suDateOfBirth')} caption="You must be at least 18." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Select value={day} placeholder={t('suDay')} title={t('suDay')} options={DAY_OPTIONS} onChange={setDay} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Select value={month} placeholder={t('suMonth')} title={t('suMonth')} options={MONTH_OPTIONS} onChange={setMonth} />
          </View>
          <View style={{ flex: 1 }}>
            <Select value={year} placeholder={t('suYear')} title={t('suYear')} options={YEAR_OPTIONS} onChange={setYear} />
          </View>
        </View>
        {age !== null ? <Callout icon="calendar-outline" text={`You are ${age} years old`} /> : null}
      </View>

      <Field label={t('suHeight')}>
        <Select
          value={height}
          placeholder={t('suSelectYourHeight')}
          title={t('suHeight')}
          options={HEIGHTS}
          onChange={setHeight}
        />
      </Field>

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suPhysicalStatus')} />
        <ChipGroup>
          {PHYSICAL_STATUSES.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={physicalStatus === option.id}
              onPress={() => setPhysicalStatus(option.id)}
            />
          ))}
        </ChipGroup>
      </View>

      <View style={{ gap: 14 }}>
        <SectionHeading title={t('suMaritalStatus')} />
        <ChipGroup>
          {MARITAL_STATUSES.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={maritalStatus === option.id}
              onPress={() => setMaritalStatus(option.id)}
            />
          ))}
        </ChipGroup>
      </View>
    </StepScaffold>
  );
}
