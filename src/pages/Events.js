import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, DollarSign, Plus, X, AlertCircle, Download } from 'lucide-react';
import eventsService from '../services/events';
export default function Events() {
    const [events, setEvents] = useState([]);
    const [summary, setSummary] = useState({
        totalCreated: 0,
        upcomingCount: 0,
        pastCount: 0,
        pendingCount: 0,
        fullyCollectedCount: 0,
    });
    const [filter, setFilter] = useState('all');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventGuests, setEventGuests] = useState([]);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showMoneyModal, setShowMoneyModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [moneyError, setMoneyError] = useState('');
    const [moneyForm, setMoneyForm] = useState({
        guestName: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'cash',
        notes: ''
    });
    const [newEvent, setNewEvent] = useState({
        title: '',
        date: '',
        location: '',
        organizer: '',
        guestCount: '',
        moneyExpected: ''
    });
    useEffect(() => {
        loadEvents();
        loadSummary();
    }, [filter]);
    const loadEvents = async () => {
        const response = await eventsService.getEvents(filter);
        if (response.success && response.data) {
            setEvents(response.data);
        }
    };
    const loadSummary = async () => {
        const response = await eventsService.getSummary();
        if (response.success && response.data) {
            setSummary(response.data);
        }
    };
    const loadEventGuests = async (eventId) => {
        const response = await eventsService.getGuests(eventId);
        if (response.success && response.data) {
            setEventGuests(response.data);
        }
    };
    const handleViewEvent = async (event) => {
        const response = await eventsService.getEvent(event.id);
        if (response.success && response.data) {
            setSelectedEvent(response.data.event);
            setEventGuests(response.data.guests || []);
        }
        else {
            setSelectedEvent(event);
            await loadEventGuests(event.id);
        }
        setShowDetailModal(true);
    };
    const handleRecordMoney = async () => {
        const parsedAmount = Number(moneyForm.amount);
        if (!selectedEvent || !moneyForm.guestName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setMoneyError('Please enter a guest name and a positive amount.');
            return;
        }
        setMoneyError('');
        const response = await eventsService.recordMoneyReceived(selectedEvent.id, moneyForm.guestName.trim(), parsedAmount, moneyForm.date, moneyForm.paymentMode, moneyForm.notes);
        if (response.success) {
            await loadEventGuests(selectedEvent.id);
            await loadEvents();
            setMoneyError('');
            setMoneyForm({
                guestName: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                paymentMode: 'cash',
                notes: ''
            });
            setShowMoneyModal(false);
        }
        else {
            setMoneyError(response.error || 'Unable to record payment. Please check the form and try again.');
        }
    };
    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.date || !newEvent.location) {
            alert('Please fill in all required fields');
            return;
        }
        const response = await eventsService.createEvent({
            title: newEvent.title,
            date: newEvent.date,
            location: newEvent.location,
            organizer: newEvent.organizer,
            guestCount: parseInt(newEvent.guestCount || '0'),
            moneyExpected: parseInt(newEvent.moneyExpected || '0')
        });
        if (response.success) {
            await loadEvents();
            await loadSummary();
            setNewEvent({
                title: '',
                date: '',
                location: '',
                organizer: '',
                guestCount: '',
                moneyExpected: ''
            });
            setShowCreateModal(false);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'upcoming': return 'bg-blue-100 text-blue-800';
            case 'ongoing': return 'bg-purple-100 text-purple-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const getRSVPColor = (status) => {
        switch (status) {
            case 'attending': return 'text-green-600';
            case 'not_attending': return 'text-red-600';
            case 'maybe': return 'text-yellow-600';
            default: return 'text-gray-600';
        }
    };
    const filteredEvents = events;
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6", children: [_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-4xl font-bold text-slate-900", children: "Events" }), _jsx("p", { className: "text-slate-600 mt-2", children: "Manage your own community events and contributions" })] }), _jsxs("button", { onClick: () => setShowCreateModal(true), className: "flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition", children: [_jsx(Plus, { size: 20 }), " Create Event"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow p-4 border border-slate-100", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Total Created" }), _jsx("p", { className: "text-3xl font-bold text-slate-900 mt-1", children: summary.totalCreated })] }), _jsxs("div", { className: "bg-white rounded-xl shadow p-4 border border-slate-100", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Upcoming" }), _jsx("p", { className: "text-3xl font-bold text-blue-600 mt-1", children: summary.upcomingCount })] }), _jsxs("div", { className: "bg-white rounded-xl shadow p-4 border border-slate-100", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Past History" }), _jsx("p", { className: "text-3xl font-bold text-emerald-600 mt-1", children: summary.pastCount })] }), _jsxs("div", { className: "bg-white rounded-xl shadow p-4 border border-slate-100", children: [_jsx("p", { className: "text-sm text-slate-500", children: "Pending Payment" }), _jsx("p", { className: "text-3xl font-bold text-orange-600 mt-1", children: summary.pendingCount })] })] }), _jsx("div", { className: "flex gap-3 mb-8 overflow-x-auto pb-2", children: [
                            { id: 'all', label: 'All Created' },
                            { id: 'upcoming', label: 'Upcoming' },
                            { id: 'past', label: 'Past History' },
                            { id: 'pending', label: 'Pending Payment' },
                            { id: 'fully_collected', label: 'Fully Collected' }
                        ].map(f => (_jsx("button", { onClick: () => setFilter(f.id), className: `px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${filter === f.id
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:border-purple-400'}`, children: f.label }, f.id))) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8", children: filteredEvents.map(event => {
                            const progress = (event.moneyCollected / event.moneyExpected) * 100;
                            return (_jsxs("div", { className: "bg-white rounded-xl shadow-lg hover:shadow-xl transition overflow-hidden group", children: [_jsxs("div", { className: "h-40 bg-gradient-to-br from-purple-400 to-purple-600 overflow-hidden relative", children: [event.image && (_jsx("img", { src: event.image, alt: event.title, className: "w-full h-full object-cover group-hover:scale-105 transition" })), _jsx("div", { className: "absolute top-3 right-3", children: _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(event.status)}`, children: event.status.charAt(0).toUpperCase() + event.status.slice(1) }) })] }), _jsxs("div", { className: "p-5", children: [_jsx("h3", { className: "text-lg font-bold text-slate-900 mb-2", children: event.title }), _jsxs("div", { className: "space-y-2 text-sm text-slate-600 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { size: 16, className: "text-purple-600" }), new Date(event.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MapPin, { size: 16, className: "text-purple-600" }), event.location] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Users, { size: 16, className: "text-purple-600" }), event.guestCount, " guests"] })] }), _jsxs("div", { className: "mb-4 pb-4 border-b border-slate-200", children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide", children: "Organizer" }), _jsx("p", { className: "font-semibold text-slate-900", children: event.organizer })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(DollarSign, { size: 16, className: "text-green-600" }), _jsxs("span", { className: "text-sm font-semibold text-slate-900", children: ["\u20B9", event.moneyCollected.toLocaleString(), " / \u20B9", event.moneyExpected.toLocaleString()] })] }), _jsxs("span", { className: "text-xs font-bold text-purple-600", children: [Math.round(progress), "%"] })] }), _jsx("div", { className: "w-full bg-slate-200 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: "bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300", style: { width: `${Math.min(progress, 100)}%` } }) })] }), _jsx("button", { onClick: () => handleViewEvent(event), className: "w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition", children: "View Details" })] })] }, event.id));
                        }) }), filteredEvents.length === 0 && (_jsxs("div", { className: "text-center py-12", children: [_jsx(AlertCircle, { size: 48, className: "mx-auto text-slate-400 mb-4" }), _jsx("p", { className: "text-slate-600 text-lg", children: summary.totalCreated === 0 ? 'No events created yet. Create your first event to get started.' : 'No events found for this filter' })] }))] }), showDetailModal && selectedEvent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center border-b", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold", children: selectedEvent.title }), _jsxs("p", { className: "text-purple-100 text-sm mt-1", children: ["Organized by ", selectedEvent.organizer] })] }), _jsx("button", { onClick: () => setShowDetailModal(false), className: "hover:bg-purple-800 p-2 rounded-lg transition", children: _jsx(X, { size: 24 }) })] }), _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-slate-50 p-4 rounded-lg", children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide mb-1", children: "Date & Time" }), _jsx("p", { className: "font-semibold text-slate-900", children: new Date(selectedEvent.date).toLocaleDateString('en-IN', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    }) })] }), _jsxs("div", { className: "bg-slate-50 p-4 rounded-lg", children: [_jsx("p", { className: "text-xs text-slate-500 uppercase tracking-wide mb-1", children: "Location" }), _jsx("p", { className: "font-semibold text-slate-900", children: selectedEvent.location })] })] }), _jsxs("div", { className: "bg-purple-50 border-l-4 border-purple-600 p-4 rounded", children: [_jsxs("div", { className: "flex justify-between items-center mb-3", children: [_jsx("h3", { className: "font-bold text-slate-900", children: "Money Tracking" }), _jsxs("span", { className: "text-sm font-semibold text-purple-600", children: [Math.round((selectedEvent.moneyCollected / selectedEvent.moneyExpected) * 100), "%"] })] }), _jsx("div", { className: "w-full bg-slate-200 rounded-full h-3 mb-3", children: _jsx("div", { className: "bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all", style: { width: `${Math.min((selectedEvent.moneyCollected / selectedEvent.moneyExpected) * 100, 100)}%` } }) }), _jsxs("div", { className: "grid grid-cols-3 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-600", children: "Expected" }), _jsxs("p", { className: "font-bold text-slate-900", children: ["\u20B9", selectedEvent.moneyExpected.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-600", children: "Collected" }), _jsxs("p", { className: "font-bold text-green-600", children: ["\u20B9", selectedEvent.moneyCollected.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-slate-600", children: "Remaining" }), _jsxs("p", { className: "font-bold text-orange-600", children: ["\u20B9", (selectedEvent.moneyExpected - selectedEvent.moneyCollected).toLocaleString()] })] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-lg font-bold text-slate-900", children: ["Guest Details (", eventGuests.length, ")"] }), _jsxs("button", { onClick: () => setShowMoneyModal(true), className: "flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition", children: [_jsx(Plus, { size: 16 }), " Record Contribution"] })] }), _jsx("div", { className: "overflow-x-auto", children: eventGuests.length > 0 ? (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-slate-100 border-b-2 border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-900", children: "Guest Name" }), _jsx("th", { className: "px-4 py-3 text-left font-semibold text-slate-900", children: "RSVP" }), _jsx("th", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: "Promised" }), _jsx("th", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: "Received" }), _jsx("th", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: "Balance" }), _jsx("th", { className: "px-4 py-3 text-center font-semibold text-slate-900", children: "Payment" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-200", children: eventGuests.map(guest => {
                                                            const balance = guest.amountPromised - guest.amountReceived;
                                                            return (_jsxs("tr", { className: "hover:bg-slate-50 transition", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-900", children: guest.name }), _jsxs("td", { className: `px-4 py-3 font-semibold ${getRSVPColor(guest.rsvpStatus)}`, children: [guest.rsvpStatus === 'attending' && '✓ Attending', guest.rsvpStatus === 'not_attending' && '✗ Not Attending', guest.rsvpStatus === 'maybe' && '? Maybe', guest.rsvpStatus === 'not_responded' && '○ Not Responded'] }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: ["\u20B9", guest.amountPromised.toLocaleString()] }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-green-600", children: ["\u20B9", guest.amountReceived.toLocaleString()] }), _jsxs("td", { className: `px-4 py-3 text-right font-semibold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`, children: ["\u20B9", balance.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-center", children: guest.paymentMode && (_jsx("span", { className: "inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold", children: guest.paymentMode === 'upi' ? 'UPI' : guest.paymentMode === 'bank_transfer' ? 'Bank' : 'Cash' })) })] }, guest.id));
                                                        }) })] })) : (_jsx("div", { className: "bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-600", children: "Guest list and contribution tracking will appear here once you add guests." })) })] }), _jsxs("div", { className: "flex gap-3 pt-4 border-t border-slate-200", children: [_jsxs("button", { className: "flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2 rounded-lg font-semibold transition", children: [_jsx(Users, { size: 18 }), " Invite Guests"] }), _jsxs("button", { className: "flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-900 py-2 rounded-lg font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed", disabled: eventGuests.length === 0, children: [_jsx(Download, { size: 18 }), " Export List"] })] })] })] }) })), showMoneyModal && selectedEvent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-xl max-w-md w-full", children: [_jsxs("div", { className: "bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex justify-between items-center", children: [_jsx("h2", { className: "text-xl font-bold", children: "Record Contribution" }), _jsx("button", { onClick: () => setShowMoneyModal(false), className: "hover:bg-green-800 p-2 rounded-lg transition", children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Guest Name" }), _jsx("input", { type: "text", value: moneyForm.guestName, onChange: (e) => setMoneyForm({ ...moneyForm, guestName: e.target.value }), placeholder: "Enter guest name", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Amount Received (\u20B9)" }), _jsx("input", { type: "number", value: moneyForm.amount, onChange: (e) => {
                                                setMoneyError('');
                                                setMoneyForm({ ...moneyForm, amount: e.target.value });
                                            }, placeholder: "0", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Date" }), _jsx("input", { type: "date", value: moneyForm.date, onChange: (e) => {
                                                setMoneyError('');
                                                setMoneyForm({ ...moneyForm, date: e.target.value });
                                            }, className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Payment Mode" }), _jsxs("select", { value: moneyForm.paymentMode, onChange: (e) => {
                                                setMoneyError('');
                                                setMoneyForm({ ...moneyForm, paymentMode: e.target.value });
                                            }, className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500", children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "bank_transfer", children: "Bank Transfer" }), _jsx("option", { value: "manual", children: "Manual" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: moneyForm.notes, onChange: (e) => {
                                                setMoneyError('');
                                                setMoneyForm({ ...moneyForm, notes: e.target.value });
                                            }, placeholder: "Add any notes...", rows: 3, className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500 resize-none" })] }), moneyError && (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700", children: moneyError })), _jsxs("div", { className: "flex gap-3 pt-4", children: [_jsx("button", { onClick: () => setShowMoneyModal(false), className: "flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 py-2 rounded-lg font-semibold transition", children: "Cancel" }), _jsx("button", { onClick: handleRecordMoney, disabled: !moneyForm.guestName.trim() || !Number.isFinite(Number(moneyForm.amount)) || Number(moneyForm.amount) <= 0, className: "flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white py-2 rounded-lg font-semibold transition", children: "Record Payment" })] })] })] }) })), showCreateModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-xl max-w-md w-full", children: [_jsxs("div", { className: "bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center", children: [_jsx("h2", { className: "text-xl font-bold", children: "Create New Event" }), _jsx("button", { onClick: () => setShowCreateModal(false), className: "hover:bg-purple-800 p-2 rounded-lg transition", children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Event Title *" }), _jsx("input", { type: "text", value: newEvent.title, onChange: (e) => setNewEvent({ ...newEvent, title: e.target.value }), placeholder: "Enter event title", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Date *" }), _jsx("input", { type: "date", value: newEvent.date, onChange: (e) => setNewEvent({ ...newEvent, date: e.target.value }), className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Location *" }), _jsx("input", { type: "text", value: newEvent.location, onChange: (e) => setNewEvent({ ...newEvent, location: e.target.value }), placeholder: "Enter location", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Organizer" }), _jsx("input", { type: "text", value: newEvent.organizer, onChange: (e) => setNewEvent({ ...newEvent, organizer: e.target.value }), placeholder: "Your name", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Expected Guests" }), _jsx("input", { type: "number", value: newEvent.guestCount, onChange: (e) => setNewEvent({ ...newEvent, guestCount: e.target.value }), placeholder: "0", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-slate-900 mb-2", children: "Expected Amount (\u20B9)" }), _jsx("input", { type: "number", value: newEvent.moneyExpected, onChange: (e) => setNewEvent({ ...newEvent, moneyExpected: e.target.value }), placeholder: "0", className: "w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500" })] }), _jsxs("div", { className: "flex gap-3 pt-4", children: [_jsx("button", { onClick: () => setShowCreateModal(false), className: "flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 py-2 rounded-lg font-semibold transition", children: "Cancel" }), _jsx("button", { onClick: handleCreateEvent, className: "flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition", children: "Create Event" })] })] })] }) }))] }));
}
