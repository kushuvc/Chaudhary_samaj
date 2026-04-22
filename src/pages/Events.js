import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, DollarSign, MapPin, Plus, Users } from 'lucide-react';
import eventsService from '../services/events';
export default function Events() {
    const [events, setEvents] = useState([]);
    const [summary, setSummary] = useState({
        totalCreated: 0,
        upcomingCount: 0,
        pastCount: 0,
        pendingCount: 0,
        fullyCollectedCount: 0
    });
    const [filter, setFilter] = useState('all');
    useEffect(() => {
        const loadData = async () => {
            const [eventsResponse, summaryResponse] = await Promise.all([
                eventsService.getEvents(filter),
                eventsService.getSummary()
            ]);
            if (eventsResponse.success && eventsResponse.data) {
                setEvents(eventsResponse.data);
            }
            if (summaryResponse.success && summaryResponse.data) {
                setSummary(summaryResponse.data);
            }
        };
        void loadData();
    }, [filter]);
    const filteredEvents = events.filter((event) => {
        if (filter === 'all')
            return true;
        if (filter === 'fully_collected')
            return event.moneyExpected > 0 && event.moneyCollected >= event.moneyExpected;
        return event.status === filter;
    });
    const getStatusColor = (status) => {
        switch (status) {
            case 'upcoming':
                return 'bg-blue-100 text-blue-800';
            case 'ongoing':
                return 'bg-purple-100 text-purple-800';
            case 'completed':
                return 'bg-emerald-100 text-emerald-800';
            case 'cancelled':
                return 'bg-rose-100 text-rose-800';
            case 'pending':
                return 'bg-amber-100 text-amber-800';
            default:
                return 'bg-slate-100 text-slate-800';
        }
    };
    return (_jsxs("div", { className: "space-y-6 pb-8", children: [_jsxs("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { className: "max-w-2xl", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Planning lane" }), _jsx("h1", { className: "mt-2 text-4xl font-semibold tracking-tight text-slate-950", children: "Events" }), _jsx("p", { className: "mt-3 max-w-xl text-slate-600", children: "Manage community events and contributions with a cleaner premium shell." })] }), _jsxs("button", { className: "inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5", children: [_jsx(Plus, { size: 20 }), " Create Event"] })] }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 md:grid-cols-4", children: [_jsxs("div", { className: "rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Total Created" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-slate-900", children: summary.totalCreated })] }), _jsxs("div", { className: "rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Upcoming" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-blue-600", children: summary.upcomingCount })] }), _jsxs("div", { className: "rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Past History" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-emerald-600", children: summary.pastCount })] }), _jsxs("div", { className: "rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Pending Payment" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-orange-600", children: summary.pendingCount })] })] })] }), _jsxs("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: [_jsx("div", { className: "mb-6 flex flex-wrap gap-3", children: ['all', 'upcoming', 'past', 'pending', 'fully_collected'].map((value) => (_jsx("button", { onClick: () => setFilter(value), className: `rounded-full px-4 py-2 text-sm font-semibold transition ${filter === value ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, children: value.replace('_', ' ') }, value))) }), _jsx("div", { className: "grid gap-6 lg:grid-cols-3", children: filteredEvents.map((event) => {
                            const progress = event.moneyExpected > 0 ? (event.moneyCollected / event.moneyExpected) * 100 : 0;
                            return (_jsxs("article", { className: "overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg", children: [_jsxs("div", { className: "relative h-40 bg-gradient-to-br from-purple-400 to-purple-600", children: [event.image ? _jsx("img", { src: event.image, alt: event.title, className: "h-full w-full object-cover" }) : null, _jsx("span", { className: `absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(event.status)}`, children: event.status })] }), _jsxs("div", { className: "space-y-4 p-5", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-bold text-slate-900", children: event.title }), _jsxs("p", { className: "mt-1 text-sm text-slate-600", children: ["Organizer: ", event.organizer] })] }), _jsxs("div", { className: "space-y-2 text-sm text-slate-600", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { size: 16, className: "text-purple-600" }), new Date(event.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MapPin, { size: 16, className: "text-purple-600" }), event.location] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Users, { size: 16, className: "text-purple-600" }), event.guestCount, " guests"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(DollarSign, { size: 16, className: "text-emerald-600" }), "\u20B9", event.moneyCollected.toLocaleString(), " / \u20B9", event.moneyExpected.toLocaleString()] })] }), _jsx("div", { className: "h-2 overflow-hidden rounded-full bg-slate-200", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600", style: { width: `${Math.min(progress, 100)}%` } }) }), _jsx("button", { className: "w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800", children: "View Details" })] })] }, event.id));
                        }) }), filteredEvents.length === 0 && (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center", children: [_jsx(AlertCircle, { size: 48, className: "mx-auto mb-4 text-slate-400" }), _jsx("p", { className: "text-lg font-semibold text-slate-700", children: summary.totalCreated === 0 ? 'No events created yet. Create your first event to get started.' : 'No events found for this filter' })] }))] })] }));
}
