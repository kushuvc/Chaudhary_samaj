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

/**
 * Product id for the plan that was the only one. Kept as the fallback for a
 * build that cannot reach the plans endpoint, so billing still works offline
 * of the admin screen rather than not at all.
 */
export const PREMIUM_PRODUCT_ID = 'premium_monthly';

/**
 * The Play offer for Aadhaar-verified members, created in Play Console on each
 * plan's base plan with "Developer determined" eligibility. Play hands such an
 * offer to every client, so it is this app that decides who may use it. The
 * server checks the same id on purchase.
 */
export const VERIFIED_OFFER_ID = 'verified-discount';

/** What Play knows about one subscription product. */
export interface PlayProduct {
  sku: string;
  displayPrice?: string;
  title?: string;
  /** Price during the verified-member offer, when Play Console has one. */
  verifiedPrice?: string;
  /** How many billing periods that price lasts. */
  verifiedCycles?: number;
  /** Whole-number discount against the regular price, e.g. 50. */
  verifiedPercentOff?: number;
}

interface OfferEntry {
  offerToken: string;
  verified: boolean;
  /** Pricing phases; a plain base plan has exactly one. */
  phases: Array<{ formattedPrice: string; priceAmountMicros: string; billingCycleCount: number }>;
}

interface PlayBillingState {
  available: boolean;
  loading: boolean;
  purchasing: boolean;
  /** True while re-checking the store for a purchase we never confirmed. */
  restoring: boolean;
  /** Keyed by product id, so each plan card can show Play's own price. */
  products: Record<string, PlayProduct>;
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
export function usePlayBilling(productIds: string[], onEntitled: () => void) {
  const [state, setState] = useState<PlayBillingState>({
    available: false,
    loading: true,
    purchasing: false,
    restoring: false,
    products: {},
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
  const offersRef = useRef<Record<string, OfferEntry[]>>({});
  const onEntitledRef = useRef(onEntitled);
  onEntitledRef.current = onEntitled;

  /*
   * The plan list arrives asynchronously, so this effect re-runs as it lands.
   * Joining the ids gives it a stable dependency — a new array with the same
   * contents would otherwise tear down and rebuild the Play connection on
   * every render.
   */
  const skuKey = productIds.join(',');

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

        const skus = productIds.length ? productIds : [PREMIUM_PRODUCT_ID];
        const products = await fetchProducts({ skus, type: 'subs' });
        if (!mounted.current) return;

        const offers: Record<string, OfferEntry[]> = {};
        const catalogue: Record<string, PlayProduct> = {};

        for (const entry of products ?? []) {
          const product = entry as {
            id?: string;
            productId?: string;
            displayPrice?: string;
            title?: string;
            subscriptionOffers?: Array<{
              id?: string | null;
              offerTokenAndroid?: string | null;
              offerTagsAndroid?: string[] | null;
              pricingPhasesAndroid?: { pricingPhaseList?: OfferEntry['phases'] } | null;
            }>;
          };
          // expo-iap has used both names across versions; take whichever is set.
          const sku = product.id || product.productId;
          if (!sku) continue;

          const entries: OfferEntry[] = (product.subscriptionOffers ?? [])
            .filter((offer) => Boolean(offer?.offerTokenAndroid))
            .map((offer) => ({
              offerToken: offer.offerTokenAndroid as string,
              verified: offer.id === VERIFIED_OFFER_ID || Boolean(offer.offerTagsAndroid?.includes(VERIFIED_OFFER_ID)),
              phases: offer.pricingPhasesAndroid?.pricingPhaseList ?? [],
            }));
          offers[sku] = entries;

          const deal = entries.find((entry) => entry.verified);
          const regular = regularOffer(entries);
          const dealPhase = deal?.phases[0];
          const regularMicros = Number(regular?.phases[regular.phases.length - 1]?.priceAmountMicros);
          const dealMicros = Number(dealPhase?.priceAmountMicros);
          catalogue[sku] = {
            sku,
            displayPrice: product.displayPrice,
            title: product.title,
            ...(dealPhase && deal && deal.phases.length > 1
              ? {
                  verifiedPrice: dealPhase.formattedPrice,
                  verifiedCycles: dealPhase.billingCycleCount,
                  verifiedPercentOff:
                    regularMicros > 0 && dealMicros >= 0
                      ? Math.round((1 - dealMicros / regularMicros) * 100)
                      : undefined,
                }
              : {}),
          };
        }

        offersRef.current = offers;

        setState((prev) => ({
          ...prev,
          available: true,
          loading: false,
          products: catalogue,
          // An empty list nearly always means Play Console setup rather than a
          // code fault, so say which. A partial list means one plan's product
          // id does not match Play Console, which is worth naming separately.
          error: !products?.length
            ? 'This subscription is not available yet. It may still be rolling out on Google Play.'
            : products.length < skus.length
              ? 'Some plans are not set up on Google Play yet, so they cannot be bought here.'
              : null,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuKey]);

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

  /**
   * `useVerifiedOffer` is the caller saying the member is Aadhaar-verified.
   * Exactly one offer token goes to Play: passing every token, as this used
   * to, leaves Play's choice to whichever offer happens to come first — which
   * would hand the verified discount to anyone once it exists.
   */
  const buy = useCallback(async (sku: string, useVerifiedOffer = false) => {
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
      const entries = offersRef.current[sku] ?? [];
      const chosen =
        (useVerifiedOffer ? entries.find((entry) => entry.verified) : undefined) ?? regularOffer(entries);
      if (!chosen) {
        throw new Error('This plan is not available to purchase yet. Please try again shortly.');
      }
      const subscriptionOffers = [{ sku, offerToken: chosen.offerToken }];

      await requestPurchase({
        request: { google: { skus: [sku], subscriptionOffers } },
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

/**
 * The plain base-plan offer: the one that is not the verified discount,
 * preferring a single price phase (no intro pricing) when there are several.
 */
function regularOffer(entries: OfferEntry[]): OfferEntry | undefined {
  const others = entries.filter((entry) => !entry.verified);
  return others.find((entry) => entry.phases.length === 1) ?? others[0];
}
