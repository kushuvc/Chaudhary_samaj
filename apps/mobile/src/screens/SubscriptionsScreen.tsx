import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemePalette } from '../context/ThemeContext';
import { useAppLanguage } from '../context/LanguageContext';
import { ScreenTitle } from '../components/AppPrimitives';
import { api } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

interface SubscriptionData {
  hasSubscription: boolean;
  plan?: string;
  amount?: number;
  expiresAt?: string;
}

const PLAN = { name: 'Monthly Plan', amount: 200, days: 30 };

export function SubscriptionsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const pendingPlanRef = useRef<{ plan: string; amount: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      console.log('[loadSubscription] Loading subscription status...');
      const data = await api.getSubscriptionStatus();
      console.log('[loadSubscription] Subscription data received:', data);
      setSubscription(data);
      console.log('[loadSubscription] Subscription state updated');
    } catch (err) {
      console.error('[loadSubscription] Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // Handle web callback from Razorpay (for localhost testing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const razorpayPaymentId = urlParams.get('razorpay_payment_id');
      const razorpayPaymentLinkId = urlParams.get('razorpay_payment_link_id');
      const razorpayPaymentStatus = urlParams.get('razorpay_payment_link_status');
      
      if (razorpayPaymentId && razorpayPaymentStatus === 'paid') {
        console.log('[web-callback] Razorpay payment callback detected:', {
          razorpayPaymentId,
          razorpayPaymentLinkId,
          razorpayPaymentStatus
        });
        
        // Process the payment verification
        handleWebPaymentVerification({
          razorpay_payment_id: razorpayPaymentId,
          razorpay_payment_link_id: razorpayPaymentLinkId || '',
          razorpay_payment_link_reference_id: urlParams.get('razorpay_payment_link_reference_id') || '',
          razorpay_payment_link_status: razorpayPaymentStatus,
          razorpay_signature: urlParams.get('razorpay_signature') || '',
          plan: urlParams.get('plan') || 'premium',
          amount: Number(urlParams.get('amount')) || 200
        });
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Listen for deep link return from Razorpay
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (!url || !url.includes('chaudharysamaj://')) return;
      
      // Handle Razorpay payment callback
      if (url.includes('payment/razorpay')) {
        console.log('[deep-link] Payment callback received:', url);
        const parsed = new URL(url);
        const params = Object.fromEntries(parsed.searchParams);
        console.log('[deep-link] Parsed params:', params);

        const {
        razorpay_payment_id,
        razorpay_payment_link_id,
        razorpay_payment_link_reference_id,
        razorpay_payment_link_status,
        razorpay_signature,
        plan,
        amount,
      } = params;

      if (!razorpay_payment_id || razorpay_payment_link_status !== 'paid') {
        Alert.alert('Payment Failed', 'Your payment was not completed. Please try again.');
        return;
      }

      setVerifying(true);
      console.log('[payment-verify] Starting verification with params:', {
        razorpay_payment_id,
        razorpay_payment_link_id,
        razorpay_payment_link_status,
        plan,
        amount
      });
      try {
        const result = await api.verifyPaymentLink({
          razorpay_payment_id,
          razorpay_payment_link_id,
          razorpay_payment_link_reference_id,
          razorpay_payment_link_status,
          razorpay_signature,
          plan: plan ?? pendingPlanRef.current?.plan ?? 'premium',
          amount: Number(amount) || pendingPlanRef.current?.amount || 0,
        });
        console.log('[payment-verify] Verification result:', result);
        if (result.verified) {
          console.log('[payment-verify] Payment verified, loading subscription...');
          await loadSubscription();
          console.log('[payment-verify] Subscription loaded after verification');
        }
      } catch (err) {
        console.error('[payment-verify] Verification failed:', err);
        Alert.alert('Verification Failed', 'Payment done but verification failed. Please contact support.');
      } finally {
        setVerifying(false);
        setAwaitingReturn(false);
        pendingPlanRef.current = null;
      }
    }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle app opened via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl({ url });
    });

    return () => subscription.remove();
  }, [loadSubscription]);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Poll every 3s after payment link opens — works even without deep link (webhook activates subscription server-side)
  const startPolling = useCallback(() => {
    stopPolling();
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 3 minutes
    
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        console.log(`[polling] Attempt ${attempts}: Checking subscription status...`);
        const data = await api.getSubscriptionStatus();
        console.log(`[polling] Attempt ${attempts}: Subscription data:`, data);
        
        if (data.hasSubscription) {
          console.log('[polling] Subscription detected! Stopping polling.');
          setSubscription(data);
          setAwaitingReturn(false);
          stopPolling();
          Alert.alert('Success', 'Your subscription has been activated!');
        } else if (attempts >= maxAttempts) {
          console.log('[polling] Max attempts reached, stopping polling');
          setAwaitingReturn(false);
          stopPolling();
          Alert.alert('Timeout', 'Payment verification timed out. Please check manually.');
        }
      } catch (err) {
        console.error('[polling] Error:', err);
        if (attempts >= maxAttempts) {
          setAwaitingReturn(false);
          stopPolling();
        }
      }
    }, 3000);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handlePurchase = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      console.log('[purchase] Starting payment process...');
      pendingPlanRef.current = { plan: 'premium', amount: PLAN.amount };
      console.log('[purchase] Creating payment link...');
      const paymentLink = await api.createPaymentLink('premium', PLAN.amount);
      console.log('[purchase] Payment link created:', paymentLink);
      console.log('[purchase] Checking if URL can be opened:', paymentLink.short_url);
      const supported = await Linking.canOpenURL(paymentLink.short_url);
      console.log('[purchase] URL supported:', supported);
      if (supported) {
        console.log('[purchase] Opening URL:', paymentLink.short_url);
        try {
          await Linking.openURL(paymentLink.short_url);
          console.log('[purchase] URL opened via Linking, starting polling...');
        } catch (linkErr) {
          console.error('[purchase] Linking.openURL failed, trying window.open:', linkErr);
          // Fallback for web testing
          window.open(paymentLink.short_url, '_blank');
          console.log('[purchase] URL opened via window.open, starting polling...');
        }
        setAwaitingReturn(true);
        startPolling();
      } else {
        console.error('[purchase] URL not supported:', paymentLink.short_url);
        Alert.alert('Error', 'Cannot open payment page');
        pendingPlanRef.current = null;
      }
    } catch (err) {
      console.error('[purchase] Payment initiation failed:', err);
      Alert.alert('Error', 'Failed to initiate payment: ' + (err as Error).message);
      pendingPlanRef.current = null;
    } finally {
      setProcessing(false);
    }
  };

  const handleManualCheck = async () => {
    setVerifying(true);
    await loadSubscription();
    setVerifying(false);
    setAwaitingReturn(false);
    stopPolling();
  };

  const handleWebPaymentVerification = async (params: {
    razorpay_payment_id: string;
    razorpay_payment_link_id: string;
    razorpay_payment_link_reference_id: string;
    razorpay_payment_link_status: string;
    razorpay_signature: string;
    plan: string;
    amount: number;
  }) => {
    console.log('[web-verify] Starting web payment verification...');
    setVerifying(true);
    try {
      const result = await api.verifyPaymentLink(params);
      console.log('[web-verify] Verification result:', result);
      if (result.verified) {
        console.log('[web-verify] Payment verified, loading subscription...');
        await loadSubscription();
        console.log('[web-verify] Subscription loaded after web verification');
        Alert.alert('Success', 'Payment completed! Subscription activated.');
      }
    } catch (err) {
      console.error('[web-verify] Web verification failed:', err);
      Alert.alert('Verification Failed', 'Payment verification failed. Please contact support.');
    } finally {
      setVerifying(false);
      setAwaitingReturn(false);
    }
  };

  const handleManualVerification = async () => {
    console.log('[manual-verify] Starting manual payment verification...');
    setVerifying(true);
    try {
      // Simulate the payment verification with test data
      const result = await api.verifyPaymentLink({
        razorpay_payment_id: 'pay_web_test_' + Date.now(),
        razorpay_payment_link_id: 'plink_web_test',
        razorpay_payment_link_reference_id: 'ref_web_test',
        razorpay_payment_link_status: 'paid',
        razorpay_signature: 'web_test_signature',
        plan: 'premium',
        amount: 200,
      });
      console.log('[manual-verify] Verification result:', result);
      if (result.verified) {
        console.log('[manual-verify] Payment verified, loading subscription...');
        await loadSubscription();
        console.log('[manual-verify] Subscription loaded after manual verification');
        // Force a small delay to ensure React state updates
        setTimeout(() => {
          console.log('[manual-verify] Forced re-render check');
        }, 100);
        Alert.alert('Success', 'Payment verified manually! Subscription activated.');
      }
    } catch (err) {
      console.error('[manual-verify] Manual verification failed:', err);
      Alert.alert('Verification Failed', 'Manual verification failed. Please check console for details.');
    } finally {
      setVerifying(false);
      setAwaitingReturn(false);
    }
  };

  const isActive = subscription?.hasSubscription;
  console.log('[UI] Subscription state:', { subscription, isActive });
  const daysLeft = isActive && subscription?.expiresAt
    ? Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const startedAt = (subscription as any)?.startedAt
    ? new Date((subscription as any).startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  if (loading) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (verifying) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 16 }}>Verifying payment...</Text>
        <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>Please wait while we confirm your payment with Razorpay</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScreenTitle title="Subscriptions" />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>

        {/* Active Subscription Banner */}
        {isActive && (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
            <Text style={styles.activeText}>🎉 You're Subscribed!</Text>
            <Text style={[styles.activeText, { fontSize: 15 }]}>Monthly Plan Active</Text>
            {startedAt && (
              <Text style={styles.expiryText}>Started: {startedAt}</Text>
            )}
            <Text style={styles.expiryText}>
              {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Expires today'}
            </Text>
            {subscription?.expiresAt && (
              <Text style={[styles.expiryText, { fontWeight: '600' }]}>
                Valid till: {new Date(subscription.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
        )}

        {/* Awaiting payment return banner */}
        {awaitingReturn && !isActive && (
          <View style={styles.awaitingBanner}>
            <ActivityIndicator size="small" color="#ea580c" />
            <Text style={styles.awaitingText}>Waiting for payment confirmation...</Text>
            <Pressable style={styles.manualCheckBtn} onPress={handleManualCheck}>
              <Text style={styles.manualCheckText}>I've completed payment — check now</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.description}>
          {isActive
            ? 'You have unlimited access to all matrimony profiles.'
            : 'Free users can view only 2 profiles. Subscribe to unlock unlimited profiles.'}
        </Text>

        {/* Single Plan Card */}
        {!isActive && (
          <View style={[styles.planCard, styles.premiumCard]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{PLAN.name}</Text>
              <View style={styles.bestValueBadge}><Text style={styles.bestValueText}>Most Popular</Text></View>
            </View>
            <Text style={[styles.planPrice, styles.premiumPrice]}>₹{PLAN.amount}<Text style={{ fontSize: 14, fontWeight: '400' }}> / month</Text></Text>
            <View style={styles.features}>
              <Text style={styles.planFeatures}>✓ Unlimited profile views</Text>
              <Text style={styles.planFeatures}>✓ View all phone numbers</Text>
              <Text style={styles.planFeatures}>✓ Send unlimited interests</Text>
              <Text style={styles.planFeatures}>✓ Valid for {PLAN.days} days</Text>
            </View>
            <Pressable
              style={[styles.buyButton, styles.premiumButton, processing && styles.buttonDisabled]}
              onPress={handlePurchase}
              disabled={processing}
            >
              <Text style={styles.buyButtonText}>
                {processing ? 'Processing...' : 'Subscribe Now — ₹200/month'}
              </Text>
            </Pressable>
            
            {/* Manual verification button for web testing */}
            <Pressable
              style={[styles.manualCheckBtn, { marginTop: 12 }]}
              onPress={handleManualVerification}
            >
              <Text style={styles.manualCheckText}>🔧 Web Testing: Manual Verify Payment</Text>
            </Pressable>
            
            {/* Instructions for actual payment */}
            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: '#0369a1', textAlign: 'center' }}>
                💡 After completing Razorpay payment, click "Manual Verify" to activate subscription
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.note}>
          🔒 Secure payments powered by Razorpay. Cancel anytime.
        </Text>
      </ScrollView>
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
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      gap: 16,
    },
    activeBanner: {
      backgroundColor: '#E8F5E9',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#4CAF50',
    },
    activeText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#4CAF50',
      marginTop: 8,
    },
    expiryText: {
      fontSize: 14,
      color: palette.muted,
      marginTop: 4,
    },
    description: {
      fontSize: 16,
      color: palette.text,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
    },
    plansContainer: {
      marginTop: 24,
      gap: 16,
    },
    planCard: {
      backgroundColor: palette.cardBg,
      borderRadius: 12,
      padding: 20,
      borderWidth: 2,
      borderColor: palette.border,
    },
    planCardDisabled: {
      opacity: 0.6,
    },
    planCardActive: {
      borderColor: '#4CAF50',
      borderWidth: 3,
    },
    premiumCard: {
      borderColor: '#FFD700',
      borderWidth: 2,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.text,
    },
    planPrice: {
      fontSize: 32,
      fontWeight: '700',
      color: palette.primary,
      marginBottom: 12,
    },
    premiumPrice: {
      color: '#FF9800',
    },
    features: {
      gap: 4,
      marginBottom: 16,
    },
    planFeatures: {
      fontSize: 14,
      color: palette.text,
      marginBottom: 4,
      lineHeight: 20,
    },
    activeBadge: {
      backgroundColor: '#4CAF50',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    activeBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    bestValueBadge: {
      backgroundColor: '#FF9800',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    bestValueText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    buyButton: {
      backgroundColor: palette.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    premiumButton: {
      backgroundColor: '#FF9800',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buyButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    note: {
      fontSize: 14,
      color: palette.muted,
      textAlign: 'center',
      marginTop: 24,
      fontStyle: 'italic',
    },
    awaitingBanner: {
      backgroundColor: '#fff7ed',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center' as const,
      gap: 10,
      borderWidth: 1,
      borderColor: '#fed7aa',
    },
    awaitingText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ea580c',
    },
    manualCheckBtn: {
      backgroundColor: '#ea580c',
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    manualCheckText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 13,
    },
  });
}
