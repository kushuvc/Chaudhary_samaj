import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { radius, spacing, type } from '../theme';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppTheme } from '../context/ThemeContext';

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateValue(value: string) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateLabel(value: string) {
  if (!value) {
    return 'Select date';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [iosVisible, setIosVisible] = useState(false);
  const currentDate = useMemo(() => parseDateValue(value), [value]);
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: currentDate,
        onChange: (_event, date) => {
          if (!date) {
            return;
          }
          onChange(toISODate(date));
        },
      });
      return;
    }
    setIosVisible((prev) => !prev);
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.inputLike} onPress={openPicker}>
        <Text style={value ? styles.inputText : styles.placeholderText}>{formatDateLabel(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosVisible ? (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            mode="date"
            value={currentDate}
            onChange={(_event, date) => {
              if (!date) {
                return;
              }
              onChange(toISODate(date));
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    fieldGroup: {
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      ...type.caption,
      color: palette.text,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    inputLike: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    inputText: {
      color: palette.text,
    },
    placeholderText: {
      color: palette.muted,
    },
    iosPickerWrap: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.md,
      backgroundColor: palette.surface,
      marginTop: spacing.xs,
    },
  });
}
