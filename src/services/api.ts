import { ApiResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const AUTH_STORAGE_KEY = 'chaudhary_auth'

function getCurrentUserIdFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const payload = JSON.parse(raw) as { user?: { id?: string } }
    return payload?.user?.id || null
  } catch {
    return null
  }
}

class ApiService {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL.replace(/\/$/, '')
  }

  private buildUrl(endpoint: string) {
    return `${this.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const currentUserId = getCurrentUserIdFromStorage()

      const response = await fetch(this.buildUrl(endpoint), {
        headers: {
          'Content-Type': 'application/json',
          ...(currentUserId ? { 'x-user-id': currentUserId } : {}),
          ...(options.headers || {}),
        },
        ...options,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          success: false,
          error: payload?.error || `Request failed with status ${response.status}`,
        }
      }

      return payload as ApiResponse<T>
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete request',
      }
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, payload: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async put<T>(endpoint: string, payload: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export default new ApiService()
