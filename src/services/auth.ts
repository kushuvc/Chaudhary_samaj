import apiService from './api'

export interface AuthUser {
  id: string
  fullName: string
  email: string
  phone?: string | null
  avatar?: string | null
}

interface AuthPayload {
  user: AuthUser
  authToken: string
}

interface OtpRequestPayload {
  email: string
  purpose: 'login' | 'signup'
  expiresAt: string
  sentViaFallback?: boolean
  debugOtp?: string
}

const AUTH_STORAGE_KEY = 'chaudhary_auth'

function readStorage(): AuthPayload | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthPayload) : null
  } catch {
    return null
  }
}

function writeStorage(payload: AuthPayload) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

class AuthService {
  getAuth(): AuthPayload | null {
    return readStorage()
  }

  getCurrentUser(): AuthUser | null {
    return this.getAuth()?.user ?? null
  }

  isAuthenticated(): boolean {
    return Boolean(this.getCurrentUser())
  }

  getCurrentUserId(): string | null {
    return this.getCurrentUser()?.id ?? null
  }

  async requestEmailOtp(
    email: string,
    purpose: 'login' | 'signup'
  ): Promise<{ success: boolean; error?: string; debugOtp?: string; expiresAt?: string; sentViaFallback?: boolean }> {
    const response = await apiService.post<OtpRequestPayload>('/auth/otp/request', { email, purpose })
    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Unable to send OTP' }
    }

    return {
      success: true,
      debugOtp: response.data.debugOtp,
      expiresAt: response.data.expiresAt,
      sentViaFallback: response.data.sentViaFallback,
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post<AuthPayload>('/auth/login', { email, password })
    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Unable to login' }
    }

    writeStorage(response.data)
    return { success: true }
  }

  async signup(payload: {
    fullName: string
    email: string
    password: string
    confirmPassword: string
    gender?: string
    dateOfBirth?: string
    phone?: string
  }): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post<AuthPayload>('/auth/signup', payload)
    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Unable to create account' }
    }

    writeStorage(response.data)
    return { success: true }
  }

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

export default new AuthService()
