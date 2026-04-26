import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { MatrimonyFilterOptions, MatrimonyProfile } from '../types';

type MatchTab = 'all' | 'shortlisted' | 'viewed' | 'locked';

const TAB_CONFIG: Array<{ key: MatchTab; label: string }> = [
  { key: 'all', label: 'All Matches' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'locked', label: 'Locked' },
];

const EMPTY_OPTIONS: MatrimonyFilterOptions = {
  locations: [],
  communities: [],
  subCommunities: [],
  genders: [],
  educations: [],
  occupations: [],
  maritalStatuses: [],
  languages: [],
};

interface FilterState {
  location: string;
  community: string;
  subCommunity: string;
  gender: string;
  education: string;
  occupation: string;
  maritalStatus: string;
  language: string;
  minAge: string;
  maxAge: string;
}

const INITIAL_FILTERS: FilterState = {
  location: '',
  community: '',
  subCommunity: '',
  gender: '',
  education: '',
  occupation: '',
  maritalStatus: '',
  language: '',
  minAge: '',
  maxAge: '',
};

function FilterChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FilterSection({
  title,
  allLabel,
  selectedValue,
  options,
  onSelect,
  styles,
}: {
  title: string;
  allLabel: string;
  selectedValue: string;
  options: string[];
  onSelect: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
        <FilterChip label={allLabel} active={!selectedValue} onPress={() => onSelect('')} styles={styles} />
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            active={selectedValue === option}
            onPress={() => onSelect(option)}
            styles={styles}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function MatrimonyScreen() {
  const { palette } = useAppTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [tab, setTab] = useState<MatchTab>('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState<MatrimonyFilterOptions>(EMPTY_OPTIONS);
  const [profiles, setProfiles] = useState<MatrimonyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const appliedFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value).trim() !== '').length,
    [filters],
  );

  const loadProfiles = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getMatrimonyProfiles({
        tab,
        search,
        location: filters.location,
        community: filters.community,
        subCommunity: filters.subCommunity,
        gender: filters.gender,
        education: filters.education,
        occupation: filters.occupation,
        maritalStatus: filters.maritalStatus,
        language: filters.language,
        minAge: filters.minAge,
        maxAge: filters.maxAge,
      });
      setProfiles(response.profiles || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, search, tab]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await api.getMatrimonyFilterOptions();
        setFilterOptions(options || EMPTY_OPTIONS);
      } catch (_err) {
        setFilterOptions(EMPTY_OPTIONS);
      }
    };

    loadOptions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfiles();
  };

  const runAction = async (profileId: string, action: 'shortlist' | 'view' | 'unlock') => {
    try {
      setActionProfileId(profileId);
      if (action === 'shortlist') {
        await api.toggleMatrimonyShortlist(profileId);
      } else if (action === 'view') {
        await api.markMatrimonyViewed(profileId);
      } else {
        await api.unlockMatrimonyProfile(profileId);
      }
      await loadProfiles();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionProfileId(null);
    }
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearch('');
  };

  if (loading) {
    return <ScreenLoader message="Loading matches..." />;
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Matrimony</Text>
          <Text style={styles.subtitle}>Compatibility list with backend filters and actions.</Text>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, location, bio"
          style={styles.searchInput}
          returnKeyType="search"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TAB_CONFIG.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key ? styles.tabActive : null]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.filterActionsRow}>
          <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
            <Text style={styles.filterButtonText}>Filters {appliedFilterCount ? `(${appliedFilterCount})` : ''}</Text>
          </Pressable>
          <Pressable style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        </View>

        {error ? <InlineError message={error} /> : null}

        {profiles.length === 0 ? (
          <EmptyState
            title="No matches found"
            subtitle="Adjust filters or create more user profiles to see matches."
            actionLabel="Reset Filters"
            onAction={clearFilters}
          />
        ) : null}

        {profiles.map((profile) => (
          <View key={profile.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.score}>{profile.compatibilityScore}%</Text>
            </View>
            <Text style={styles.meta}>
              {profile.age} • {profile.gender || 'N/A'} • {profile.location}
            </Text>
            <Text style={styles.meta}>
              {profile.community}
              {profile.subCommunity ? ` • ${profile.subCommunity}` : ''}
            </Text>
            <Text style={styles.meta}>{profile.education || 'Education not added'} • {profile.occupation || 'Occupation not added'}</Text>
            <Text style={styles.bio}>{profile.bio || 'No bio added yet.'}</Text>

            <View style={styles.actionRow}>
              <Pressable
                style={styles.secondaryAction}
                onPress={() => runAction(profile.id, 'view')}
                disabled={actionProfileId === profile.id}
              >
                <Text style={styles.secondaryActionText}>View</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryAction}
                onPress={() => runAction(profile.id, 'shortlist')}
                disabled={actionProfileId === profile.id}
              >
                <Text style={styles.secondaryActionText}>{profile.isShortlisted ? 'Unshortlist' : 'Shortlist'}</Text>
              </Pressable>
              {!profile.isUnlocked ? (
                <Pressable
                  style={styles.primaryAction}
                  onPress={() => runAction(profile.id, 'unlock')}
                  disabled={actionProfileId === profile.id}
                >
                  <Text style={styles.primaryActionText}>Unlock</Text>
                </Pressable>
              ) : (
                <View style={styles.unlockedPill}>
                  <Text style={styles.unlockedText}>Unlocked</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={filterModalVisible} animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Matrimony Filters</Text>
            <Pressable onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.ageRow}>
              <View style={styles.ageFieldWrap}>
                <Text style={styles.ageLabel}>Min Age</Text>
                <TextInput
                  value={filters.minAge}
                  onChangeText={(value) => setFilters((prev) => ({ ...prev, minAge: value.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  style={styles.ageInput}
                  placeholder="18"
                />
              </View>
              <View style={styles.ageFieldWrap}>
                <Text style={styles.ageLabel}>Max Age</Text>
                <TextInput
                  value={filters.maxAge}
                  onChangeText={(value) => setFilters((prev) => ({ ...prev, maxAge: value.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  style={styles.ageInput}
                  placeholder="60"
                />
              </View>
            </View>

            <FilterSection
              title="Location"
              allLabel="All Locations"
              selectedValue={filters.location}
              options={filterOptions.locations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, location: value }))}
              styles={styles}
            />
            <FilterSection
              title="Community"
              allLabel="All Communities"
              selectedValue={filters.community}
              options={filterOptions.communities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, community: value }))}
              styles={styles}
            />
            <FilterSection
              title="Sub Community"
              allLabel="All Sub Communities"
              selectedValue={filters.subCommunity}
              options={filterOptions.subCommunities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, subCommunity: value }))}
              styles={styles}
            />
            <FilterSection
              title="Gender"
              allLabel="All Genders"
              selectedValue={filters.gender}
              options={filterOptions.genders}
              onSelect={(value) => setFilters((prev) => ({ ...prev, gender: value }))}
              styles={styles}
            />
            <FilterSection
              title="Education"
              allLabel="All Education"
              selectedValue={filters.education}
              options={filterOptions.educations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, education: value }))}
              styles={styles}
            />
            <FilterSection
              title="Occupation"
              allLabel="All Occupations"
              selectedValue={filters.occupation}
              options={filterOptions.occupations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, occupation: value }))}
              styles={styles}
            />
            <FilterSection
              title="Marital Status"
              allLabel="All Status"
              selectedValue={filters.maritalStatus}
              options={filterOptions.maritalStatuses}
              onSelect={(value) => setFilters((prev) => ({ ...prev, maritalStatus: value }))}
              styles={styles}
            />
            <FilterSection
              title="Language"
              allLabel="All Languages"
              selectedValue={filters.language}
              options={filterOptions.languages}
              onSelect={(value) => setFilters((prev) => ({ ...prev, language: value }))}
              styles={styles}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    color: palette.muted,
    marginTop: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: palette.text,
  },
  tabRow: {
    gap: 8,
    paddingVertical: 2,
  },
  tab: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    backgroundColor: palette.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  tabText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: palette.primary,
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: palette.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButtonText: {
    color: palette.surface,
    fontWeight: '700',
  },
  clearButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  clearButtonText: {
    color: palette.accent,
    fontWeight: '700',
  },
  error: {
    color: palette.danger,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 14,
  },
  emptyTitle: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtitle: {
    color: palette.muted,
    marginTop: 6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  score: {
    color: palette.primary,
    fontWeight: '800',
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
  },
  bio: {
    color: palette.accent,
    marginTop: 2,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  secondaryAction: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: palette.surface,
  },
  secondaryActionText: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryAction: {
    borderRadius: 8,
    backgroundColor: palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: palette.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  unlockedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.primary,
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: palette.primarySoft,
  },
  unlockedText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  modalPage: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
  },
  modalTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 18,
  },
  modalClose: {
    color: palette.primary,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  ageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ageFieldWrap: {
    flex: 1,
    gap: 6,
  },
  ageLabel: {
    color: palette.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  ageInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterSection: {
    gap: 8,
  },
  filterSectionTitle: {
    color: palette.text,
    fontWeight: '700',
  },
  filterChipRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    backgroundColor: palette.surface,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  filterChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  filterChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: palette.primary,
  },
  });
}
