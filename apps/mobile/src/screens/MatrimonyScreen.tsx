import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { MatrimonyProfileDetailScreen } from './MatrimonyProfileDetailScreen';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { MatrimonyFilterOptions, MatrimonyProfile } from '../types';

type MatchTab = 'all' | 'newlyJoined' | 'more';
type MembershipType = 'regular' | 'prime';

const TAB_CONFIG: Array<{ key: MatchTab; label: string }> = [
  { key: 'all', label: 'All matches' },
  { key: 'newlyJoined', label: 'Newly joined' },
  { key: 'more', label: 'More' },
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
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [tab, setTab] = useState<MatchTab>('all');
  const [membership, setMembership] = useState<MembershipType>('regular');
  const [search, setSearch] = useState('');
  const [interestsMap, setInterestsMap] = useState<Record<string, 'sent' | 'received' | 'mutual'>>({});
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState<MatrimonyFilterOptions>(EMPTY_OPTIONS);
  const [profiles, setProfiles] = useState<MatrimonyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [profileDetailVisible, setProfileDetailVisible] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const appliedFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value).trim() !== '').length,
    [filters],
  );

  const loadInterests = useCallback(async () => {
    try {
      const data = await api.getMyInterests();
      const map: Record<string, 'sent' | 'received' | 'mutual'> = {};
      data.sent.forEach(i => { if (i.status === 'pending') map[i.profileId] = 'sent'; });
      data.received.forEach(i => { 
        if (i.status === 'accepted') map[i.profileId] = 'mutual';
        else if (i.status === 'pending') map[i.profileId] = 'received';
      });
      setInterestsMap(map);
    } catch (e) {
      // ignore
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getMatrimonyProfiles({
        tab: tab === 'more' ? 'all' : tab,
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
      await loadInterests();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, search, tab, loadInterests]);

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
    return <ScreenLoader message={t('loadingMatches')} />;
  }

  const tabLabel = (key: MatchTab) => {
    if (key === 'all') return 'All matches';
    if (key === 'newlyJoined') return 'Newly joined';
    return 'More';
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {/* Membership Toggle */}
        <View style={styles.membershipToggle}>
          <Pressable
            style={[styles.membershipButton, membership === 'regular' && styles.membershipActive]}
            onPress={() => setMembership('regular')}
          >
            <Text style={[styles.membershipText, membership === 'regular' && styles.membershipTextActive]}>
              Regular
            </Text>
          </Pressable>
          <Pressable
            style={[styles.membershipButton, membership === 'prime' && styles.membershipPrimeActive]}
            onPress={() => {
              Alert.alert('PRIME Membership', 'Upgrade to PRIME for exclusive benefits!');
              setMembership('prime');
            }}
          >
            <Text style={[styles.membershipText, membership === 'prime' && styles.membershipTextActive]}>
              PRIME
            </Text>
            <View style={styles.primeDot} />
          </Pressable>
        </View>

        {/* Match Count */}
        <Text style={styles.matchCount}>{profiles.length} Matches based on your <Text style={styles.preferencesHighlight}>preferences</Text></Text>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
          <Pressable style={styles.filterChipMain} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={16} color={palette.text} />
            <Text style={styles.filterChipMainText}>Filter</Text>
          </Pressable>
          <Pressable style={styles.filterChipMain}>
            <Text style={styles.filterChipMainText}>Sort by</Text>
            <Ionicons name="chevron-down" size={16} color={palette.text} />
          </Pressable>
          <Pressable style={styles.filterChipMain}>
            <Text style={styles.filterChipMainText}>Newly joined</Text>
          </Pressable>
          <Pressable style={[styles.filterChipMain, styles.notMatchChip]}>
            <Text style={[styles.filterChipMainText, styles.notMatchText]}>Not matches</Text>
          </Pressable>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TAB_CONFIG.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key ? styles.tabActive : null]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>{tabLabel(item.key)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.filterActionsRow}>
          <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
            <Text style={styles.filterButtonText}>{t('filtersLabel')} {appliedFilterCount ? `(${appliedFilterCount})` : ''}</Text>
          </Pressable>
          <Pressable style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>{t('clear')}</Text>
          </Pressable>
        </View>

        {error ? <InlineError message={error} /> : null}

        {profiles.length === 0 ? (
          <EmptyState
            title={t('noMatchesFound')}
            subtitle={t('noMatchesSubtitle')}
            actionLabel={t('resetFilters')}
            onAction={clearFilters}
          />
        ) : null}

        {profiles.map((profile) => {
          const interestStatus = interestsMap[profile.id];
          return (
            <View key={profile.id} style={styles.newCard}>
              {/* Profile Image Area */}
              <View style={styles.imageContainer}>
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={80} color={palette.muted} />
                </View>
                <Pressable style={styles.shortlistButton} onPress={() => runAction(profile.id, 'shortlist')}>
                  <Ionicons name={profile.isShortlisted ? "bookmark" : "bookmark-outline"} size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Info Section */}
              <View style={styles.infoSection}>
                <View style={styles.nameRow}>
                  <Text style={styles.newName}>{profile.name}</Text>
                  <View style={styles.contactButtons}>
                    <Pressable style={styles.iconButton}>
                      <Ionicons name="call-outline" size={20} color="#E53935" />
                    </Pressable>
                    <Pressable style={styles.iconButton}>
                      <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.profileId}>PTL{profile.id.slice(-6)} • Last seen recently</Text>

                <Text style={styles.details}>
                  {profile.age} Yrs • {profile.height || "4'9\""} • {profile.education || 'M.Com'} • {profile.occupation || 'Accounts / Finance Professional'} • {profile.location}
                </Text>

                {/* Interest Status */}
                {interestStatus === 'sent' && (
                  <Text style={styles.interestStatus}>You sent an interest • {new Date().toLocaleDateString()}</Text>
                )}
                {interestStatus === 'mutual' && (
                  <Text style={styles.mutualStatus}>🎉 Mutual interest! You can now chat</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.newActionRow}>
                <Pressable style={styles.callNowButton}>
                  <Ionicons name="call" size={16} color="#E53935" />
                  <Text style={styles.callNowText}>Call Now</Text>
                </Pressable>
                <Pressable 
                  style={styles.sendMessageButton}
                  onPress={() => {
                    setSelectedProfileId(profile.id);
                    setProfileDetailVisible(true);
                  }}
                >
                  <Ionicons name="mail" size={16} color="#FFFFFF" />
                  <Text style={styles.sendMessageText}>Send Message</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Profile Detail Modal */}
      <Modal visible={profileDetailVisible} animationType="slide" onRequestClose={() => setProfileDetailVisible(false)}>
        {selectedProfileId && (
          <MatrimonyProfileDetailScreen
            profileId={selectedProfileId}
            onBack={() => setProfileDetailVisible(false)}
          />
        )}
      </Modal>

      <Modal visible={filterModalVisible} animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('matrimonyFilters')}</Text>
            <Pressable onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.modalClose}>{t('done')}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.ageRow}>
              <View style={styles.ageFieldWrap}>
                <Text style={styles.ageLabel}>{t('minAge')}</Text>
                <TextInput
                  value={filters.minAge}
                  onChangeText={(value) => setFilters((prev) => ({ ...prev, minAge: value.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  style={styles.ageInput}
                  placeholder="18"
                />
              </View>
              <View style={styles.ageFieldWrap}>
                <Text style={styles.ageLabel}>{t('maxAge')}</Text>
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
              title={t('locationLabel')}
              allLabel={t('allLocations')}
              selectedValue={filters.location}
              options={filterOptions.locations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, location: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('community')}
              allLabel={t('allCommunities')}
              selectedValue={filters.community}
              options={filterOptions.communities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, community: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('subCommunityLabel')}
              allLabel={t('allSubCommunities')}
              selectedValue={filters.subCommunity}
              options={filterOptions.subCommunities}
              onSelect={(value) => setFilters((prev) => ({ ...prev, subCommunity: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('genderLabel')}
              allLabel={t('allGenders')}
              selectedValue={filters.gender}
              options={filterOptions.genders}
              onSelect={(value) => setFilters((prev) => ({ ...prev, gender: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('educationLabel')}
              allLabel={t('allEducation')}
              selectedValue={filters.education}
              options={filterOptions.educations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, education: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('occupationLabel')}
              allLabel={t('allOccupations')}
              selectedValue={filters.occupation}
              options={filterOptions.occupations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, occupation: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('maritalStatusLabel')}
              allLabel={t('allStatus')}
              selectedValue={filters.maritalStatus}
              options={filterOptions.maritalStatuses}
              onSelect={(value) => setFilters((prev) => ({ ...prev, maritalStatus: value }))}
              styles={styles}
            />
            <FilterSection
              title={t('languageFieldLabel')}
              allLabel={t('allLanguages')}
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
  membershipToggle: {
    flexDirection: 'row',
    backgroundColor: palette.cardBg,
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    alignSelf: 'center',
  },
  membershipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  membershipActive: {
    backgroundColor: '#E53935',
  },
  membershipPrimeActive: {
    backgroundColor: '#FFD700',
  },
  membershipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  membershipTextActive: {
    color: '#FFFFFF',
  },
  primeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E53935',
    marginLeft: 6,
  },
  matchCount: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: 12,
    textAlign: 'center',
  },
  preferencesHighlight: {
    color: '#E53935',
    fontWeight: '600',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cardBg,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipMainText: {
    fontSize: 13,
    color: palette.text,
  },
  notMatchChip: {
    borderColor: palette.muted,
  },
  notMatchText: {
    color: palette.muted,
  },
  // New card styles
  newCard: {
    backgroundColor: palette.cardBg,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: palette.border,
  },
  profileImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortlistButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  newName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileId: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 8,
  },
  details: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  interestStatus: {
    fontSize: 13,
    color: palette.primary,
    fontStyle: 'italic',
  },
  mutualStatus: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  newActionRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  callNowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: '#E53935',
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  callNowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  sendMessageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  sendMessageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  });
}
