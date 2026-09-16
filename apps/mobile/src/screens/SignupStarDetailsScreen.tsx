import React, { useState } from 'react';
import { Field, PrimaryButton, Select, StepScaffold, TextButton } from '../components/ui';
import { NAKSHATRAS, RAASIS } from '../constants/signupOptions';
import { useAppLanguage } from '../context/LanguageContext';

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
  const { t } = useAppLanguage();
  const [nakshatra, setNakshatra] = useState<string | null>(null);
  const [raasi, setRaasi] = useState<string | null>(null);

  const canContinue = Boolean(nakshatra && raasi);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow={t('suHoroscope')}
      title={t('suAddStarDetails')}
      subtitle={t('suOptionalHelpsMembersWhoMatchOn')}
      footer={
        <>
          <PrimaryButton
            label={t('suSaveAndContinue')}
            disabled={!canContinue}
            onPress={() => {
              if (nakshatra && raasi) {
                onNext({ nakshatra, raasi });
              }
            }}
          />
          <TextButton label={t('suILlDoThisLater')} onPress={onSkip} />
        </>
      }
    >
      <Field label={t('suStarNakshatra')}>
        <Select
          value={nakshatra}
          placeholder={t('suSelectYourNakshatra')}
          title={t('suStarNakshatra')}
          options={NAKSHATRAS.map((item) => ({ id: item, label: item }))}
          onChange={setNakshatra}
        />
      </Field>

      <Field label={t('suRaasi')}>
        <Select
          value={raasi}
          placeholder={t('suSelectYourRaasi')}
          title={t('suRaasi')}
          options={RAASIS.map((item) => ({ id: item, label: item }))}
          onChange={setRaasi}
        />
      </Field>
    </StepScaffold>
  );
}
