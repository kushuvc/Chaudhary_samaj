import React, { useEffect, useState } from 'react';
import { AadhaarVerify } from '../components/AadhaarVerify';
import { PrimaryButton, StepScaffold, TextButton } from '../components/ui';
import { useAppLanguage } from '../context/LanguageContext';
import { api, type VerificationSummary } from '../services/api';

/*
 * The Aadhaar step in signup.
 *
 * Comes straight after photos, once the account exists, because the server
 * compares the Aadhaar with the profile just saved. Skippable: a member can
 * verify later from the Profile tab. The guide starts open, since this is the
 * first time anyone sees the step.
 */
export function SignupVerifyScreen({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useAppLanguage();
  const [aadhaar, setAadhaar] = useState<VerificationSummary['aadhaar'] | null>(null);

  useEffect(() => {
    api.getVerification().then((v) => setAadhaar(v.aadhaar)).catch(() => {});
  }, []);

  const done = aadhaar?.status === 'verified' || aadhaar?.status === 'review';

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow={t('verifyTitle')}
      title={t('verifySignupTitle')}
      subtitle={t('verifySignupSubtitle')}
      footer={
        done ? (
          <PrimaryButton label={t('verifyContinue')} onPress={onNext} />
        ) : (
          <TextButton label={t('suILlDoThisLater')} onPress={onNext} />
        )
      }
    >
      <AadhaarVerify aadhaar={aadhaar} onResult={(summary) => setAadhaar(summary.aadhaar)} guideOpenInitially />
    </StepScaffold>
  );
}
