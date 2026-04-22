import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeIndianRupee, CalendarDays, ChevronRight, Clock3, HeartHandshake, LayoutDashboard, MapPin, Megaphone, Sparkles, Store, Users, } from 'lucide-react';
import BrandArtwork from '../components/BrandArtwork';
const sectionCards = [
    {
        title: 'Community Feed',
        description: 'Fresh conversations, announcements, and local updates in a premium card stack.',
        to: '/community',
        icon: Users,
        accent: 'from-orange-500 to-amber-400',
        meta: 'Best for daily discovery',
    },
    {
        title: 'Events',
        description: 'Browse ceremonies, planning, and contribution tracking in one place.',
        to: '/events',
        icon: CalendarDays,
        accent: 'from-slate-900 to-slate-700',
        meta: 'Runs like a premium booking lane',
    },
    {
        title: 'Business',
        description: 'Explore verified services, vendors, and local partners with a swipe-friendly layout.',
        to: '/business',
        icon: Store,
        accent: 'from-indigo-600 to-violet-500',
        meta: 'Local commerce spotlight',
    },
    {
        title: 'Matrimony',
        description: 'A polished matching lane with focused profiles and quick shortlists.',
        to: '/matrimony',
        icon: HeartHandshake,
        accent: 'from-rose-500 to-fuchsia-500',
        meta: 'High-intent discovery',
    },
    {
        title: 'Help Center',
        description: 'Support requests and community help, presented with a calm, clean flow.',
        to: '/help-and-need',
        icon: Megaphone,
        accent: 'from-emerald-500 to-teal-500',
        meta: 'Assistance without friction',
    },
    {
        title: 'Settings',
        description: 'Account controls and preferences, tucked away in a focused utility lane.',
        to: '/settings',
        icon: LayoutDashboard,
        accent: 'from-slate-500 to-slate-700',
        meta: 'Keep the system tuned',
    },
];
const metrics = [
    { label: 'Live lanes', value: '06', icon: Sparkles, tone: 'text-orange-600' },
    { label: 'Active members', value: '1.2k', icon: Users, tone: 'text-slate-900' },
    { label: 'Upcoming events', value: '24', icon: CalendarDays, tone: 'text-indigo-600' },
    { label: 'Community support', value: '98%', icon: HeartHandshake, tone: 'text-emerald-600' },
];
const highlights = [
    {
        title: 'Featured route',
        description: 'Choose a section from the left drawer and move through the app without losing context.',
        icon: ChevronRight,
    },
    {
        title: 'Premium motion',
        description: 'Cards lift and slide on hover so the whole surface feels alive, not static.',
        icon: Clock3,
    },
    {
        title: 'No alerts for now',
        description: 'The notifications lane is hidden to keep the UI focused on discovery.',
        icon: BadgeIndianRupee,
    },
];
export default function Dashboard() {
    return (_jsxs("div", { className: "space-y-6 pb-8", children: [_jsxs("section", { className: "relative overflow-hidden rounded-[2rem] border border-white/60 bg-[#08101a] p-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:p-8", children: [_jsx("div", { className: "absolute -right-24 -top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" }), _jsx("div", { className: "absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" }), _jsxs("div", { className: "grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center", children: [_jsxs("div", { className: "relative z-10 max-w-2xl", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-200/90 backdrop-blur", children: [_jsx(Sparkles, { size: 15 }), "Swiggy-style discovery. CRED-like polish."] }), _jsx("h1", { className: "mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl", children: "One premium home for community, events, business, and matches." }), _jsx("p", { className: "mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg", children: "This reconstruction turns the app into a clean discovery experience with a left-sliding section rail, rich cards, and a strong visual hierarchy. Alerts are hidden for now so the interface stays focused." }), _jsxs("div", { className: "mt-8 flex flex-wrap gap-3", children: [_jsxs(Link, { to: "/community", className: "inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:-translate-y-0.5", children: ["Explore community ", _jsx(ArrowRight, { size: 16 })] }), _jsxs(Link, { to: "/events", className: "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10", children: ["Browse events ", _jsx(ChevronRight, { size: 16 })] })] }), _jsxs("div", { className: "mt-8 grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", children: "Style" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: "Bold, premium, and fast" })] }), _jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", children: "Motion" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: "Sliding section rails" })] }), _jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", children: "Alerts" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: "Hidden for now" })] })] })] }), _jsxs("div", { className: "relative z-10", children: [_jsx("div", { className: "rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_25px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl", children: _jsx(BrandArtwork, { className: "mx-auto h-[18rem] w-full max-w-[20rem] drop-shadow-[0_24px_50px_rgba(0,0,0,0.45)]" }) }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", children: "Quick note" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: "The left drawer now owns all sections." })] }), _jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", children: "Visual system" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: "Orange, slate, cream, and glass." })] })] })] })] })] }), _jsx("section", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-4", children: metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (_jsx("article", { className: "rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-500", children: metric.label }), _jsx("p", { className: `mt-2 text-3xl font-semibold tracking-tight ${metric.tone}`, children: metric.value })] }), _jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15", children: _jsx(Icon, { size: 20 }) })] }) }, metric.label));
                }) }), _jsxs("section", { className: "grid gap-5 lg:grid-cols-[1.1fr_0.9fr]", children: [_jsxs("div", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Choose a section" }), _jsx("h2", { className: "mt-2 text-2xl font-semibold tracking-tight text-slate-950", children: "Each lane slides in from the left." })] }), _jsxs("div", { className: "hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:inline-flex", children: [_jsx(LayoutDashboard, { size: 15, className: "mr-2" }), "Interactive shell"] })] }), _jsx("div", { className: "mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: sectionCards.map((card, index) => {
                                    const Icon = card.icon;
                                    return (_jsxs(Link, { to: card.to, className: "group relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(15,23,42,0.12)]", style: { animationDelay: `${index * 60}ms` }, children: [_jsx("div", { className: `absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}` }), _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: `flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg shadow-black/10`, children: _jsx(Icon, { size: 20 }) }), _jsx("h3", { className: "mt-4 text-lg font-semibold text-slate-950", children: card.title })] }), _jsx(ChevronRight, { size: 18, className: "mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-slate-600", children: card.description }), _jsx("p", { className: "mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400", children: card.meta })] }, card.title));
                                }) })] }), _jsxs("div", { className: "space-y-4 rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Visual notes" }), _jsx("h2", { className: "mt-2 text-2xl font-semibold tracking-tight text-slate-950", children: "Why this feels more like Swiggy or CRED" })] }), _jsx("div", { className: "space-y-3", children: highlights.map((highlight) => {
                                    const Icon = highlight.icon;
                                    return (_jsx("article", { className: "rounded-[1.5rem] border border-slate-200/80 bg-slate-50 p-4 transition hover:bg-white", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white", children: _jsx(Icon, { size: 18 }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-slate-950", children: highlight.title }), _jsx("p", { className: "mt-1 text-sm leading-6 text-slate-600", children: highlight.description })] })] }) }, highlight.title));
                                }) }), _jsxs("div", { className: "rounded-[1.5rem] bg-gradient-to-br from-orange-500 to-amber-400 p-5 text-slate-950 shadow-[0_20px_50px_rgba(249,115,22,0.18)]", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-900/70", children: "Fast access" }), _jsx("p", { className: "mt-2 text-lg font-semibold", children: "The left drawer owns navigation, the cards own discovery." }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-900/75", children: "Use this as the new foundation, then we can tune each section one by one to match the same visual language." })] })] })] }), _jsxs("section", { className: "grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-[2rem] border border-white/70 bg-[#111827] p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.15)] lg:col-span-2", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Highlighted lane" }), _jsx("h2", { className: "mt-2 text-2xl font-semibold tracking-tight text-white", children: "Curated cards with room to breathe" })] }), _jsx("div", { className: "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-200", children: "Alerts hidden by design" })] }), _jsxs("div", { className: "mt-5 grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-sm font-semibold text-white", children: "Primary action" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-300", children: "Every section card now behaves like a lane you can jump into quickly." }), _jsxs("div", { className: "mt-4 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white", children: ["Open section ", _jsx(ArrowRight, { size: 15 })] })] }), _jsxs("div", { className: "rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur", children: [_jsx("p", { className: "text-sm font-semibold text-white", children: "Secondary action" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-300", children: "The UI keeps your eye on the content instead of on notification chrome." }), _jsxs("div", { className: "mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white", children: [_jsx(MapPin, { size: 15 }), "Stay focused"] })] })] })] }), _jsxs("div", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Next step" }), _jsx("h2", { className: "mt-2 text-xl font-semibold tracking-tight text-slate-950", children: "If you want, I can now restyle every page to match this shell." }), _jsx("p", { className: "mt-3 text-sm leading-6 text-slate-600", children: "Community, business, events, help, matrimony, profile, and settings can all share the same premium card language." }), _jsxs("div", { className: "mt-5 space-y-3", children: [_jsxs(Link, { to: "/community", className: "flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800", children: ["Open community ", _jsx(ArrowRight, { size: 15 })] }), _jsxs(Link, { to: "/business", className: "flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50", children: ["Open business ", _jsx(ArrowRight, { size: 15 })] })] })] })] })] }));
}
