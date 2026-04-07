import apiService from './api'
import { ApiResponse } from '../types'

export type HelpCategory = 'financial' | 'medical' | 'jobs' | 'business' | 'general'
export type HelpStatus = 'under_review' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'
export type VerificationStatus = 'pending' | 'verified' | 'rejected'

export interface HelpRequest {
  id: string
  creatorUserId: string
  title: string
  category: HelpCategory
  subType?: string
  amount?: number
  collected?: number
  status: HelpStatus
  urgency: UrgencyLevel
  postedBy: string
  postedAt: string
  updatedAt?: string
  location?: string
  description: string
  reason?: string
  medicalCategory?: string
  expenseType?: string
  contact?: string
  verified?: boolean
  verificationStatus?: VerificationStatus
  riskScore?: number
  supporterCount?: number
}

export interface CreateHelpRequestPayload {
  title: string
  category: HelpCategory
  amount?: number
  urgency: UrgencyLevel
  location: string
  contact: string
  description: string
  reason?: string
  medicalCategory?: string
  expenseType?: string
  subType?: string
}

export interface SupportHelpRequestPayload {
  amount?: number
  offerMessage?: string
  contactMode?: string
  isAnonymous?: boolean
}

class HelpCenterService {
  async getHelpRequests(filters?: {
    category?: HelpCategory
    urgency?: UrgencyLevel
    status?: HelpStatus
    search?: string
  }): Promise<ApiResponse<HelpRequest[]>> {
    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    if (filters?.urgency) params.set('urgency', filters.urgency)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.search?.trim()) params.set('search', filters.search.trim())

    const query = params.toString()
    return apiService.get<HelpRequest[]>(`/help-requests${query ? `?${query}` : ''}`)
  }

  async getHelpRequest(id: string): Promise<ApiResponse<HelpRequest>> {
    return apiService.get<HelpRequest>(`/help-requests/${id}`)
  }

  async createHelpRequest(helpData: CreateHelpRequestPayload): Promise<ApiResponse<HelpRequest>> {
    return apiService.post<HelpRequest>('/help-requests', helpData)
  }

  async offerHelp(requestId: string, payload: SupportHelpRequestPayload): Promise<ApiResponse<{ id: string }>> {
    return apiService.post<{ id: string }>(`/help-requests/${requestId}/support`, payload)
  }
}

export default new HelpCenterService()
