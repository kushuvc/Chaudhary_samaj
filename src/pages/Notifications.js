import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { BellRing, CheckCheck, Filter, Megaphone, MessageCircle, ShieldAlert, Trash2 } from 'lucide-react';
const initialNotifications = [
    { id: 'ntf-1', title: 'General Meeting Reminder', message: 'Community general meeting starts tomorrow at 6:30 PM in Town Hall.', type: 'announcement', createdAt: '2026-03-30T18:30:00.000Z', read: false },
    { id: 'ntf-2', title: 'New Matrimony Match', message: 'You have 3 new compatibility matches based on saved preferences.', type: 'event', createdAt: '2026-03-30T10:10:00.000Z', read: false },
    { id: 'ntf-3', title: 'Security Update', message: 'Your password was updated successfully on this device.', type: 'security', createdAt: '2026-03-29T09:50:00.000Z', read: true },
    { id: 'ntf-4', title: 'Support Reply', message: 'An admin replied to your Help and Need request. Check the thread for details.', type: 'message', createdAt: '2026-03-28T15:05:00.000Z', read: true }
];
const typeLabel = {
    announcement: 'Announcement',
    message: 'Message',
    security: 'Security',
    event: 'Event'
};
const typeStyle = {
    announcement: 'bg-indigo-100 text-indigo-700',
    message: 'bg-sky-100 text-sky-700',
    security: 'bg-rose-100 text-rose-700',
    event: 'bg-emerald-100 text-emerald-700'
};
const typeIcon = {
    announcement: _jsx(Megaphone, { size: 14 }),
    message: _jsx(MessageCircle, { size: 14 }),
    security: _jsx(ShieldAlert, { size: 14 }),
    event: _jsx(BellRing, { size: 14 })
};
export default function Notifications() {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [filterType, setFilterType] = useState('all');
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const typeMatch = filterType === 'all' || item.type === filterType;
            const readMatch = !showUnreadOnly || !item.read;
            return typeMatch && readMatch;
        });
    }, [filterType, notifications, showUnreadOnly]);
    const markAsRead = (id) => {
        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    };
    const markAllRead = () => {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    };
    const clearRead = () => {
        setNotifications((prev) => prev.filter((item) => !item.read));
    };
    const formatTimeAgo = (isoDate) => {
        const diffMs = Date.now() - new Date(isoDate).getTime();
        const mins = Math.max(1, Math.floor(diffMs / 60000));
        if (mins < 60)
            return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)
            return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };
    return (_jsxs("div", { className: "space-y-5 pb-8", children: [_jsxs("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Signal lane" }), _jsx("h1", { className: "mt-2 text-4xl font-semibold tracking-tight text-slate-950", children: "Notifications" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm text-slate-600", children: "Stay updated with community announcements and account activity." })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: markAllRead, className: "inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5", children: [_jsx(CheckCheck, { size: 16 }), " Mark All Read"] }), _jsxs("button", { onClick: clearRead, className: "inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50", children: [_jsx(Trash2, { size: 16 }), " Clear Read"] })] })] }), _jsx("div", { className: "mt-4 rounded-[1.6rem] bg-slate-50 p-4", children: _jsxs("p", { className: "text-sm text-slate-700", children: [_jsx("span", { className: "font-bold text-slate-900", children: unreadCount }), " unread notifications"] }) })] }), _jsx("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-5", children: _jsxs("div", { className: "grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center", children: [_jsxs("div", { className: "inline-flex items-center gap-2 text-sm text-slate-600", children: [_jsx(Filter, { size: 16 }), " Filter"] }), _jsxs("select", { value: filterType, onChange: (event) => setFilterType(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "announcement", children: "Announcement" }), _jsx("option", { value: "message", children: "Message" }), _jsx("option", { value: "security", children: "Security" }), _jsx("option", { value: "event", children: "Event" })] }), _jsxs("label", { className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", checked: showUnreadOnly, onChange: (event) => setShowUnreadOnly(event.target.checked) }), "Unread only"] })] }) }), filteredNotifications.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center", children: [_jsx("p", { className: "text-lg font-semibold text-slate-700", children: "No notifications found" }), _jsx("p", { className: "text-sm text-slate-500", children: "Try changing your notification filters." })] })) : (_jsx("div", { className: "space-y-3", children: filteredNotifications.map((notification) => (_jsx("article", { className: `rounded-2xl border p-4 shadow-sm transition ${notification.read ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/40'}`, children: _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle[notification.type]}`, children: [typeIcon[notification.type], typeLabel[notification.type]] }), !notification.read && _jsx("span", { className: "rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white", children: "Unread" })] }), _jsx("h3", { className: "text-base font-bold text-slate-900", children: notification.title }), _jsx("p", { className: "text-sm text-slate-600", children: notification.message }), _jsx("p", { className: "text-xs text-slate-500", children: formatTimeAgo(notification.createdAt) })] }), !notification.read && (_jsx("button", { onClick: () => markAsRead(notification.id), className: "rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800", children: "Mark Read" }))] }) }, notification.id))) }))] }));
}
