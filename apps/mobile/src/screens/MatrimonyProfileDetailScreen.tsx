import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppLanguage } from '../context/LanguageContext';
import { optionLabel } from '../constants/optionTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import { VerifiedBadge } from '../components/VerifiedBadge';
import type { MatrimonyProfile } from '../types';
import { useCapabilities } from '../hooks/useCapabilities';

type InterestStatus = 'none' | 'pending' | 'sent' | 'accepted' | 'declined';

interface ProfileDetail extends MatrimonyProfile {
  phone?: string | null;
  email?: string | null;
  interestStatus?: InterestStatus;
  hasSentInterest?: boolean;
  hasReceivedInterest?: boolean;
  /** Id of the interest this profile sent us, needed to accept or decline it. */
  receivedInterestId?: string | null;
  // Personal Details
  gender?: string | null;
  dateOfBirth?: string | null;
  physicalStatus?: string | null;
  // Religious Details
  religion?: string | null;
  caste?: string | null;
  subCaste?: string | null;
  dosh?: string | null;
  // Location Details
  country?: string | null;
  state?: string | null;
  city?: string | null;
  village?: string | null;
  nativeCity?: string | null;
  nativeVillage?: string | null;
  // Family Details
  familyStatus?: string | null;
  familyType?: string | null;
  familyWealth?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  fatherOccupation?: string | null;
  motherOccupation?: string | null;
  siblings?: string | null;
  // Interests
  hobbies?: string[] | null;
  music?: string[] | null;
  sports?: string[] | null;
  // Lifestyle
  eatingHabit?: string | null;
  // Horoscope
  horoscopeTime?: string | null;
  horoscopePlace?: string | null;
  // Matrimony prefs
  language?: string | null;
  preferredLocation?: string | null;
  preferredEducation?: string | null;
  preferredOccupation?: string | null;
}

interface MatrimonyProfileDetailScreenProps {
  profileId: string;
  onBack: () => void;
}

// Colours come from the active theme: the fixed light palette drew values in
// near-black on the dark card, so only the labels were readable.
function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { language, t } = useAppLanguage();
  const { palette } = useAppTheme();
  const filled = value != null && String(value).trim() !== '';
  return (
    <View style={[infoRowStyle, { borderBottomColor: palette.border }]}>
      <Text style={[infoLabelStyle, { color: palette.muted }]}>{label}</Text>
      <Text style={[infoValueStyle, { color: palette.text }]}>{filled ? optionLabel(String(value), language) : t('lblNotSet')}</Text>
    </View>
  );
}

const infoRowStyle: import('react-native').ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingVertical: 8,
  borderBottomWidth: 1,
};
const infoLabelStyle: import('react-native').TextStyle = {
  fontSize: 14,
  flex: 1,
};
const infoValueStyle: import('react-native').TextStyle = {
  fontSize: 14,
  fontWeight: '500',
  flex: 1,
  textAlign: 'right',
};

