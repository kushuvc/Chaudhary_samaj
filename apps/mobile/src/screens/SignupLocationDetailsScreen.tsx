import React, { useMemo, useState } from 'react';
import {
  Field,
  Input,
  PrimaryButton,
  SectionHeading,
  Select,
  StepScaffold,
} from '../components/ui';
import { CITIES, COUNTRIES, OTHER, STATES } from '../constants/signupOptions';
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
  /** Answers already given (Back, or a resumed signup), shown again. */
  initial?: LocationDetailsData;
  onBack: () => void;
  onNext: (data: LocationDetailsData) => void;
}

export function SignupLocationDetailsScreen({ subject: subjectProp, initial, onBack, onNext }: SignupLocationDetailsScreenProps) {
  const { t, language } = useAppLanguage();
  const subject = subjectProp ?? subjectFor(null, language);
  const [country, setCountry] = useState<string | null>(initial?.country || null);
  const [state, setState] = useState<string | null>(initial?.state || null);
  // A town typed under "Other" comes back as that choice plus the text.
  const initialListed = Boolean(initial?.city && initial.state && CITIES[initial.state]?.includes(initial.city));
  const [city, setCity] = useState<string | null>(initial?.city ? (initialListed ? initial.city : OTHER) : null);
  // Typed when the town is not in the list ("Other").
  const [customCity, setCustomCity] = useState(initial?.city && !initialListed ? initial.city : '');
  const [village, setVillage] = useState(initial?.village || '');
  const [nativeCity, setNativeCity] = useState(initial?.nativeCity || '');
  const [nativeVillage, setNativeVillage] = useState(initial?.nativeVillage || '');

  const stateOptions = useMemo(
    () => ((country && STATES[country]) || ['Other']).map((item) => ({ id: item, label: item })),
    [country]
  );

  const cityOptions = useMemo(
    () => ((state && CITIES[state]) || ['Other']).map((item) => ({ id: item, label: item })),
    [state]
  );

  const typingCity = city === OTHER;
  const finalCity = typingCity ? customCity.trim() : city;
  const canContinue = Boolean(country && state && finalCity);

  return (
    <StepScaffold
      onBack={onBack}
      step={3}
      totalSteps={5}
      eyebrow={t('suLocationDetails')}
      title={t('suTitleLocation', { verb: subject.verb, pronoun: subject.pronoun })}
      subtitle={t('suSubLocation', { possessive: subject.possessive })}
      footer={
        <PrimaryButton
          label={t('suContinue')}
          icon="arrow-forward"
          disabled={!canContinue}
          onPress={() => {
            if (country && state && finalCity) {
              onNext({ country, state, city: finalCity, village, nativeCity, nativeVillage });
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

      <Field label={t('suState')} hint={!country ? t('suChooseCountryFirst') : undefined}>
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

      <Field label={t('suCity')} hint={!state ? t('suChooseStateFirst') : undefined}>
        <Select
          value={city}
          placeholder={t('suSelectCity')}
          title={t('suCity')}
          options={cityOptions}
          onChange={setCity}
          disabled={!state}
        />
      </Field>

      {typingCity ? (
        <Field label={t('suTypeCity')}>
          <Input value={customCity} onChangeText={setCustomCity} placeholder={t('suTypeCityPlaceholder')} autoCapitalize="words" />
        </Field>
      ) : null}

      <SectionHeading title={t('suNativePlace')} caption={t('hintOptionalFamily')} />

      <Field label={t('suAreaOrVillage')}>
        <Input value={village} onChangeText={setVillage} placeholder={t('hintEgVillage')} autoCapitalize="words" />
      </Field>

      <Field label={t('suNativeCity')}>
        <Input value={nativeCity} onChangeText={setNativeCity} placeholder={t('hintEgNativeCity')} autoCapitalize="words" />
      </Field>

      <Field label={t('suNativeVillage')}>
        <Input
          value={nativeVillage}
          onChangeText={setNativeVillage}
          placeholder={t('hintEgNativeVillage')}
          autoCapitalize="words"
        />
      </Field>
    </StepScaffold>
  );
}
