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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { colors } from '../theme';
import { api } from '../services/api';
import type { MatrimonyProfile } from '../types';

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

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={infoRowStyle}>
      <Text style={infoLabelStyle}>{label}</Text>
      <Text style={infoValueStyle}>{value != null && String(value).trim() !== '' ? String(value) : 'Not specified'}</Text>
    </View>
  );
}

const infoRowStyle: import('react-native').ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
};
const infoLabelStyle: import('react-native').TextStyle = {
  fontSize: 14,
  color: colors.muted,
  flex: 1,
};
const infoValueStyle: import('react-native').TextStyle = {
  fontSize: 14,
  color: colors.text,
  fontWeight: '500',
  flex: 1,
  textAlign: 'right',
};

// Feature flag for monetization - easily toggle later
const FEATURES = {
  SHOW_PHONE_FREE: true, // Set to false when implementing premium
  SEND_INTEREST_FREE: true, // Set to false when implementing premium
  CHAT_FREE: true, // Set to false when implementing premium
};

export function MatrimonyProfileDetailScreen({ profileId, onBack }: MatrimonyProfileDetailScreenProps) {
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
        setError('Profile not found');
      }
    } catch (err) {
      // A locked profile comes back as 403 rather than a failure — say what it
      // is and what to do, instead of surfacing a raw error string.
      const apiError = err as { code?: string; message?: string };
      setError(
        apiError.code === 'SUBSCRIPTION_REQUIRED'
          ? 'Subscribe to ₹200/month to view this profile.'
          : apiError.message || 'Could not load this profile.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleSendInterest = async () => {
    // Check if feature is premium-locked
    if (!FEATURES.SEND_INTEREST_FREE) {
      showAlert('Premium Feature', 'Upgrade to premium to send interests.');
      return;
    }

    try {
      setActionLoading(true);
      await api.sendInterest(profileId);
      showAlert('Interest Sent! 💌', `Your interest has been sent to ${profile?.name || 'this profile'}. You will be notified when they respond.`);
      await loadProfile();
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.toLowerCase().includes('already')) {
        showAlert('Already Sent', 'You have already sent an interest to this profile.');
      } else {
        showAlert('Failed to Send Interest', msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const respondToInterest = async (accept: boolean) => {
    const interestId = profile?.receivedInterestId;
    if (!interestId) {
      showAlert('Nothing to respond to', 'This interest is no longer available. Pull down to refresh.');
      return;
    }

    try {
      setActionLoading(true);
      await api.respondToInterest(interestId, accept);
      showAlert(
        accept ? 'Interest accepted 🎉' : 'Interest declined',
        accept
          ? `You and ${profile?.name || 'this member'} are now matched. You can message each other.`
          : `${profile?.name || 'This member'} will not be notified.`
      );
      await loadProfile();
    } catch (err) {
      showAlert(
        accept ? 'Could not accept' : 'Could not decline',
        (err as Error).message || 'Something went wrong. Please try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = () => {
    if (!FEATURES.CHAT_FREE) {
      showAlert('Premium Feature', 'Upgrade to premium to message your matches.');
      return;
    }
    // Chat lives in the Messages tab, which lists every accepted match.
    // Close this modal first, otherwise it stays open over the tab.
    onBack?.();
    navigation.navigate('Messages');
  };

  const handleShowPhoneNumber = () => {
    // Check if feature is premium-locked
    if (!FEATURES.SHOW_PHONE_FREE) {
      showAlert('Premium Feature', 'Upgrade to premium to view phone numbers.');
      return;
    }

    if (profile?.interestStatus === 'accepted') {
      const phone = profile.phone;
      if (phone) {
        showAlert('Phone Number 📞', phone, [{ text: 'OK' }]);
      } else {
        showAlert('No Number Found', `${profile.name || 'This user'} has not added a phone number to their profile yet.`, [{ text: 'OK' }]);
      }
    } else if (profile?.interestStatus === 'sent') {
      showAlert(
        'Interest Pending',
        'Your interest has been sent. Phone number will be visible once they accept your interest.',
        [{ text: 'OK' }]
      );
    } else if (profile?.interestStatus === 'declined') {
      showAlert(
        'Interest Declined',
        'Your interest was declined. Phone number is not accessible.',
        [{ text: 'OK' }]
      );
    } else {
      showAlert(
        'Phone Number Hidden 🔒',
        'You need to have a mutual interest accepted to view the phone number. Send interest to connect!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Interest', onPress: handleSendInterest }
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
    { id: 'underage', label: 'This person is under 18' },
    { id: 'fake_profile', label: 'Fake or impersonated profile' },
    { id: 'harassment', label: 'Harassment or abusive messages' },
    { id: 'inappropriate_content', label: 'Inappropriate photos or content' },
    { id: 'scam', label: 'Scam or asking for money' },
    { id: 'other', label: 'Something else' },
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
        'Thank you',
        'Our team will review this. This member is now hidden from you.',
        [{ text: 'OK', onPress: onBack }]
      );
    } catch (err) {
      showAlert('Could not send the report', (err as Error).message || 'Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const renderActionButtons = () => {
    if (!profile) return null;

    const { interestStatus } = profile;

    // Both have accepted - show chat button
    if (interestStatus === 'accepted') {
      return (
        <View style={styles.actionRow}>
          <Pressable style={styles.phoneButton} onPress={handleShowPhoneNumber}>
            <Ionicons name="call-outline" size={20} color="#FFFFFF" />
            <Text style={styles.phoneButtonText}>Show Number</Text>
          </Pressable>
          <Pressable style={styles.messageButton} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
            <Text style={styles.messageButtonText}>Message</Text>
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
            <Text style={styles.pendingText}>Interest Sent</Text>
          </View>
          <Pressable style={styles.phoneButtonDisabled} onPress={handleShowPhoneNumber}>
            <Ionicons name="call-outline" size={20} color={palette.muted} />
            <Text style={styles.phoneButtonTextDisabled}>Show Number</Text>
          </Pressable>
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
            <Text style={styles.respondButtonText}>Accept Interest</Text>
          </Pressable>
          <Pressable
            style={[styles.declineButton, actionLoading ? styles.buttonBusy : null]}
            onPress={() => respondToInterest(false)}
            disabled={actionLoading}
          >
            <Ionicons name="close" size={20} color={palette.danger} />
            <Text style={styles.declineButtonText}>Decline</Text>
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
            {actionLoading ? 'Sending...' : 'Send Interest'}
          </Text>
        </Pressable>
        <Pressable style={styles.phoneButtonDisabled} onPress={handleShowPhoneNumber}>
          <Ionicons name="call-outline" size={20} color={palette.muted} />
          <Text style={styles.phoneButtonTextDisabled}>Show Number</Text>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return <ScreenLoader message="Loading profile..." />;
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <EmptyState 
          title="Profile Not Found" 
          subtitle={error || 'Unable to load profile'}
          actionLabel="Go Back"
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
        contentContainerStyle={styles.content}
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
            <Text style={styles.compatibility}>{profile.compatibilityScore}% Match</Text>
          </View>
        </View>

        {/* Photo Gallery - Swipeable Carousel */}
        {profile.photos && profile.photos.filter((p) => p.status === 'done' && p.uri).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
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
          accessibilityLabel="Report this profile"
        >
          <Ionicons name="flag-outline" size={16} color={palette.danger} />
          <Text style={styles.reportButtonText}>Report this profile</Text>
        </Pressable>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <InfoRow label="Age" value={profile.age ? `${profile.age} Years` : null} />
          <InfoRow label="Gender" value={profile.gender} />
          <InfoRow label="Date of Birth" value={profile.dateOfBirth} />
          <InfoRow label="Height" value={profile.height} />
          <InfoRow label="Marital Status" value={profile.maritalStatus} />
          <InfoRow label="Physical Status" value={profile.physicalStatus} />
          <InfoRow label="Location" value={profile.location} />
          <InfoRow label="Community" value={profile.community} />
          <InfoRow label="Sub Community" value={profile.subCommunity} />
          <InfoRow label="Language" value={profile.language} />
          <InfoRow label="Education" value={profile.education} />
          <InfoRow label="Occupation" value={profile.occupation} />
          <InfoRow label="Income" value={profile.income} />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{profile.bio || 'Not specified'}</Text>
        </View>

        {/* Religious Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Religious Details</Text>
          <InfoRow label="Religion" value={profile.religion} />
          <InfoRow label="Caste" value={profile.caste} />
          <InfoRow label="Gol (Subcaste)" value={profile.subCaste} />
          <InfoRow label="Dosh" value={profile.dosh} />
        </View>

        {/* Location Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Details</Text>
          <InfoRow label="Country" value={profile.country} />
          <InfoRow label="State" value={profile.state} />
          <InfoRow label="City" value={profile.city} />
          <InfoRow label="Village" value={profile.village} />
          <InfoRow label="Native City" value={profile.nativeCity} />
          <InfoRow label="Native Village" value={profile.nativeVillage} />
        </View>

        {/* Family Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family Details</Text>
          <InfoRow label="Family Status" value={profile.familyStatus} />
          <InfoRow label="Family Type" value={profile.familyType} />
          <InfoRow label="Family Wealth" value={profile.familyWealth} />
          <InfoRow label="Father's Name" value={profile.fatherName} />
          <InfoRow label="Father's Occupation" value={profile.fatherOccupation} />
          <InfoRow label="Mother's Name" value={profile.motherName} />
          <InfoRow label="Mother's Occupation" value={profile.motherOccupation} />
          <InfoRow label="Siblings" value={profile.siblings} />
        </View>

        {/* Lifestyle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
          <InfoRow label="Eating Habit" value={profile.eatingHabit} />
          <InfoRow label="Hobbies" value={profile.hobbies?.join(', ')} />
          <InfoRow label="Music" value={profile.music?.join(', ')} />
          <InfoRow label="Sports" value={profile.sports?.join(', ')} />
        </View>

        {/* Horoscope Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horoscope Details</Text>
          <InfoRow label="Time of Birth" value={profile.horoscopeTime} />
          <InfoRow label="Place of Birth" value={profile.horoscopePlace} />
        </View>

        {/* Partner Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partner Preferences</Text>
          <InfoRow label="Preferred Location" value={profile.preferredLocation} />
          <InfoRow label="Preferred Education" value={profile.preferredEducation} />
          <InfoRow label="Preferred Occupation" value={profile.preferredOccupation} />
        </View>

        {/* Interest Status */}
        {profile.interestStatus !== 'none' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interest Status</Text>
            <View style={[styles.statusPill, profile.interestStatus && styles[`status${profile.interestStatus}`]]}>
              <Text style={styles.statusText}>
                {profile.interestStatus === 'sent' && 'Interest Sent'}
                {profile.interestStatus === 'pending' && 'Interest Received'}
                {profile.interestStatus === 'accepted' && 'Mutual Interest ✓'}
                {profile.interestStatus === 'declined' && 'Interest Declined'}
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
          <Pressable style={styles.reportSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.reportTitle}>Report this profile</Text>
            <Text style={styles.reportSubtitle}>
              Tell us what is wrong. Our team reviews every report, and this member is hidden from you straight away.
            </Text>

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
              placeholder="Anything else we should know? (optional)"
              placeholderTextColor={palette.muted}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.reportActions}>
              <Pressable style={styles.reportCancel} onPress={() => setReportOpen(false)}>
                <Text style={styles.reportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportSubmit, (!reportReason || reporting) && styles.reportSubmitDisabled]}
                disabled={!reportReason || reporting}
                onPress={submitReport}
              >
                <Text style={styles.reportSubmitText}>{reporting ? 'Sending…' : 'Send report'}</Text>
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
      padding: 20, gap: 8, maxHeight: '88%',
    },
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
