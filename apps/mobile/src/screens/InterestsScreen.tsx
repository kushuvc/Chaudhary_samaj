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

type InterestTab = 'received' | 'sent';

interface Interest {
  id: string;
  profileId: string;
  name: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

interface InterestsScreenProps {
  onBack?: () => void;
  onViewProfile?: (profileId: string) => void;
  onMessage?: (matchId: string, name: string) => void;
}

// Feature flag for monetization
const FEATURES = {
  ACCEPT_INTEREST_FREE: true,
  DECLINE_INTEREST_FREE: true,
  CHAT_FREE: true,
};

export function InterestsScreen({ onBack, onViewProfile, onMessage }: InterestsScreenProps) {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [activeTab, setActiveTab] = useState<InterestTab>('received');
  const [sent, setSent] = useState<Interest[]>([]);
  const [received, setReceived] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadInterests = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMyInterests();
      setSent(data.sent as Interest[]);
      setReceived(data.received as Interest[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInterests();
  }, [loadInterests]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInterests();
  };

  const handleAccept = async (interest: Interest) => {
    if (!FEATURES.ACCEPT_INTEREST_FREE) {
      Alert.alert('Premium Feature', 'Upgrade to premium to accept interests.');
      return;
    }

    try {
      setActionId(interest.id);
      await api.respondToInterest(interest.id, true);
      Alert.alert('Success', `You accepted ${interest.name}'s interest!`);
      await loadInterests();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Failed to accept interest');
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (interest: Interest) => {
    if (!FEATURES.DECLINE_INTEREST_FREE) {
      Alert.alert('Premium Feature', 'Upgrade to premium to decline interests.');
      return;
    }

    Alert.alert(
      'Decline Interest',
      `Are you sure you want to decline ${interest.name}'s interest?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionId(interest.id);
              await api.respondToInterest(interest.id, false);
              Alert.alert('Declined', `You declined ${interest.name}'s interest.`);
              await loadInterests();
            } catch (err) {
              Alert.alert('Error', (err as Error).message || 'Failed to decline interest');
            } finally {
              setActionId(null);
            }
          }
        }
      ]
    );
  };

  const handleMessage = (interest: Interest) => {
    if (!FEATURES.CHAT_FREE) {
      Alert.alert('Premium Feature', 'Upgrade to premium to chat with matches.');
      return;
    }
    onMessage?.(interest.profileId, interest.name);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const renderInterestCard = (interest: Interest) => {
    const isReceived = activeTab === 'received';
    const isPending = interest.status === 'pending';
    const isAccepted = interest.status === 'accepted';
    const isDeclined = interest.status === 'declined';
    const isActionLoading = actionId === interest.id;

    return (
      <View key={interest.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color={palette.muted} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{interest.name}</Text>
            <Text style={styles.date}>{formatDate(interest.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, styles[`status${interest.status}`]]}>
            <Text style={styles.statusText}>
              {interest.status === 'pending' && 'Pending'}
              {interest.status === 'accepted' && 'Matched'}
              {interest.status === 'declined' && 'Declined'}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.viewButton}
            onPress={() => onViewProfile?.(interest.profileId)}
          >
            <Ionicons name="eye-outline" size={18} color={palette.primary} />
            <Text style={styles.viewButtonText}>View Profile</Text>
          </Pressable>

          {isReceived && isPending && (
            <>
              <Pressable
                style={[styles.acceptButton, isActionLoading && styles.buttonDisabled]}
                onPress={() => handleAccept(interest)}
                disabled={isActionLoading}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>
                  {isActionLoading ? '...' : 'Accept'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.declineButton, isActionLoading && styles.buttonDisabled]}
                onPress={() => handleDecline(interest)}
                disabled={isActionLoading}
              >
                <Ionicons name="close" size={18} color={palette.danger} />
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
            </>
          )}

          {isAccepted && (
            <Pressable
              style={styles.messageButton}
              onPress={() => handleMessage(interest)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <Text style={styles.messageButtonText}>Message</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const currentList = activeTab === 'received' ? received : sent;
  const pendingReceived = received.filter(r => r.status === 'pending').length;
  const acceptedReceived = received.filter(r => r.status === 'accepted').length;
  const acceptedSent = sent.filter(s => s.status === 'accepted').length;

  if (loading) {
    return <ScreenLoader message="Loading interests..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>My Interests</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pendingReceived}</Text>
          <Text style={styles.statLabel}>Received</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{sent.length}</Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{acceptedReceived + acceptedSent}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received ({received.length})
          </Text>
          {pendingReceived > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingReceived}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent ({sent.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {error ? <InlineError message={error} /> : null}

        {currentList.length === 0 ? (
          <EmptyState
            title={activeTab === 'received' ? 'No Interests Received' : 'No Interests Sent'}
            subtitle={
              activeTab === 'received'
                ? 'When someone sends you an interest, it will appear here.'
                : 'Browse profiles and send interests to connect with matches.'
            }
          />
        ) : (
          currentList.map(renderInterestCard)
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
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
      marginLeft: 12,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 16,
      backgroundColor: palette.cardBg,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: palette.primary,
    },
    statLabel: {
      fontSize: 12,
      color: palette.muted,
      marginTop: 4,
    },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: palette.border,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 12,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: palette.border,
      borderRadius: 24,
      gap: 8,
    },
    tabActive: {
      backgroundColor: palette.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.text,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    badge: {
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: palette.primary,
    },
    content: {
      padding: 16,
    },
    card: {
      backgroundColor: palette.cardBg,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: palette.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: palette.text,
    },
    date: {
      fontSize: 12,
      color: palette.muted,
      marginTop: 2,
    },
    statusBadge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
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
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    viewButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      gap: 6,
    },
    viewButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.primary,
    },
    acceptButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: '#4CAF50',
      gap: 6,
    },
    acceptButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    declineButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: palette.bg,
      borderWidth: 1,
      borderColor: palette.danger,
      gap: 6,
    },
    declineButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: palette.danger,
    },
    messageButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: '#2196F3',
      gap: 6,
    },
    messageButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
}
