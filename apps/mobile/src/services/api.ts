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

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

let authToken: string | null = null;
let userId: string | null = null;

export const setApiSession = (session: AuthSession | null) => {
  authToken = session?.authToken || null;
  userId = session?.user?.id || null;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (userId) {
    headers.set('x-user-id', userId);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  requestOtp: async (email: string, purpose: OtpPurpose) => {
    const response = await request<{ message?: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    });

    return {
      message: response.message || 'OTP sent successfully',
      debugOtp: (response as { debugOtp?: string }).debugOtp,
    };
  },
  signup: async (payload: SignupPayload) => {
    const response = await request<{ data?: { user?: any; authToken?: string } }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        fullName: payload.name,
        email: payload.email,
        password: payload.password,
        otpCode: payload.otpCode,
        phone: payload.phone,
        gender: payload.gender,
        age: payload.age,
        location: payload.location,
        community: payload.community,
        subCommunity: payload.subCommunity,
        education: payload.education,
        occupation: payload.occupation,
        maritalStatus: payload.maritalStatus,
        language: payload.language
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
  login: async (payload: { email: string; password: string; otpCode: string }) => {
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
    const response = await request<{ data: MatrimonyProfile[] }>(`/matrimony/profiles${suffix}`);
    return { profiles: response.data };
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
  unlockMatrimonyProfile: (profileId: string) =>
    request<{ data: { unlocked: boolean } }>(`/matrimony/profiles/${profileId}/unlock`, {
      method: 'POST'
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
  }
};
