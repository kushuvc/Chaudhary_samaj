import apiService from './api'

export type BusinessCategory =
  | 'food'
  | 'education'
  | 'healthcare'
  | 'retail'
  | 'professional'
  | 'home_services'

export interface BusinessListing {
  id: string
  creatorUserId?: string
  name: string
  category: BusinessCategory
  ownerName: string
  description: string
  contactPhone: string
  contactEmail?: string
  location: string
  serviceTags: string[]
  verified: boolean
  trending: boolean
  promoted: boolean
  featured: boolean
  bannerImage?: string
  gallery: string[]
  services: string[]
  rating?: number
  reviewCount?: number
  createdAt: string
  updatedAt?: string
}

export interface CreateBusinessListingPayload {
  name: string
  category: BusinessCategory
  ownerName: string
  description: string
  contactPhone: string
  contactEmail?: string
  location: string
  serviceTags: string[]
  bannerImage?: string
  gallery: string[]
  services: string[]
}

class BusinessService {
  async getBusinesses() {
    return apiService.get<BusinessListing[]>('/business/listings')
  }

  async getBusinessById(id: string) {
    return apiService.get<BusinessListing>(`/business/listings/${id}`)
  }

  async getFeaturedBusinesses() {
    const response = await this.getBusinesses()
    if (!response.success || !response.data) {
      return response
    }

    return { success: true, data: response.data.filter((item) => item.featured) }
  }

  async getPromotedBusinesses() {
    const response = await this.getBusinesses()
    if (!response.success || !response.data) {
      return response
    }

    return { success: true, data: response.data.filter((item) => item.promoted) }
  }

  async createBusinessListing(payload: CreateBusinessListingPayload) {
    return apiService.post<BusinessListing>('/business/listings', payload)
  }
}

export default new BusinessService()
