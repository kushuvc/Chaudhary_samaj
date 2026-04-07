import apiService from './api';
class BusinessService {
    async getBusinesses() {
        return apiService.get('/business/listings');
    }
    async getBusinessById(id) {
        return apiService.get(`/business/listings/${id}`);
    }
    async getFeaturedBusinesses() {
        const response = await this.getBusinesses();
        if (!response.success || !response.data) {
            return response;
        }
        return { success: true, data: response.data.filter((item) => item.featured) };
    }
    async getPromotedBusinesses() {
        const response = await this.getBusinesses();
        if (!response.success || !response.data) {
            return response;
        }
        return { success: true, data: response.data.filter((item) => item.promoted) };
    }
    async createBusinessListing(payload) {
        return apiService.post('/business/listings', payload);
    }
}
export default new BusinessService();
