import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { GradientFill, PrimaryButton } from '../components/ui';
import { MatrimonyArt } from '../components/MatrimonyArt';
import { api, type AadhaarStatus } from '../services/api';
import { usePlayBilling } from '../services/playBilling';
import { radius, shadow, spacing } from '../theme';

import type { PlanCapabilities, SubscriptionPlan, SubscriptionStatus } from '../services/api';
import { useAppLanguage } from '../context/LanguageContext';

type SubscriptionData = SubscriptionStatus;

/*
 * What a plan gets you.
 *
 * Every plan opens the directory; the other three are per-plan now, so this
 * lists them with a tick or a cross rather than pretending they are the same.
 * A member has to be able to see what they are choosing between.
 */
const PERKS: Array<{ key: string; capability?: keyof PlanCapabilities }> = [
  { key: 'capViewProfiles' },
  { key: 'capViewPhone', capability: 'canViewPhone' },
  { key: 'capViewPhoneUnmatched', capability: 'canViewPhoneUnmatched' },
  { key: 'capHidePhone', capability: 'canHidePhone' },
  { key: 'capSendInterest', capability: 'canSendInterest' },
  { key: 'capChat', capability: 'canChat' },
];

/** Off unless a plan switches them on, so a missing flag reads as not included. */
const OPT_IN: Array<keyof PlanCapabilities> = ['canViewPhoneUnmatched', 'canHidePhone'];

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
  const [helpOpen, setHelpOpen] = useState(false);

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

  /*
   * Aadhaar-verified members get the "verified-discount" Play offer. Checked
   * on focus so a member who verifies and comes back sees the price drop.
   */
  const navigation = useNavigation<any>();
  const [idStatus, setIdStatus] = useState<AadhaarStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      api.getVerification().then((v) => setIdStatus(v.aadhaar.status)).catch(() => {});
    }, [])
  );
  const idVerified = idStatus === 'verified';
  // Only mentioned once Play Console actually has the offer.
  const bestDealPercent = Math.max(
    0,
    ...Object.values(play.products).map((product) => product.verifiedPercentOff ?? 0)
  );

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
   * Only prompt someone to compare when there is something to compare. With
   * every plan unlocking the same things, "check the list on each" is noise.
   */
  const plansDifferInWhatTheyUnlock = plans.some((plan) =>
    (plan.dailyProfileViews ?? null) !== (plans[0]?.dailyProfileViews ?? null) ||
    PERKS.some(
      (perk) =>
        perk.capability &&
        Boolean(plan.capabilities?.[perk.capability] ?? !OPT_IN.includes(perk.capability)) !==
          Boolean(plans[0]?.capabilities?.[perk.capability] ?? !OPT_IN.includes(perk.capability))
    )
  );
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
    (idVerified ? selectedPlayProduct?.verifiedPrice : undefined) ??
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
        <MatrimonyArt
          scene="plans"
          title={t('secMembership')}
          subtitle={t('plansArtSub')}
        />

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

            {!idVerified && idStatus && bestDealPercent > 0 ? (
              <Pressable
                style={styles.dealCard}
                onPress={() => navigation.navigate('Verification')}
                accessibilityRole="button"
              >
                <Ionicons name="shield-checkmark" size={26} color={palette.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dealTitle}>{t('planVerifyForDiscountTitle', { percent: bestDealPercent })}</Text>
                  <Text style={styles.dealBody}>
                    {idStatus === 'review' ? t('planVerifyReviewDiscount') : t('planVerifyForDiscountBody')}
                  </Text>
                </View>
                {idStatus === 'review' ? null : <Ionicons name="chevron-forward" size={18} color={palette.muted} />}
              </Pressable>
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
                  /*
                   * On a Play build every plan must go through Play Billing —
                   * Google requires it for digital goods — so a plan with no
                   * product id, or one Google has never heard of, is shown but
                   * cannot be picked. It used to be selectable with a dead
                   * Subscribe button, which reads as broken rather than as
                   * unavailable.
                   */
                  const buyable = !play.available || Boolean(playProduct);
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
                        {idVerified && playProduct?.verifiedPrice ? (
                          <Text style={styles.dealNote}>
                            {t('planVerifiedDeal', { count: playProduct.verifiedCycles ?? 1 })}
                          </Text>
                        ) : null}
                      </View>

                      {idVerified && playProduct?.verifiedPrice ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.planOptionPrice}>{playProduct.verifiedPrice}</Text>
                          <Text style={styles.planOldPrice}>{playProduct.displayPrice}</Text>
                        </View>
                      ) : (
                        <Text style={styles.planOptionPrice}>
                          {playProduct?.displayPrice || `₹${rupees}`}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}

                <View style={styles.perks}>
                  {PERKS.filter(
                    // Only listed once some plan offers it; otherwise it is a
                    // row of crosses for a feature nobody can buy.
                    (perk) =>
                      !perk.capability ||
                      !OPT_IN.includes(perk.capability) ||
                      plans.some((plan) => plan.capabilities?.[perk.capability!] === true)
                  ).map((perk) => {
                    // No capability means every plan has it. An unknown flag
                    // reads as included, matching the server's own default —
                    // except numbers without a match, which is opt-in.
                    const flag = perk.capability ? selectedPlan?.capabilities?.[perk.capability] : undefined;
                    const included =
                      !perk.capability ||
                      (OPT_IN.includes(perk.capability) ? flag === true : flag !== false);
                    return (
                      <View key={perk.key} style={styles.perkRow}>
                        <View style={[styles.perkIcon, !included && styles.perkIconOff]}>
                          <Ionicons
                            name={included ? 'checkmark' : 'close'}
                            size={13}
                            color={included ? palette.primary : palette.muted}
                          />
                        </View>
                        <Text style={[styles.perkText, !included && styles.perkTextOff]}>
                          {perk.key === 'capViewProfiles' && selectedPlan?.dailyProfileViews
                            ? t('capViewProfilesDaily', { count: selectedPlan.dailyProfileViews })
                            : t(perk.key)}
                        </Text>
                        {!included ? (
                          <Text style={styles.perkOffLabel}>{t('capNotIncluded')}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {plans.length > 1 ? (
                  <Text style={styles.planFootnote}>
                    {plansDifferInWhatTheyUnlock ? t('planComparePrompt') : t('planFullAccessNote')}
                  </Text>
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
                        if (selectedPlan?.playProductId) void play.buy(selectedPlan.playProductId, idVerified);
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

        {/*
          * The answers used to sit open on the page and ran longer than the
          * plans themselves, which buried the thing people came here to do.
          * Behind one row instead — offered to everyone, subscribed or not,
          * because a member looking for how to stop paying is exactly who
          * must not have to ask support.
          */}
        <Pressable
          style={({ pressed }) => [styles.helpTrigger, pressed && styles.helpTriggerPressed]}
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('helpOpenTitle')}
        >
          <View style={styles.helpTriggerIcon}>
            <Ionicons name="help-circle" size={22} color={palette.primary} />
          </View>
          <View style={styles.helpTriggerText}>
            <Text style={styles.helpTriggerTitle}>{t('helpOpenTitle')}</Text>
            <Text style={styles.helpTriggerSub}>{t('helpOpenSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>

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

      <Modal
        visible={helpOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          {/* Tapping the dimmed area closes, the way every other sheet on the
              phone behaves. The sheet itself swallows the press. */}
          <Pressable style={styles.sheetDismissArea} onPress={() => setHelpOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('helpTitle')}</Text>
              <Pressable
                onPress={() => setHelpOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('helpClose')}
              >
                <Ionicons name="close" size={22} color={palette.muted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.helpHeading}>{t('helpWhatTitle')}</Text>
              <Text style={styles.helpBody}>{t('helpWhatBody')}</Text>

              <Text style={styles.helpHeading}>{t('helpPayTitle')}</Text>
              {['helpPayStep1', 'helpPayStep2', 'helpPayStep3', 'helpPayStep4'].map((key, i) => (
                <View key={key} style={styles.helpStep}>
                  <View style={styles.helpStepNum}>
                    <Text style={styles.helpStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.helpStepText}>{t(key)}</Text>
                </View>
              ))}
              <View style={styles.helpNote}>
                <Ionicons name="shield-checkmark" size={16} color={palette.primary} />
                <Text style={styles.helpNoteText}>{t('helpPaySafe')}</Text>
              </View>

              <Text style={styles.helpHeading}>{t('helpRenewTitle')}</Text>
              <Text style={styles.helpBody}>{t('helpRenewBody')}</Text>

              <Text style={styles.helpHeading}>{t('helpCancelTitle')}</Text>
              <Text style={styles.helpBody}>{t('helpCancelBody')}</Text>
              <View style={styles.helpNote}>
                <Ionicons name="checkmark-circle" size={16} color={palette.primary} />
                <Text style={styles.helpNoteText}>{t('helpCancelKeep')}</Text>
              </View>

              <Text style={styles.helpHeading}>{t('helpChangeTitle')}</Text>
              <Text style={styles.helpBody}>{t('helpChangeBody')}</Text>

              <Text style={styles.helpHeading}>{t('helpPhoneTitle')}</Text>
              <Text style={styles.helpBody}>{t('helpPhoneBody')}</Text>
            </ScrollView>

            {/* A rule under the scrolling text, so a line cut off mid-glyph
                at the fold reads as "there is more" rather than as broken. */}
            <View style={styles.sheetFooter}>
              <PrimaryButton label={t('helpClose')} onPress={() => setHelpOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
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
    planOldPrice: { fontSize: 13, color: palette.muted, textDecorationLine: 'line-through' },
    dealNote: { fontSize: 12.5, fontWeight: '700', color: palette.success, marginTop: 3 },
    dealCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: palette.successSoft,
      borderWidth: 1,
      borderColor: palette.success,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    dealTitle: { fontSize: 15, fontWeight: '800', color: palette.text },
    dealBody: { fontSize: 13, lineHeight: 18, color: palette.textSoft, marginTop: 2 },
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
    perkIconOff: { backgroundColor: palette.border },
    perkTextOff: { color: palette.muted },
    perkOffLabel: { fontSize: 12, color: palette.muted },

    footnote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.xs,
    },
    footnoteText: { fontSize: 12.5, color: palette.muted },

    /* One quiet row, not a wall of text. It has to read as a thing you can
       tap — icon, two lines, chevron — or nobody finds the answers. */
    helpTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: palette.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    helpTriggerPressed: { opacity: 0.6 },
    helpTriggerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpTriggerText: { flex: 1, gap: 2 },
    helpTriggerTitle: { fontSize: 15.5, fontWeight: '700', color: palette.text },
    helpTriggerSub: { fontSize: 13, color: palette.muted },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheetDismissArea: { flex: 1 },
    sheet: {
      /* Capped so the plans stay visible behind it — the sheet is an aside,
         not a second screen. */
      maxHeight: '82%',
      backgroundColor: palette.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    sheetGrabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.border,
      marginBottom: spacing.sm,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetScroll: { flexGrow: 0 },
    sheetContent: { paddingBottom: spacing.lg, gap: 2 },
    sheetFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palette.border,
      paddingTop: spacing.md,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '800',
      color: palette.text,
      letterSpacing: -0.3,
    },
    helpHeading: {
      fontSize: 15.5,
      fontWeight: '700',
      color: palette.text,
      marginTop: spacing.md,
      marginBottom: 4,
    },
    helpBody: { fontSize: 15, lineHeight: 23, color: palette.textSoft ?? palette.text },
    helpStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: 8 },
    helpStepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: palette.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    helpStepNumText: { fontSize: 12.5, fontWeight: '800', color: palette.primary },
    helpStepText: { flex: 1, fontSize: 15, lineHeight: 23, color: palette.textSoft ?? palette.text },
    helpNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: palette.primarySoft,
    },
    helpNoteText: { flex: 1, fontSize: 14, lineHeight: 21, color: palette.text },
    restoreButton: { paddingVertical: 12, alignItems: 'center' },
    restoreButtonText: { color: palette.primary, fontSize: 14, fontWeight: '600' },
    playError: { fontSize: 13, color: palette.danger, marginTop: spacing.sm, textAlign: 'center' },
  });
}
