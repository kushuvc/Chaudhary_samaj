import React, { useState } from 'react';
import { Field, PrimaryButton, Select, StepScaffold, TextButton } from '../components/ui';
import { BIRTH_TIME_SLOTS, CITIES, COUNTRIES, STATES } from '../constants/signupOptions';

export interface HoroscopeData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
}

interface SignupHoroscopeScreenProps {
  onBack: () => void;
  onNext: (data: HoroscopeData) => void;
  onSkip: () => void;
  /** ISO date already captured in step 1, shown read-only. */
  dateOfBirth?: string;
}

/** Flattens the known city lists so birth place can be picked in one step. */
const PLACE_OPTIONS = (() => {
  const places = new Set<string>();
  Object.values(CITIES).forEach((list) => list.forEach((city) => city !== 'Other' && places.add(city)));
  Object.values(STATES).forEach((list) => list.forEach((state) => state !== 'Other' && places.add(state)));
  COUNTRIES.forEach((country) => country !== 'Other' && places.add(country));
  return Array.from(places)
    .sort((a, b) => a.localeCompare(b))
    .map((place) => ({ id: place, label: place }));
})();

export function SignupHoroscopeScreen({ onBack, onNext, onSkip, dateOfBirth }: SignupHoroscopeScreenProps) {
  const [timeOfBirth, setTimeOfBirth] = useState<string | null>(null);
  const [placeOfBirth, setPlaceOfBirth] = useState<string | null>(null);

  const canContinue = Boolean(timeOfBirth && placeOfBirth);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Horoscope"
      title="Add horoscope details"
      subtitle="Optional. Families who match kundli will look for this."
      footer={
        <>
          <PrimaryButton
            label="Save and continue"
            disabled={!canContinue}
            onPress={() => {
              if (timeOfBirth && placeOfBirth) {
                onNext({ dateOfBirth: dateOfBirth || '', timeOfBirth, placeOfBirth });
              }
            }}
          />
          <TextButton label="I'll do this later" onPress={onSkip} />
        </>
      }
    >
      {dateOfBirth ? (
        <Field label="Date of birth" hint="Taken from your personal details.">
          <Select value={dateOfBirth} placeholder={dateOfBirth} options={[]} onChange={() => {}} disabled />
        </Field>
      ) : null}

      <Field label="Time of birth">
        <Select
          value={timeOfBirth}
          placeholder="Select your time of birth"
          title="Time of birth"
          options={BIRTH_TIME_SLOTS.map((slot) => ({ id: slot, label: slot }))}
          onChange={setTimeOfBirth}
        />
      </Field>

      <Field label="Place of birth">
        <Select
          value={placeOfBirth}
          placeholder="Select your place of birth"
          title="Place of birth"
          options={PLACE_OPTIONS}
          onChange={setPlaceOfBirth}
        />
      </Field>
    </StepScaffold>
  );
}
