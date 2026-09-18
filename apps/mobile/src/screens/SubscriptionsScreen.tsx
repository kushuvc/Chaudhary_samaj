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

import type { SubscriptionPlan, SubscriptionStatus } from '../services/api';
import { useAppLanguage } from '../context/LanguageContext';

type SubscriptionData = SubscriptionStatus;

/*
 * What a subscription gets you. Shared by every plan on purpose: access is
 * all-or-nothing on the server, so plans differ in length and price only —
 * listing different perks per plan would be a promise the API cannot keep.
 */
const PERK_KEYS = [
  'subUnlimitedViews',
  'subSeePhones',
  'subUnlimitedInterests',
  'subPriorityPlacement',
];

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
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const pendingLinkIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);

  const loadSubscription = useCallback(async () => {
    try {
      // Both together: the screen cannot decide what to show without knowing
      // the member's state and what is on sale.
      const [status, available] = await Promise.all([
        api.getSubscriptionStatus(),
        api.getSubscriptionPlans().catch((err) => {
          console.error('[subscriptions] plans failed:', err);
          return [] as SubscriptionPlan[];
        }),
      ]);
      setSubscription(status);
      setPlans(available);
      // Keep whatever the member picked if it is still on sale; otherwise fall
      // back to the first, which is the order the admin screen chose.
      setSelectedCode((current) =>
        current && available.some((plan) => plan.code === current)
          ? current
          : available[0]?.code ?? null
      );
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
  const playProductIds = useMemo(
    () => plans.map((plan) => plan.playProductId).filter((id): id is string => Boolean(id)),
    [plans]
  );

  const play = usePlayBilling(playProductIds, () => {
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
    Alert.alert(t('paySubActive'), t('paySubActiveBody'));
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
      if (!selectedPlan) return;
      const link = await api.createPaymentLink(selectedPlan.code);
      pendingLinkIdRef.current = link.id;

      const opened = await Linking.canOpenURL(link.short_url);
      if (!opened) {
        Alert.alert(t('payCannotOpen'), t('payNoBrowser'));
        pendingLinkIdRef.current = null;
        return;
      }

      await Linking.openURL(link.short_url);
      setAwaitingPayment(true);
      startPolling();
    } catch (err) {
      Alert.alert(t('payStartFailed'), (err as Error).message);
      pendingLinkIdRef.current = null;
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCheck = async () => {
    try {
      const activated = await checkPaymentLink();
      if (!activated) {
        Alert.alert(t('payNotConfirmed'), t('payRazorpayPending'));
      }
    } catch (err) {
      Alert.alert(t('payCheckFailed'), (err as Error).message);
    }
  };

  const isActive = Boolean(subscription?.hasSubscription);

  /*
   * Free for this member because of the rules, not because they paid. Shown
   * differently from an active subscription: there is nothing to cancel, no
   * expiry, and no price to quote.
   */
  const freeForMember = Boolean(subscription?.plan?.freeForYou) && !isActive;

  const selectedPlan = plans.find((plan) => plan.code === selectedCode) ?? plans[0] ?? null;
  /*
   * The name of the plan they are actually on. A member can hold a plan that
   * has since been retired, in which case the list no longer carries it and the
   * stored code is the honest thing to show.
   */
  const activePlanName =
    plans.find((plan) => plan.code === subscription?.plan_name)?.name ??
    subscription?.plan_name ??
    t('planMonthly');
  // Play's own price when the plan sells through Play, because that is what the
  // member is actually charged. Ours is the fallback and the web-checkout price.
  const selectedPlayProduct = selectedPlan?.playProductId
    ? play.products[selectedPlan.playProductId]
    : undefined;
  const selectedPrice =
    selectedPlayProduct?.displayPrice ??
    (selectedPlan ? `₹${Math.round(selectedPlan.pricePaise / 100)}` : '');
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
        <Text style={styles.screenTitle}>{t('secMembership')}</Text>

        {freeForMember ? (
          <View style={styles.activeCard}>
            <GradientFill colors={palette.gradient} borderRadius={radius.lg} />
            <View style={styles.activeBadge}>
              <Ionicons name="gift" size={16} color="#FFFFFF" />
              <Text style={styles.activeBadgeText}>{t('lblIncluded')}</Text>
            </View>
            <Text style={styles.activeTitle}>{t('payFullAccessFree')}</Text>
            <Text style={styles.activeSubtitle}>{t('payEverythingUnlocked')}</Text>
          </View>
        ) : isActive ? (
          <View style={styles.activeCard}>
            <GradientFill colors={palette.gradient} borderRadius={radius.lg} />
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.activeBadgeText}>{t('lblActive')}</Text>
            </View>
            <Text style={styles.activeTitle}>{t('planNamePlan', { name: activePlanName })}</Text>
            <Text style={styles.activeSubtitle}>
              {daysLeft > 1
                ? t('subDaysRemaining', { days: daysLeft })
                : daysLeft === 1
                  ? t('subOneDayRemaining')
                  : t('subExpiresToday')}
            </Text>
            <View style={styles.activeMetaRow}>
              {formatDate(subscription?.startedAt) ? (
                <View style={styles.activeMeta}>
                  <Text style={styles.activeMetaLabel}>{t('lblStarted')}</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(subscription?.startedAt)}</Text>
                </View>
              ) : null}
              {formatDate(subscription?.expiresAt) ? (
                <View style={styles.activeMeta}>
                  <Text style={styles.activeMetaLabel}>{t('lblValidTill')}</Text>
                  <Text style={styles.activeMetaValue}>{formatDate(subscription?.expiresAt)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.lede}>{t('payFreeLimit')}</Text>

            {awaitingPayment ? (
              <View style={styles.awaitingCard}>
                <ActivityIndicator size="small" color={palette.primary} />
                <View style={styles.awaitingTextGroup}>
                  <Text style={styles.awaitingTitle}>{t('payWaitingConfirm')}</Text>
                  <Text style={styles.awaitingBody}>{t('payFinishInBrowser')}</Text>
                </View>
                <Pressable style={styles.awaitingAction} onPress={handleManualCheck}>
                  <Text style={styles.awaitingActionText}>{t('actCheckNow')}</Text>
                </Pressable>
              </View>
            ) : null}

            {plans.length === 0 ? (
              <View style={styles.planCard}>
                <Text style={styles.emptyPlans}>{t('planNoneAvailable')}</Text>
              </View>
            ) : (
              <View style={styles.planCard}>
                {/* One row per plan. Access is the same whichever they pick, so
                    the choice is only length and price — laid out to compare. */}
                {plans.map((plan) => {
                  const rupees = Math.round(plan.pricePaise / 100);
                  const perMonth = plan.durationDays
                    ? Math.round((rupees / plan.durationDays) * 30)
                    : rupees;
                  const playProduct = plan.playProductId ? play.products[plan.playProductId] : undefined;
                  // On a Play build a plan Google has never heard of cannot be
                  // bought, so it is shown but not selectable.
                  const buyable = !play.available || !plan.playProductId || Boolean(playProduct);
                  const selected = plan.code === selectedPlan?.code;

                  return (
                    <Pressable
                      key={plan.code}
                      style={[
                        styles.planOption,
                        selected && styles.planOptionSelected,
                        !buyable && styles.planOptionDisabled,
                      ]}
                      disabled={!buyable}
                      onPress={() => setSelectedCode(plan.code)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: !buyable }}
                    >
                      <View style={styles.planRadio}>
                        {selected ? <View style={styles.planRadioDot} /> : null}
                      </View>

                      <View style={styles.planOptionBody}>
                        <View style={styles.planOptionTop}>
                          <Text style={styles.planName}>{plan.name}</Text>
                          {plan.badge ? (
                            <View style={styles.popularPill}>
                              <Text style={styles.popularText}>{plan.badge}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.planCadence}>
                          {t('planForDays', { days: plan.durationDays })}
                          {plan.durationDays > 30 ? ` · ${t('planPerMonthApprox', { amount: perMonth })}` : ''}
                        </Text>
                        {!buyable ? <Text style={styles.planUnavailable}>{t('planNotOnPlay')}</Text> : null}
                      </View>

                      <Text style={styles.planOptionPrice}>
                        {playProduct?.displayPrice || `₹${rupees}`}
                      </Text>
                    </Pressable>
                  );
                })}

                <View style={styles.perks}>
                  {PERK_KEYS.map((perk) => (
                    <View key={perk} style={styles.perkRow}>
                      <View style={styles.perkIcon}>
                        <Ionicons name="checkmark" size={13} color={palette.primary} />
                      </View>
                      <Text style={styles.perkText}>{t(perk)}</Text>
                    </View>
                  ))}
                </View>

                {plans.length > 1 ? (
                  <Text style={styles.planFootnote}>{t('planFullAccessNote')}</Text>
                ) : null}

                {play.available ? (
                  <>
                    <PrimaryButton
                      label={
                        play.purchasing
                          ? t('subOpeningPlay')
                          : t('planSubscribeFor', { price: selectedPrice })
                      }
                      onPress={() => {
                        if (selectedPlan?.playProductId) void play.buy(selectedPlan.playProductId);
                      }}
                      disabled={play.purchasing || play.loading || !selectedPlan?.playProductId}
                    />
                    {play.error ? <Text style={styles.playError}>{play.error}</Text> : null}

                    {/*
                      * For anyone who paid but never got access — the purchase
                      * exists at Google, so this asks for it again rather than
                      * leaving them to buy twice.
                      */}
                    <Pressable
                      style={styles.restoreButton}
                      disabled={play.restoring}
                      onPress={() => void play.restore()}
                    >
                      <Text style={styles.restoreButtonText}>
                        {play.restoring ? t('subChecking') : t('subRestorePurchase')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <PrimaryButton
                      label={processing ? t('subOpeningCheckout') : t('planSubscribeFor', { price: selectedPrice })}
                      onPress={handlePurchase}
                      disabled={processing || !selectedPlan}
                    />
                    {play.error ? <Text style={styles.playError}>{play.error}</Text> : null}
                  </>
                )}
              </View>
            )}
          </>
        )}

        <View style={styles.footnote}>
          <Ionicons name="lock-closed" size={13} color={palette.muted} />
          {/* Name the processor that will actually take the payment. This read
              "Secured by Razorpay" on every device, including the ones paying
              through Google Play. */}
          <Text style={styles.footnoteText}>
            {play.available
              ? t('subBilledPlay')
              : t('subSecuredRazorpayCancel')}
          </Text>
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
    planName: { fontSize: 20, fontWeight: '800', color: palette.text, letterSpacing: -0.3 },
    planCadence: { fontSize: 13, color: palette.muted, marginTop: 2 },
    popularPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: palette.primarySoft,
    },
    popularText: { fontSize: 11, fontWeight: '800', color: palette.primary, letterSpacing: 0.3 },

    /* One selectable plan. The row reads name, length, price left to right so
       two plans of different lengths line up for comparison. */
    planOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    planOptionSelected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
    planOptionDisabled: { opacity: 0.5 },
    planOptionBody: { flex: 1 },
    planOptionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    planOptionPrice: { fontSize: 19, fontWeight: '800', color: palette.text, letterSpacing: -0.4 },
    planRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
    planUnavailable: { fontSize: 12, color: palette.danger, marginTop: 3 },
    planFootnote: { fontSize: 12.5, color: palette.muted, lineHeight: 18 },
    emptyPlans: { fontSize: 14.5, color: palette.muted, textAlign: 'center', paddingVertical: spacing.md },

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
    restoreButton: { paddingVertical: 12, alignItems: 'center' },
    restoreButtonText: { color: palette.primary, fontSize: 14, fontWeight: '600' },
    playError: { fontSize: 13, color: palette.danger, marginTop: spacing.sm, textAlign: 'center' },
  });
}
