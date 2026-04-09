import type {
  AuthSession,
  BusinessListing,
  CommunityPost,
  EventSummary,
  HelpNeedRequest,
  MatrimonyProfile,
  OtpPurpose
} from '../../shared-types/src';

export interface ApiClientOptions {
  baseUrl: string;
  getAuthToken?: () => string | null;
  getUserId?: () => string | null;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => string | null;
  private getUserId?: () => string | null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAuthToken = options.getAuthToken;
    this.getUserId = options.getUserId;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set('Content-Type', 'application/json');

    const token = this.getAuthToken?.();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const userId = this.getUserId?.();
    if (userId) {
      headers.set('x-user-id', userId);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data as T;
  }

  requestOtp(email: string, purpose: OtpPurpose) {
    return this.request<{ message: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, purpose })
    });
  }

  signup(payload: { name: string; email: string; password: string; otpCode: string }) {
    return this.request<AuthSession>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  login(payload: { email: string; password: string; otpCode: string }) {
    return this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  getMatrimonyProfiles() {
    return this.request<{ profiles: MatrimonyProfile[] }>('/matrimony/profiles');
  }

  getEvents() {
    return this.request<{ events: EventSummary[] }>('/events');
  }

  getBusinessListings() {
    return this.request<{ listings: BusinessListing[] }>('/business/listings');
  }

  getCommunityPosts() {
    return this.request<{ posts: CommunityPost[] }>('/community/posts');
  }

  getHelpRequests() {
    return this.request<{ requests: HelpNeedRequest[] }>('/help-requests');
  }
}

export function createApiClient(options: ApiClientOptions) {
  return new ApiClient(options);
}
