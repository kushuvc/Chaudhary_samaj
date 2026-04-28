import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { radius, spacing, type } from '../theme';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppTheme } from '../context/ThemeContext';

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [pickerVisible, setPickerVisible] = useState(false);
  const currentDate = useMemo(() => parseDateValue(value), [value]);
  const [draftDate, setDraftDate] = useState<Date>(currentDate);
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const draftISO = toISODate(draftDate);

  const openPicker = () => {
    setDraftDate(currentDate);
    setPickerVisible(true);
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.inputLike} onPress={openPicker}>
        <Text style={value ? styles.inputText : styles.placeholderText}>{formatDateLabel(value)}</Text>
      </Pressable>
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <View style={styles.iosPickerWrap}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={draftISO}
                  onChange={(event) => {
                    const next = new Date(event.currentTarget.value);
                    if (!Number.isNaN(next.getTime())) {
                      setDraftDate(next);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 12,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: palette.text,
                    fontSize: 16,
                  }}
                />
              ) : (
                <DateTimePicker
                  mode="date"
                  value={draftDate}
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={(_event, date) => {
                    if (!date) {
                      return;
                    }
                    setDraftDate(date);
                  }}
                />
              )}
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmBtn}
                onPress={() => {
                  onChange(toISODate(draftDate));
                  setPickerVisible(false);
                }}
              >
                <Text style={styles.confirmText}>Select</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'center',
      padding: spacing.md,
    },
    pickerCard: {
      backgroundColor: palette.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    modalTitle: {
      ...type.body,
      color: palette.text,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.xs,
    },
    cancelBtn: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.sm,
      backgroundColor: palette.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    cancelText: {
      color: palette.accent,
      fontWeight: '600',
    },
    confirmBtn: {
      borderWidth: 1,
      borderColor: palette.primary,
      borderRadius: radius.sm,
      backgroundColor: palette.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    confirmText: {
      color: palette.surface,
      fontWeight: '700',
    },
  });
}
