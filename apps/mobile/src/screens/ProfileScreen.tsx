import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { InlineError, ScreenLoader } from '../components/AppFeedback';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { useAuth } from '../context/AuthContext';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import { radius, spacing, type } from '../theme';
import type { MatrimonyMemberPayload, MatrimonyMemberProfile, MatrimonyMemberSettings } from '../types';

const emptyProfile: MatrimonyMemberProfile = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  occupation: '',
  education: '',
  bio: '',
};

const emptyMatrimony: MatrimonyMemberSettings = {
  age: '',
  maritalStatus: '',
  height: '',
  income: '',
  community: '',
  language: '',
  profileBio: '',
  preferredLocation: '',
  preferredEducation: '',
  preferredOccupation: '',
};

const MARITAL_STATUS_OPTIONS = ['Never Married', 'Divorced', 'Widowed', 'Separated'];
const COMMUNITY_OPTIONS = ['Chaudhary', 'Jat', 'Other'];
const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Gujarati', 'Rajasthani', 'Haryanvi'];
const EDUCATION_OPTIONS = ['High School', 'Diploma', 'Graduate', 'Postgraduate', 'Doctorate'];
const OCCUPATION_OPTIONS = [
  'Business',
  'Private Job',
  'Government Job',
  'Self Employed',
  'Professional',
  'Student',
  'Other',
];

const normalizeValue = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.toLowerCase() === 'not set' ? '' : trimmed;
};

type OptionSelectProps = {
  label: string;
  value: string;
  options: string[];
  editable: boolean;
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
};