export function MatrimonyProfileDetailScreen({ profileId, onBack }: MatrimonyProfileDetailScreenProps) {
  const capabilities = useCapabilities();
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(palette, insets.top), [palette, insets.top]);
  
  const [reportOpen, setReportOpen] = useState(false);
  
  const [reportReason, setReportReason] = useState<string | null>(null);
  
  const [reportDetails, setReportDetails] = useState('');
  
  const [reporting, setReporting] = useState(false);
  
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      const [profileData, interests] = await Promise.all([
        api.getMatrimonyProfileById(profileId),
        api.getMyInterests(),
      ]);

      if (profileData) {
        const sent = interests.sent.find(i => i.profileId === profileId);
        const received = interests.received.find(i => i.profileId === profileId);

        let interestStatus: InterestStatus = 'none';
        if (sent?.status === 'accepted' || received?.status === 'accepted') {
          interestStatus = 'accepted';
        } else if (sent?.status === 'pending') {
          interestStatus = 'sent';
        } else if (received?.status === 'pending') {
          interestStatus = 'pending';
        } else if (sent?.status === 'declined' || received?.status === 'declined') {
          interestStatus = 'declined';
        }

        setProfile({
          ...profileData,
          interestStatus,
          hasSentInterest: !!sent,
          hasReceivedInterest: !!received,
          receivedInterestId: received?.id ?? null,
        });
      } else {
        setError(t('mpProfileNotFound'));
      }
    } catch (err) {
      // A locked profile comes back as 403 rather than a failure — say what it
      // is and what to do, instead of surfacing a raw error string.
      const apiError = err as { code?: string; message?: string; limit?: number };
      setError(
        apiError.code === 'SUBSCRIPTION_REQUIRED'
          ? t('mpSubscribeToView')
          : apiError.code === 'DAILY_VIEW_LIMIT'
            ? t('mpDailyLimit')
            : apiError.message || t('mpCouldNotLoad')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Record the view once per opening. The endpoint existed but nothing called
  // it, so views were never counted and the owner could not be told.
  useEffect(() => {
    void api.markMatrimonyViewed(profileId).catch(() => {});
  }, [profileId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleSendInterest = async () => {
    // Check if feature is premium-locked
    if (!capabilities.canSendInterest) {
      showAlert(t('alertPremiumFeature'), t('mpUpgradeSendInterest'));
      return;
    }

    try {
      setActionLoading(true);
      await api.sendInterest(profileId);
      showAlert(t('mpInterestSentTitle'), t('mpInterestSentBody', { name: profile?.name || t('mpThisProfile') }));
      await loadProfile();
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.toLowerCase().includes('already')) {
        showAlert(t('mpAlreadySentTitle'), t('mpAlreadySentBody'));
      } else {
        showAlert(t('mpSendFailedTitle'), msg || t('alertSomethingWrong'));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const respondToInterest = async (accept: boolean) => {
    const interestId = profile?.receivedInterestId;
    if (!interestId) {
      showAlert(t('mpNothingToRespondTitle'), t('mpNothingToRespondBody'));
      return;
    }

    try {
      setActionLoading(true);
      await api.respondToInterest(interestId, accept);
      showAlert(
        accept ? t('mpInterestAcceptedTitle') : t('mpInterestDeclinedTitle'),
        accept
          ? t('mpInterestAcceptedBody', { name: profile?.name || t('mpThisMember') })
          : t('mpInterestDeclinedBody', { name: profile?.name || t('mpThisMember') })
      );
      await loadProfile();
    } catch (err) {
      showAlert(
        accept ? t('mpCouldNotAccept') : t('mpCouldNotDecline'),
        (err as Error).message || t('alertSomethingWrong')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = () => {
    if (!capabilities.canChat) {
      showAlert(t('alertPremiumFeature'), t('mpUpgradeMessage'));
      return;
    }
    // Chat lives in the Messages tab, which lists every accepted match.
    // Close this modal first, otherwise it stays open over the tab.
    onBack?.();
    navigation.navigate('Messages');
  };

  const handleShowPhoneNumber = async () => {
    const planHasNoNumbers = () => showAlert(t('alertPremiumFeature'), t('mpUpgradePhone'));

    if (!capabilities.canViewPhone) {
      planHasNoNumbers();
      return;
    }

    // Some plans include numbers without a match; those skip the
    // accepted-interest requirement here as they do on the server.
    if (profile?.interestStatus === 'accepted' || capabilities.canViewPhoneUnmatched) {
      /*
       * The number is fetched, not read off the profile. The profile payload
       * has never carried it — the old code read `profile.phone`, always got
       * undefined, and told every member the person had not added one.
       */
      try {
        const { phone } = await api.unlockPhoneNumber(profileId);
        if (phone) {
          showAlert(t('mpPhoneNumberTitle'), phone, [{ text: t('actOk') }]);
        } else {
          showAlert(t('mpNoNumberTitle'), t('mpNoNumberBody', { name: profile?.name || t('mpThisUser') }), [{ text: t('actOk') }]);
        }
      } catch (err) {
        // Each refusal says why, so a member is not told to upgrade when the
        // other person simply chose not to share.
        const code = (err as { code?: string }).code;
        if (code === 'PHONE_HIDDEN') {
          showAlert(
            t('mpPhoneHiddenByOwnerTitle'),
            t('mpPhoneHiddenByOwnerBody', { name: profile?.name || t('mpThisUser') }),
            [{ text: t('actOk') }]
          );
        } else if (code === 'SUBSCRIPTION_REQUIRED' || code === 'PLAN_UPGRADE_REQUIRED') {
          planHasNoNumbers();
        } else if (code === 'INTEREST_REQUIRED') {
          showAlert(t('mpPhoneHiddenTitle'), t('mpPhoneHiddenBody'), [
            { text: t('actCancel'), style: 'cancel' },
            { text: t('actSendInterest'), onPress: handleSendInterest },
          ]);
        } else {
          showAlert(t('mpUnableShowNumber'), (err as Error).message || t('alertSomethingWrong'));
        }
      }
    } else if (profile?.interestStatus === 'sent') {
      showAlert(
        t('mpInterestPendingTitle'),
        t('mpInterestPendingBody'),
        [{ text: t('actOk') }]
      );
    } else if (profile?.interestStatus === 'declined') {
      showAlert(
        t('mpInterestRefusedTitle'),
        t('mpInterestRefusedBody'),
        [{ text: t('actOk') }]
      );
    } else {
      showAlert(
        t('mpPhoneHiddenTitle'),
        t('mpPhoneHiddenBody'),
        [
          { text: t('actCancel'), style: 'cancel' },
          { text: t('actSendInterest'), onPress: handleSendInterest }
        ]
      );
    }
  };

  /*
   * Reporting a member.
   *
   * "Under 18" is listed first and named plainly: it is the reason Google's
   * child safety standards exist, and burying it under "Other" would make the
   * published standards untrue.
   */
  const REPORT_REASONS: Array<{ id: string; label: string }> = [
    { id: 'underage', label: t('rptUnderage') },
    { id: 'fake_profile', label: t('rptFake') },
    { id: 'harassment', label: t('rptHarassment') },
    { id: 'inappropriate_content', label: t('rptInappropriate') },
    { id: 'scam', label: t('rptScam') },
    { id: 'other', label: t('rptOther') },
  ];

  const submitReport = async () => {
    if (!reportReason || reporting) return;
    setReporting(true);
    try {
      await api.reportProfile(profileId, reportReason, reportDetails.trim() || undefined);
      setReportOpen(false);
      setReportReason(null);
      setReportDetails('');
      showAlert(
        t('rptThanksTitle'),
        t('rptThanksBody'),
        [{ text: t('actOk'), onPress: onBack }]
      );
    } catch (err) {
      showAlert(t('rptFailedTitle'), (err as Error).message || t('actTryAgain'));
    } finally {
      setReporting(false);
    }
  };

  const renderActionButtons = () => {
    if (!profile) return null;

    const { interestStatus } = profile;
    const phoneOpen = capabilities.canViewPhone && capabilities.canViewPhoneUnmatched;
    const phoneButton = (
      <Pressable
        style={phoneOpen ? styles.phoneButton : styles.phoneButtonDisabled}
        onPress={handleShowPhoneNumber}
      >
        <Ionicons name="call-outline" size={20} color={phoneOpen ? '#FFFFFF' : palette.muted} />
        <Text style={phoneOpen ? styles.phoneButtonText : styles.phoneButtonTextDisabled}>
          {t('actShowNumber')}
        </Text>
      </Pressable>
    );

    // Both have accepted - show chat button
    if (interestStatus === 'accepted') {
      return (
        <View style={styles.actionRow}>
          <Pressable style={styles.phoneButton} onPress={handleShowPhoneNumber}>
            <Ionicons name="call-outline" size={20} color="#FFFFFF" />
            <Text style={styles.phoneButtonText}>{t('actShowNumber')}</Text>
          </Pressable>
          <Pressable style={styles.messageButton} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
            <Text style={styles.messageButtonText}>{t('actMessage')}</Text>
          </Pressable>
        </View>
      );
    }

    // Interest sent by me, pending
    if (interestStatus === 'sent') {
      return (
        <View style={styles.actionRow}>
          <View style={styles.pendingPill}>
            <Ionicons name="time-outline" size={18} color={palette.primary} />
            <Text style={styles.pendingText}>{t('lblInterestSent')}</Text>
          </View>
          {phoneButton}
        </View>
      );
    }

    // Interest received from them, pending
    if (interestStatus === 'pending') {
      return (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.respondButton, actionLoading ? styles.buttonBusy : null]}
            onPress={() => respondToInterest(true)}
            disabled={actionLoading}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.respondButtonText}>{t('actAcceptInterest')}</Text>
          </Pressable>
          <Pressable
            style={[styles.declineButton, actionLoading ? styles.buttonBusy : null]}
            onPress={() => respondToInterest(false)}
            disabled={actionLoading}
          >
            <Ionicons name="close" size={20} color={palette.danger} />
            <Text style={styles.declineButtonText}>{t('actDecline')}</Text>
          </Pressable>
        </View>
      );
    }

    // No interest yet
    return (
      <View style={styles.actionRow}>
        <Pressable 
          style={[styles.interestButton, actionLoading && styles.buttonDisabled]} 
          onPress={handleSendInterest}
          disabled={actionLoading}
        >
          <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
          <Text style={styles.interestButtonText}>
            {actionLoading ? t('sendingInterest') : t('actSendInterest')}
          </Text>
        </Pressable>
        {phoneButton}
      </View>
    );
  };

  if (loading) {
    return <ScreenLoader message={t('loadingProfile')} />;
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('navProfile')}</Text>
        </View>
        <EmptyState 
          title={t('profileNotFound')} 
          subtitle={error || t('mpUnableLoad')}
          actionLabel={t('actGoBack')}
          onAction={onBack}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{profile.name}</Text>
      </View>

      <ScrollView
        // The page is drawn behind the navigation bar; without the inset the
        // last rows could never be scrolled out from under it.
        contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {error ? <InlineError message={error} /> : null}

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {(() => {
            const primaryPhoto = profile.photos?.find((p) => p.isPrimary && p.status === 'done' && p.uri);
            return primaryPhoto ? (
              <Image source={{ uri: primaryPhoto.uri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color={palette.muted} />
              </View>
            );
          })()}
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile.name}</Text>
            {profile.idVerified || profile.emailVerified ? (
              <View style={styles.verifyRow}>
                {profile.idVerified ? <VerifiedBadge /> : null}
                {profile.emailVerified ? (
                  <View style={styles.emailVerified}>
                    <Ionicons name="mail-outline" size={13} color={palette.muted} />
                    <Text style={styles.emailVerifiedText}>{t('verifyEmailBadgeDetail')}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {!profile.idVerified ? (
              <View style={styles.cautionRow}>
                <Ionicons name="alert-circle-outline" size={15} color={palette.warning} />
                <Text style={styles.cautionText}>{t('unverifiedCaution')}</Text>
              </View>
            ) : null}
            <Text style={styles.compatibility}>{profile.compatibilityScore}% Match</Text>
          </View>
        </View>

        {/* Photo Gallery - Swipeable Carousel */}
        {profile.photos && profile.photos.filter((p) => p.status === 'done' && p.uri).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('secPhotos')}</Text>
            <FlatList
              data={profile.photos.filter((p) => p.status === 'done' && p.uri)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => item.id || `photo-${index}`}
              renderItem={({ item }) => (
                <View style={styles.carouselItem}>
                  <Image source={{ uri: item.uri }} style={styles.carouselPhoto} resizeMode="contain" />
                </View>
              )}
              style={styles.carousel}
            />
            <Text style={styles.photoCount}>
              Swipe left/right • {profile.photos.filter((p) => p.status === 'done' && p.uri).length} photos
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {renderActionButtons()}

        <Pressable
          style={styles.reportButton}
          onPress={() => setReportOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('actReportProfile')}
        >
          <Ionicons name="flag-outline" size={16} color={palette.danger} />
          <Text style={styles.reportButtonText}>{t('actReportProfile')}</Text>
        </Pressable>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secBasicInfo')}</Text>
          <InfoRow label={t('fldAge')} value={profile.age ? `${profile.age} Years` : null} />
          <InfoRow label={t('fldGender')} value={profile.gender} />
          <InfoRow label={t('fldDob')} value={profile.dateOfBirth} />
          <InfoRow label={t('fldHeight')} value={profile.height} />
          <InfoRow label={t('fldMaritalStatus')} value={profile.maritalStatus} />
          <InfoRow label={t('fldPhysicalStatus')} value={profile.physicalStatus} />
          <InfoRow label={t('fldLocation')} value={profile.location} />
          <InfoRow label={t('fldCommunity')} value={profile.community} />
          <InfoRow label={t('fldSubCommunity')} value={profile.subCommunity} />
          <InfoRow label={t('fldLanguage')} value={profile.language} />
          <InfoRow label={t('fldEducation')} value={profile.education} />
          <InfoRow label={t('fldOccupation')} value={profile.occupation} />
          <InfoRow label={t('fldIncome')} value={profile.income} />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('fldAbout')}</Text>
          <Text style={styles.bio}>{profile.bio || t('lblNotSet')}</Text>
        </View>

        {/* Religious Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secReligiousDetails')}</Text>
          <InfoRow label={t('fldReligion')} value={profile.religion} />
          <InfoRow label={t('fldCaste')} value={profile.caste} />
          <InfoRow label={t('fldGol')} value={profile.subCaste} />
          <InfoRow label={t('fldDosh')} value={profile.dosh} />
        </View>

        {/* Location Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secLocationDetails')}</Text>
          <InfoRow label={t('fldCountry')} value={profile.country} />
          <InfoRow label={t('fldState')} value={profile.state} />
          {/* There is no separate city column; the city is what `location` holds. */}
          <InfoRow label={t('fldCity')} value={profile.location} />
          <InfoRow label={t('fldVillage')} value={profile.village} />
          <InfoRow label={t('fldNativeCity')} value={profile.nativeCity} />
          <InfoRow label={t('fldNativeVillage')} value={profile.nativeVillage} />
        </View>

        {/* Family Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secFamilyDetails')}</Text>
          <InfoRow label={t('fldFamilyStatus')} value={profile.familyStatus} />
          <InfoRow label={t('fldFamilyType')} value={profile.familyType} />
          <InfoRow label={t('fldFamilyWealth')} value={profile.familyWealth} />
          <InfoRow label={t('fldFatherName')} value={profile.fatherName} />
          <InfoRow label={t('fldFatherOccupation')} value={profile.fatherOccupation} />
          <InfoRow label={t('fldMotherName')} value={profile.motherName} />
          <InfoRow label={t('fldMotherOccupation')} value={profile.motherOccupation} />
          <InfoRow label={t('fldSiblings')} value={profile.siblings} />
        </View>

        {/* Lifestyle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secLifestyle')}</Text>
          <InfoRow label={t('fldEatingHabit')} value={profile.eatingHabit} />
          <InfoRow label={t('fldHobbies')} value={profile.hobbies?.join(', ')} />
          <InfoRow label={t('fldMusic')} value={profile.music?.join(', ')} />
          <InfoRow label={t('fldSports')} value={profile.sports?.join(', ')} />
        </View>

        {/* Horoscope Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secHoroscope')}</Text>
          <InfoRow label={t('fldBirthTime')} value={profile.horoscopeTime} />
          <InfoRow label={t('fldBirthPlace')} value={profile.horoscopePlace} />
        </View>

        {/* Partner Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('secPartnerPrefs')}</Text>
          <InfoRow label={t('fldPrefLocation')} value={profile.preferredLocation} />
          <InfoRow label={t('fldPrefEducation')} value={profile.preferredEducation} />
          <InfoRow label={t('fldPrefOccupation')} value={profile.preferredOccupation} />
        </View>

        {/* Interest Status */}
        {profile.interestStatus !== 'none' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('secInterestStatus')}</Text>
            <View style={[styles.statusPill, profile.interestStatus && styles[`status${profile.interestStatus}`]]}>
              <Text style={styles.statusText}>
                {profile.interestStatus === 'sent' && t('stInterestSent')}
                {profile.interestStatus === 'pending' && t('stInterestReceived')}
                {profile.interestStatus === 'accepted' && t('stMutualInterest')}
                {profile.interestStatus === 'declined' && t('stInterestDeclined')}
              </Text>
            </View>
            {profile.interestStatus === 'accepted' && (
              <Text style={styles.hint}>
                You can now view phone number and chat with {profile.name}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.reportOverlay} onPress={() => setReportOpen(false)}>
          <Pressable
            style={[styles.reportSheet, { paddingBottom: 20 + insets.bottom }]}
            onPress={(event) => event.stopPropagation()}
          >
            {/*
             * The reasons scroll and the buttons stay pinned below them. With a
             * large font the sheet hit its height cap and simply cut off,
             * leaving "Send report" unreachable.
             */}
            <ScrollView
              style={styles.reportScroll}
              contentContainerStyle={styles.reportScrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={styles.reportTitle}>{t('actReportProfile')}</Text>
              <Text style={styles.reportSubtitle}>{t('rptIntro')}</Text>

              {REPORT_REASONS.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.reportReason, reportReason === item.id && styles.reportReasonActive]}
                  onPress={() => setReportReason(item.id)}
                >
                  <Ionicons
                    name={reportReason === item.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={reportReason === item.id ? palette.primary : palette.muted}
                  />
                  <Text style={styles.reportReasonText}>{item.label}</Text>
                </Pressable>
              ))}

              <TextInput
                style={styles.reportInput}
                value={reportDetails}
                onChangeText={(text) => setReportDetails(text.slice(0, 2000))}
                placeholder={t('rptDetailsPlaceholder')}
                placeholderTextColor={palette.muted}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.reportActions}>
              <Pressable style={styles.reportCancel} onPress={() => setReportOpen(false)}>
                <Text style={styles.reportCancelText}>{t('actCancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.reportSubmit, (!reportReason || reporting) && styles.reportSubmitDisabled]}
                disabled={!reportReason || reporting}
                onPress={submitReport}
              >
                <Text style={styles.reportSubmitText}>{reporting ? t('suSendingCode') : t('actSendReport')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(palette: ThemePalette, insetTop = 0) {
  return StyleSheet.create({
    reportButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, marginHorizontal: 16, marginTop: 4,
    },
    reportButtonText: { color: palette.danger, fontSize: 14, fontWeight: '600' },
    reportOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
    },
    reportSheet: {
      backgroundColor: palette.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, maxHeight: '88%',
    },
    reportScroll: { flexShrink: 1 },
    reportScrollContent: { gap: 8 },
    reportTitle: { color: palette.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
    reportSubtitle: { color: palette.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 6 },
    reportReason: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 11, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: palette.border,
    },
    reportReasonActive: { borderColor: palette.primary, backgroundColor: palette.surface },
    reportReasonText: { color: palette.text, fontSize: 14.5, flex: 1 },
    reportInput: {
      borderWidth: 1, borderColor: palette.border, borderRadius: 10,
      padding: 12, minHeight: 78, color: palette.text, fontSize: 14.5, marginTop: 4,
    },
    reportActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    reportCancel: {
      flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center',
      borderWidth: 1, borderColor: palette.border,
    },
    reportCancelText: { color: palette.text, fontWeight: '700', fontSize: 15 },
    reportSubmit: {
      flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center',
      backgroundColor: palette.danger,
    },
    reportSubmitDisabled: { opacity: 0.5 },
    reportSubmitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: insetTop + 12,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: palette.text,
      marginLeft: 12,
    },
    content: {
      padding: 16,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 12,
    },
    carousel: {
      height: 300,
    },
    carouselItem: {
      width: 300,
      height: 300,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.border,
    },
    carouselPhoto: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    photoCount: {
      textAlign: 'center',
      color: palette.muted,
      fontSize: 12,
      marginTop: 8,
    },
    headerInfo: {
      alignItems: 'center',
    },
    name: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 4,
    },
    verifyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    emailVerified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    emailVerifiedText: { fontSize: 12, color: palette.muted },
    cautionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 4 },
    cautionText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: palette.warning },
    compatibility: {
      fontSize: 16,
      color: palette.primary,
      fontWeight: '600',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    interestButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    interestButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    phoneButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    phoneButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    phoneButtonDisabled: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    phoneButtonTextDisabled: {
      color: palette.muted,
      fontSize: 16,
      fontWeight: '600',
    },
    messageButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    messageButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    pendingPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primarySoft,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    pendingText: {
      color: palette.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    respondButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.accent,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    respondButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonBusy: {
      opacity: 0.6,
    },
    declineButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.bg,
      borderWidth: 1,
      borderColor: palette.danger,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
    },
    declineButtonText: {
      color: palette.danger,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    section: {
      marginBottom: 24,
      backgroundColor: palette.cardBg,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    infoLabel: {
      fontSize: 14,
      color: palette.muted,
    },
    infoValue: {
      fontSize: 14,
      color: palette.text,
      fontWeight: '500',
    },
    bio: {
      fontSize: 14,
      color: palette.text,
      lineHeight: 20,
    },
    statusPill: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      alignSelf: 'flex-start',
    },
    statussent: {
      backgroundColor: palette.primarySoft,
    },
    statuspending: {
      backgroundColor: palette.primarySoft,
    },
    statusaccepted: {
      backgroundColor: palette.accentSoft,
    },
    statusdeclined: {
      backgroundColor: palette.dangerSoft,
    },
    statusnone: {
      backgroundColor: palette.border,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    hint: {
      fontSize: 12,
      color: palette.muted,
      marginTop: 8,
      fontStyle: 'italic',
    },
  });
}
