import apiService from './api';
class HelpCenterService {
    async getHelpRequests(filters) {
        const params = new URLSearchParams();
        if (filters?.category)
            params.set('category', filters.category);
        if (filters?.urgency)
            params.set('urgency', filters.urgency);
        if (filters?.status)
            params.set('status', filters.status);
        if (filters?.search?.trim())
            params.set('search', filters.search.trim());
        const query = params.toString();
        return apiService.get(`/help-requests${query ? `?${query}` : ''}`);
    }
    async getHelpRequest(id) {
        return apiService.get(`/help-requests/${id}`);
    }
    async createHelpRequest(helpData) {
        return apiService.post('/help-requests', helpData);
    }
    async offerHelp(requestId, payload) {
        return apiService.post(`/help-requests/${requestId}/support`, payload);
    }
}
export default new HelpCenterService();