function OptionSelect({ label, value, options, editable, onSelect, styles }: OptionSelectProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {!editable ? (
        <View style={styles.readOnlyValueWrap}>
          <Text style={styles.readOnlyValueText}>{value || '-'}</Text>
        </View>
      ) : (
        <FlatList
          data={options}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSelected = item === value;
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={[styles.chip, isSelected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

type LabeledInputProps = {
  label: string;
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function LabeledInput({
  label,
  value,
  placeholder,
  editable,
  onChangeText,
  styles,
  keyboardType,
  multiline,
  numberOfLines,
  autoCapitalize,
}: LabeledInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        style={[styles.input, multiline ? styles.textArea : null]}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export function ProfileScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { session, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<MatrimonyMemberProfile>(emptyProfile);
  const [matrimony, setMatrimony] = useState<MatrimonyMemberSettings>(emptyMatrimony);

  const completionScore = useMemo(() => {
    const fields = [
      profile.fullName,
      profile.email,
      profile.phone || '',
      profile.location,
      profile.occupation,
      profile.education,
      profile.bio,
    ];
    const filled = fields.filter((field) => String(field).trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const matrimonyCompletion = useMemo(() => {
    const fields = Object.values(matrimony);
    const filled = fields.filter((field) => String(field).trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [matrimony]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setError(null);
        const data = await api.getMyMatrimonyProfile();
        if (!mounted) {
          return;
        }
        setProfile({
          fullName: normalizeValue(data.profile.fullName) || '',
          email: normalizeValue(data.profile.email) || session?.user?.email || '',
          phone: normalizeValue(data.profile.phone),
          location: normalizeValue(data.profile.location),
          occupation: normalizeValue(data.profile.occupation),
          education: normalizeValue(data.profile.education),
          bio: normalizeValue(data.profile.bio),
        });
        setMatrimony({
          age: normalizeValue(data.matrimony.age),
          maritalStatus: normalizeValue(data.matrimony.maritalStatus),
          height: normalizeValue(data.matrimony.height),
          income: normalizeValue(data.matrimony.income),
          community: normalizeValue(data.matrimony.community),
          language: normalizeValue(data.matrimony.language),
          profileBio: normalizeValue(data.matrimony.profileBio),
          preferredLocation: normalizeValue(data.matrimony.preferredLocation),
          preferredEducation: normalizeValue(data.matrimony.preferredEducation),
          preferredOccupation: normalizeValue(data.matrimony.preferredOccupation),
        });
      } catch (err) {
        if (mounted) {
          setError((err as Error).message || t('unableLoadProfile'));
          setProfile((prev) => ({
            ...prev,
            fullName: session?.user?.name || prev.fullName,
            email: session?.user?.email || prev.email,
          }));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [session?.user?.email, session?.user?.name, t]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload: Partial<MatrimonyMemberPayload> = {
        user: {
          id: session?.user?.id,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
        },
        profile,
        matrimony,
      };

      const updated = await api.updateMyMatrimonyProfile(payload);
      setProfile(updated.profile);
      setMatrimony(updated.matrimony);
      setIsEditing(false);
    } catch (err) {
      setError((err as Error).message || t('unableSaveProfile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ScreenLoader message={t('loadingProfile')} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <ScreenTitle title={t('profile')} subtitle={t('profileSubtitle')} />
        <PrimaryButton
          label={saving ? t('saving') : isEditing ? t('save') : t('edit')}
          onPress={isEditing ? saveProfile : () => setIsEditing(true)}
          disabled={saving}
        />
      </View>

      {error ? <InlineError message={error} /> : null}

      <SectionCard>
        <Text style={styles.cardTitle}>{t('profileCompletion')} {completionScore}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionScore}%` }]} />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>{t('basicInformation')}</Text>
        <LabeledInput
          label={t('fullNameLabel')}
          value={profile.fullName}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
          editable={isEditing}
          placeholder={t('fullNamePlaceholder')}
          styles={styles}
        />
        <LabeledInput
          label={t('emailLabel')}
          value={profile.email}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, email: value }))}
          editable={isEditing}
          placeholder={t('contactEmailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          styles={styles}
        />
        <LabeledInput
          label={t('phoneLabel')}
          value={profile.phone || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
          editable={isEditing}
          placeholder={t('phonePlaceholder')}
          keyboardType="phone-pad"
          styles={styles}
        />
        <LabeledInput
          label={t('locationLabel')}
          value={profile.location}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, location: value }))}
          editable={isEditing}
          placeholder={t('locationPlaceholder')}
          styles={styles}
        />
        <OptionSelect
          label={t('occupationLabel')}
          value={profile.occupation}
          options={OCCUPATION_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, occupation: value }))}
          styles={styles}
        />
        <OptionSelect
          label={t('educationLabel')}
          value={profile.education}
          options={EDUCATION_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, education: value }))}
          styles={styles}
        />
        <LabeledInput
          label={t('profileBioLabel')}
          value={profile.bio}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, bio: value }))}
          editable={isEditing}
          placeholder={t('bioPlaceholder')}
          multiline
          numberOfLines={4}
          styles={styles}
        />
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>{t('matrimonyCompletion')} {matrimonyCompletion}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFillAlt, { width: `${matrimonyCompletion}%` }]} />
        </View>
        <LabeledInput
          label={t('ageLabel')}
          value={matrimony.age}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, age: value }))}
          editable={isEditing}
          placeholder={t('agePlaceholder')}
          keyboardType="number-pad"
          styles={styles}
        />
        <OptionSelect
          label={t('maritalStatusLabel')}
          value={matrimony.maritalStatus}
          options={MARITAL_STATUS_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, maritalStatus: value }))}
          styles={styles}
        />
        <LabeledInput
          label={t('heightLabel')}
          value={matrimony.height}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, height: value }))}
          editable={isEditing}
          placeholder={t('heightPlaceholder')}
          styles={styles}
        />
        <LabeledInput
          label={t('incomeLabel')}
          value={matrimony.income}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, income: value }))}
          editable={isEditing}
          placeholder={t('incomePlaceholder')}
          styles={styles}
        />
        <OptionSelect
          label={t('community')}
          value={matrimony.community}
          options={COMMUNITY_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, community: value }))}
          styles={styles}
        />
        <OptionSelect
          label={t('languageFieldLabel')}
          value={matrimony.language}
          options={LANGUAGE_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, language: value }))}
          styles={styles}
        />
        <LabeledInput
          label={t('matrimonyBioLabel')}
          value={matrimony.profileBio}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, profileBio: value }))}
          editable={isEditing}
          placeholder={t('matrimonyBioPlaceholder')}
          multiline
          numberOfLines={4}
          styles={styles}
        />
        <LabeledInput
          label={t('preferredLocationLabel')}
          value={matrimony.preferredLocation}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, preferredLocation: value }))}
          editable={isEditing}
          placeholder={t('preferredLocationPlaceholder')}
          styles={styles}
        />
        <OptionSelect
          label={t('preferredEducationLabel')}
          value={matrimony.preferredEducation}
          options={EDUCATION_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, preferredEducation: value }))}
          styles={styles}
        />
        <OptionSelect
          label={t('preferredOccupationLabel')}
          value={matrimony.preferredOccupation}
          options={OCCUPATION_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, preferredOccupation: value }))}
          styles={styles}
        />
      </SectionCard>

      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutButtonText}>{t('logoutLabel')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...type.body,
    fontWeight: '700',
    color: palette.text,
  },
  sectionTitle: {
    ...type.h2,
    marginBottom: spacing.sm,
  },
  fieldGroup: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...type.caption,
    color: palette.muted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chip: {
    borderRadius: 999,
    borderColor: palette.border,
    borderWidth: 1,
    backgroundColor: palette.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  chipText: {
    ...type.caption,
    color: palette.text,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: palette.primary,
  },
  readOnlyValueWrap: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  readOnlyValueText: {
    ...type.body,
    color: palette.text,
  },
  progressTrack: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
  },
  progressFillAlt: {
    height: '100%',
    backgroundColor: palette.danger,
  },
  logoutButton: {
    backgroundColor: palette.danger,
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: palette.surface,
    fontWeight: '700',
  },
  });
}
