import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { optionLabel } from '../constants/optionTranslations';
import { MatrimonyArt } from '../components/MatrimonyArt';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { MatrimonyFilterOptions, MatrimonyProfile } from '../types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInView } from '../components/Motion';
import { VerifiedBadge } from '../components/VerifiedBadge';

/*
 * "More" listed exactly the same profiles as "All" — it mapped to the same
 * server tab — so it was a third way to see the first screen. Replaced with
 * Shortlisted, which the bookmark on every card has been writing to all
 * along with nowhere to read it back.
 */
type MatchTab = 'all' | 'newlyJoined' | 'shortlisted';

const TAB_CONFIG: Array<{ key: MatchTab; labelKey: string }> = [
  { key: 'all', labelKey: 'matchTabAll' },
  { key: 'newlyJoined', labelKey: 'matchTabNewlyJoined' },
  { key: 'shortlisted', labelKey: 'matchTabShortlisted' },
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
  /** '1' to show only Aadhaar-verified members. A string so the applied-filter count treats it like the rest. */
  verifiedOnly: '' | '1';
}

const INITIAL_FILTERS: FilterState = {
  gender: '',
  education: '',
  minAge: '',
  maxAge: '',
  sortBy: '',
  verifiedOnly: '',
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
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
  const { t, language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [tab, setTab] = useState<MatchTab>('all');
  const [search, setSearch] = useState('');
  const [interestsMap, setInterestsMap] = useState<Record<string, 'sent' | 'received' | 'mutual' | 'accepted'>>({});
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState<MatrimonyFilterOptions>(EMPTY_OPTIONS);
  const [profiles, setProfiles] = useState<MatrimonyProfile[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [profileDetailVisible, setProfileDetailVisible] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [shownNumbers, setShownNumbers] = useState<Record<string, string | null>>({});
  const [sendingInterest, setSendingInterest] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

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
        tab,
        search,
        gender: filters.gender,
        education: filters.education,
        minAge: filters.minAge,
        maxAge: filters.maxAge,
        sortBy: filters.sortBy,
        verifiedOnly: filters.verifiedOnly,
      });
      setProfiles(response.profiles || []);
      setTotalMatches(response.total);
      setHasMore(response.hasMore);
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

  /** Fetch the next page and append it. Guarded so a fast scroll cannot stack requests. */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const response = await api.getMatrimonyProfiles({
        tab,
        search,
        gender: filters.gender,
        education: filters.education,
        minAge: filters.minAge,
        maxAge: filters.maxAge,
        sortBy: filters.sortBy,
        verifiedOnly: filters.verifiedOnly,
        offset: profiles.length,
      });
      setProfiles((current) => [...current, ...(response.profiles || [])]);
      setTotalMatches(response.total);
      setHasMore(response.hasMore);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, profiles.length, tab, search, filters]);

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

  /**
   * Shortlisting is one tap and should feel like one.
   *
   * It used to pop a modal alert and then reload the whole list, so saving
   * someone cost a dismissed dialog and a visible reflow. The bookmark now
   * flips immediately and the request settles behind it; a failure puts the
   * bookmark back and says so, which is the only case worth interrupting for.
   */
  const toggleShortlist = async (profileId: string) => {
    const wasShortlisted = Boolean(profiles.find((p) => p.id === profileId)?.isShortlisted);
    const flip = (value: boolean) =>
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isShortlisted: value } : p)),
      );

    flip(!wasShortlisted);
    try {
      await api.toggleMatrimonyShortlist(profileId);
      // On the shortlist tab itself, un-saving someone should take them out of
      // the list rather than leave a hollow bookmark behind.
      if (tab === 'shortlisted' && wasShortlisted) {
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
        // Keep the "N matches" heading honest — dropping the card without
        // this left the count one ahead of the list.
        setTotalMatches((prev) => Math.max(prev - 1, 0));
      }
    } catch (err) {
      flip(wasShortlisted);
      showAlert(t('mmActionFailed'), (err as Error).message || t('alertSomethingWrong'));
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
    if (key === 'all') return t('matchTabAll');
    if (key === 'newlyJoined') return t('matchTabNewlyJoined');
    return t('matchTabShortlisted');
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
          // Start the next page before the user reaches the end, so the list
          // does not visibly stall at the bottom.
          if (distanceFromBottom < 600) {
            void loadMore();
          }
        }}
      >
        <MatrimonyArt
          scene="matches"
          title={t('matrimony')}
          subtitle={t('matrimonyArtSub')}
          style={{ marginBottom: 12 }}
        />

        <View style={styles.headerBlock}>
          <Text style={styles.matchCount}>
            {t(totalMatches === 1 ? 'matchCountOne' : 'matchCountMany', { count: totalMatches })}
          </Text>
        </View>

        {/* View tabs. These switch which set of profiles is listed. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TAB_CONFIG.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key ? styles.tabActive : null]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>
                {tabLabel(item.key)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Refinement controls. Kept to one row: everything here opens the
            filter sheet or clears it, so there is a single place to look. */}
        <View style={styles.filterBar}>
          <Pressable
            style={[styles.filterAction, appliedFilterCount > 0 ? styles.filterActionActive : null]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={appliedFilterCount > 0 ? '#FFFFFF' : palette.text}
            />
            <Text
              style={[
                styles.filterActionText,
                appliedFilterCount > 0 ? styles.filterActionTextActive : null,
              ]}
            >
              {t('filtersLabel')}
            </Text>
            {appliedFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{appliedFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            style={[styles.filterAction, filters.sortBy ? styles.filterActionActive : null]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Text
              style={[styles.filterActionText, filters.sortBy ? styles.filterActionTextActive : null]}
            >
              {filters.sortBy ? t(filters.sortBy === 'name' ? 'sortByName' : 'sortByAge') : t('sortLabel')}
            </Text>
            <Ionicons
              name="chevron-down"
              size={15}
              color={filters.sortBy ? '#FFFFFF' : palette.text}
            />
          </Pressable>

          {appliedFilterCount > 0 || search ? (
            <Pressable style={styles.clearAction} onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearActionText}>{t('clear')}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <InlineError message={error} /> : null}

        {profiles.length === 0 ? (
          tab === 'shortlisted' ? (
            // "No matches found — adjust your filters" is wrong here: nothing
            // is filtered out, the member simply has not saved anyone yet.
            <EmptyState
              title={t('shortlistEmptyTitle')}
              subtitle={t('shortlistEmptyBody')}
              actionLabel={t('matchTabAll')}
              onAction={() => setTab('all')}
            />
          ) : (
            <EmptyState
              title={t('noMatchesFound')}
              subtitle={t('noMatchesSubtitle')}
              actionLabel={t('resetFilters')}
              onAction={clearFilters}
            />
          )
        ) : null}

        {profiles.map((profile, index) => {
          const interestStatus = interestsMap[profile.id];
          // The server decides this and omits the data for locked profiles;
          // recomputing it from list position here would only ever disagree.
          const isLocked = Boolean(profile.isLocked);
          // Get primary photo or first available photo
          const primaryPhoto = profile.photos?.find(p => p.status === 'done' && p.isPrimary)
            || profile.photos?.find(p => p.status === 'done')
            || null;
          if (isLocked) {
            return (
              <FadeInView key={profile.id} index={index}>
              <View style={[styles.newCard, { overflow: 'hidden' }]}>
                {/* Blurred locked overlay */}
                <View style={styles.lockedOverlay}>
                  <Ionicons name="lock-closed" size={36} color="#FFFFFF" />
                  <Text style={styles.lockedTitle}>{t('actSubscribeToView')}</Text>
                  <Text style={styles.lockedSubtitle}>₹200/month — Unlimited profiles</Text>
                  <Pressable
                    style={styles.lockedButton}
                    onPress={() => navigation.navigate('Subscriptions')}
                  >
                    <Text style={styles.lockedButtonText}>{t('actGetFullAccess')}</Text>
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
                    <Text style={styles.details}>{`•• ${t('yearsShort')} • ••••• • ••••••`}</Text>
                  </View>
                </View>
              </View>
              </FadeInView>
            );
          }
          return (
            <FadeInView key={profile.id} index={index}>
            <View style={styles.newCard}>
              {/* Profile Image Area */}
              <Pressable style={styles.imageContainer} onPress={() => { setSelectedProfileId(profile.id); setProfileDetailVisible(true); }}>
                {primaryPhoto?.uri ? (
                  <Image source={{ uri: primaryPhoto.uri }} style={styles.profileImage} />
                ) : profile.photosHidden ? (
                  // Photo privacy: the server withheld the photos until an
                  // interest is accepted. Say so, rather than look photo-less.
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="eye-off-outline" size={44} color={palette.muted} />
                    <Text style={{ color: palette.muted, marginTop: 8, paddingHorizontal: 24, textAlign: 'center', fontSize: 13 }}>
                      {t('photoAfterAccept')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Ionicons name="person" size={80} color={palette.muted} />
                  </View>
                )}
                <Pressable style={styles.shortlistButton} onPress={() => void toggleShortlist(profile.id)}>
                  <Ionicons name={profile.isShortlisted ? "bookmark" : "bookmark-outline"} size={20} color="#FFFFFF" />
                </Pressable>
              </Pressable>

              {/* Info Section */}
              <View style={styles.infoSection}>
                <View style={styles.nameRow}>
                  <Text style={[styles.newName, { flex: 0, flexShrink: 1 }]}>{profile.name}</Text>
                  {profile.idVerified ? <VerifiedBadge compact /> : null}
                </View>

                <Text style={styles.profileId}>PTL{profile.id.slice(-6)} • {t('lastSeenRecently')}</Text>

                <Text style={styles.details}>
                  {profile.age} {t('yearsShort')} • {profile.height || "4'9\""} •{' '}
                  {optionLabel(profile.education || 'M.Com', language)} •{' '}
                  {optionLabel(profile.occupation || 'Accounts / Finance Professional', language)} •{' '}
                  {optionLabel(profile.location || '', language)}
                </Text>

                {/* Interest Status */}
                {interestStatus === 'sent' && (
                  <Text style={styles.interestStatus}>{t('interestSentOn', { date: new Date().toLocaleDateString() })}</Text>
                )}
                {interestStatus === 'mutual' && (
                  <Text style={styles.mutualStatus}>{t('mutualInterest')}</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.newActionRow}>
                <Pressable
                  style={styles.showNumberButton}
                  onPress={() => {
                    if (shownNumbers[profile.id] !== undefined) {
                      const num = shownNumbers[profile.id];
                      showAlert(t('mmPhoneNumber'), num ? num : t('mpNoPhoneAdded'));
                    } else {
                      // The number comes back from the server, which is the
                      // only place that knows whether this member's plan and
                      // this pairing's interest allow it. The card payload
                      // never carries it.
                      api.unlockPhoneNumber(profile.id)
                        .then(({ phone }) => {
                          setShownNumbers(prev => ({ ...prev, [profile.id]: phone }));
                          showAlert(
                            t('mmPhoneNumber'),
                            phone
                              ? phone
                              : t('mpNoPhoneAddedYet')
                          );
                        })
                        .catch((err: Error) => {
                          showAlert(t('mpUnableShowNumber'), err.message || t('alertSomethingWrong'));
                        });
                    }
                  }}
                >
                  <Ionicons name="eye-outline" size={16} color={palette.primary} />
                  <Text style={styles.showNumberText}>{t('actShowNumber')}</Text>
                </Pressable>
                {interestStatus === 'sent' || interestStatus === 'mutual' ? (
                  <View style={[styles.sendMessageButton, styles.sendMessageButtonDisabled]}>
                    <Ionicons name={interestStatus === 'mutual' ? 'heart' : 'checkmark-circle'} size={16} color="#FFFFFF" />
                    <Text style={styles.sendMessageText}>
                      {interestStatus === 'mutual' ? t('stMatched') : t('stInterestSent')}
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
                        showAlert(t('mpInterestSentTitle'), t('mmInterestSentBody'));
                      } catch (err) {
                        const msg = (err as Error).message || '';
                        if (msg.toLowerCase().includes('already')) {
                          setInterestsMap(prev => ({ ...prev, [profile.id]: 'sent' }));
                          showAlert(t('mpAlreadySentTitle'), t('mpAlreadySentBody'));
                        } else {
                          showAlert(t('lblFailed'), msg || t('mmSendInterestFailed'));
                        }
                      } finally {
                        setSendingInterest(null);
                      }
                    }}
                  >
                    <Ionicons name="heart-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.sendMessageText}>
                      {sendingInterest === profile.id ? t('sendingInterest') : t('actSendInterest')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
            </FadeInView>
          );
        })}

        {loadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : null}

        {!hasMore && profiles.length > 0 ? (
          <Text style={styles.listEnd}>
            {totalMatches === 1 ? t('mmOnlyMatch') : t('mmAllMatches', { count: totalMatches })}
          </Text>
        ) : null}
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
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.modalTitle}>{t('matrimonyFilters')}</Text>
            <Pressable onPress={() => setFilterModalVisible(false)} hitSlop={10}>
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
            {/*
              * No gender filter: the server returns only the opposite gender,
              * so the control could only ever select "all of them" or "none".
              */}

            {/* Verified only */}
            <View style={styles.filterSection}>
              <View style={styles.filterChipRow}>
                <FilterChip
                  label={t('verifiedOnlyFilter')}
                  active={filters.verifiedOnly === '1'}
                  onPress={() => setFilters((prev) => ({ ...prev, verifiedOnly: prev.verifiedOnly ? '' : '1' }))}
                  styles={styles}
                />
              </View>
            </View>

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
              <Text style={styles.filterSectionTitle}>{t('lblSortBy')}</Text>
              <View style={styles.filterChipRow}>
                <FilterChip label={t('lblDefault')} active={!filters.sortBy} onPress={() => setFilters(prev => ({ ...prev, sortBy: '' }))} styles={styles} />
                <FilterChip label={t('fldName')} active={filters.sortBy === 'name'} onPress={() => setFilters(prev => ({ ...prev, sortBy: 'name' }))} styles={styles} />
                <FilterChip label={t('fldAge')} active={filters.sortBy === 'age'} onPress={() => setFilters(prev => ({ ...prev, sortBy: 'age' }))} styles={styles} />
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
    // Trailing space so the last chip clears the screen edge when scrolled.
    paddingRight: 8,
  },
  tab: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    backgroundColor: palette.surface,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  tabActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  tabText: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: palette.primary,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  filterActionActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterActionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: palette.text,
  },
  filterActionTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  clearAction: {
    marginLeft: 'auto',
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  clearActionText: {
    color: palette.primary,
    fontSize: 13.5,
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
    color: palette.textSoft,
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
    color: palette.textSoft,
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
    // Wrap rather than push "Done" off the screen at large font sizes.
    flexShrink: 1,
    marginRight: 12,
  },
  modalClose: {
    color: palette.primary,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
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
    color: palette.textSoft,
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
    gap: 10,
  },
  filterSectionTitle: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  listEnd: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 13,
    color: palette.muted,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
    paddingRight: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    backgroundColor: palette.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  filterChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  filterChipText: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: palette.primary,
  },
  headerBlock: {
    paddingBottom: 2,
  },
  matchCount: {
    fontSize: 14.5,
    lineHeight: 20,
    color: palette.muted,
  },
  matchCountNumber: {
    color: palette.text,
    fontWeight: '800',
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
    gap: 6,
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
    color: palette.textSoft,
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
    borderColor: palette.primary,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  showNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.primary,
  },
  sendMessageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  sendMessageButtonDisabled: {
    backgroundColor: palette.borderStrong,
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
    // Sits on the dark locked overlay, so it stays light in both themes.
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  lockedButton: {
    marginTop: 6,
    backgroundColor: palette.violet,
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
