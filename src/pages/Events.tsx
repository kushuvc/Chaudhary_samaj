import { useEffect, useState } from 'react'
import { AlertCircle, Calendar, DollarSign, MapPin, Plus, Users } from 'lucide-react'
import eventsService from '../services/events'
import { Event } from '../types'

type EventFilter = 'all' | 'upcoming' | 'past' | 'pending' | 'fully_collected'

export default function Events() {
  const [events, setEvents] = useState<Event[]>([])
  const [summary, setSummary] = useState({
    totalCreated: 0,
    upcomingCount: 0,
    pastCount: 0,
    pendingCount: 0,
    fullyCollectedCount: 0
  })
  const [filter, setFilter] = useState<EventFilter>('all')

  useEffect(() => {
    const loadData = async () => {
      const [eventsResponse, summaryResponse] = await Promise.all([
        eventsService.getEvents(filter),
        eventsService.getSummary()
      ])

      if (eventsResponse.success && eventsResponse.data) {
        setEvents(eventsResponse.data)
      }

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data)
      }
    }

    void loadData()
  }, [filter])

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true
    if (filter === 'fully_collected') return event.moneyExpected > 0 && event.moneyCollected >= event.moneyExpected
    return event.status === filter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800'
      case 'ongoing':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-emerald-100 text-emerald-800'
      case 'cancelled':
        return 'bg-rose-100 text-rose-800'
      case 'pending':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Planning lane</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Events</h1>
            <p className="mt-3 max-w-xl text-slate-600">Manage community events and contributions with a cleaner premium shell.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5">
            <Plus size={20} /> Create Event
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Created</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{summary.totalCreated}</p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Upcoming</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{summary.upcomingCount}</p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Past History</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{summary.pastCount}</p>
          </div>
          <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending Payment</p>
            <p className="mt-1 text-3xl font-bold text-orange-600">{summary.pendingCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
        <div className="mb-6 flex flex-wrap gap-3">
          {(['all', 'upcoming', 'past', 'pending', 'fully_collected'] as EventFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === value ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {value.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const progress = event.moneyExpected > 0 ? (event.moneyCollected / event.moneyExpected) * 100 : 0

            return (
              <article key={event.id} className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative h-40 bg-gradient-to-br from-purple-400 to-purple-600">
                  {event.image ? <img src={event.image} alt={event.title} className="h-full w-full object-cover" /> : null}
                  <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">Organizer: {event.organizer}</p>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Calendar size={16} className="text-purple-600" />{new Date(event.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="flex items-center gap-2"><MapPin size={16} className="text-purple-600" />{event.location}</div>
                    <div className="flex items-center gap-2"><Users size={16} className="text-purple-600" />{event.guestCount} guests</div>
                    <div className="flex items-center gap-2"><DollarSign size={16} className="text-emerald-600" />₹{event.moneyCollected.toLocaleString()} / ₹{event.moneyExpected.toLocaleString()}</div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>

                  <button className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                    View Details
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-semibold text-slate-700">
              {summary.totalCreated === 0 ? 'No events created yet. Create your first event to get started.' : 'No events found for this filter'}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
