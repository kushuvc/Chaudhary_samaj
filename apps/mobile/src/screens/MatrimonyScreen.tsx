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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
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
}: {
  title: string;
  allLabel: string;
  selectedValue: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
        <FilterChip label={allLabel} active={!selectedValue} onPress={() => onSelect('')} />
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            active={selectedValue === option}
            onPress={() => onSelect(option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function MatrimonyScreen() {
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
            />
            <FilterSection
              title="Community"
              allLabel="All Communities"
              selectedValue={filters.community}
              options={filterOptions.communities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, community: value }))}
            />
            <FilterSection
              title="Sub Community"
              allLabel="All Sub Communities"
              selectedValue={filters.subCommunity}
              options={filterOptions.subCommunities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, subCommunity: value }))}
            />
            <FilterSection
              title="Gender"
              allLabel="All Genders"
              selectedValue={filters.gender}
              options={filterOptions.genders}
              onSelect={(value) => setFilters((prev) => ({ ...prev, gender: value }))}
            />
            <FilterSection
              title="Education"
              allLabel="All Education"
              selectedValue={filters.education}
              options={filterOptions.educations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, education: value }))}
            />
            <FilterSection
              title="Occupation"
              allLabel="All Occupations"
              selectedValue={filters.occupation}
              options={filterOptions.occupations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, occupation: value }))}
            />
            <FilterSection
              title="Marital Status"
              allLabel="All Status"
              selectedValue={filters.maritalStatus}
              options={filterOptions.maritalStatuses}
              onSelect={(value) => setFilters((prev) => ({ ...prev, maritalStatus: value }))}
            />
            <FilterSection
              title="Language"
              allLabel="All Languages"
              selectedValue={filters.language}
              options={filterOptions.languages}
              onSelect={(value) => setFilters((prev) => ({ ...prev, language: value }))}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginTop: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0f172a',
  },
  tabRow: {
    gap: 8,
    paddingVertical: 2,
  },
  tab: {
    borderWidth: 1,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#0f766e',
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#f0fdfa',
    fontWeight: '700',
  },
  clearButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  clearButtonText: {
    color: '#334155',
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 14,
  },
  emptyTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtitle: {
    color: '#64748b',
    marginTop: 6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  score: {
    color: '#0f766e',
    fontWeight: '800',
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  bio: {
    color: '#334155',
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
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  secondaryActionText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryAction: {
    borderRadius: 8,
    backgroundColor: '#115e59',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: '#ecfeff',
    fontWeight: '700',
    fontSize: 12,
  },
  unlockedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0f766e',
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: '#f0fdfa',
  },
  unlockedText: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 12,
  },
  modalPage: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  modalTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18,
  },
  modalClose: {
    color: '#0f766e',
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
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  ageInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterSection: {
    gap: 8,
  },
  filterSectionTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  filterChipRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  filterChipActive: {
    borderColor: '#115e59',
    backgroundColor: '#ccfbf1',
  },
  filterChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#134e4a',
  },
});
