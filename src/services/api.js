const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const AUTH_STORAGE_KEY = 'chaudhary_auth';
function getCurrentUserIdFromStorage() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const payload = JSON.parse(raw);
        return payload?.user?.id || null;
    }
    catch {
        return null;
    }
}
class ApiService {
    constructor(baseURL = API_BASE_URL) {
        Object.defineProperty(this, "baseURL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.baseURL = baseURL.replace(/\/$/, '');
    }
    buildUrl(endpoint) {
        return `${this.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    }
    async request(endpoint, options = {}) {
        try {
            const currentUserId = getCurrentUserIdFromStorage();
            const response = await fetch(this.buildUrl(endpoint), {
                headers: {
                    'Content-Type': 'application/json',
                    ...(currentUserId ? { 'x-user-id': currentUserId } : {}),
                    ...(options.headers || {}),
                },
                ...options,
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                return {
                    success: false,
                    error: payload?.error || `Request failed with status ${response.status}`,
                };
            }
            return payload;
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to complete request',
            };
        }
    }
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    async post(endpoint, payload) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    async put(endpoint, payload) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}
export default new ApiService();
