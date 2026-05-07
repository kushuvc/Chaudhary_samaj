import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, InlineError, ScreenLoader } from '../components/AppFeedback';
import { useAppLanguage } from '../context/LanguageContext';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import type { MatrimonyProfile } from '../types';

type InterestStatus = 'none' | 'pending' | 'sent' | 'accepted' | 'declined';

interface ProfileDetail extends MatrimonyProfile {
  phone?: string | null;
  email?: string | null;
  interestStatus?: InterestStatus;
  hasSentInterest?: boolean;
  hasReceivedInterest?: boolean;
}

interface MatrimonyProfileDetailScreenProps {
  profileId: string;
  onBack: () => void;
}

// Feature flag for monetization - easily toggle later
const FEATURES = {
  SHOW_PHONE_FREE: true, // Set to false when implementing premium
  SEND_INTEREST_FREE: true, // Set to false when implementing premium
  CHAT_FREE: true, // Set to false when implementing premium
};

export function MatrimonyProfileDetailScreen({ profileId, onBack }: MatrimonyProfileDetailScreenProps) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      // Get profile details with interest status
      const response = await api.getMatrimonyProfiles({ profileId });
      const profileData = response.profiles?.[0];
      
      if (profileData) {
        // Check interest status
        const interests = await api.getMyInterests();
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
        });
      } else {
        setError('Profile not found');
      }
    } catch (err) {
      setError((err as Error).message);
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
      Alert.alert('Premium Feature', 'Upgrade to premium to send interests.');
      return;
    }

    try {
      setActionLoading(true);
      await api.sendInterest(profileId);
      Alert.alert('Success', 'Interest sent successfully!');
      await loadProfile();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Failed to send interest');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowPhoneNumber = () => {
    // Check if feature is premium-locked
    if (!FEATURES.SHOW_PHONE_FREE) {
      Alert.alert('Premium Feature', 'Upgrade to premium to view phone numbers.');
      return;
    }

    if (profile?.interestStatus === 'accepted') {
      // Show phone number
      Alert.alert(
        'Contact Information',
        `Phone: ${profile.phone || 'Not available'}\nEmail: ${profile.email || 'Not available'}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Phone Number Hidden',
        'Phone number will be visible after mutual interest. Send interest to connect!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Interest', onPress: handleSendInterest }
        ]
      );
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
          <Pressable style={styles.messageButton}>
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
          <Pressable style={styles.respondButton}>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.respondButtonText}>Accept Interest</Text>
          </Pressable>
          <Pressable style={styles.declineButton}>
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
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={60} color={palette.muted} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.compatibility}>{profile.compatibilityScore}% Match</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {renderActionButtons()}

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{profile.age} Years</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Height</Text>
            <Text style={styles.infoValue}>{profile.height || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Marital Status</Text>
            <Text style={styles.infoValue}>{profile.maritalStatus || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{profile.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Community</Text>
            <Text style={styles.infoValue}>{profile.community}</Text>
          </View>
          {profile.subCommunity && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sub Community</Text>
              <Text style={styles.infoValue}>{profile.subCommunity}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Education</Text>
            <Text style={styles.infoValue}>{profile.education || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Occupation</Text>
            <Text style={styles.infoValue}>{profile.occupation || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Income</Text>
            <Text style={styles.infoValue}>{profile.income || 'Not specified'}</Text>
          </View>
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        )}

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
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
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
      backgroundColor: '#E53935',
      paddingVertical: 14,
      borderRadius: 28,
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
      backgroundColor: '#4CAF50',
      paddingVertical: 14,
      borderRadius: 28,
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
      borderRadius: 28,
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
      backgroundColor: '#2196F3',
      paddingVertical: 14,
      borderRadius: 28,
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
      borderRadius: 28,
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
      backgroundColor: '#4CAF50',
      paddingVertical: 14,
      borderRadius: 28,
      gap: 8,
    },
    respondButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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
      borderRadius: 28,
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
      backgroundColor: '#FFF3E0',
    },
    statuspending: {
      backgroundColor: '#E3F2FD',
    },
    statusaccepted: {
      backgroundColor: '#E8F5E9',
    },
    statusdeclined: {
      backgroundColor: '#FFEBEE',
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
