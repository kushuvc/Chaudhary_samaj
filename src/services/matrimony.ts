// Matrimony Service - API-first profile filtering and user state management
import apiService from './api'

export interface MatrimonyProfile {
  id: string
  name: string
  age: number
  location: string
  community: string
  education: string
  occupation: string
  bio: string
  maritalStatus: string
  height: string
  income: string
  language: string
  image?: string
  compatibilityScore: number
  isUnlocked: boolean
  isShortlisted: boolean
  isViewed: boolean
  createdAt: string
  gender?: string
  subCommunity?: string
  dateOfBirth?: string
}

export interface MatrimonyFilter {
  ageRange?: [number, number]
  location?: string
  gender?: string
  community?: string
  subCommunity?: string
  education?: string
  occupation?: string
  maritalStatus?: string
  height?: string
  income?: string
  language?: string
  searchQuery?: string
  statusTab?: 'all' | 'shortlisted' | 'viewed' | 'locked'
}

export interface MatrimonyFilterOptions {
  locations: string[]
  genders: string[]
  communities: string[]
  subCommunities: string[]
  educations: string[]
  occupations: string[]
  maritalStatuses: string[]
  languages: string[]
  ageBounds: {
    min: number
    max: number
  }
}

export interface SavedFilter {
  id: string
  name: string
  filters: MatrimonyFilter
}

export interface MatrimonyMemberUser {
  id?: string
  fullName: string
  email: string
  phone?: string | null
  avatar?: string | null
}

export interface MatrimonyMemberProfile {
  fullName: string
  email: string
  phone?: string | null
  location: string
  occupation: string
  education: string
  bio: string
}

export interface MatrimonyMemberSettings {
  age: string
  maritalStatus: string
  height: string
  income: string
  community: string
  language: string
  profileBio: string
  preferredLocation: string
  preferredEducation: string
  preferredOccupation: string
}

export interface MatrimonyMemberPreferences {
  id: string
  preferredLocation: string
  preferredEducation: string
  preferredOccupation: string
  ageMin?: number | null
  ageMax?: number | null
  maritalStatus?: string | null
  incomeRange?: string | null
  languages?: string | null
  notes?: string | null
}

export interface MatrimonyMemberPayload {
  user: MatrimonyMemberUser
  profile: MatrimonyMemberProfile
  matrimony: MatrimonyMemberSettings
  preferences: MatrimonyMemberPreferences | null
}

class MatrimonyService {
  private mapProfile(record: any): MatrimonyProfile {
    return {
      id: record.id,
      name: record.name ?? record.full_name ?? record.fullName,
      age: Number(record.age),
      location: record.location,
      community: record.community,
      education: record.education,
      occupation: record.occupation,
      bio: record.bio,
      maritalStatus: record.maritalStatus ?? record.marital_status,
      height: record.height,
      income: record.income,
      language: record.language,
      subCommunity: record.subCommunity ?? record.sub_community,
      image: record.image ?? record.avatar_url,
      compatibilityScore: Number(record.compatibilityScore ?? record.compatibility_score ?? 0),
      isUnlocked: Boolean(record.isUnlocked ?? record.is_unlocked),
      isShortlisted: Boolean(record.isShortlisted ?? record.is_shortlisted),
      isViewed: Boolean(record.isViewed ?? record.is_viewed),
      createdAt: record.createdAt ?? record.created_at,
    }
  }

