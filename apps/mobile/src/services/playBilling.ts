import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import { api } from './api';

/** Must match the subscription's product ID in Play Console exactly. */
export const PREMIUM_PRODUCT_ID = 'premium_monthly';

interface PlayBillingState {
  available: boolean;
  loading: boolean;
  purchasing: boolean;
  /** True while re-checking the store for a purchase we never confirmed. */
  restoring: boolean;
  product: { displayPrice?: string; title?: string } | null;
  error: string | null;
}

/**
 * Google Play subscription purchasing.
 *
 * A purchase is only worth anything once the server has checked the token with
 * Google, so nothing here grants access on its own — `onEntitled` fires after
 * our API confirms it. Treating the client's own success callback as proof
 * would let anyone with a patched build unlock the app.
 */
export function usePlayBilling(onEntitled: () => void) {
  const [state, setState] = useState<PlayBillingState>({
    available: false,
    loading: true,
    purchasing: false,
    restoring: false,
    product: null,
    error: null,
  });

  // Keeps the listeners from calling back into an unmounted screen.
  const mounted = useRef(true);

  /*
   * Play Billing v5+ will not open a subscription purchase without an offer
   * token, and the token is only available on the product returned by
   * fetchProducts. Holding it in a ref keeps `buy` stable while still seeing
   * the value fetched after mount.
   */
  const offersRef = useRef<Array<{ sku: string; offerToken: string }>>([]);
  const onEntitledRef = useRef(onEntitled);
  onEntitledRef.current = onEntitled;

  useEffect(() => {
    mounted.current = true;

    // Play Billing is Android-only; iOS would need StoreKit, which this app
    // does not ship yet.
    if (Platform.OS !== 'android') {
      setState((prev) => ({ ...prev, available: false, loading: false }));
      return;
    }

    let purchaseSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;

    const setup = async () => {
      try {
        await initConnection();

        purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          const token = purchase.purchaseToken;
          if (!token) return;

          try {
            // The server verifies with Google and, if genuine, acknowledges the
            // purchase. Play auto-refunds anything unacknowledged after three
            // days, so a failure here is not cosmetic.
            const result = await api.verifyPlayPurchase(token);
            if (!mounted.current) return;

            if (result.active) {
              setState((prev) => ({ ...prev, purchasing: false, error: null }));
              onEntitledRef.current();
            } else {
              setState((prev) => ({
                ...prev,
                purchasing: false,
                error: 'Your payment went through but is not active yet. Pull down to refresh in a moment.',
              }));
            }
          } catch (err) {
            if (!mounted.current) return;
            setState((prev) => ({
              ...prev,
              purchasing: false,
              error: (err as Error).message || 'We could not confirm the purchase. Contact support if you were charged.',
            }));
          }
        });

        errorSub = purchaseErrorListener((err) => {
          if (!mounted.current) return;
          // Backing out of the Play sheet is a normal choice, not a failure.
          setState((prev) => ({
            ...prev,
            purchasing: false,
            error: isUserCancelledError(err) ? null : err?.message || 'The purchase could not be completed.',
          }));
        });

        /*
         * Pick up anything bought but never confirmed, before showing the
         * plan. A member who has already paid should not be looking at a
         * Subscribe button.
         */
        try {
          const outstanding = await getAvailablePurchases();
          for (const purchase of outstanding ?? []) {
            const token = (purchase as Purchase).purchaseToken;
            if (!token) continue;
            const result = await api.verifyPlayPurchase(token);
            if (result.active) {
              onEntitledRef.current();
              break;
            }
          }
        } catch {
          // Not fatal: the buy flow and the manual restore both still work.
        }

        const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' });
        if (!mounted.current) return;

        const subscription = products?.[0] as
          | { subscriptionOffers?: Array<{ offerTokenAndroid?: string | null }> }
          | undefined;

        offersRef.current = (subscription?.subscriptionOffers ?? [])
          .map((offer) => offer?.offerTokenAndroid)
          .filter((token): token is string => Boolean(token))
          .map((offerToken) => ({ sku: PREMIUM_PRODUCT_ID, offerToken }));

        setState((prev) => ({
          ...prev,
          available: true,
          loading: false,
          product: (products?.[0] as { displayPrice?: string; title?: string }) ?? null,
          // An empty list nearly always means Play Console setup rather than a
          // code fault, so say which.
          error: products?.length
            ? null
            : 'This subscription is not available yet. It may still be rolling out on Google Play.',
        }));
      } catch (err) {
        if (!mounted.current) return;
        setState((prev) => ({
          ...prev,
          available: false,
          loading: false,
          error: (err as Error).message || 'Google Play billing is unavailable on this device.',
        }));
      }
    };

    void setup();

    return () => {
      mounted.current = false;
      purchaseSub?.remove();
      errorSub?.remove();
      void endConnection();
    };
  }, []);

  /*
   * Re-check the store for a purchase we never confirmed.
   *
   * purchaseUpdatedListener only fires for a purchase made in this session, so
   * if verification failed at the moment of buying — a cold server, a dropped
   * connection — nothing ever retried and the member stayed unsubscribed
   * despite having paid. Play keeps the purchase until it is acknowledged, so
   * asking the store for it is the recovery path.
   */
  const restore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    setState((prev) => ({ ...prev, restoring: true, error: null }));
    try {
      const purchases = await getAvailablePurchases();
      const tokens = (purchases ?? [])
        .map((purchase) => (purchase as Purchase).purchaseToken)
        .filter((token): token is string => Boolean(token));

      if (!tokens.length) {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            restoring: false,
            error: 'We could not find a purchase on this Google account.',
          }));
        }
        return false;
      }

      for (const token of tokens) {
        const result = await api.verifyPlayPurchase(token);
        if (result.active) {
          if (mounted.current) setState((prev) => ({ ...prev, restoring: false, error: null }));
          onEntitledRef.current();
          return true;
        }
      }

      if (mounted.current) {
        setState((prev) => ({
          ...prev,
          restoring: false,
          error: 'We found a purchase but it is not active yet. Please try again shortly.',
        }));
      }
      return false;
    } catch (err) {
      if (mounted.current) {
        setState((prev) => ({
          ...prev,
          restoring: false,
          error: (err as Error).message || 'Could not restore the purchase.',
        }));
      }
      return false;
    }
  }, []);

  const buy = useCallback(async () => {
    setState((prev) => ({ ...prev, purchasing: true, error: null }));
    try {
      // Resolves when Play accepts the request; the actual result arrives on
      // the purchase listener above.
      // Platform key is `google` (the SDK vendor), not `android`.
      //
      // subscriptionOffers carries the offer token for the base plan. Play
      // Billing v5+ refuses to open the purchase sheet without it, and leaving
      // it out fails at the payment step rather than at startup — the worst
      // place to find out.
      const subscriptionOffers = offersRef.current;
      if (!subscriptionOffers.length) {
        throw new Error('This subscription is not available to purchase yet. Please try again shortly.');
      }

      await requestPurchase({
        request: { google: { skus: [PREMIUM_PRODUCT_ID], subscriptionOffers } },
        type: 'subs',
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        purchasing: false,
        error: (err as Error).message || 'Could not open Google Play.',
      }));
    }
  }, []);

  return { ...state, buy, restore };
}
