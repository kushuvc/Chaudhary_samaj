import React, { useState } from 'react';
import { View } from 'react-native';
import { OptionCard, PrimaryButton, StepScaffold, TextButton } from '../components/ui';
import { EATING_HABITS } from '../constants/signupOptions';

export type EatingHabit = 'vegetarian' | 'non_vegetarian' | 'eggetarian';

interface SignupEatingHabitsScreenProps {
  onBack: () => void;
  onNext: (habit: EatingHabit) => void;
  onSkip: () => void;
}

export function SignupEatingHabitsScreen({ onBack, onNext, onSkip }: SignupEatingHabitsScreenProps) {
  const [habit, setHabit] = useState<EatingHabit | null>(null);

  return (
    <StepScaffold
      onBack={onBack}
      eyebrow="Lifestyle"
      title="Your eating habits"
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
