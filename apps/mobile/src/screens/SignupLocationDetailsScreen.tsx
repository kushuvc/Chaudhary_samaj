import React, { useMemo, useState } from 'react';
import {
  Field,
  Input,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { CITIES, COUNTRIES, STATES } from '../constants/signupOptions';
import { subjectFor, type ProfileSubject } from '../constants/profileSubject';
import { useAppLanguage } from '../context/LanguageContext';

export interface LocationDetailsData {
  country: string;
  state: string;
  city: string;
  village: string;
  nativeCity: string;
  nativeVillage: string;
}

interface SignupLocationDetailsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onNext: (data: LocationDetailsData) => void;
}

export function SignupLocationDetailsScreen({ subject: subjectProp, onBack, onNext }: SignupLocationDetailsScreenProps) {
  const { t } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null);
  const [country, setCountry] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [village, setVillage] = useState('');
  const [nativeCity, setNativeCity] = useState('');
  const [nativeVillage, setNativeVillage] = useState('');

  const stateOptions = useMemo(
    () => ((country && STATES[country]) || ['Other']).map((item) => ({ id: item, label: item })),
    [country]
  );

  const cityOptions = useMemo(
    () => ((state && CITIES[state]) || ['Other']).map((item) => ({ id: item, label: item })),
    [state]
  );

  const canContinue = Boolean(country && state && city);

  return (
    <StepScaffold
      onBack={onBack}
      step={3}
      totalSteps={5}
      eyebrow={t('suLocationDetails')}
      title={`Where ${subject.verb} ${subject.pronoun} based?`}
      subtitle={`Matches nearby show up first, and ${subject.possessive} native place helps families connect.`}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (country && state && city) {
              onNext({ country, state, city, village, nativeCity, nativeVillage });
            }
          }}
        />
      }
    >
      <Field label={t('suCountryYouLiveIn')}>
        <Select
          value={country}
          placeholder={t('suSelectCountry')}
          title={t('suCountry')}
          options={COUNTRIES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setCountry(next);
            setState(null);
            setCity(null);
          }}
        />
      </Field>

      <Field label={t('suState')} hint={!country ? 'Choose a country first' : undefined}>
        <Select
          value={state}
          placeholder={t('suSelectState')}
          title={t('suState')}
          options={stateOptions}
          onChange={(next) => {
            setState(next);
            setCity(null);
          }}
          disabled={!country}
        />
      </Field>

      <Field label={t('suCity')} hint={!state ? 'Choose a state first' : undefined}>
        <Select
          value={city}
          placeholder={t('suSelectCity')}
          title={t('suCity')}
          options={cityOptions}
          onChange={setCity}
          disabled={!state}
        />
      </Field>

      <SectionHeading title={t('suNativePlace')} caption="Optional, but useful for family introductions." />

      <Field label={t('suAreaOrVillage')}>
        <Input value={village} onChangeText={setVillage} placeholder="e.g. Vastrapur" autoCapitalize="words" />
      </Field>

      <Field label={t('suNativeCity')}>
        <Input value={nativeCity} onChangeText={setNativeCity} placeholder="e.g. Mehsana" autoCapitalize="words" />
      </Field>

      <Field label={t('suNativeVillage')}>
        <Input
          value={nativeVillage}
          onChangeText={setNativeVillage}
          placeholder="e.g. Kadi"
          autoCapitalize="words"
        />
      </Field>
    </StepScaffold>
  );
}
