import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing, type } from '../theme';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppTheme } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { optionLabel } from '../constants/optionTranslations';

export function SectionCard({ children }: { children: React.ReactNode }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return <View style={styles.card}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <Pressable style={[styles.primaryButton, disabled ? styles.disabledButton : null]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <Pressable style={[styles.secondaryButton, disabled ? styles.disabledButton : null]} onPress={onPress} disabled={disabled}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function FieldLabel({ text }: { text: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

export function LabeledInput({
  label,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel text={label} />
      <TextInput
        {...props}
        style={[styles.input, style]}
        placeholderTextColor={palette.muted}
      />
    </View>
  );
}

export function OptionSelector({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const { palette } = useAppTheme();
  const { language } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel text={label} />
      <View style={styles.optionRow}>
        {options.map((option) => {
          const isSelected = option === value;
          return (
            <Pressable
              key={`${label}-${option}`}
              onPress={() => onChange(option)}
              style={[styles.optionChip, isSelected ? styles.optionChipActive : null]}
            >
              <Text style={[styles.optionChipText, isSelected ? styles.optionChipTextActive : null]}>
                {optionLabel(option, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    primaryButton: {
      backgroundColor: palette.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: palette.onPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
    },
    secondaryButtonText: {
      color: palette.text,
      fontWeight: '700',
      fontSize: 13,
    },
    disabledButton: {
      opacity: 0.55,
    },
    title: {
      ...type.title,
      color: palette.text,
    },
    subtitle: {
      ...type.body,
      color: palette.muted,
      marginTop: spacing.xs,
    },
    fieldGroup: {
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      ...type.caption,
      color: palette.text,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      color: palette.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    optionChip: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    optionChipActive: {
      borderColor: palette.primary,
      backgroundColor: palette.primarySoft,
    },
    optionChipText: {
      ...type.caption,
      color: palette.text,
      textTransform: 'capitalize',
    },
    optionChipTextActive: {
      color: palette.primary,
      fontWeight: '700',
    },
  });
}
