import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { MatrimonyProfileDetailScreen } from './MatrimonyProfileDetailScreen';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { MatrimonyFilterOptions, MatrimonyProfile } from '../types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type MatchTab = 'all' | 'newlyJoined' | 'more';

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

type SortBy = '' | 'name' | 'age';

interface FilterState {
  gender: string;
  education: string;
  minAge: string;
  maxAge: string;
  sortBy: SortBy;
}

const INITIAL_FILTERS: FilterState = {
  gender: '',
  education: '',
  minAge: '',
  maxAge: '',
  sortBy: '',
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
  const [search, setSearch] = useState('');
  const [interestsMap, setInterestsMap] = useState<Record<string, 'sent' | 'received' | 'mutual' | 'accepted'>>({});
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
  const [shownNumbers, setShownNumbers] = useState<Record<string, string | null>>({});
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const FREE_PROFILE_LIMIT = 2;

  const appliedFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value).trim() !== '').length,
    [filters],
  );

  const loadInterests = useCallback(async () => {
    try {
      const data = await api.getMyInterests();
      const map: Record<string, 'sent' | 'received' | 'mutual' | 'accepted'> = {}; // eslint-disable-line
      data.sent.forEach(i => {
        if (i.status === 'accepted') map[i.profileId] = 'mutual';
        else if (i.status === 'pending') map[i.profileId] = 'sent';
      });
      data.received.forEach(i => {
        if (i.status === 'accepted') map[i.profileId] = 'mutual';
        else if (i.status === 'pending' && !map[i.profileId]) map[i.profileId] = 'received';
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
        gender: filters.gender,
        education: filters.education,
        minAge: filters.minAge,
        maxAge: filters.maxAge,
        sortBy: filters.sortBy,
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
    api.getSubscriptionStatus().then((s) => setIsSubscribed(s.hasSubscription)).catch(() => {});
  }, []);

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
        const wasShortlisted = profiles.find(p => p.id === profileId)?.isShortlisted;
        await api.toggleMatrimonyShortlist(profileId);
        showAlert(
          wasShortlisted ? 'Removed from Shortlist' : 'Added to Shortlist',
          wasShortlisted ? 'Profile removed from your shortlist.' : 'Profile saved to your shortlist!'
        );
      } else if (action === 'view') {
        await api.markMatrimonyViewed(profileId);
      } else {
        await api.unlockMatrimonyProfile(profileId);
      }
      await loadProfiles();
    } catch (err) {
      showAlert('Action Failed', (err as Error).message || 'Something went wrong. Please try again.');
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
        {/* Tab Row */}
        <Text style={styles.matchCount}>{profiles.length} Matches based on your <Text style={styles.preferencesHighlight}>preferences</Text></Text>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
          <Pressable style={styles.filterChipMain} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={16} color={palette.text} />
            <Text style={styles.filterChipMainText}>Filter</Text>
          </Pressable>
          <Pressable style={[styles.filterChipMain, filters.sortBy ? styles.filterChipMainActive : null]} onPress={() => setFilterModalVisible(true)}>
            <Text style={[styles.filterChipMainText, filters.sortBy ? styles.filterChipMainActiveText : null]}>
              {filters.sortBy ? `Sort: ${filters.sortBy === 'name' ? 'Name' : 'Age'}` : 'Sort by'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={filters.sortBy ? '#FFFFFF' : palette.text} />
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

        {profiles.map((profile, index) => {
          const interestStatus = interestsMap[profile.id];
          const isLocked = !isSubscribed && index >= FREE_PROFILE_LIMIT;
          // Get primary photo or first available photo
          const primaryPhoto = profile.photos?.find(p => p.status === 'done' && p.isPrimary)
            || profile.photos?.find(p => p.status === 'done')
            || null;
          if (isLocked) {
            return (
              <View key={profile.id} style={[styles.newCard, { overflow: 'hidden' }]}>
                {/* Blurred locked overlay */}
                <View style={styles.lockedOverlay}>
                  <Ionicons name="lock-closed" size={36} color="#FFFFFF" />
                  <Text style={styles.lockedTitle}>Subscribe to View</Text>
                  <Text style={styles.lockedSubtitle}>₹200/month — Unlimited profiles</Text>
                  <Pressable
                    style={styles.lockedButton}
                    onPress={() => navigation.navigate('Subscriptions')}
                  >
                    <Text style={styles.lockedButtonText}>Get Full Access</Text>
                  </Pressable>
                </View>
                {/* Blurred background content */}
                <View style={{ opacity: 0.15, pointerEvents: 'none' }}>
                  <View style={[styles.imageContainer, { height: 120 }]}>
                    <View style={styles.profileImagePlaceholder}>
                      <Ionicons name="person" size={60} color="#ccc" />
                    </View>
                  </View>
                  <View style={[styles.infoSection, { gap: 4 }]}>
                    <Text style={styles.newName}>{'••••••••••'}</Text>
                    <Text style={styles.details}>{'•• Yrs • ••••• • ••••••'}</Text>
                  </View>
                </View>
              </View>
            );
          }
          return (
            <View key={profile.id} style={styles.newCard}>
              {/* Profile Image Area */}
              <Pressable style={styles.imageContainer} onPress={() => { setSelectedProfileId(profile.id); setProfileDetailVisible(true); }}>
                {primaryPhoto?.uri ? (
                  <Image source={{ uri: primaryPhoto.uri }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="person" size={80} color={palette.muted} />
                  </View>
                )}
                <Pressable style={styles.shortlistButton} onPress={() => runAction(profile.id, 'shortlist')}>
                  <Ionicons name={profile.isShortlisted ? "bookmark" : "bookmark-outline"} size={20} color="#FFFFFF" />
                </Pressable>
              </Pressable>

              {/* Info Section */}
              <View style={styles.infoSection}>
                <View style={styles.nameRow}>
                  <Text style={styles.newName}>{profile.name}</Text>
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
                <Pressable
                  style={styles.showNumberButton}
                  onPress={() => {
                    if (shownNumbers[profile.id] !== undefined) {
                      const num = shownNumbers[profile.id];
                      showAlert('Phone Number', num ? num : 'This user has not added a phone number.');
                    } else {
                      api.unlockMatrimonyProfile(profile.id)
                        .then(() => {
                          const phone = (profile as any).phone || null;
                          setShownNumbers(prev => ({ ...prev, [profile.id]: phone }));
                          showAlert(
                            'Phone Number',
                            phone
                              ? phone
                              : 'This user has not added a phone number yet.'
                          );
                        })
                        .catch((err: Error) => {
                          showAlert('Unable to Show Number', err.message || 'Something went wrong. Please try again.');
                        });
                    }
                  }}
                >
                  <Ionicons name="eye-outline" size={16} color="#E53935" />
                  <Text style={styles.showNumberText}>Show Number</Text>
                </Pressable>
                {interestStatus === 'sent' || interestStatus === 'mutual' ? (
                  <View style={[styles.sendMessageButton, styles.sendMessageButtonDisabled]}>
                    <Ionicons name={interestStatus === 'mutual' ? 'heart' : 'checkmark-circle'} size={16} color="#FFFFFF" />
                    <Text style={styles.sendMessageText}>
                      {interestStatus === 'mutual' ? 'Matched!' : 'Interest Sent'}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.sendMessageButton, sendingInterest === profile.id && styles.sendMessageButtonDisabled]}
                    disabled={sendingInterest === profile.id}
                    onPress={async () => {
                      try {
                        setSendingInterest(profile.id);
                        await api.sendInterest(profile.id);
                        setInterestsMap(prev => ({ ...prev, [profile.id]: 'sent' }));
                        showAlert('Interest Sent! 💌', `Your interest has been sent successfully.`);
                      } catch (err) {
                        const msg = (err as Error).message || '';
                        if (msg.toLowerCase().includes('already')) {
                          setInterestsMap(prev => ({ ...prev, [profile.id]: 'sent' }));
                          showAlert('Already Sent', 'You have already sent an interest to this profile.');
                        } else {
                          showAlert('Failed', msg || 'Could not send interest. Please try again.');
                        }
                      } finally {
                        setSendingInterest(null);
                      }
                    }}
                  >
                    <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.sendMessageText}>
                      {sendingInterest === profile.id ? 'Sending...' : 'Send Interest'}
                    </Text>
                  </Pressable>
                )}
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
            {/* Age Range */}
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

            {/* Gender */}
            <FilterSection
              title={t('genderLabel')}
              allLabel={t('allGenders')}
              selectedValue={filters.gender}
              options={filterOptions.genders}
              onSelect={(value) => setFilters((prev) => ({ ...prev, gender: value }))}
              styles={styles}
            />

            {/* Education */}
            <FilterSection
              title={t('educationLabel')}
              allLabel={t('allEducation')}
              selectedValue={filters.education}
              options={filterOptions.educations}
              onSelect={(value) => setFilters((prev) => ({ ...prev, education: value }))}
              styles={styles}
            />

            {/* Sort By */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Sort By</Text>
              <View style={styles.filterChipRow}>
                <FilterChip label="Default" active={!filters.sortBy} onPress={() => setFilters(prev => ({ ...prev, sortBy: '' }))} styles={styles} />
                <FilterChip label="Name" active={filters.sortBy === 'name'} onPress={() => setFilters(prev => ({ ...prev, sortBy: 'name' }))} styles={styles} />
                <FilterChip label="Age" active={filters.sortBy === 'age'} onPress={() => setFilters(prev => ({ ...prev, sortBy: 'age' }))} styles={styles} />
              </View>
            </View>
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
  filterChipMainActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterChipMainActiveText: {
    color: '#FFFFFF',
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
    height: 240,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: palette.border,
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
  showNumberButton: {
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
  showNumberText: {
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
  sendMessageButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.85,
  },
  sendMessageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30,30,30,0.82)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 12,
  },
  lockedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 13,
    color: '#e0e0e0',
    textAlign: 'center',
  },
  lockedButton: {
    marginTop: 6,
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  lockedButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  });
}
