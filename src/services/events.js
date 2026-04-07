import apiService from './api';
class EventsService {
    async getEvents(tab) {
        return apiService.get(`/events${tab && tab !== 'all' ? `?tab=${tab}` : ''}`);
    }
    async getSummary() {
        return apiService.get('/events/summary');
    }
    async getEvent(id) {
        return apiService.get(`/events/${id}`);
    }
    async createEvent(eventData) {
        return apiService.post('/events', eventData);
    }
    async updateEvent(id, eventData) {
        return apiService.put(`/events/${id}`, eventData);
    }
    async getGuests(eventId) {
        return apiService.get(`/events/${eventId}/guests`);
    }
    async addGuest(eventId, guestData) {
        return apiService.post(`/events/${eventId}/guests`, guestData);
    }
    async recordMoneyReceived(eventId, guestName, amount, date, paymentMode, notes) {
        return apiService.post(`/events/${eventId}/contributions`, {
            guestName,
            amount,
            date,
            paymentMode,
            notes,
        });
    }
    async updateGuestRSVP(guestId, rsvpStatus) {
        return apiService.put(`/events/guests/${guestId}/rsvp`, { rsvpStatus });
    }
    async exportEventList(eventId) {
        return apiService.get(`/events/${eventId}`);
    }
}
export default new EventsService();
