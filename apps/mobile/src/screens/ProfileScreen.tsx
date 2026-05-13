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
import { PhotoManager } from '../components/PhotoManager';
import type { Photo } from './SignupManagePhotosScreen';
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
  // Extended fields
  gender: '',
  dateOfBirth: '',
  physicalStatus: '',
  religion: '',
  caste: '',
  subCaste: '',
  dosh: '',
  country: '',
  state: '',
  city: '',
  village: '',
  nativeCity: '',
  nativeVillage: '',
  eatingHabit: '',
  horoscopeTime: '',
  horoscopePlace: '',
  photos: [],
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
  // Extended fields
  familyStatus: '',
  familyType: '',
  familyWealth: '',
  fatherName: '',
  motherName: '',
  fatherOccupation: '',
  motherOccupation: '',
  siblings: '',
  hobbies: [],
  music: [],
  sports: [],
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
          // Extended fields
          gender: normalizeValue(data.profile.gender),
          dateOfBirth: normalizeValue(data.profile.dateOfBirth),
          physicalStatus: normalizeValue(data.profile.physicalStatus),
          religion: normalizeValue(data.profile.religion),
          caste: normalizeValue(data.profile.caste),
          subCaste: normalizeValue(data.profile.subCaste),
          dosh: normalizeValue(data.profile.dosh),
          country: normalizeValue(data.profile.country),
          state: normalizeValue(data.profile.state),
          city: normalizeValue(data.profile.city),
          village: normalizeValue(data.profile.village),
          nativeCity: normalizeValue(data.profile.nativeCity),
          nativeVillage: normalizeValue(data.profile.nativeVillage),
          eatingHabit: normalizeValue(data.profile.eatingHabit),
          horoscopeTime: normalizeValue(data.profile.horoscopeTime),
          horoscopePlace: normalizeValue(data.profile.horoscopePlace),
          photos: data.profile.photos || [],
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
          // Extended fields
          familyStatus: normalizeValue(data.matrimony.familyStatus),
          familyType: normalizeValue(data.matrimony.familyType),
          familyWealth: normalizeValue(data.matrimony.familyWealth),
          fatherName: normalizeValue(data.matrimony.fatherName),
          motherName: normalizeValue(data.matrimony.motherName),
          fatherOccupation: normalizeValue(data.matrimony.fatherOccupation),
          motherOccupation: normalizeValue(data.matrimony.motherOccupation),
          siblings: normalizeValue(data.matrimony.siblings),
          hobbies: data.matrimony.hobbies || [],
          music: data.matrimony.music || [],
          sports: data.matrimony.sports || [],
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
        profile: {
          ...profile,
          // Ensure all extended fields are included
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
          physicalStatus: profile.physicalStatus,
          religion: profile.religion,
          caste: profile.caste,
          subCaste: profile.subCaste,
          dosh: profile.dosh,
          country: profile.country,
          state: profile.state,
          city: profile.city,
          village: profile.village,
          nativeCity: profile.nativeCity,
          nativeVillage: profile.nativeVillage,
          eatingHabit: profile.eatingHabit,
          horoscopeTime: profile.horoscopeTime,
          horoscopePlace: profile.horoscopePlace,
          photos: profile.photos,
        },
        matrimony: {
          ...matrimony,
          // Ensure all extended fields are included
          familyStatus: matrimony.familyStatus,
          familyType: matrimony.familyType,
          familyWealth: matrimony.familyWealth,
          fatherName: matrimony.fatherName,
          motherName: matrimony.motherName,
          fatherOccupation: matrimony.fatherOccupation,
          motherOccupation: matrimony.motherOccupation,
          siblings: matrimony.siblings,
          hobbies: matrimony.hobbies,
          music: matrimony.music,
          sports: matrimony.sports,
        },
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

      {/* Personal Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <LabeledInput
          label="Gender"
          value={profile.gender || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, gender: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Date of Birth"
          value={profile.dateOfBirth || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, dateOfBirth: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Physical Status"
          value={profile.physicalStatus || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, physicalStatus: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Religious Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Religious Details</Text>
        <LabeledInput
          label="Religion"
          value={profile.religion || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, religion: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Caste"
          value={profile.caste || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, caste: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Gol (Subcaste)"
          value={profile.subCaste || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, subCaste: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Dosh"
          value={profile.dosh || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, dosh: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Location Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Location Details</Text>
        <LabeledInput
          label="Country"
          value={profile.country || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, country: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="State"
          value={profile.state || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, state: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="City"
          value={profile.city || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, city: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Village"
          value={profile.village || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, village: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Native City"
          value={profile.nativeCity || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, nativeCity: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Native Village"
          value={profile.nativeVillage || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, nativeVillage: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Interests from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Interests</Text>
        <LabeledInput
          label="Hobbies"
          value={matrimony.hobbies?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, hobbies: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Music"
          value={matrimony.music?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, music: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Sports"
          value={matrimony.sports?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, sports: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Family Details */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Family Details</Text>
        <OptionSelect
          label="Family Status"
          value={matrimony.familyStatus || ''}
          options={['Middle Class', 'Upper Middle Class', 'Rich', 'Affluent']}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyStatus: value }))}
          styles={styles}
        />
        <OptionSelect
          label="Family Type"
          value={matrimony.familyType || ''}
          options={['Joint Family', 'Nuclear Family', 'Extended Family']}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyType: value }))}
          styles={styles}
        />
        <OptionSelect
          label="Family Wealth"
          value={matrimony.familyWealth || ''}
          options={['Below Average', 'Average', 'Above Average', 'High']}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyWealth: value }))}
          styles={styles}
        />
        <LabeledInput
          label="Father's Name"
          value={matrimony.fatherName || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, fatherName: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Father's Occupation"
          value={matrimony.fatherOccupation || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, fatherOccupation: value }))}
          editable={isEditing}
          placeholder="e.g. Farmer, Business"
          styles={styles}
        />
        <LabeledInput
          label="Mother's Name"
          value={matrimony.motherName || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, motherName: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Mother's Occupation"
          value={matrimony.motherOccupation || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, motherOccupation: value }))}
          editable={isEditing}
          placeholder="e.g. Homemaker, Teacher"
          styles={styles}
        />
        <LabeledInput
          label="Siblings"
          value={matrimony.siblings || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, siblings: value }))}
          editable={isEditing}
          placeholder="e.g. 1 Brother, 2 Sisters"
          styles={styles}
        />
      </SectionCard>

      {/* Eating Habits from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Eating Habits</Text>
        <LabeledInput
          label="Eating Habit"
          value={profile.eatingHabit || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, eatingHabit: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Horoscope Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Horoscope Details</Text>
        <LabeledInput
          label="Time of Birth"
          value={profile.horoscopeTime || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, horoscopeTime: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
        <LabeledInput
          label="Place of Birth"
          value={profile.horoscopePlace || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, horoscopePlace: value }))}
          editable={isEditing}
          placeholder="Not set"
          styles={styles}
        />
      </SectionCard>

      {/* Photos */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Photos</Text>
        <PhotoManager
          photos={(profile.photos || []).filter((p: any) => p.status === 'done')}
          editable={isEditing}
          maxPhotos={2}
          onChange={(updated: Photo[]) => setProfile((prev) => ({ ...prev, photos: updated }))}
        />
        {!isEditing && (!profile.photos || profile.photos.filter((p: any) => p.status === 'done').length === 0) && (
          <Text style={styles.noPhotosText}>No photos uploaded yet. Tap Edit to add photos.</Text>
        )}
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
  noPhotosText: {
    ...type.body,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  photosCount: {
    ...type.body,
    color: palette.muted,
    marginTop: spacing.xs,
  },
  });
}
