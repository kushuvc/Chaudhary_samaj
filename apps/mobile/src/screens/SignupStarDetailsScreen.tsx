import React, { useState } from 'react';
import { Field, PrimaryButton, Select, StepScaffold, TextButton } from '../components/ui';
import { NAKSHATRAS, RAASIS } from '../constants/signupOptions';

export interface StarDetailsData {
  nakshatra: string;
  raasi: string;
}

interface SignupStarDetailsScreenProps {
  onBack: () => void;
  onNext: (data: StarDetailsData) => void;
  onSkip: () => void;
}

export function SignupStarDetailsScreen({ onBack, onNext, onSkip }: SignupStarDetailsScreenProps) {
  const [nakshatra, setNakshatra] = useState<string | null>(null);
  const [raasi, setRaasi] = useState<string | null>(null);

  const canContinue = Boolean(nakshatra && raasi);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Horoscope"
      title="Add star details"
      subtitle="Optional. Helps members who match on nakshatra and raasi."
      footer={
        <>
          <PrimaryButton
            label="Save and continue"
            disabled={!canContinue}
            onPress={() => {
              if (nakshatra && raasi) {
                onNext({ nakshatra, raasi });
              }
            }}
          />
          <TextButton label="I'll do this later" onPress={onSkip} />
        </>
      }
    >
      <Field label="Star / Nakshatra">
        <Select
          value={nakshatra}
          placeholder="Select your nakshatra"
          title="Star / Nakshatra"
          options={NAKSHATRAS.map((item) => ({ id: item, label: item }))}
          onChange={setNakshatra}
        />
      </Field>

      <Field label="Raasi">
        <Select
          value={raasi}
          placeholder="Select your raasi"
          title="Raasi"
          options={RAASIS.map((item) => ({ id: item, label: item }))}
          onChange={setRaasi}
        />
      </Field>
    </StepScaffold>
  );
}
