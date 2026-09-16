import React, { useMemo, useState } from 'react';
import {
  Field,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  INCOME_CURRENCIES,
  INCOME_RANGES_FOREIGN,
  INCOME_RANGES_INR,
  OCCUPATIONS,
} from '../constants/signupOptions';
import { useAppLanguage } from '../context/LanguageContext';

export interface ProfessionalDetailsData {
  education: string;
  employmentType: string;
  occupation: string;
  incomeCurrency: string;
  annualIncome: string;
}

interface SignupProfessionalDetailsScreenProps {
  onBack: () => void;
  onNext: (data: ProfessionalDetailsData) => void;
}

export function SignupProfessionalDetailsScreen({ onBack, onNext }: SignupProfessionalDetailsScreenProps) {
  const { t } = useAppLanguage();
  const [education, setEducation] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [incomeCurrency, setIncomeCurrency] = useState<string | null>('INR');
  const [annualIncome, setAnnualIncome] = useState<string | null>(null);

  const notWorking = employmentType === 'Not Working';

  const incomeOptions = useMemo(() => {
    const ranges = incomeCurrency === 'INR' ? INCOME_RANGES_INR : INCOME_RANGES_FOREIGN;
    return ranges.map((item) => ({ id: item, label: item }));
  }, [incomeCurrency]);

  const canContinue = Boolean(
    education && employmentType && occupation && (notWorking || (incomeCurrency && annualIncome))
  );

  return (
    <StepScaffold
      onBack={onBack}
      step={4}
      totalSteps={5}
      eyebrow={t('suProfessionalDetails')}
      title={t('suEducationAndWork')}
      subtitle={t('suManyMembersFilterOnTheseSo')}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (education && employmentType && occupation) {
              onNext({
                education,
                employmentType,
                occupation,
                incomeCurrency: notWorking ? '' : incomeCurrency || '',
                annualIncome: notWorking ? '' : annualIncome || '',
              });
            }
          }}
        />
      }
    >
      <Field label={t('suHighestEducation')}>
        <Select
          value={education}
          placeholder={t('suSelectYourEducation')}
          title={t('suEducation')}
          options={EDUCATION_LEVELS.map((item) => ({ id: item, label: item }))}
          onChange={setEducation}
        />
      </Field>

      <Field label={t('suEmploymentType')}>
        <Select
          value={employmentType}
          placeholder={t('suSelectEmploymentType')}
          title={t('suEmploymentType')}
          options={EMPLOYMENT_TYPES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setEmploymentType(next);
            if (next === 'Not Working') {
              setAnnualIncome(null);
            }
          }}
        />
      </Field>

      <Field label={t('suOccupation')}>
        <Select
          value={occupation}
          placeholder={t('suSelectYourOccupation')}
          title={t('suOccupation')}
          options={OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setOccupation}
        />
      </Field>

      {!notWorking ? (
        <>
          <SectionHeading title={t('suAnnualIncome')} caption="Shown as a range — never an exact figure." />

          <Field label={t('suCurrency')}>
            <Select
              value={incomeCurrency}
              placeholder={t('suSelectCurrency')}
              title={t('suCurrency')}
              options={INCOME_CURRENCIES}
              onChange={(next) => {
                setIncomeCurrency(next);
                setAnnualIncome(null);
              }}
              searchable={false}
            />
          </Field>

          <Field label={t('suIncomeRange')}>
            <Select
              value={annualIncome}
              placeholder={t('suSelectYourAnnualIncome')}
              title={t('suAnnualIncome')}
              options={incomeOptions}
              onChange={setAnnualIncome}
              disabled={!incomeCurrency}
            />
          </Field>
        </>
      ) : null}
    </StepScaffold>
  );
}
