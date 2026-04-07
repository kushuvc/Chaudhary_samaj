import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Matrimony', path: '/matrimony', icon: '💍' },
    { label: 'Events', path: '/events', icon: '🎉' },
    { label: 'Help and Need', path: '/help-and-need', icon: '🤝' },
    { label: 'Business', path: '/business', icon: '💼' },
    { label: 'Community', path: '/community', icon: '👥' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
    { label: 'Admin', path: '/admin', icon: '🔐' },
];
export default function Sidebar({ isOpen, onToggle }) {
    const location = useLocation();
    return (_jsxs(_Fragment, { children: [isOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-30 block md:hidden", onClick: onToggle })), _jsxs("aside", { className: `fixed md:static w-64 h-screen bg-white border-r border-gray-200 transform transition-transform duration-200 z-40 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`, children: [_jsxs("div", { className: "p-6 border-b border-gray-200", children: [_jsx("h1", { className: "text-2xl font-bold text-primary-700", children: "Chaudhary" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Community Platform" })] }), _jsx("nav", { className: "flex-1 overflow-y-auto p-4", children: _jsx("ul", { className: "space-y-2", children: navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (_jsx("li", { children: _jsxs(Link, { to: item.path, onClick: () => {
                                            // Close sidebar on mobile after navigation
                                            if (window.innerWidth < 768) {
                                                onToggle();
                                            }
                                        }, className: `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${isActive
                                            ? 'bg-primary-100 text-primary-700 font-medium'
                                            : 'text-gray-700 hover:bg-gray-100'}`, children: [_jsx("span", { className: "text-lg", children: item.icon }), _jsx("span", { children: item.label })] }) }, item.path));
                            }) }) }), _jsx("div", { className: "border-t border-gray-200 p-4", children: _jsx("p", { className: "text-xs text-gray-500", children: "\u00A9 2026 Chaudhary Samaj" }) })] })] }));
}
