import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { GradientFill, PrimaryButton } from '../components/ui';
import { api } from '../services/api';
import { usePlayBilling } from '../services/playBilling';
import { radius, shadow, spacing } from '../theme';

interface SubscriptionData {
  hasSubscription: boolean;
  plan?: string;
  amount?: number;
  startedAt?: string;
  expiresAt?: string;
}

const PLAN = {
  name: 'Monthly',
  amount: 200,
  days: 30,
  perks: [
    'Unlimited profile views',
    'See phone numbers on every profile',
    'Send unlimited interests',
    'Priority placement in search',
  ],
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

function formatDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SubscriptionsScreen() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const pendingLinkIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);

  const loadSubscription = useCallback(async () => {
    try {
      setSubscription(await api.getSubscriptionStatus());
    } catch (err) {
      console.error('[subscriptions] status failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tabs stay mounted, so a plain mount effect would leave this showing stale
  // state after the subscription changes elsewhere (or on another device).
  useFocusEffect(
    useCallback(() => {
      void loadSubscription();
    }, [loadSubscription])
  );

  // Google Play is the payment path on Android. Razorpay stays in the codebase
  // for a future web checkout, where Play's service fee does not apply.
  const play = usePlayBilling(() => {
    void loadSubscription();
  });

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  /**
   * Ask the server to check the payment link with Razorpay directly. This is the
   * authoritative path: it does not depend on a webhook reaching the API or on the
   * deep link firing, both of which are unavailable in local development.
   */
  const checkPaymentLink = useCallback(async (): Promise<boolean> => {
    const linkId = pendingLinkIdRef.current;
    if (!linkId) return false;

    const result = await api.getPaymentLinkStatus(linkId);
    if (!result.activated) return false;

    stopPolling();
    pendingLinkIdRef.current = null;
    setAwaitingPayment(false);
    await loadSubscription();
    Alert.alert('Subscription active', 'Your monthly plan is now active. Enjoy unlimited access.');
    return true;
  }, [loadSubscription, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartedAtRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      try {
        const activated = await checkPaymentLink();
        if (activated) return;
      } catch (err) {
        console.error('[subscriptions] poll failed:', err);
      }

      if (Date.now() - pollStartedAtRef.current >= POLL_TIMEOUT_MS) {
        stopPolling();
        setAwaitingPayment(false);
      }
    }, POLL_INTERVAL_MS);
  }, [checkPaymentLink, stopPolling]);

  // If Razorpay redirects back into the app, confirm immediately rather than waiting
  // for the next poll tick.
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url || !url.includes('payment/razorpay')) return;
      void checkPaymentLink().catch((err) => console.error('[subscriptions] deep link check failed:', err));
    };

    const listener = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => listener.remove();
  }, [checkPaymentLink]);

  const handlePurchase = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      const link = await api.createPaymentLink('premium', PLAN.amount);
      pendingLinkIdRef.current = link.id;

      const opened = await Linking.canOpenURL(link.short_url);
      if (!opened) {
        Alert.alert('Cannot open checkout', 'No browser is available to open the payment page.');
        pendingLinkIdRef.current = null;
        return;
      }

      await Linking.openURL(link.short_url);
      setAwaitingPayment(true);
      startPolling();
    } catch (err) {
      Alert.alert('Payment failed to start', (err as Error).message);
      pendingLinkIdRef.current = null;
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCheck = async () => {
    try {
      const activated = await checkPaymentLink();
      if (!activated) {
        Alert.alert('Not confirmed yet', 'Razorpay has not reported this payment as complete. Try again in a moment.');
      }
    } catch (err) {
      Alert.alert('Could not check payment', (err as Error).message);
    }
  };

  const isActive = Boolean(subscription?.hasSubscription);
  const daysLeft = isActive && subscription?.expiresAt
    ? Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      >
        <Text style={styles.screenTitle}>Membership</Text>

        {isActive ? (
          <View style={styles.activeCard}>
            <GradientFill colors={palette.gradient} borderRadius={radius.lg} />
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
            <Text style={styles.activeTitle}>{PLAN.name} plan</Text>
            <Text style={styles.activeSubtitle}>
              {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining` : 'Expires today'}
            </Text>
            <View style={styles.activeMetaRow}>
              {formatDate(subscription?.startedAt) ? (
                <View style={styles.activeMeta}>
                  <Text style={styles.activeMetaLabel}>Started</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(subscription?.startedAt)}</Text>
                </View>
              ) : null}
              {formatDate(subscription?.expiresAt) ? (
                <View style={styles.activeMeta}>
                  <Text style={styles.activeMetaLabel}>Valid till</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(subscription?.expiresAt)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.lede}>
              Free members can view two profiles. Go premium for unlimited access to the whole community.
            </Text>

            {awaitingPayment ? (
              <View style={styles.awaitingCard}>
                <ActivityIndicator size="small" color={palette.primary} />
                <View style={styles.awaitingTextGroup}>
                  <Text style={styles.awaitingTitle}>Waiting for confirmation</Text>
                  <Text style={styles.awaitingBody}>
                    Finish the payment in your browser. We check automatically every few seconds.
                  </Text>
                </View>
                <Pressable style={styles.awaitingAction} onPress={handleManualCheck}>
                  <Text style={styles.awaitingActionText}>Check now</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{PLAN.name}</Text>
                  <Text style={styles.planCadence}>Billed every {PLAN.days} days</Text>
                </View>
                <View style={styles.popularPill}>
                  <Text style={styles.popularText}>Most popular</Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceCurrency}>₹</Text>
                <Text style={styles.priceAmount}>{PLAN.amount}</Text>
                <Text style={styles.pricePeriod}>/ month</Text>
              </View>

              <View style={styles.perks}>
                {PLAN.perks.map((perk) => (
                  <View key={perk} style={styles.perkRow}>
                    <View style={styles.perkIcon}>
                      <Ionicons name="checkmark" size={13} color={palette.primary} />
                    </View>
                    <Text style={styles.perkText}>{perk}</Text>
                  </View>
                ))}
              </View>

              {play.available ? (
                <>
                  <PrimaryButton
                    label={
                      play.purchasing
                        ? 'Opening Google Play…'
                        : `Subscribe — ${play.product?.displayPrice || `₹${PLAN.amount}`}`
                    }
                    onPress={play.buy}
                    disabled={play.purchasing || play.loading}
                  />
                  {play.error ? <Text style={styles.playError}>{play.error}</Text> : null}
                </>
              ) : (
                <>
                  <PrimaryButton
                    label={processing ? 'Opening checkout…' : `Subscribe — ₹${PLAN.amount}`}
                    onPress={handlePurchase}
                    disabled={processing}
                  />
                  {play.error ? <Text style={styles.playError}>{play.error}</Text> : null}
                </>
              )}
            </View>
          </>
        )}

        <View style={styles.footnote}>
          <Ionicons name="lock-closed" size={13} color={palette.muted} />
          <Text style={styles.footnoteText}>Secured by Razorpay. Cancel anytime.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: palette.bg },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: palette.text,
      marginBottom: spacing.xs,
    },
    lede: { fontSize: 15, lineHeight: 22, color: palette.muted },

    activeCard: {
      borderRadius: radius.lg,
      padding: spacing.lg,
      overflow: 'hidden',
      gap: spacing.xs,
      ...shadow.cta,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.22)',
      marginBottom: spacing.xs,
    },
    activeBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    activeTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
    activeSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 15 },
    activeMetaRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
    activeMeta: { gap: 2 },
    activeMetaLabel: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    activeMetaValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

    awaitingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: palette.primarySoft,
      borderWidth: 1,
      borderColor: palette.border,
    },
    awaitingTextGroup: { flex: 1, gap: 2 },
    awaitingTitle: { fontSize: 14, fontWeight: '700', color: palette.text },
    awaitingBody: { fontSize: 12.5, lineHeight: 17, color: palette.muted },
    awaitingAction: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.sm,
      backgroundColor: palette.primary,
    },
    awaitingActionText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

    planCard: {
      backgroundColor: palette.cardBg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: palette.border,
      gap: spacing.md,
      ...shadow.card,
    },
    planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    planName: { fontSize: 20, fontWeight: '800', color: palette.text, letterSpacing: -0.3 },
    planCadence: { fontSize: 13, color: palette.muted, marginTop: 2 },
    popularPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: palette.primarySoft,
    },
    popularText: { fontSize: 11, fontWeight: '800', color: palette.primary, letterSpacing: 0.3 },

    priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    priceCurrency: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 6 },
    priceAmount: { fontSize: 44, fontWeight: '800', color: palette.text, letterSpacing: -1.5 },
    pricePeriod: { fontSize: 15, color: palette.muted, marginBottom: 8, marginLeft: 4 },

    perks: { gap: spacing.sm },
    perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    perkIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkText: { flex: 1, fontSize: 14.5, color: palette.text },

    footnote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.xs,
    },
    footnoteText: { fontSize: 12.5, color: palette.muted },
    playError: { fontSize: 13, color: palette.danger, marginTop: spacing.sm, textAlign: 'center' },
  });
}