  // Get all profiles with optional filtering
  async getProfiles(filters?: MatrimonyFilter): Promise<MatrimonyProfile[]> {
    try {
      const queryParams = new URLSearchParams()

      if (filters?.searchQuery) queryParams.set('search', filters.searchQuery)
      if (filters?.location) queryParams.set('location', filters.location)
      if (filters?.gender) queryParams.set('gender', filters.gender)
      if (filters?.community) queryParams.set('community', filters.community)
      if (filters?.subCommunity) queryParams.set('subCommunity', filters.subCommunity)
      if (filters?.education) queryParams.set('education', filters.education)
      if (filters?.occupation) queryParams.set('occupation', filters.occupation)
      if (filters?.maritalStatus) queryParams.set('maritalStatus', filters.maritalStatus)
      if (filters?.language) queryParams.set('language', filters.language)
      if (filters?.statusTab) queryParams.set('tab', filters.statusTab)
      if (filters?.ageRange) {
        queryParams.set('minAge', String(filters.ageRange[0]))
        queryParams.set('maxAge', String(filters.ageRange[1]))
      }

      const response = await apiService.get<MatrimonyProfile[]>(
        `/matrimony/profiles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      )

      if (response.success && response.data) {
        return response.data.map((profile) => this.mapProfile(profile))
      }
      return []
    } catch (error) {
      console.error('Failed to load profiles from backend.', error)
      return []
    }
  }

  async getFilterOptions(): Promise<MatrimonyFilterOptions> {
    try {
      const response = await apiService.get<MatrimonyFilterOptions>('/matrimony/filter-options')
      if (response.success && response.data) {
        return response.data
      }
    } catch (error) {
      console.error('Failed to load filter options from backend.', error)
    }

    return {
      locations: [],
      genders: [],
      communities: [],
      subCommunities: [],
      educations: [],
      occupations: [],
      maritalStatuses: [],
      languages: [],
      ageBounds: { min: 18, max: 60 },
    }
  }

  // Get single profile
  async getProfile(id: string): Promise<MatrimonyProfile | null> {
    try {
      const response = await apiService.get<MatrimonyProfile>(`/matrimony/profiles/${id}`)
      if (response.success && response.data) {
        return this.mapProfile(response.data)
      }
      return null
    } catch (error) {
      console.error('Failed to load profile from backend.', error)
      return null
    }
  }

  // Get shortlisted profiles
  async getShortlisted(): Promise<MatrimonyProfile[]> {
    return this.getProfiles({ statusTab: 'shortlisted' })
  }

  // Get viewed profiles
  async getViewed(): Promise<MatrimonyProfile[]> {
    return this.getProfiles({ statusTab: 'viewed' })
  }

  // Get locked profiles
  async getLocked(): Promise<MatrimonyProfile[]> {
    return this.getProfiles({ statusTab: 'locked' })
  }

  // Get saved filters
  async getSavedFilters(): Promise<SavedFilter[]> {
    try {
      const response = await apiService.get<SavedFilter[]>('/matrimony/saved-filters')
      if (response.success && response.data) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to load saved filters from backend.', error)
      return []
    }
  }

  // Unlock profile (frontend placeholder)
  async unlockProfile(id: string): Promise<boolean> {
    try {
      const response = await apiService.post<{ unlocked: boolean }>(`/matrimony/profiles/${id}/unlock`, {})
      if (response.success) {
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to unlock profile via backend.', error)
      return false
    }
  }

  // Toggle shortlist
  async toggleShortlist(id: string): Promise<boolean> {
    try {
      const response = await apiService.post<{ shortlisted: boolean }>(`/matrimony/profiles/${id}/shortlist`, {})
      if (response.success) {
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to toggle shortlist via backend.', error)
      return false
    }
  }

  // Mark as viewed
  async markAsViewed(id: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/matrimony/profiles/${id}/view`, {})
      if (response.success) {
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to mark profile as viewed via backend.', error)
      return false
    }
  }

  async getMe(): Promise<MatrimonyMemberPayload | null> {
    try {
      const response = await apiService.get<MatrimonyMemberPayload>('/matrimony/me')
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      console.error('Failed to load current profile from backend.', error)
      return null
    }
  }

  async updateMe(payload: Partial<MatrimonyMemberPayload>): Promise<MatrimonyMemberPayload | null> {
    try {
      const response = await apiService.put<MatrimonyMemberPayload>('/matrimony/me', payload)
      if (response.success && response.data) {
        return response.data
      }
    } catch (error) {
      console.error('Failed to update current profile via backend.', error)
    }

    return null
  }
}

export default new MatrimonyService()
