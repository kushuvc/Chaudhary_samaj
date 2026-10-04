import Constants from 'expo-constants';
import type {
  AuthSession,
  BusinessListing,
  CommunityPost,
  CommunityMeeting,
  CommunityFeedStats,
  CreateBusinessListingPayload,
  CreateCommunityMeetingPayload,
  CreateCommunityPostPayload,
  CreateHelpNeedPayload,
  CreateEventPayload,
  EventDetail,
  EventGuest,
  EventSummary,
  EventSummaryStats,
  HelpNeedRequest,
  HelpNeedQuery,
  MatrimonyProfile,
  MatrimonyFilterOptions,
  OfferHelpPayload,
  OtpPurpose,
  RecordContributionPayload,
  MatrimonyMemberPayload,
  SignupPayload
} from '../types';

/**
 * Where the API lives.
 *
 * EXPO_PUBLIC_API_BASE_URL wins when set (deployed builds). Otherwise, derive
 * the host from the Metro server the bundle was loaded from. On a phone that is
 * the dev machine's LAN address, which changes whenever DHCP hands out a new
 * lease — hardcoding it in .env means the app silently stops reaching the API
 * every time that happens. Reading it from Expo keeps the two in sync.
 */
function resolveApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000/api`;

  return 'http://localhost:3000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * How long to wait before giving up on a request.
 *
 * Long enough to survive a cold start on Render's free tier, short enough that
 * a genuinely unreachable server reports back rather than hanging.
 */
const REQUEST_TIMEOUT_MS = 45000;

/** Uploads carry a whole image, so they get longer than a normal request. */
const UPLOAD_TIMEOUT_MS = 90000;

let authToken: string | null = null;
let userId: string | null = null;

/** One entry in the in-app guide. */
export interface GuideSection {
  key: string;
  /** An Ionicons name. */
  icon: string;
  title: string;
  body: string;
}

export const setApiSession = (session: AuthSession | null) => {
  authToken = session?.authToken || null;
  userId = session?.user?.id || null;
};

/**
 * Called when the server rejects our token. A stored session can stop being
 * valid without the app doing anything — the token expires, or the signing key
 * rotates — and without this the app keeps its stale session and renders empty
 * screens instead of asking the user to sign in again.
 */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

/**
 * One plan on sale, as configured in the admin screen.
 *
 * `playProductId` is the Play Console product this maps to; a plan without one
 * sells only through the Razorpay link.
 */
/** One entry in the in-app Notifications list. */
export interface AppNotification {
  id: string;
  type: 'announcement' | 'interest_received' | 'interest_accepted' | string;
  title: string;
  body: string;
  /** `screen` names the tab a tap should open. */
  data: { screen?: string; [key: string]: unknown };
  createdAt: string;
  read: boolean;
}

/** What a plan unlocks. A missing flag reads as allowed, matching the server. */
export interface PlanCapabilities {
  canViewPhone: boolean;
  canSendInterest: boolean;
  canChat: boolean;
  /** Contact numbers of members not yet matched with. Off unless a plan opts in. */
  canViewPhoneUnmatched?: boolean;
  /** Members on this plan may stop sharing their own number. Opt-in. */
  canHidePhone?: boolean;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  durationDays: number;
  pricePaise: number;
  playProductId: string | null;
  badge: string | null;
  capabilities: PlanCapabilities;
}

export interface SubscriptionStatus {
  hasSubscription: boolean;
  entitled?: boolean;
  reason?: 'free-for-gender' | 'subscribed' | 'none' | 'anonymous';
  plan?: {
    pricePaise: number;
    freeProfileLimit: number;
    freeForYou: boolean;
    capabilities?: PlanCapabilities;
  };
  plan_name?: string;
  amount?: number;
  startedAt?: string;
  expiresAt?: string;
}

export interface ApiError extends Error {
  status?: number;
  /** Machine-readable error code from the server, e.g. PHONE_ALREADY_REGISTERED. */
  code?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (userId) {
    headers.set('x-user-id', userId);
  }

  /*
   * Time the request out.
   *
   * React Native's fetch has no default timeout, so a connection that stalls
   * never settles. Every screen that awaits one of these calls sits on its
   * "Please wait" state for ever, with the button disabled and no error — the
   * login screen did exactly that against a cold server. The timeout is
   * generous because the API sleeps when idle on Render's free tier and can
   * take the better part of a minute to answer the first request.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal
    });
  } catch (cause) {
    if ((cause as Error)?.name === 'AbortError') {
      const timeoutError = new Error(
        'The server is taking too long to respond. Check your connection and try again.'
      ) as ApiError;
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }

    const networkError = new Error(
      'Could not reach the server. Check your connection and try again.'
    ) as ApiError;
    networkError.code = 'NETWORK';
    throw networkError;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // A 401 while we believed we were signed in means the stored token is no
    // longer accepted. Drop the session so the app returns to the login screen
    // rather than sitting on an authenticated shell full of empty data.
    if (response.status === 401 && authToken) {
      onUnauthorized?.();
    }

    const error = new Error(data.error || `Request failed (${response.status})`) as ApiError;
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data as T;
}

export const api = {
  /**
   * `phone` is only meaningful for signup — the server checks it alongside the
   * email so a number already in use is caught before the profile questions.
   */
  requestOtp: async (email: string, purpose: OtpPurpose, phone?: string) => {
    const response = await request<{
      message?: string;
      data?: {
        email?: string;
        purpose?: OtpPurpose;
        expiresAt?: string;
        sentViaFallback?: boolean;
        debugOtp?: string;
      };
    }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, ...(phone ? { phone } : {}) })
    });

    return {
      message: response.message || 'OTP sent successfully',
      debugOtp: response.data?.debugOtp,
    };
  },
  /**
   * Confirm an emailed code. For `login` the server returns a session; for
   * `signup` it only confirms the address — /auth/signup issues the token once
   * the account is actually created.
   */
  verifyOtp: async (email: string, purpose: OtpPurpose, otp: string) => {
    const response = await request<{
      data?: { user?: any; authToken?: string; verified?: boolean };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, otp }),
    });

    const next = response.data;
    if (!next?.authToken) {
      return null;
    }

    const user = next.user || {};
    return {
      authToken: String(next.authToken),
      user: {
        id: String(user.id || ''),
        name: String(user.name || user.fullName || ''),
        email: String(user.email || ''),
        phone: user.phone ?? null,
        isVerified: true,
      },
    } as AuthSession;
  },
  signup: async (payload: SignupPayload) => {
    const response = await request<{ data?: { user?: any; authToken?: string } }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        fullName: payload.name,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        gender: payload.gender,
        age: payload.age,
        dateOfBirth: payload.dateOfBirth,
        height: payload.height,
        maritalStatus: payload.maritalStatus,
        physicalStatus: payload.physicalStatus,
        location: payload.location,
        country: payload.country,
        state: payload.state,
        city: payload.city,
        village: payload.village,
        nativeCity: payload.nativeCity,
        nativeVillage: payload.nativeVillage,
        community: payload.community,
        subCommunity: payload.subCommunity,
        religion: payload.religion,
        caste: payload.caste,
        dosh: payload.dosh,
        education: payload.education,
        occupation: payload.occupation,
        language: payload.language,
        eatingHabit: payload.eatingHabit,
        horoscopeTime: payload.horoscopeTime,
        horoscopePlace: payload.horoscopePlace,
        familyStatus: payload.familyStatus,
        familyType: payload.familyType,
        familyWealth: payload.familyWealth,
        fatherName: payload.fatherName,
        motherName: payload.motherName,
        fatherOccupation: payload.fatherOccupation,
        motherOccupation: payload.motherOccupation,
        siblings: payload.siblings,
        hobbies: payload.hobbies,
        music: payload.music,
        sports: payload.sports,
        /*
         * Collected by the signup steps and stored by the server, but absent
         * from this body — so eight answers a member typed were discarded on
         * the way out. `bio` was the visible one: every profile fell back to
         * "New member. Please update your profile." however much someone wrote
         * about themselves.
         */
        bio: payload.bio,
        subcaste: payload.subcaste,
        openToAnySubcaste: payload.openToAnySubcaste,
        motherTongue: payload.motherTongue,
        profileCreatedFor: payload.profileCreatedFor,
        employmentType: payload.employmentType,
        incomeCurrency: payload.incomeCurrency,
        annualIncome: payload.annualIncome,
        createAccount: payload.createAccount,
      })
    });

    const next = response.data;
    const user = next?.user || {};

    return {
      authToken: String(next?.authToken || ''),
      user: {
        id: String(user.id || ''),
        name: String(user.name || user.fullName || ''),
        email: String(user.email || ''),
        phone: user.phone ?? null,
        isVerified: Boolean(user.isVerified)
      }
    } as AuthSession;
  },
  login: async (payload: { email: string; password: string }) => {
    const response = await request<{ data?: { user?: any; authToken?: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const next = response.data;
    const user = next?.user || {};

    return {
      authToken: String(next?.authToken || ''),
      user: {
        id: String(user.id || ''),
        name: String(user.name || user.fullName || ''),
        email: String(user.email || ''),
        phone: user.phone ?? null,
        isVerified: Boolean(user.isVerified)
      }
    } as AuthSession;
  },
  getMatrimonyProfileById: async (profileId: string) => {
    const response = await request<{ data: MatrimonyProfile }>(`/matrimony/profiles/${profileId}`);
    return response.data;
  },
  getMatrimonyProfiles: async (params?: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          query.set(key, String(value));
        }
      });
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await request<{
      data: MatrimonyProfile[];
      pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/matrimony/profiles${suffix}`);
    return {
      profiles: response.data,
      // Older builds of the API returned no pagination block; treating a
      // missing one as "there is no more" keeps them working unchanged.
      total: response.pagination?.total ?? response.data.length,
      hasMore: response.pagination?.hasMore ?? false,
    };
  },
  /**
   * The in-app guide, already resolved to one language by the server.
   *
   * Content lives in the database so a section can be reworded or added for a
   * new feature without shipping a release.
   */
  getAppGuide: async (language: string): Promise<GuideSection[]> => {
    const response = await request<{ data: GuideSection[] }>(
      `/guide?lang=${encodeURIComponent(language)}`,
    );
    return response.data;
  },

  getMatrimonyFilterOptions: async () => {
    const response = await request<{ data: MatrimonyFilterOptions }>('/matrimony/filter-options');
    return response.data;
  },
  toggleMatrimonyShortlist: (profileId: string) =>
    request<{ data: { shortlisted: boolean } }>(`/matrimony/profiles/${profileId}/shortlist`, {
      method: 'POST'
    }),
  markMatrimonyViewed: (profileId: string) =>
    request<{ success: true }>(`/matrimony/profiles/${profileId}/view`, {
      method: 'POST'
    }),
  // Interest APIs
  /**
   * Ask for a member's contact number.
   *
   * The server decides: it needs a plan that includes contact numbers and an
   * interest accepted on both sides. A refusal carries a code saying which of
   * the two is missing, so the app can explain rather than guess.
   */
  unlockPhoneNumber: async (profileId: string): Promise<{ unlocked: boolean; phone: string | null }> => {
    const response = await request<{ data: { unlocked: boolean; phone: string | null } }>(
      `/matrimony/profiles/${encodeURIComponent(profileId)}/unlock`,
      { method: 'POST' }
    );
    return response.data;
  },

  sendInterest: (profileId: string) =>
    request<{ data: { interestId: string; status: 'pending' } }>(`/matrimony/profiles/${profileId}/interest`, {
      method: 'POST'
    }),
  getMyInterests: async () => {
    const response = await request<{ data: { sent: any[]; received: any[] } }>('/matrimony/interests');
    return {
      sent: response.data.sent.map((item) => ({
        id: String(item.id),
        profileId: String(item.profileId || item.receiverId || ''),
        name: String(item.name || ''),
        status: String(item.status || 'pending'),
        createdAt: String(item.createdAt || ''),
      })),
      received: response.data.received.map((item) => ({
        id: String(item.id),
        profileId: String(item.profileId || item.senderId || ''),
        name: String(item.name || ''),
        status: String(item.status || 'pending'),
        createdAt: String(item.createdAt || ''),
      })),
    };
  },
  respondToInterest: (interestId: string, accept: boolean) =>
    request<{ data: { status: 'accepted' | 'declined' } }>(`/matrimony/interests/${interestId}`, {
      method: 'PUT',
      body: JSON.stringify({ accept })
    }),
  // Messaging APIs
  getMyMatches: async (fresh = false) => {
    const response = await request<{ data: any[] }>(`/matrimony/matches${fresh ? '?fresh=1' : ''}`);
    return response.data.map((item) => ({
      id: String(item.id || ''),
      profileId: String(item.profileId || item.profileid || item.matchedUserId || ''),
      name: String(item.name || ''),
      lastMessage: String(item.lastMessage || item.lastmessage || ''),
      lastMessageTime: String(item.lastMessageTime || item.lastmessagetime || ''),
      unreadCount: Number(item.unreadCount ?? item.unreadcount ?? 0),
    }));
  },
  getMessages: async (matchId: string) => {
    const response = await request<{ data: any[] }>(`/matrimony/matches/${matchId}/messages`);
    return response.data.map((item) => ({
      id: String(item.id || ''),
      senderId: String(item.senderId || item.senderid || item.sender_id || ''),
      content: String(item.content || item.message || ''),
      createdAt: String(item.createdAt || item.createdat || item.created_at || ''),
      isRead: Boolean(item.isRead ?? item.isread ?? item.is_read),
    }));
  },
  sendMessage: (matchId: string, content: string) =>
    request<{ data: { id: string; createdAt: string } }>(`/matrimony/matches/${matchId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    }),
  getMyMatrimonyProfile: async () => {
    const response = await request<{ data: MatrimonyMemberPayload }>('/matrimony/me');
    return response.data;
  },
  updateMyMatrimonyProfile: async (payload: Partial<MatrimonyMemberPayload>) => {
    const response = await request<{ data: MatrimonyMemberPayload }>('/matrimony/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return response.data;
  },
  getEvents: async (tab: 'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected' = 'all') => {
    const suffix = tab === 'all' ? '' : `?tab=${encodeURIComponent(tab)}`;
    const response = await request<{ data: any[] }>(`/events${suffix}`);
    return {
      events: response.data.map((item) => ({
        id: String(item.id),
        title: String(item.title || ''),
        eventDate: String(item.date || item.eventDate || ''),
        location: String(item.location || ''),
        organizerName: String(item.organizerName || ''),
        guestCount: Number(item.guestCount || 0),
        expectedAmount: Number(item.moneyExpected || item.expectedAmount || 0),
        collectedAmount: Number(item.moneyCollected || item.collectedAmount || 0),
        status: String(item.status || 'upcoming')
      })) as EventSummary[]
    };
  },
  getEventSummary: async () => {
    const response = await request<{ data: EventSummaryStats }>('/events/summary');
    return response.data;
  },
  getEventById: async (eventId: string) => {
    const response = await request<{ data: { event: any; guests: any[] } }>(`/events/${eventId}`);
    return {
      event: {
        id: String(response.data.event.id),
        title: String(response.data.event.title || ''),
        eventDate: String(response.data.event.date || ''),
        location: String(response.data.event.location || ''),
        organizerName: String(response.data.event.organizerName || ''),
        guestCount: Number(response.data.event.guestCount || 0),
        expectedAmount: Number(response.data.event.moneyExpected || 0),
        collectedAmount: Number(response.data.event.moneyCollected || 0),
        status: String(response.data.event.status || 'upcoming')
      } as EventSummary,
      guests: (response.data.guests || []).map((guest) => ({
        id: String(guest.id),
        eventId: String(guest.eventId || eventId),
        name: String(guest.name || ''),
        rsvpStatus: String(guest.rsvpStatus || 'not_responded'),
        amountPromised: Number(guest.amountPromised || 0),
        amountReceived: Number(guest.amountReceived || 0),
        paymentMode: guest.paymentMode ? String(guest.paymentMode) : undefined,
        notes: guest.notes ? String(guest.notes) : undefined
      })) as EventGuest[]
    } as EventDetail;
  },
  createEvent: async (payload: CreateEventPayload) => {
    const response = await request<{ data: any }>('/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.data;
  },
  recordContribution: async (eventId: string, payload: RecordContributionPayload) => {
    const response = await request<{ data: any }>(`/events/${eventId}/contributions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.data;
  },
  getHelpAndNeed: async (query?: HelpNeedQuery) => {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          params.set(key, String(value));
        }
      });
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await request<{ data: any[] }>(`/help-requests${suffix}`);

    return {
      requests: response.data.map((item) => ({
        id: String(item.id),
        title: String(item.title || ''),
        category: String(item.category || 'general'),
        urgency: String(item.urgency || 'medium'),
        amountNeeded: Number(item.amount || item.amountNeeded || 0),
        amountCollected: Number(item.collected || item.amountCollected || 0),
        status: String(item.status || 'open'),
        location: String(item.location || ''),
        createdAt: String(item.createdAt || new Date().toISOString()),
        description: item.description ? String(item.description) : undefined,
        contactPreference: item.contactPreference ? String(item.contactPreference) : undefined,
        verificationStatus: item.verificationStatus ? String(item.verificationStatus) : undefined,
        riskLevel: item.riskLevel ? String(item.riskLevel) : undefined,
        supportersCount: Number(item.supportersCount || 0),
      })) as HelpNeedRequest[],
    };
  },
  createHelpNeedRequest: (payload: CreateHelpNeedPayload) =>
    request<{ data: HelpNeedRequest }>('/help-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  offerHelpNeedSupport: (requestId: string, payload: OfferHelpPayload) =>
    request<{ data: unknown }>(`/help-requests/${requestId}/support`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getBusinessListings: async () => {
    const response = await request<{ data: any[] }>('/business/listings');
    return {
      listings: response.data.map((item) => ({
        id: String(item.id),
        name: String(item.name || ''),
        category: String(item.category || ''),
        ownerName: String(item.ownerName || ''),
        description: String(item.description || ''),
        contactPhone: String(item.contactPhone || ''),
        contactEmail: item.contactEmail ? String(item.contactEmail) : undefined,
        location: String(item.location || ''),
        serviceTags: Array.isArray(item.serviceTags)
          ? item.serviceTags.map((tag: unknown) => String(tag))
          : [],
        verified: Boolean(item.verified),
        trending: Boolean(item.trending),
        promoted: Boolean(item.promoted),
        featured: Boolean(item.featured)
      })) as BusinessListing[]
    };
  },
  createBusinessListing: async (payload: CreateBusinessListingPayload) => {
    const response = await request<{ data: any }>('/business/listings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      listing: {
        id: String(response.data.id),
        name: String(response.data.name || ''),
        category: String(response.data.category || ''),
        ownerName: String(response.data.ownerName || ''),
        description: String(response.data.description || ''),
        contactPhone: String(response.data.contactPhone || ''),
        contactEmail: response.data.contactEmail ? String(response.data.contactEmail) : undefined,
        location: String(response.data.location || ''),
        serviceTags: Array.isArray(response.data.serviceTags)
          ? response.data.serviceTags.map((tag: unknown) => String(tag))
          : [],
        verified: Boolean(response.data.verified),
        trending: Boolean(response.data.trending),
        promoted: Boolean(response.data.promoted),
        featured: Boolean(response.data.featured)
      } as BusinessListing
    };
  },
  getCommunityPosts: async (params?: { category?: string; search?: string; pinnedOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.category) {
      query.set('category', params.category);
    }
    if (params?.search) {
      query.set('search', params.search);
    }
    if (params?.pinnedOnly) {
      query.set('pinned', 'true');
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await request<{ data: any[] }>(`/community/posts${suffix}`);
    return {
      posts: response.data.map((item) => ({
        id: String(item.id),
        title: String(item.title || ''),
        content: String(item.content || ''),
        category: String(item.category || 'update'),
        authorName: String(item.author || item.authorName || ''),
        createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
        creatorUserId: item.creatorUserId ? String(item.creatorUserId) : item.creator_user_id ? String(item.creator_user_id) : undefined,
        pinned: Boolean(item.pinned),
        likes: Number(item.likes || item.likesCount || 0),
        comments: Number(item.comments || item.commentsCount || 0)
      })) as CommunityPost[]
    };
  },
  getCommunityMeetings: async () => {
    const response = await request<{ data: any[] }>('/community/meetings');
    return {
      meetings: response.data.map((item) => ({
        id: String(item.id),
        title: String(item.title || ''),
        meetingDate: String(item.meetingDate || item.meeting_date || ''),
        location: String(item.location || ''),
        host: String(item.host || item.hostName || item.host_name || ''),
        agenda: String(item.agenda || ''),
        createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
        creatorUserId: item.creatorUserId ? String(item.creatorUserId) : item.creator_user_id ? String(item.creator_user_id) : undefined
      })) as CommunityMeeting[]
    };
  },
  getCommunityFeedStats: async () => {
    const response = await request<{ data: CommunityFeedStats }>('/community/stats');
    return response.data;
  },
  createCommunityPost: async (payload: CreateCommunityPostPayload) => {
    const response = await request<{ data: CommunityPost }>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const item = response.data as any;
    return {
      id: String(item.id),
      title: String(item.title || ''),
      content: String(item.content || ''),
      category: String(item.category || 'update'),
      authorName: String(item.author || item.authorName || ''),
      createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
      creatorUserId: item.creatorUserId ? String(item.creatorUserId) : item.creator_user_id ? String(item.creator_user_id) : undefined,
      pinned: Boolean(item.pinned),
      likes: Number(item.likes || item.likesCount || 0),
      comments: Number(item.comments || item.commentsCount || 0)
    } as CommunityPost;
  },
  createCommunityMeeting: async (payload: CreateCommunityMeetingPayload) => {
    const response = await request<{ data: CommunityMeeting }>('/community/meetings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const item = response.data as any;
    return {
      id: String(item.id),
      title: String(item.title || ''),
      meetingDate: String(item.meetingDate || item.meeting_date || ''),
      location: String(item.location || ''),
      host: String(item.host || item.hostName || item.host_name || ''),
      agenda: String(item.agenda || ''),
      createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
      creatorUserId: item.creatorUserId ? String(item.creatorUserId) : item.creator_user_id ? String(item.creator_user_id) : undefined
    } as CommunityMeeting;
  },

  uploadPhoto: async (localUri: string): Promise<string> => {
    const filename = localUri.split('/').pop() || 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const formData = new FormData();

    // On web, fetch the blob from the object URL; on native use the RN file object syntax
    if (localUri.startsWith('blob:') || localUri.startsWith('http')) {
      const blobRes = await fetch(localUri);
      const blob = await blobRes.blob();
      formData.append('photo', blob, filename);
    } else {
      formData.append('photo', { uri: localUri, name: filename, type: mimeType } as any);
    }

    // Do NOT set Content-Type — fetch must auto-set multipart/form-data with boundary
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (userId) headers['x-user-id'] = userId;

    /*
     * This call cannot go through request(), which serialises a JSON body —
     * fetch has to set the multipart boundary itself. That meant it also
     * missed the timeout and the 401 handling, so a stalled upload hung for
     * ever behind a spinner with no error, which is indistinguishable from
     * "uploading a photo does not work".
     */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/upload/photo`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
    } catch (cause) {
      if ((cause as Error)?.name === 'AbortError') {
        const timeoutError = new Error(
          'The photo took too long to upload. Check your connection and try again.'
        ) as ApiError;
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }

      const networkError = new Error(
        'Could not reach the server to upload the photo. Check your connection and try again.'
      ) as ApiError;
      networkError.code = 'NETWORK';
      throw networkError;
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({})) as any;

    if (!res.ok) {
      if (res.status === 401 && authToken) {
        onUnauthorized?.();
      }
      const error = new Error(data.error || 'Upload failed') as ApiError;
      error.status = res.status;
      error.code = data.code;
      throw error;
    }

    const url = data?.data?.url;
    if (!url) {
      throw new Error('The server did not return a photo URL.');
    }
    return url as string;
  },

  /**
   * Permanently delete the signed-in account.
   *
   * The Settings screen promises this deletes everything, and Play requires
   * that it actually does — it previously only called logout(), leaving every
   * row in place.
   */
  /** Starts a password reset. Answers the same way for unknown addresses. */
  forgotPassword: async (email: string): Promise<{ message?: string; debugOtp?: string }> => {
    const response = await request<{ data?: { message?: string; debugOtp?: string } }>(
      '/auth/password/forgot',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
    return response.data || {};
  },

  /** Completes a reset and returns a session, so no second sign-in is needed. */
  resetPassword: async (email: string, otp: string, password: string): Promise<string> => {
    const response = await request<{ data?: { authToken?: string } }>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    });
    const token = response.data?.authToken;
    if (!token) throw new Error('The reset did not return a session. Please sign in.');
    return token;
  },

  /** Report a member. Also hides them from the reporter straight away. */
  reportProfile: async (
    profileId: string,
    reason: string,
    details?: string
  ): Promise<{ message?: string }> => {
    const response = await request<{ data?: { message?: string } }>(
      `/matrimony/profiles/${profileId}/report`,
      { method: 'POST', body: JSON.stringify({ reason, details }) }
    );
    return response.data || {};
  },

  /**
   * End a conversation. Deletes the match and its messages for both sides and
   * withdraws the accepted interests, so neither is left reading as mutual.
   * Weaker than blocking: they can send a fresh interest afterwards.
   */
  unmatch: async (matchId: string): Promise<void> => {
    await request<{ success: boolean }>(`/matrimony/matches/${matchId}`, { method: 'DELETE' });
  },

  /** Hide a member from you, and you from them. */
  blockProfile: async (profileId: string): Promise<void> => {
    await request<{ success: boolean }>(`/matrimony/profiles/${profileId}/block`, {
      method: 'POST',
    });
  },

  deleteAccount: async (): Promise<void> => {
    await request<{ success: boolean }>('/auth/account', { method: 'DELETE' });
  },

  deletePhoto: async (url: string): Promise<void> => {
    await request<{ success: boolean }>('/upload/photo', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    });
  },

  // Payment APIs
  /**
   * Subscription status, plus the rule that applies to this member.
   *
   * `entitled` can be true without a subscription when the member's gender is
   * free under the current rules, and `plan` carries the live price — both are
   * set from the admin screen, so nothing about pricing is hardcoded here.
   */
  /**
   * Whether this member's number is shared, and whether their plan lets them
   * stop sharing it. Lives on the server: it decides who gets the number.
   */
  registerPushToken: (token: string, platform: string) =>
    request<{ success: boolean }>('/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),
  unregisterPushToken: (token: string) =>
    request<{ success: boolean }>('/push-tokens', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
  getNotifications: async (): Promise<AppNotification[]> => {
    const response = await request<{ data: AppNotification[] }>('/notifications');
    return response.data || [];
  },
  /** Marks these read, or every notification when no ids are given. */
  markNotificationsRead: (ids?: string[]) =>
    request<{ success: boolean }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids?.length ? { ids } : {}),
    }),
  getPhoneSharing: async (): Promise<{ showPhone: boolean; canHidePhone: boolean }> => {
    const response = await request<{ data: any }>('/settings');
    return {
      showPhone: response.data?.privacy?.showPhoneToConnections !== false,
      canHidePhone: response.data?.canHidePhone === true,
    };
  },
  setPhoneSharing: (showPhone: boolean) =>
    request<{ success: boolean }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ privacy: { showPhoneToConnections: showPhone } }),
    }),
  getSubscriptionStatus: async (): Promise<SubscriptionStatus> => {
    const response = await request<{ data: SubscriptionStatus }>('/payments/subscription');
    return response.data;
  },

  createPaymentOrder: async (plan: string): Promise<{ id: string; amount: number; currency: string }> => {
    const response = await request<{ data: { id: string; amount: number; currency: string } }>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    return response.data;
  },

  verifyPayment: async (orderId: string, paymentId: string, signature: string, plan: string): Promise<{ verified: boolean }> => {
    const response = await request<{ data: { verified: boolean } }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        plan,
      }),
    });
    return response.data;
  },

  /** The plans on sale. Ordered as the admin screen orders them. */
  getSubscriptionPlans: async (): Promise<SubscriptionPlan[]> => {
    const response = await request<{ data: SubscriptionPlan[] }>('/payments/plans');
    return response.data;
  },

  /*
   * Only the plan code goes up. The amount used to travel with it, which meant
   * the client was naming its own price; the server reads it off the plan now.
   */
  createPaymentLink: async (plan: string): Promise<{ id: string; short_url: string }> => {
    const response = await request<{ data: { id: string; short_url: string } }>('/payments/create-link', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
    return response.data;
  },

  /**
   * Hand a Google Play purchase token to the server, which verifies it with
   * Google before granting anything. The client never decides entitlement.
   */
  verifyPlayPurchase: async (purchaseToken: string) => {
    const response = await request<{
      data: { active: boolean; plan?: string; startedAt?: string; expiresAt?: string; state?: string };
    }>('/payments/play/verify', {
      method: 'POST',
      body: JSON.stringify({ purchaseToken }),
    });
    return response.data;
  },
  getPaymentLinkStatus: async (
    linkId: string
  ): Promise<{ status: string; activated: boolean; plan?: string; startedAt?: string; expiresAt?: string }> => {
    const response = await request<{
      data: { status: string; activated: boolean; plan?: string; startedAt?: string; expiresAt?: string };
    }>(`/payments/link-status/${encodeURIComponent(linkId)}`);
    return response.data;
  },

  verifyPaymentLink: async (params: {
    razorpay_payment_id: string;
    razorpay_payment_link_id: string;
    razorpay_payment_link_reference_id: string;
    razorpay_payment_link_status: string;
    razorpay_signature: string;
    plan: string;
    amount: number;
  }): Promise<{ verified: boolean; plan: string; startedAt: string; expiresAt: string }> => {
    const response = await request<{ data: { verified: boolean; plan: string; startedAt: string; expiresAt: string } }>('/payments/verify-link', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.data;
  },

  // Phone OTP APIs. Pass purpose 'signup' so the server can reject a number
  // that already belongs to an account; omit it for login.
  requestPhoneOtp: async (
    phone: string,
    purpose?: 'signup' | 'login'
  ): Promise<{ message: string; mockOtp?: string }> => {
    const response = await request<{ message: string; mockOtp?: string }>('/auth/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose }),
    });
    return response;
  },

  verifyPhoneOtp: async (phone: string, otp: string, verifyOnly?: boolean): Promise<{ token?: string; userId?: string; message: string; verified?: boolean }> => {
    const response = await request<{ token?: string; userId?: string; message: string; verified?: boolean }>('/auth/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, verifyOnly: !!verifyOnly }),
    });
    return response;
  },
};
