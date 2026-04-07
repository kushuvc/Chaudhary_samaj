// Global types for the application

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  phone?: string
  location?: string
}

export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface Profile {
  id: string
  userId: string
  bio?: string
  profileImage?: string
  age?: number
  location?: string
  community?: string
  education?: string
  occupation?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginationParams {
  page: number
  limit: number
  sort?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface Event {
  id: string
  creatorUserId?: string
  title: string
  date: string
  location: string
  organizer: string
  guestCount: number
  moneyExpected: number
  moneyCollected: number
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  description?: string
  image?: string
  createdAt?: string
  updatedAt?: string
}

export interface Guest {
  id: string
  eventId: string
  name: string
  rsvpStatus: 'attending' | 'not_attending' | 'maybe' | 'not_responded'
  amountPromised: number
  amountReceived: number
  paymentMode?: string
  notes?: string
}

export interface MoneyRecord {
  id: string
  eventId: string
  guestId: string
  amount: number
  date: string
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'manual'
  notes?: string
}

export interface EventSummary {
  totalCreated: number
  upcomingCount: number
  pastCount: number
  pendingCount: number
  fullyCollectedCount: number
}
