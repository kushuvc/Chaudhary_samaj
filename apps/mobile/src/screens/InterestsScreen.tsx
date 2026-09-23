import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Modal,
  Pressable,
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
import { MatrimonyArt } from '../components/MatrimonyArt';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { api } from '../services/api';
import { MatrimonyProfileDetailScreen } from './MatrimonyProfileDetailScreen';
import { useCapabilities } from '../hooks/useCapabilities';

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

/*
 * Responding to an interest is never gated. A member who cannot accept is
 * stranded, and so is the person who sent it — that is a worse product than
 * any plan boundary is worth.
 */
export function InterestsScreen({ onBack, onViewProfile, onMessage }: InterestsScreenProps) {
  const capabilities = useCapabilities();
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette, insets.top), [palette, insets.top]);
  const navigation = useNavigation<any>();
  
  const [activeTab, setActiveTab] = useState<InterestTab>('received');
  const [sent, setSent] = useState<Interest[]>([]);
  const [received, setReceived] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

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
    try {
      setActionId(interest.id);
      await api.respondToInterest(interest.id, true);
      showAlert(t('lblSuccess'), `You accepted ${interest.name}'s interest!`);
      await loadInterests();
    } catch (err) {
      showAlert(t('lblError'), (err as Error).message || t('inAcceptFailed'));
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (interest: Interest) => {
    showAlert(
      t('inDeclineConfirmTitle'),
      t('inDeclineConfirmBody', { name: interest.name }),
      [
        { text: t('actCancel'), style: 'cancel' },
        {
          text: t('actDecline'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionId(interest.id);
              await api.respondToInterest(interest.id, false);
              showAlert(t('lblDeclined'), `You declined ${interest.name}'s interest.`);
              await loadInterests();
            } catch (err) {
              showAlert(t('lblError'), (err as Error).message || t('inDeclineFailed'));
            } finally {
              setActionId(null);
            }
          }
        }
      ]
    );
  };

  const handleMessage = (interest: Interest) => {
    if (!capabilities.canChat) {
      showAlert(t('alertPremiumFeature'), t('mpUpgradeChat'));
      return;
    }
    if (onMessage) {
      onMessage(interest.profileId, interest.name);
    } else {
      // Navigate to Messages tab when used as standalone tab
      navigation.navigate('Messages');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('lblToday');
    if (diffDays === 1) return t('lblYesterday');
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
              {interest.status === 'pending' && t('lblPending')}
              {interest.status === 'accepted' && t('lblMatched')}
              {interest.status === 'declined' && t('lblDeclined')}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.viewButton}
            onPress={() => {
              setViewingProfileId(interest.profileId);
              onViewProfile?.(interest.profileId);
            }}
          >
            <Ionicons name="eye-outline" size={18} color={palette.primary} />
            <Text style={styles.viewButtonText}>{t('actViewProfile')}</Text>
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
                  {isActionLoading ? '...' : t('actAccept')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.declineButton, isActionLoading && styles.buttonDisabled]}
                onPress={() => handleDecline(interest)}
                disabled={isActionLoading}
              >
                <Ionicons name="close" size={18} color={palette.danger} />
                <Text style={styles.declineButtonText}>{t('actDecline')}</Text>
              </Pressable>
            </>
          )}

          {isAccepted && (
            <Pressable
              style={styles.messageButton}
              onPress={() => handleMessage(interest)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <Text style={styles.messageButtonText}>{t('actMessage')}</Text>
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
    return <ScreenLoader message={t('loadingInterests')} />;
  }

  return (
    <View style={styles.container}>
      {/* The banner carries the title now, so the plain header would print
          "My Interests" twice. The back arrow still needs somewhere to live
          when this screen is pushed rather than tabbed to. */}
      {onBack ? (
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
        </View>
      ) : null}

      <MatrimonyArt
        scene="interests"
        title={t('secMyInterests')}
        subtitle={t('interestsArtSub')}
        height={124}
        style={{ marginHorizontal: 16, marginTop: insets.top + 12, marginBottom: 12 }}
      />

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pendingReceived}</Text>
          <Text style={styles.statLabel}>{t('lblReceived')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{sent.length}</Text>
          <Text style={styles.statLabel}>{t('lblSent')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{acceptedReceived + acceptedSent}</Text>
          <Text style={styles.statLabel}>{t('lblMatches')}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            {t('lblReceived')} ({received.length})
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
            {t('lblSent')} ({sent.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {error ? <InlineError message={error} /> : null}

        {currentList.length === 0 ? (
          <EmptyState
            title={activeTab === 'received' ? t('inNoneReceived') : t('inNoneSent')}
            subtitle={
              activeTab === 'received'
                ? t('inNoneReceivedBody')
                : t('inNoneSentBody')
            }
          />
        ) : (
          currentList.map(renderInterestCard)
        )}
      </ScrollView>

      {/* Profile Detail Modal */}
      <Modal
        visible={viewingProfileId !== null}
        animationType="slide"
        onRequestClose={() => setViewingProfileId(null)}
      >
        {viewingProfileId && (
          <MatrimonyProfileDetailScreen
            profileId={viewingProfileId}
            onBack={() => setViewingProfileId(null)}
          />
        )}
      </Modal>
    </View>
  );
}

function createStyles(palette: ThemePalette, insetTop = 0) {
  return StyleSheet.create({
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
      backgroundColor: palette.primarySoft,
    },
    statusaccepted: {
      backgroundColor: palette.accentSoft,
    },
    statusdeclined: {
      backgroundColor: palette.dangerSoft,
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
      backgroundColor: palette.accent,
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
      backgroundColor: palette.primary,
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
