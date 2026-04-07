import apiService from './api'
import { ApiResponse, Event, EventSummary, Guest, MoneyRecord } from '../types'

class EventsService {
  async getEvents(tab?: 'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected'): Promise<ApiResponse<Event[]>> {
    return apiService.get<Event[]>(`/events${tab && tab !== 'all' ? `?tab=${tab}` : ''}`)
  }

  async getSummary(): Promise<ApiResponse<EventSummary>> {
    return apiService.get<EventSummary>('/events/summary')
  }

  async getEvent(id: string): Promise<ApiResponse<{ event: Event; guests: Guest[] }>> {
    return apiService.get<{ event: Event; guests: Guest[] }>(`/events/${id}`)
  }

  async createEvent(eventData: Partial<Event>): Promise<ApiResponse<Event>> {
    return apiService.post<Event>('/events', eventData)
  }

  async updateEvent(id: string, eventData: Partial<Event>): Promise<ApiResponse<Event>> {
    return apiService.put<Event>(`/events/${id}`, eventData)
  }

  async getGuests(eventId: string): Promise<ApiResponse<Guest[]>> {
    return apiService.get<Guest[]>(`/events/${eventId}/guests`)
  }

  async addGuest(eventId: string, guestData: Partial<Guest>): Promise<ApiResponse<Guest>> {
    return apiService.post<Guest>(`/events/${eventId}/guests`, guestData)
  }

  async recordMoneyReceived(
    eventId: string,
    guestName: string,
    amount: number,
    date: string,
    paymentMode: string,
    notes?: string
  ): Promise<ApiResponse<MoneyRecord>> {
    return apiService.post<MoneyRecord>(`/events/${eventId}/contributions`, {
      guestName,
      amount,
      date,
      paymentMode,
      notes,
    })
  }

  async updateGuestRSVP(guestId: string, rsvpStatus: 'attending' | 'not_attending' | 'maybe' | 'not_responded') {
    return apiService.put<Guest>(`/events/guests/${guestId}/rsvp`, { rsvpStatus })
  }

  async exportEventList(eventId: string): Promise<ApiResponse<{ event: Event; guests: Guest[] }>> {
    return apiService.get<{ event: Event; guests: Guest[] }>(`/events/${eventId}`)
  }
}

export default new EventsService()
