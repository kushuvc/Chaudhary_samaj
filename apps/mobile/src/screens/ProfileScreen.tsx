import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { InlineError, ScreenLoader } from '../components/AppFeedback';
import { PhotoManager } from '../components/PhotoManager';
import type { Photo } from './SignupManagePhotosScreen';
import { PrimaryButton, ScreenTitle, SectionCard } from '../components/AppPrimitives';
import { KeyboardScrollContext, useKeyboardAwareScroll } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAppLanguage } from '../context/LanguageContext';
import { optionLabel } from '../constants/optionTranslations';
import { Select } from '../components/ui';
import {
  CASTES, COUNTRIES, DOSH_OPTIONS, EATING_HABITS, EMPLOYMENT_TYPES, FAMILY_STATUSES,
  FAMILY_TYPES, FAMILY_WEALTH, HEIGHTS, INCOME_CURRENCIES, MARITAL_STATUSES,
  MOTHER_TONGUES, NAKSHATRAS, PHYSICAL_STATUSES, RAASIS, RELIGIONS, STATES, SUBCASTES,
} from '../constants/signupOptions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api, type AadhaarStatus } from '../services/api';
import { VerifiedBadge } from '../components/VerifiedBadge';
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
  const { language } = useAppLanguage();
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {!editable ? (
        <View style={styles.readOnlyValueWrap}>
          <Text style={styles.readOnlyValueText}>{value ? optionLabel(value, language) : '-'}</Text>
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
                <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                  {optionLabel(item, language)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

type SelectOption = { id: string; label: string };

/** Turns the plain string lists into the { id, label } shape Select wants. */
function asOptions(list: ReadonlyArray<string | SelectOption>): SelectOption[] {
  return list.map((item) =>
    typeof item === 'string' ? { id: item, label: item } : { id: item.id, label: item.label },
  );
}

/**
 * A field backed by a real dropdown.
 *
 * Most of this screen was free-text boxes for values that are a fixed list at
 * signup — religion, caste, marital status, height. A member could type
 * anything, and usually typed nothing, so the fields stayed blank. Reading
 * mode still shows plain text; only Edit opens the picker.
 */
function LabeledSelect({
  label,
  value,
  options,
  editable,
  onSelect,
  placeholder,
  styles,
}: {
  label: string;
  value: string | null | undefined;
  options: SelectOption[];
  editable: boolean;
  onSelect: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const { language } = useAppLanguage();
  const selected = options.find((option) => option.id === value);
  // Falls back to the stored value so a profile filled in by an older build,
  // or by a list that has since changed, still shows what it holds.
  const shown = selected ? optionLabel(selected.label, language) : optionLabel(value ?? '', language);

  // Matches LabeledInput: an empty field is hidden until the member edits.
  if (!editable && !String(value ?? '').trim()) return null;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <Select
          value={value || null}
          placeholder={placeholder}
          title={label}
          options={options}
          onChange={onSelect}
        />
      ) : (
        <View style={styles.readOnlyValueWrap}>
          <Text style={styles.readOnlyValueText}>{shown || '-'}</Text>
        </View>
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
  // Reports focus so the scroll container can lift this field above the
  // keyboard, the same way the shared Input does on the signup steps.
  const shellRef = useRef<View>(null);
  const keyboardScroll = useContext(KeyboardScrollContext);
  const { language } = useAppLanguage();

  /*
   * While viewing, show only what is filled in.
   *
   * The profile renders every field the schema has, but signup asks for a
   * fraction of them, so the rest sat there as empty rows and made the screen
   * look padded with things that were never asked. They come back in edit
   * mode, so nothing becomes unfillable.
   */
  if (!editable && !String(value ?? '').trim()) {
    return null;
  }

  return (
    <View ref={shellRef} style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        onFocus={() => keyboardScroll?.onInputFocus(shellRef.current)}
        value={editable ? value : optionLabel(value ?? '', language)}
        onChangeText={onChangeText}
        editable={editable}
        style={[styles.input, multiline ? styles.textArea : null]}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

export function ProfileScreen() {
  const { session } = useAuth();
  console.log('[ProfileScreen] Session:', session ? 'Authenticated' : 'Not authenticated');
  const { t } = useAppLanguage();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboardScroll = useKeyboardAwareScroll();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();
  // Reloaded on focus so returning from the Verification screen shows the result.
  const [idStatus, setIdStatus] = useState<AadhaarStatus>('none');
  useFocusEffect(
    React.useCallback(() => {
      api.getVerification().then((v) => setIdStatus(v.aadhaar.status)).catch(() => {});
    }, [])
  );
  // The server drops name changes once Aadhaar matched it; the app says so.
  const nameLocked = idStatus === 'verified';
  const [isEditing, setIsEditing] = useState(false);
  // What the profile looked like when Edit was tapped, so Cancel can put it back.
  const snapshot = useRef<{ profile: typeof profile; matrimony: typeof matrimony } | null>(null);
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
        console.log('[ProfileScreen] Loading profile data...');
        setError(null);
        const data = await api.getMyMatrimonyProfile();
        console.log('[ProfileScreen] Profile data received:', data);
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
        const profileData = {
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
        };
        console.log('[ProfileScreen] Matrimony data set:', profileData);
        setMatrimony(profileData);
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
    <ScrollView
      {...keyboardScroll.scrollProps}
      automaticallyAdjustKeyboardInsets
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12 },
        keyboardScroll.keyboardHeight > 0 && {
          paddingBottom: keyboardScroll.keyboardHeight + 24,
        },
      ]}
    >
      <KeyboardScrollContext.Provider value={keyboardScroll.contextValue}>
      <View style={styles.headerRow}>
        <ScreenTitle title={t('profile')} subtitle={t('profileSubtitle')} />
        {/* One button that silently changed meaning between "Edit" and
            "Save" left no way back out of edit mode and no sign you were in
            it. Editing now announces itself and can be abandoned. */}
        {isEditing ? (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                if (snapshot.current) {
                  setProfile(snapshot.current.profile);
                  setMatrimony(snapshot.current.matrimony);
                }
                setError(null);
                setIsEditing(false);
              }}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>{t('actCancel')}</Text>
            </Pressable>
            <PrimaryButton
              label={saving ? t('saving') : t('save')}
              onPress={saveProfile}
              disabled={saving}
            />
          </View>
        ) : (
          <PrimaryButton
            label={t('edit')}
            onPress={() => {
              snapshot.current = { profile, matrimony };
              setIsEditing(true);
            }}
            disabled={saving}
          />
        )}
      </View>

      {isEditing ? (
        <View style={styles.editBanner}>
          <Ionicons name="create-outline" size={18} color={palette.primary} />
          <Text style={styles.editBannerText}>{t('profileEditingHint')}</Text>
        </View>
      ) : null}

      {error ? <InlineError message={error} /> : null}

      <Pressable
        style={styles.verifyCard}
        onPress={() => navigation.navigate('Verification')}
        accessibilityRole="button"
      >
        <Ionicons
          name={nameLocked ? 'shield-checkmark' : 'shield-outline'}
          size={24}
          color={nameLocked ? palette.success : palette.primary}
        />
        <View style={{ flex: 1 }}>
          {nameLocked ? (
            <VerifiedBadge />
          ) : (
            <>
              <Text style={styles.cardTitle}>
                {idStatus === 'review' ? t('verifyAadhaarReview') : t('verifyGetVerified')}
              </Text>
              <Text style={styles.editBannerText}>{t('verifyGetVerifiedBody')}</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.muted} />
      </Pressable>

      <SectionCard>
        <Text style={styles.cardTitle}>{t('profileCompletion')} {completionScore}%</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionScore}%` }]} />
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>{t('basicInformation')}</Text>
        <LabeledInput
          label={nameLocked ? `${t('fullNameLabel')} · ${t('verifyLockedField')}` : t('fullNameLabel')}
          value={profile.fullName}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
          editable={isEditing && !nameLocked}
          placeholder={t('fullNamePlaceholder')}
          styles={styles}
        />
        {/*
          * Email and phone stay read-only even while editing. They are how an
          * account is identified and recovered — the address a password reset
          * goes to, the number a sign-in code goes to. Letting someone retype
          * either in a profile form is how an account quietly moves to an
          * address its owner does not hold. The server refuses the change too;
          * this only stops the app offering it.
          */}
        <LabeledInput
          label={t('emailLabel')}
          value={profile.email}
          onChangeText={() => {}}
          editable={false}
          placeholder={t('contactEmailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          styles={styles}
        />
        <LabeledInput
          label={t('phoneLabel')}
          value={profile.phone || ''}
          onChangeText={() => {}}
          editable={false}
          placeholder={t('phonePlaceholder')}
          keyboardType="phone-pad"
          styles={styles}
        />
        {isEditing ? (
          <Text style={[styles.fieldHint, { color: palette.muted }]}>{t('fieldLockedNote')}</Text>
        ) : null}
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
        <Text style={styles.sectionTitle}>{t('secPersonalDetails')}</Text>
        {/*
          * Gender is fixed at signup. The directory shows only the opposite
          * gender, so changing it would swap everything a member can see, and
          * the server drops the field from updates anyway — leaving the input
          * editable would just lose the edit silently.
          */}
        <LabeledInput
          label={t('fldGender')}
          value={profile.gender || ''}
          onChangeText={() => {}}
          editable={false}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldPhysicalStatus')}
          value={profile.physicalStatus}
          options={asOptions(PHYSICAL_STATUSES)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, physicalStatus: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Religious Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secReligiousDetails')}</Text>
        <LabeledSelect
          label={t('fldReligion')}
          value={profile.religion}
          options={asOptions(RELIGIONS)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, religion: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldCaste')}
          value={profile.caste}
          options={asOptions(CASTES)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, caste: value, subCaste: '' }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldGol')}
          value={profile.subCaste}
          options={asOptions(SUBCASTES[profile.caste || ""] || ["Other"])}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, subCaste: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldDosh')}
          value={profile.dosh}
          options={asOptions(DOSH_OPTIONS)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, dosh: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Location Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secLocationDetails')}</Text>
        <LabeledSelect
          label={t('fldCountry')}
          value={profile.country}
          options={asOptions(COUNTRIES)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, country: value, state: '' }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldState')}
          value={profile.state}
          options={asOptions(STATES[profile.country || ""] || ["Other"])}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, state: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldCity')}
          value={profile.city || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, city: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldVillage')}
          value={profile.village || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, village: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldNativeCity')}
          value={profile.nativeCity || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, nativeCity: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldNativeVillage')}
          value={profile.nativeVillage || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, nativeVillage: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Matrimony Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secMatrimonyDetails')}</Text>
        <LabeledInput
          label={t('fldAge')}
          value={matrimony.age || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, age: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <OptionSelect
          label={t('fldMaritalStatus')}
          value={matrimony.maritalStatus || ''}
          options={MARITAL_STATUS_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, maritalStatus: value }))}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldHeight')}
          value={matrimony.height}
          options={HEIGHTS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, height: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldIncome')}
          value={matrimony.income || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, income: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <OptionSelect
          label={t('fldCommunity')}
          value={matrimony.community || ''}
          options={COMMUNITY_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, community: value }))}
          styles={styles}
        />
        <OptionSelect
          label={t('fldLanguage')}
          value={matrimony.language || ''}
          options={LANGUAGE_OPTIONS}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, language: value }))}
          styles={styles}
        />
        <LabeledInput
          label={t('fldProfileBio')}
          value={matrimony.profileBio || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, profileBio: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          multiline
          numberOfLines={3}
          styles={styles}
        />
      </SectionCard>

      {/* Interests from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('interests')}</Text>
        <LabeledInput
          label={t('fldHobbies')}
          value={matrimony.hobbies?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, hobbies: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldMusic')}
          value={matrimony.music?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, music: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldSports')}
          value={matrimony.sports?.join(', ') || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, sports: value.split(', ').filter(Boolean) }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Family Details */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secFamilyDetails')}</Text>
        <LabeledSelect
          label={t('fldFamilyStatus')}
          value={matrimony.familyStatus}
          options={asOptions(FAMILY_STATUSES)}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyStatus: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldFamilyType')}
          value={matrimony.familyType}
          options={asOptions(FAMILY_TYPES)}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyType: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledSelect
          label={t('fldFamilyWealth')}
          value={matrimony.familyWealth}
          options={asOptions(FAMILY_WEALTH)}
          editable={isEditing}
          onSelect={(value) => setMatrimony((prev) => ({ ...prev, familyWealth: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldFatherName')}
          value={matrimony.fatherName || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, fatherName: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldFatherOccupation')}
          value={matrimony.fatherOccupation || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, fatherOccupation: value }))}
          editable={isEditing}
          placeholder={t('hintEgFatherOccupation')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldMotherName')}
          value={matrimony.motherName || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, motherName: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldMotherOccupation')}
          value={matrimony.motherOccupation || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, motherOccupation: value }))}
          editable={isEditing}
          placeholder={t('hintEgMotherOccupation')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldSiblings')}
          value={matrimony.siblings || ''}
          onChangeText={(value) => setMatrimony((prev) => ({ ...prev, siblings: value }))}
          editable={isEditing}
          placeholder={t('hintEgSiblings')}
          styles={styles}
        />
      </SectionCard>

      {/* Eating Habits from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secEatingHabits')}</Text>
        <LabeledSelect
          label={t('fldEatingHabit')}
          value={profile.eatingHabit}
          options={asOptions(EATING_HABITS)}
          editable={isEditing}
          onSelect={(value) => setProfile((prev) => ({ ...prev, eatingHabit: value }))}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Horoscope Details from Signup */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secHoroscope')}</Text>
        <LabeledInput
          label={t('fldBirthTime')}
          value={profile.horoscopeTime || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, horoscopeTime: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
        <LabeledInput
          label={t('fldBirthPlace')}
          value={profile.horoscopePlace || ''}
          onChangeText={(value) => setProfile((prev) => ({ ...prev, horoscopePlace: value }))}
          editable={isEditing}
          placeholder={t('lblNotSet')}
          styles={styles}
        />
      </SectionCard>

      {/* Photos */}
      <SectionCard>
        <Text style={styles.sectionTitle}>{t('secPhotos')}</Text>
        <PhotoManager
          photos={(profile.photos || []).filter((p: any) => p.status === 'done')}
          editable={isEditing}
          maxPhotos={2}
          onChange={(updated: Photo[]) => setProfile((prev) => ({ ...prev, photos: updated }))}
        />
        {!isEditing && (!profile.photos || profile.photos.filter((p: any) => p.status === 'done').length === 0) && (
          <Text style={styles.noPhotosText}>{t('phEmpty')}</Text>
        )}
      </SectionCard>

      </KeyboardScrollContext.Provider>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: palette.muted },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  editBannerText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: palette.text },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  cardTitle: {
    ...type.body,
    fontWeight: '700',
    color: palette.text,
  },
  sectionTitle: {
    ...type.h2,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  fieldGroup: {
    marginBottom: spacing.sm,
  },
  fieldHint: { fontSize: 13, lineHeight: 19, marginTop: -2, marginBottom: 10 },
  fieldLabel: {
    ...type.caption,
    color: palette.muted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    // Sunken, not the card's own surface, so a field still reads as a field
    // in dark mode, where card and input were the same colour.
    backgroundColor: palette.surfaceSunken,
    borderColor: palette.borderStrong,
    borderWidth: 1,
    color: palette.text,
    fontSize: 15,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  placeholder: { color: palette.muted },
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
    backgroundColor: palette.surfaceSunken,
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
