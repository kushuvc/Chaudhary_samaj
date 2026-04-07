import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/auth';
export default function TopNav({ onMenuClick }) {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const currentUser = authService.getCurrentUser();
    const initials = (currentUser?.fullName || 'User')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    return (_jsx("header", { className: "bg-white border-b border-gray-200 sticky top-0 z-20", children: _jsxs("div", { className: "flex items-center justify-between h-16 px-4 md:px-8", children: [_jsxs("div", { className: "flex items-center gap-4 flex-1", children: [_jsx("button", { onClick: onMenuClick, className: "md:hidden p-2 hover:bg-gray-100 rounded-lg", "aria-label": "Toggle sidebar", children: "\u2630" }), _jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx("input", { type: "text", placeholder: "Search...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full px-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" }), _jsx("span", { className: "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400", children: "\uD83D\uDD0D" })] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs(Link, { to: "/notifications", className: "p-2 hover:bg-gray-100 rounded-lg relative", "aria-label": "Notifications", children: [_jsx("span", { className: "text-xl", children: "\uD83D\uDD14" }), _jsx("span", { className: "absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" })] }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setShowUserMenu(!showUserMenu), className: "flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg", children: [_jsx("div", { className: "w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold", children: initials }), _jsx("span", { className: "hidden sm:inline text-sm font-medium", children: currentUser?.fullName || 'User' })] }), showUserMenu && (_jsxs("div", { className: "absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2", children: [_jsx(Link, { to: "/profile", className: "block px-4 py-2 text-sm hover:bg-gray-100", onClick: () => setShowUserMenu(false), children: "\uD83D\uDC64 My Profile" }), _jsx(Link, { to: "/settings", className: "block px-4 py-2 text-sm hover:bg-gray-100", onClick: () => setShowUserMenu(false), children: "\u2699\uFE0F Settings" }), _jsx("hr", { className: "my-2" }), _jsx("button", { className: "w-full text-left px-4 py-2 text-sm hover:bg-gray-100", onClick: () => {
                                                setShowUserMenu(false);
                                                authService.logout();
                                                navigate('/login', { replace: true });
                                            }, children: "\uD83D\uDEAA Logout" })] }))] })] })] }) }));
}
