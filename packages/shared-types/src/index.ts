export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isVerified: boolean;
}

export interface AuthSession {
  authToken: string;
  user: AuthUser;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  otpCode: string;
  phone?: string;
  gender?: string;
  age?: number;
  location?: string;
  community?: string;
  subCommunity?: string;
  education?: string;
  occupation?: string;
  maritalStatus?: string;
  language?: string;
}

export type OtpPurpose = 'signup' | 'login';

export interface MatrimonyProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  community: string;
  subCommunity?: string | null;
  education?: string | null;
  occupation?: string | null;
  maritalStatus?: string | null;
  language?: string | null;
  gender?: string | null;
  height?: string | null;
  income?: string | null;
  bio?: string | null;
  compatibilityScore: number;
  isShortlisted?: boolean;
  isViewed?: boolean;
  isUnlocked?: boolean;
}

export interface MatrimonyFilterOptions {
  locations: string[];
  communities: string[];
  subCommunities: string[];
  genders: string[];
  educations: string[];
  occupations: string[];
  maritalStatuses: string[];
  languages: string[];
}

export interface EventSummary {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  organizerName: string;
  guestCount: number;
  expectedAmount: number;
  collectedAmount: number;
  status: string;
}

export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  rsvpStatus: string;
  amountPromised: number;
  amountReceived: number;
  paymentMode?: string;
  notes?: string;
}

export interface EventDetail {
  event: EventSummary;
  guests: EventGuest[];
}

export interface EventSummaryStats {
  totalCreated: number;
  upcomingCount: number;
  pastCount: number;
  pendingCount: number;
  fullyCollectedCount: number;
}

export interface CreateEventPayload {
  title: string;
  date: string;
  location: string;
  organizerName: string;
  guestCount: number;
  moneyExpected: number;
}

export interface RecordContributionPayload {
  guestName: string;
  amount: number;
  date: string;
  paymentMode: string;
  notes?: string;
}

export interface BusinessListing {
  id: string;
  name: string;
  category: string;
  ownerName: string;
  description: string;
  contactPhone: string;
  contactEmail?: string;
  location: string;
  serviceTags?: string[];
  verified?: boolean;
  trending?: boolean;
  promoted?: boolean;
  featured?: boolean;
}

export interface CreateBusinessListingPayload {
  name: string;
  category: string;
  ownerName: string;
  description: string;
  contactPhone: string;
  location: string;
  contactEmail?: string;
  serviceTags?: string[];
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  createdAt: string;
  creatorUserId?: string;
  pinned?: boolean;
  likes?: number;
  comments?: number;
}

export interface CommunityMeeting {
  id: string;
  title: string;
  meetingDate: string;
  location: string;
  host: string;
  agenda: string;
  createdAt: string;
  creatorUserId?: string;
}

export interface CommunityFeedStats {
  totalPosts: number;
  pinnedPosts: number;
  upcomingMeetings: number;
  byCategory: Record<string, number>;
}

export interface CreateCommunityPostPayload {
  title: string;
  content: string;
  category: string;
  author: string;
  pinned?: boolean;
}

export interface CreateCommunityMeetingPayload {
  title: string;
  meetingDate: string;
  location: string;
  host: string;
  agenda: string;
}

export interface HelpNeedRequest {
  id: string;
  title: string;
  category: string;
  urgency: string;
  amountNeeded: number;
  amountCollected: number;
  status: string;
  location: string;
  createdAt: string;
  description?: string;
  contactPreference?: string;
  verificationStatus?: string;
  riskLevel?: string;
  supportersCount?: number;
}

export interface HelpNeedQuery {
  category?: string;
  urgency?: string;
  status?: string;
  search?: string;
}

export interface CreateHelpNeedPayload {
  title: string;
  category: string;
  amount?: number;
  urgency: string;
  location: string;
  contact: string;
  description: string;
  reason?: string;
  medicalCategory?: string;
  expenseType?: string;
  subType?: string;
}

export interface OfferHelpPayload {
  amount?: number;
  offerMessage?: string;
  contactMode?: string;
  isAnonymous?: boolean;
}

export interface MatrimonyMemberUser {
  id?: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
}

export interface MatrimonyMemberProfile {
  fullName: string;
  email: string;
  phone?: string | null;
  location: string;
  occupation: string;
  education: string;
  bio: string;
}

export interface MatrimonyMemberSettings {
  age: string;
  maritalStatus: string;
  height: string;
  income: string;
  community: string;
  language: string;
  profileBio: string;
  preferredLocation: string;
  preferredEducation: string;
  preferredOccupation: string;
}

export interface MatrimonyMemberPreferences {
  id: string;
  preferredLocation: string;
  preferredEducation: string;
  preferredOccupation: string;
  ageMin?: number | null;
  ageMax?: number | null;
  maritalStatus?: string | null;
  incomeRange?: string | null;
  languages?: string | null;
  notes?: string | null;
}

export interface MatrimonyMemberPayload {
  user: MatrimonyMemberUser;
  profile: MatrimonyMemberProfile;
  matrimony: MatrimonyMemberSettings;
  preferences: MatrimonyMemberPreferences | null;
}

export type NotificationType = 'announcement' | 'message' | 'security' | 'event';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
}

export interface MobileNotificationState {
  notifications: NotificationItem[];
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface MobileAccountSettings {
  language: string;
  timezone: string;
  publicProfile: boolean;
}

export interface MobileNotificationSettings {
  communityAnnouncements: boolean;
  matrimonyMatches: boolean;
  eventReminders: boolean;
  securityAlerts: boolean;
  marketingUpdates: boolean;
}

export interface MobilePrivacySettings {
  showPhoneToConnections: boolean;
  showLocationPublicly: boolean;
  profileSearchable: boolean;
  twoFactorEnabled: boolean;
}

export interface MobileSettingsState {
  account: MobileAccountSettings;
  notifications: MobileNotificationSettings;
  privacy: MobilePrivacySettings;
  theme: ThemeMode;
}
