import apiService from './api'

export type CommunityPostCategory =
  | 'meeting'
  | 'news'
  | 'celebration'
  | 'update'
  | 'achievement'
  | 'lost_found'
  | 'announcement'

export interface CommunityPost {
  id: string
  creatorUserId?: string
  title: string
  content: string
  author: string
  createdAt: string
  category: CommunityPostCategory
  pinned: boolean
  likes: number
  comments: number
}

export interface UpcomingMeeting {
  id: string
  creatorUserId?: string
  title: string
  meetingDate: string
  location: string
  agenda: string
  host: string
  createdAt?: string
}

export interface CommunityFeedStats {
  totalPosts: number
  pinnedPosts: number
  upcomingMeetings: number
  byCategory: Record<string, number>
}

export interface CreateCommunityPostPayload {
  title: string
  content: string
  category: CommunityPostCategory
  author: string
  pinned?: boolean
}

export interface CreateCommunityMeetingPayload {
  title: string
  meetingDate: string
  location: string
  host: string
  agenda: string
}

class CommunityFeedService {
  async getPosts(params?: { category?: CommunityPostCategory; search?: string; pinnedOnly?: boolean }) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.search) query.set('search', params.search)
    if (params?.pinnedOnly) query.set('pinned', 'true')

    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiService.get<CommunityPost[]>(`/community/posts${suffix}`)
  }

  async createPost(payload: CreateCommunityPostPayload) {
    return apiService.post<CommunityPost>('/community/posts', payload)
  }

  async getUpcomingMeetings() {
    return apiService.get<UpcomingMeeting[]>('/community/meetings')
  }

  async createMeeting(payload: CreateCommunityMeetingPayload) {
    return apiService.post<UpcomingMeeting>('/community/meetings', payload)
  }

  async getStats() {
    return apiService.get<CommunityFeedStats>('/community/stats')
  }
}

export default new CommunityFeedService()
