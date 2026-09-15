import React, { useState } from 'react';
import { View } from 'react-native';
import { OptionCard, PrimaryButton, StepScaffold, TextButton } from '../components/ui';
import { EATING_HABITS } from '../constants/signupOptions';
import { subjectFor, capitalise, type ProfileSubject } from '../constants/profileSubject';

export type EatingHabit = 'vegetarian' | 'non_vegetarian' | 'eggetarian';

interface SignupEatingHabitsScreenProps {
  /** Who the profile is being created for, so the copy can address them. */
  subject?: ProfileSubject;
  onBack: () => void;
  onNext: (habit: EatingHabit) => void;
  onSkip: () => void;
}

export function SignupEatingHabitsScreen({ subject: subjectProp, onBack, onNext, onSkip }: SignupEatingHabitsScreenProps) {
  const subject = subjectProp ?? subjectFor(null);
  const [habit, setHabit] = useState<EatingHabit | null>(null);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Lifestyle"
      title={`${capitalise(subject.possessive)} eating habits`}
      subtitle="Many families consider this when shortlisting."
      footer={
        <>
          <PrimaryButton
            label="Save and continue"
            disabled={!habit}
            onPress={() => habit && onNext(habit)}
          />
          <TextButton label="I'll do this later" onPress={onSkip} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {EATING_HABITS.map((option) => (
          <OptionCard
            key={option.id}
            label={option.label}
            icon={option.icon}
            selected={habit === option.id}
            onPress={() => setHabit(option.id as EatingHabit)}
          />
        ))}
      </View>
    </StepScaffold>
  );
}
