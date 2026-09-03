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
      eyebrow="Professional details"
      title="Education and work"
      subtitle="Many members filter on these, so it's worth being accurate."
      footer={
        <PrimaryButton
          label="Continue"
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
      <Field label="Highest education">
        <Select
          value={education}
          placeholder="Select your education"
          title="Education"
          options={EDUCATION_LEVELS.map((item) => ({ id: item, label: item }))}
          onChange={setEducation}
        />
      </Field>

      <Field label="Employment type">
        <Select
          value={employmentType}
          placeholder="Select employment type"
          title="Employment type"
          options={EMPLOYMENT_TYPES.map((item) => ({ id: item, label: item }))}
          onChange={(next) => {
            setEmploymentType(next);
            if (next === 'Not Working') {
              setAnnualIncome(null);
            }
          }}
        />
      </Field>

      <Field label="Occupation">
        <Select
          value={occupation}
          placeholder="Select your occupation"
          title="Occupation"
          options={OCCUPATIONS.map((item) => ({ id: item, label: item }))}
          onChange={setOccupation}
        />
      </Field>

      {!notWorking ? (
        <>
          <SectionHeading title="Annual income" caption="Shown as a range — never an exact figure." />

          <Field label="Currency">
            <Select
              value={incomeCurrency}
              placeholder="Select currency"
              title="Currency"
              options={INCOME_CURRENCIES}
              onChange={(next) => {
                setIncomeCurrency(next);
                setAnnualIncome(null);
              }}
              searchable={false}
            />
          </Field>

          <Field label="Income range">
            <Select
              value={annualIncome}
              placeholder="Select your annual income"
              title="Annual income"
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
