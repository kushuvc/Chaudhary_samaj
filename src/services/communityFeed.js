import apiService from './api';
class CommunityFeedService {
    async getPosts(params) {
        const query = new URLSearchParams();
        if (params?.category)
            query.set('category', params.category);
        if (params?.search)
            query.set('search', params.search);
        if (params?.pinnedOnly)
            query.set('pinned', 'true');
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiService.get(`/community/posts${suffix}`);
    }
    async createPost(payload) {
        return apiService.post('/community/posts', payload);
    }
    async getUpcomingMeetings() {
        return apiService.get('/community/meetings');
    }
    async createMeeting(payload) {
        return apiService.post('/community/meetings', payload);
    }
    async getStats() {
        return apiService.get('/community/stats');
    }
}
export default new CommunityFeedService();
