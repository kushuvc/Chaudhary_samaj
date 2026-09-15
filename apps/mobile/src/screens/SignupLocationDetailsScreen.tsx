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
      eyebrow="Location details"
      title={`Where ${subject.verb} ${subject.pronoun} based?`}
      subtitle={`Matches nearby show up first, and ${subject.possessive} native place helps families connect.`}
      footer={
        <PrimaryButton
          label="Continue"
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
      <Field label="Country you live in">
        <Select
          value={country}
          placeholder="Select country"
          title="Country"
          options={COUNTRIES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setCountry(next);
            setState(null);
            setCity(null);
          }}
        />
      </Field>

      <Field label="State" hint={!country ? 'Choose a country first' : undefined}>
        <Select
          value={state}
          placeholder="Select state"
          title="State"
          options={stateOptions}
          onChange={(next) => {
            setState(next);
            setCity(null);
          }}
          disabled={!country}
        />
      </Field>

      <Field label="City" hint={!state ? 'Choose a state first' : undefined}>
        <Select
          value={city}
          placeholder="Select city"
          title="City"
          options={cityOptions}
          onChange={setCity}
          disabled={!state}
        />
      </Field>

      <SectionHeading title="Native place" caption="Optional, but useful for family introductions." />

      <Field label="Area or village">
        <Input value={village} onChangeText={setVillage} placeholder="e.g. Vastrapur" autoCapitalize="words" />
      </Field>

      <Field label="Native city">
        <Input value={nativeCity} onChangeText={setNativeCity} placeholder="e.g. Mehsana" autoCapitalize="words" />
      </Field>

      <Field label="Native village">
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
