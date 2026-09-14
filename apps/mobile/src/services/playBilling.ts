import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
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
    product: null,
    error: null,
  });

  // Keeps the listeners from calling back into an unmounted screen.
  const mounted = useRef(true);
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

        const products = await fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'subs' });
        if (!mounted.current) return;

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

  const buy = useCallback(async () => {
    setState((prev) => ({ ...prev, purchasing: true, error: null }));
    try {
      // Resolves when Play accepts the request; the actual result arrives on
      // the purchase listener above.
      // Platform key is `google` (the SDK vendor), not `android`.
      await requestPurchase({
        request: { google: { skus: [PREMIUM_PRODUCT_ID] } },
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

  return { ...state, buy };
}
