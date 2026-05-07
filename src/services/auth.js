import apiService from './api';
const AUTH_STORAGE_KEY = 'chaudhary_auth';
function readStorage() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function writeStorage(payload) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}
class AuthService {
    getAuth() {
        return readStorage();
    }
    getCurrentUser() {
        return this.getAuth()?.user ?? null;
    }
    isAuthenticated() {
        return Boolean(this.getCurrentUser());
    }
    getCurrentUserId() {
        return this.getCurrentUser()?.id ?? null;
    }
    async requestEmailOtp(email, purpose) {
        const response = await apiService.post('/auth/otp/request', { email, purpose });
        if (!response.success || !response.data) {
            return { success: false, error: response.error || 'Unable to send OTP' };
        }
        return {
            success: true,
            debugOtp: response.data.debugOtp,
            expiresAt: response.data.expiresAt,
            sentViaFallback: response.data.sentViaFallback,
        };
    }
    async login(email, password) {
        const response = await apiService.post('/auth/login', { email, password });
        if (!response.success || !response.data) {
            return { success: false, error: response.error || 'Unable to login' };
        }
        writeStorage(response.data);
        return { success: true };
    }
    async signup(payload) {
        const response = await apiService.post('/auth/signup', payload);
        if (!response.success || !response.data) {
            return { success: false, error: response.error || 'Unable to create account' };
        }
        writeStorage(response.data);
        return { success: true };
    }
    logout() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
}
export default new AuthService();
