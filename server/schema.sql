PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
  otp_code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matrimony_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  date_of_birth TEXT,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  location TEXT NOT NULL,
  community TEXT NOT NULL,
  sub_community TEXT,
  education TEXT NOT NULL,
  occupation TEXT NOT NULL,
  bio TEXT NOT NULL,
  marital_status TEXT NOT NULL,
  height TEXT NOT NULL,
  income TEXT NOT NULL,
  language TEXT NOT NULL,
  compatibility_score INTEGER NOT NULL DEFAULT 0,
  is_unlocked INTEGER NOT NULL DEFAULT 0,
  is_shortlisted INTEGER NOT NULL DEFAULT 0,
  is_viewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matrimony_preferences (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE,
  preferred_location TEXT,
  preferred_education TEXT,
  preferred_occupation TEXT,
  age_min INTEGER,
  age_max INTEGER,
  marital_status TEXT,
  income_range TEXT,
  languages TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES matrimony_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matrimony_saved_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matrimony_profile_actions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('shortlist', 'view', 'unlock')),
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES matrimony_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matrimony_profile_states (
  profile_id TEXT NOT NULL,
  viewer_user_id TEXT NOT NULL,
  is_shortlisted INTEGER NOT NULL DEFAULT 0,
  is_viewed INTEGER NOT NULL DEFAULT 0,
  is_unlocked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, viewer_user_id),
  FOREIGN KEY (profile_id) REFERENCES matrimony_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_events (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  location TEXT NOT NULL,
  organizer_name TEXT NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 0,
  money_expected INTEGER NOT NULL DEFAULT 0,
  money_collected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  description TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_event_guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rsvp_status TEXT NOT NULL DEFAULT 'not_responded' CHECK (rsvp_status IN ('attending', 'not_attending', 'maybe', 'not_responded')),
  amount_promised INTEGER NOT NULL DEFAULT 0,
  amount_received INTEGER NOT NULL DEFAULT 0,
  payment_mode TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES community_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_event_contributions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_mode TEXT NOT NULL,
  notes TEXT,
  contribution_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES community_events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES community_event_guests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_listings (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  description TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  location TEXT NOT NULL,
  service_tags_json TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  trending INTEGER NOT NULL DEFAULT 0,
  promoted INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  banner_image TEXT,
  gallery_json TEXT NOT NULL,
  services_json TEXT NOT NULL,
  rating REAL,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('meeting', 'news', 'celebration', 'update', 'achievement', 'lost_found', 'announcement')),
  pinned INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_meetings (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  location TEXT NOT NULL,
  host_name TEXT NOT NULL,
  agenda TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS help_requests (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('financial', 'medical', 'jobs', 'business', 'general')),
  sub_type TEXT,
  amount_needed INTEGER,
  amount_collected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'open', 'in_progress', 'resolved', 'closed', 'rejected')),
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  location TEXT NOT NULL,
  contact_preference TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  medical_category TEXT,
  expense_type TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  flags_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS help_support_offers (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  supporter_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  offer_message TEXT,
  contact_mode TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES help_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (supporter_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matrimony_profiles_location ON matrimony_profiles(location);
CREATE INDEX IF NOT EXISTS idx_matrimony_profiles_community ON matrimony_profiles(community);
CREATE INDEX IF NOT EXISTS idx_matrimony_profiles_age ON matrimony_profiles(age);
CREATE INDEX IF NOT EXISTS idx_matrimony_profile_actions_profile_id ON matrimony_profile_actions(profile_id);
CREATE INDEX IF NOT EXISTS idx_matrimony_profile_states_viewer_user_id ON matrimony_profile_states(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_community_events_creator_user_id ON community_events(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_community_events_event_date ON community_events(event_date);
CREATE INDEX IF NOT EXISTS idx_community_event_guests_event_id ON community_event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_community_event_contributions_event_id ON community_event_contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_business_listings_created_at ON business_listings(created_at);
CREATE INDEX IF NOT EXISTS idx_business_listings_location ON business_listings(location);
CREATE INDEX IF NOT EXISTS idx_business_listings_category ON business_listings(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(pinned);
CREATE INDEX IF NOT EXISTS idx_community_meetings_meeting_date ON community_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_help_requests_creator_user_id ON help_requests(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_help_requests_category ON help_requests(category);
CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status);
CREATE INDEX IF NOT EXISTS idx_help_requests_urgency ON help_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_help_requests_created_at ON help_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_help_support_offers_request_id ON help_support_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_auth_email_otps_email_purpose ON auth_email_otps(email, purpose);
CREATE INDEX IF NOT EXISTS idx_auth_email_otps_expires_at ON auth_email_otps(expires_at);