import { useEffect, useState } from 'react';
import { api, type PlanCapabilities } from '../services/api';

/**
 * What this member's plan lets them do.
 *
 * These were constants pinned to `true` in three screens, under a comment
 * saying to flip them "when implementing premium" — which a patched build
 * would have ignored anyway. The server decides now, and refuses what it must;
 * this only keeps the app from offering a control it knows will be refused.
 *
 * The default is permissive on purpose. A failed status call or a build older
 * than a capability must not lock a paying member out of what they bought —
 * the worst case here is a control that looks available and is then declined,
 * which is far better than one wrongly hidden from someone who paid.
 */
export function useCapabilities(): PlanCapabilities {
  const [capabilities, setCapabilities] = useState<PlanCapabilities>({
    canViewPhone: true,
    canSendInterest: true,
    canChat: true,
    // The one exception to the permissive default: it only changes which
    // button looks active, and the server is the one that hands numbers out.
    canViewPhoneUnmatched: false,
    canHidePhone: false,
  });

  useEffect(() => {
    let active = true;
    void api
      .getSubscriptionStatus()
      .then((status) => {
        if (active && status.plan?.capabilities) setCapabilities(status.plan.capabilities);
      })
      .catch(() => {
        // Keep the permissive default.
      });
    return () => {
      active = false;
    };
  }, []);

  return capabilities;
}
