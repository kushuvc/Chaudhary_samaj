import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

const PLANS = {
  basic: { name: 'Basic Pack', amount: 50, unlocks: 5, days: 7 },
  premium: { name: 'Premium Pack', amount: 200, unlocks: -1, days: 30 },
};

export function SubscriptionsScreen() {
  const { palette } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(palette), [palette]);
  
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const data = await api.getSubscriptionStatus();
      setSubscription(data);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: 'basic' | 'premium') => {
    if (processing) return;
    
    try {
      setProcessing(true);
      
      // Create Razorpay Payment Link via backend
      const planData = PLANS[plan];
      const paymentLink = await api.createPaymentLink(plan, planData.amount);
      
      // Open payment link in browser
      const supported = await Linking.canOpenURL(paymentLink.short_url);
      if (supported) {
        await Linking.openURL(paymentLink.short_url);
        
        // Show confirmation dialog
        Alert.alert(
          'Complete Payment',
          'You will be redirected to complete payment in your browser. After payment, return to the app and pull down to refresh.',
          [
            { text: 'OK', onPress: () => {
              // Auto-refresh subscription status after 10 seconds
              setTimeout(() => loadSubscription(), 10000);
            }}
          ]
        );
      } else {
        Alert.alert('Error', 'Cannot open payment link');
      }
      
    } catch (err) {
      Alert.alert('Error', 'Failed to create payment: ' + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const simulatePayment = async (orderId: string, plan: string, amount: number, result: 'success' | 'failure') => {
    if (result === 'success') {
      // Simulate payment success
      const mockPaymentId = 'pay_' + Date.now();
      const mockSignature = 'mock_signature';
      
      try {
        await api.verifyPayment(orderId, mockPaymentId, mockSignature, plan, amount);
        Alert.alert('Success!', `Payment completed!\nYou now have ${plan === 'basic' ? '5 unlocks for 7 days' : 'unlimited access for 30 days'}`, [
          { text: 'OK', onPress: loadSubscription }
        ]);
      } catch (err) {
        Alert.alert('Error', 'Verification failed: ' + (err as Error).message);
      }
    } else {
      Alert.alert('Failed', 'Payment was cancelled or failed. Try again.');
    }
  };

  const isActive = subscription?.hasSubscription;
  const isPremium = subscription?.plan === 'premium';
  const daysLeft = isActive && subscription?.expiresAt 
    ? Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <View style={styles.page}>
      <ScreenTitle title="Subscriptions" />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* Active Subscription Banner */}
        {isActive && (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
            <Text style={styles.activeText}>
              Active: {isPremium ? 'Premium' : 'Basic'} Plan
            </Text>
            <Text style={styles.expiryText}>
              Expires in {daysLeft} days
            </Text>
          </View>
        )}

        <Text style={styles.description}>
          Subscribe to unlock premium features like viewing phone numbers, unlimited interests, and more!
        </Text>

        <View style={styles.plansContainer}>
          {/* Basic Plan */}
          <View style={[styles.planCard, isPremium && styles.planCardDisabled]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{PLANS.basic.name}</Text>
              {isActive && !isPremium && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>}
            </View>
            <Text style={styles.planPrice}>₹{PLANS.basic.amount}</Text>
            <View style={styles.features}>
              <Text style={styles.planFeatures}>✓ Unlock {PLANS.basic.unlocks} phone numbers</Text>
              <Text style={styles.planFeatures}>✓ Valid for {PLANS.basic.days} days</Text>
            </View>
            {!isActive && (
              <Pressable 
                style={[styles.buyButton, processing && styles.buttonDisabled]} 
                onPress={() => handlePurchase('basic')}
                disabled={processing}
              >
                <Text style={styles.buyButtonText}>
                  {processing ? 'Processing...' : 'Buy Now'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Premium Plan */}
          <View style={[styles.planCard, styles.premiumCard, isPremium && styles.planCardActive]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{PLANS.premium.name}</Text>
              {isPremium && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>}
              {!isPremium && <View style={styles.bestValueBadge}><Text style={styles.bestValueText}>Best Value</Text></View>}
            </View>
            <Text style={[styles.planPrice, styles.premiumPrice]}>₹{PLANS.premium.amount}</Text>
            <View style={styles.features}>
              <Text style={styles.planFeatures}>✓ View ALL phone numbers</Text>
              <Text style={styles.planFeatures}>✓ Unlimited interests</Text>
              <Text style={styles.planFeatures}>✓ Priority listing</Text>
              <Text style={styles.planFeatures}>✓ Valid for {PLANS.premium.days} days</Text>
            </View>
            {!isPremium && (
              <Pressable 
                style={[styles.buyButton, styles.premiumButton, processing && styles.buttonDisabled]} 
                onPress={() => handlePurchase('premium')}
                disabled={processing}
              >
                <Text style={styles.buyButtonText}>
                  {processing ? 'Processing...' : isActive ? 'Upgrade Now' : 'Buy Now'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

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
  });
}
