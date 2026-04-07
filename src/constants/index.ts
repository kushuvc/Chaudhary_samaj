// Application constants

export const APP_NAME = 'Chaudhary Samaj'
export const APP_DESCRIPTION = 'Community Platform'

// Routes
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  MATRIMONY: '/matrimony',
  EVENTS: '/events',
  HELP_CENTER: '/help-and-need',
  BUSINESS: '/business',
  COMMUNITY: '/community',
  PROFILE: '/profile',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  ADMIN: '/admin',
}

// UI Constants
export const SIDEBAR_WIDTH = 256 // 64 * 4 (Tailwind's w-64)
export const TOPNAV_HEIGHT = 64 // h-16

// Asset placeholders
export const IMAGE_PLACEHOLDER = 'https://via.placeholder.com/300x200?text=Image+Placeholder'
export const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/100x100?text=User'

// Status enums
export enum EventStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum HelpCategory {
  FINANCIAL = 'financial',
  MEDICAL = 'medical',
  JOBS = 'jobs',
  BUSINESS = 'business',
  GENERAL = 'general',
}

export enum RSVPStatus {
  NOT_RESPONDED = 'not_responded',
  ATTENDING = 'attending',
  NOT_ATTENDING = 'not_attending',
  MAYBE = 'maybe',
}

// Mock user
export const MOCK_USER = {
  id: '1',
  name: 'Kush',
  email: 'kush@example.com',
  avatar: 'K',
  location: 'Delhi',
  phone: '+91-1234567890',
}

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  LIMIT: 10,
  PAGE: 1,
}

// Colors
export const COLORS = {
  PRIMARY: '#9333ea',
  SECONDARY: '#64748b',
  SUCCESS: '#10b981',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
}
