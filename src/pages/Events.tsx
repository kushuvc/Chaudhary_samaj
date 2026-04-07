import { useState, useEffect } from 'react'
import { Calendar, MapPin, Users, DollarSign, Plus, X, AlertCircle, Download } from 'lucide-react'
import eventsService from '../services/events'
import { Event, Guest } from '../types'

export default function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [summary, setSummary] = useState({
    totalCreated: 0,
    upcomingCount: 0,
    pastCount: 0,
    pendingCount: 0,
    fullyCollectedCount: 0,
  })
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected'>('all')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [eventGuests, setEventGuests] = useState<Guest[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showMoneyModal, setShowMoneyModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [moneyError, setMoneyError] = useState('')
  const [moneyForm, setMoneyForm] = useState({
    guestName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'cash' as const,
    notes: ''
  })
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    location: '',
    organizer: '',
    guestCount: '',
    moneyExpected: ''
  })

  useEffect(() => {
    loadEvents()
    loadSummary()
  }, [filter])

  const loadEvents = async () => {
    const response = await eventsService.getEvents(filter)
    if (response.success && response.data) {
      setEvents(response.data)
    }
  }

  const loadSummary = async () => {
    const response = await eventsService.getSummary()
    if (response.success && response.data) {
      setSummary(response.data)
    }
  }

  const loadEventGuests = async (eventId: string) => {
    const response = await eventsService.getGuests(eventId)
    if (response.success && response.data) {
      setEventGuests(response.data)
    }
  }

  const handleViewEvent = async (event: Event) => {
    const response = await eventsService.getEvent(event.id)
    if (response.success && response.data) {
      setSelectedEvent(response.data.event)
      setEventGuests(response.data.guests || [])
    } else {
      setSelectedEvent(event)
      await loadEventGuests(event.id)
    }
    setShowDetailModal(true)
  }

  const handleRecordMoney = async () => {
    const parsedAmount = Number(moneyForm.amount)

    if (!selectedEvent || !moneyForm.guestName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMoneyError('Please enter a guest name and a positive amount.')
      return
    }

    setMoneyError('')
    
    const response = await eventsService.recordMoneyReceived(
      selectedEvent.id,
      moneyForm.guestName.trim(),
      parsedAmount,
      moneyForm.date,
      moneyForm.paymentMode,
      moneyForm.notes
    )
    
    if (response.success) {
      await loadEventGuests(selectedEvent.id)
      await loadEvents()
      setMoneyError('')
      setMoneyForm({
        guestName: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'cash',
        notes: ''
      })
      setShowMoneyModal(false)
    } else {
      setMoneyError(response.error || 'Unable to record payment. Please check the form and try again.')
    }
  }

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.location) {
      alert('Please fill in all required fields')
      return
    }

    const response = await eventsService.createEvent({
      title: newEvent.title,
      date: newEvent.date,
      location: newEvent.location,
      organizer: newEvent.organizer,
      guestCount: parseInt(newEvent.guestCount || '0'),
      moneyExpected: parseInt(newEvent.moneyExpected || '0')
    })

    if (response.success) {
      await loadEvents()
      await loadSummary()
      setNewEvent({
        title: '',
        date: '',
        location: '',
        organizer: '',
        guestCount: '',
        moneyExpected: ''
      })
      setShowCreateModal(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800'
      case 'ongoing': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRSVPColor = (status: string) => {
    switch(status) {
      case 'attending': return 'text-green-600'
      case 'not_attending': return 'text-red-600'
      case 'maybe': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const filteredEvents = events

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Events</h1>
            <p className="text-slate-600 mt-2">Manage your own community events and contributions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            <Plus size={20} /> Create Event
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
            <p className="text-sm text-slate-500">Total Created</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{summary.totalCreated}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
            <p className="text-sm text-slate-500">Upcoming</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{summary.upcomingCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
            <p className="text-sm text-slate-500">Past History</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{summary.pastCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border border-slate-100">
            <p className="text-sm text-slate-500">Pending Payment</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{summary.pendingCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All Created' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'past', label: 'Past History' },
            { id: 'pending', label: 'Pending Payment' },
            { id: 'fully_collected', label: 'Fully Collected' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                filter === f.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredEvents.map(event => {
            const progress = (event.moneyCollected / event.moneyExpected) * 100
            return (
              <div key={event.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition overflow-hidden group">
                {/* Event Image */}
                <div className="h-40 bg-gradient-to-br from-purple-400 to-purple-600 overflow-hidden relative">
                  {event.image && (
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(event.status)}`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{event.title}</h3>
                  
                  {/* Details */}
                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-purple-600" />
                      {new Date(event.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-purple-600" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-purple-600" />
                      {event.guestCount} guests
                    </div>
                  </div>

                  {/* Organizer */}
                  <div className="mb-4 pb-4 border-b border-slate-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Organizer</p>
                    <p className="font-semibold text-slate-900">{event.organizer}</p>
                  </div>

                  {/* Money Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          ₹{event.moneyCollected.toLocaleString()} / ₹{event.moneyExpected.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-purple-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleViewEvent(event)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 text-lg">
              {summary.totalCreated === 0 ? 'No events created yet. Create your first event to get started.' : 'No events found for this filter'}
            </p>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {showDetailModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center border-b">
              <div>
                <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
                <p className="text-purple-100 text-sm mt-1">Organized by {selectedEvent.organizer}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="hover:bg-purple-800 p-2 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Event Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Date & Time</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(selectedEvent.date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Location</p>
                  <p className="font-semibold text-slate-900">{selectedEvent.location}</p>
                </div>
              </div>

              {/* Money Details */}
              <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-900">Money Tracking</h3>
                  <span className="text-sm font-semibold text-purple-600">
                    {Math.round((selectedEvent.moneyCollected / selectedEvent.moneyExpected) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 mb-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min((selectedEvent.moneyCollected / selectedEvent.moneyExpected) * 100, 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Expected</p>
                    <p className="font-bold text-slate-900">₹{selectedEvent.moneyExpected.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Collected</p>
                    <p className="font-bold text-green-600">₹{selectedEvent.moneyCollected.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Remaining</p>
                    <p className="font-bold text-orange-600">
                      ₹{(selectedEvent.moneyExpected - selectedEvent.moneyCollected).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guest Table */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Guest Details ({eventGuests.length})</h3>
                  <button
                    onClick={() => setShowMoneyModal(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    <Plus size={16} /> Record Contribution
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {eventGuests.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b-2 border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-900">Guest Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-900">RSVP</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900">Promised</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900">Received</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-900">Balance</th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-900">Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {eventGuests.map(guest => {
                          const balance = guest.amountPromised - guest.amountReceived
                          return (
                            <tr key={guest.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3 font-semibold text-slate-900">{guest.name}</td>
                              <td className={`px-4 py-3 font-semibold ${getRSVPColor(guest.rsvpStatus)}`}>
                                {guest.rsvpStatus === 'attending' && '✓ Attending'}
                                {guest.rsvpStatus === 'not_attending' && '✗ Not Attending'}
                                {guest.rsvpStatus === 'maybe' && '? Maybe'}
                                {guest.rsvpStatus === 'not_responded' && '○ Not Responded'}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                ₹{guest.amountPromised.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-green-600">
                                ₹{guest.amountReceived.toLocaleString()}
                              </td>
                              <td className={`px-4 py-3 text-right font-semibold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                ₹{balance.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {guest.paymentMode && (
                                  <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                    {guest.paymentMode === 'upi' ? 'UPI' : guest.paymentMode === 'bank_transfer' ? 'Bank' : 'Cash'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-600">
                      Guest list and contribution tracking will appear here once you add guests.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2 rounded-lg font-semibold transition">
                  <Users size={18} /> Invite Guests
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2 rounded-lg font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={eventGuests.length === 0}
                >
                  <Download size={18} /> Export List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Money Recording Modal */}
      {showMoneyModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Record Contribution</h2>
              <button onClick={() => setShowMoneyModal(false)} className="hover:bg-green-800 p-2 rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Guest Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Guest Name</label>
                <input
                  type="text"
                  value={moneyForm.guestName}
                  onChange={(e) => setMoneyForm({ ...moneyForm, guestName: e.target.value })}
                  placeholder="Enter guest name"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Amount Received (₹)</label>
                <input
                  type="number"
                  value={moneyForm.amount}
                  onChange={(e) => {
                    setMoneyError('')
                    setMoneyForm({ ...moneyForm, amount: e.target.value })
                  }}
                  placeholder="0"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Date</label>
                <input
                  type="date"
                  value={moneyForm.date}
                  onChange={(e) => {
                    setMoneyError('')
                    setMoneyForm({ ...moneyForm, date: e.target.value })
                  }}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Payment Mode</label>
                <select
                  value={moneyForm.paymentMode}
                  onChange={(e) => {
                    setMoneyError('')
                    setMoneyForm({ ...moneyForm, paymentMode: e.target.value as any })
                  }}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Notes (Optional)</label>
                <textarea
                  value={moneyForm.notes}
                  onChange={(e) => {
                    setMoneyError('')
                    setMoneyForm({ ...moneyForm, notes: e.target.value })
                  }}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500 resize-none"
                />
              </div>

              {moneyError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {moneyError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowMoneyModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 py-2 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordMoney}
                  disabled={!moneyForm.guestName.trim() || !Number.isFinite(Number(moneyForm.amount)) || Number(moneyForm.amount) <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-2 rounded-lg font-semibold transition"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Create New Event</h2>
              <button onClick={() => setShowCreateModal(false)} className="hover:bg-purple-800 p-2 rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Enter event title"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Date *</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Location *</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Enter location"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Organizer</label>
                <input
                  type="text"
                  value={newEvent.organizer}
                  onChange={(e) => setNewEvent({ ...newEvent, organizer: e.target.value })}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Expected Guests</label>
                <input
                  type="number"
                  value={newEvent.guestCount}
                  onChange={(e) => setNewEvent({ ...newEvent, guestCount: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Expected Amount (₹)</label>
                <input
                  type="number"
                  value={newEvent.moneyExpected}
                  onChange={(e) => setNewEvent({ ...newEvent, moneyExpected: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 py-2 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition"
                >
                  Create Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
