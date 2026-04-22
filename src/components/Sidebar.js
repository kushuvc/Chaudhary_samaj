import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { ArrowUpRight, BadgeIndianRupee, Building2, CalendarDays, Grid2X2, HandHeart, LayoutDashboard, Medal, Settings, UserCircle2, Users, } from 'lucide-react';
import BrandArtwork from './BrandArtwork';
const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, description: 'Home base and featured lanes' },
    { label: 'Community', path: '/community', icon: Users, description: 'Conversations, updates, and posts' },
    { label: 'Events', path: '/events', icon: CalendarDays, description: 'Meetups, ceremonies, and planning' },
    { label: 'Business', path: '/business', icon: Building2, description: 'Local services and vendors' },
    { label: 'Matrimony', path: '/matrimony', icon: Medal, description: 'Matching and discovery' },
    { label: 'Help Center', path: '/help-and-need', icon: HandHeart, description: 'Requests, help, and support' },
    { label: 'Profile', path: '/profile', icon: UserCircle2, description: 'Your public identity and details' },
    { label: 'Settings', path: '/settings', icon: Settings, description: 'Preferences and account control' },
    { label: 'Admin', path: '/admin', icon: BadgeIndianRupee, description: 'Operational tools and oversight' },
];
export default function Sidebar({ isOpen, onToggle }) {
    return (_jsxs(_Fragment, { children: [isOpen && (_jsx("div", { className: "fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm md:hidden", onClick: onToggle })), _jsxs("aside", { className: `fixed inset-y-0 left-0 z-40 flex h-screen w-[19rem] flex-col border-r border-white/10 bg-[#07111c] text-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`, children: [_jsxs("div", { className: "flex items-start gap-4 border-b border-white/10 p-6", children: [_jsx("div", { className: "h-16 w-16 rounded-3xl bg-white/5 p-2 ring-1 ring-white/10", children: _jsx(BrandArtwork, { className: "h-full w-full" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.35em] text-orange-200/80", children: "Chaudhary Samaj" }), _jsx("h1", { className: "mt-2 text-2xl font-semibold tracking-tight text-white", children: "Curated lanes" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-300", children: "A premium discovery shell with fast section switching and zero clutter." })] })] }), _jsxs("nav", { className: "flex-1 overflow-y-auto px-4 py-5", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between px-2 text-xs uppercase tracking-[0.28em] text-slate-400", children: [_jsx("span", { children: "Sections" }), _jsx(Grid2X2, { size: 14 })] }), _jsx("ul", { className: "space-y-2", children: navItems.map((item) => {
                                    const Icon = item.icon;
                                    return (_jsx("li", { children: _jsx(NavLink, { to: item.path, onClick: () => {
                                                if (window.innerWidth < 768) {
                                                    onToggle();
                                                }
                                            }, className: ({ isActive }) => [
                                                'group flex items-start gap-3 rounded-3xl border px-4 py-3 text-left transition-all duration-200',
                                                isActive
                                                    ? 'border-orange-400/40 bg-white/10 shadow-[0_18px_40px_rgba(249,115,22,0.15)]'
                                                    : 'border-transparent bg-white/0 hover:border-white/10 hover:bg-white/5',
                                            ].join(' '), children: ({ isActive }) => (_jsxs(_Fragment, { children: [_jsx("span", { className: `mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${isActive ? 'bg-orange-500 text-white' : 'bg-white/10 text-orange-200'}`, children: _jsx(Icon, { size: 18 }) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "flex items-center justify-between gap-3 text-sm font-semibold text-white", children: [_jsx("span", { children: item.label }), _jsx(ArrowUpRight, { size: 14, className: `transition-transform duration-200 ${isActive ? 'translate-x-0 opacity-100' : 'opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}` })] }), _jsx("span", { className: "mt-1 block text-xs leading-5 text-slate-400", children: item.description })] })] })) }) }, item.path));
                                }) })] }), _jsx("div", { className: "border-t border-white/10 p-4", children: _jsxs("div", { className: "rounded-[1.75rem] bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-slate-950 shadow-[0_18px_40px_rgba(249,115,22,0.22)]", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-900/70", children: "Live now" }), _jsx("p", { className: "mt-2 text-sm font-semibold", children: "Fresh sections, premium flow, no alert clutter." }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-900/70", children: "Designed for quick taps, swipes, and smooth discovery on web and mobile." })] }) })] })] }));
}
