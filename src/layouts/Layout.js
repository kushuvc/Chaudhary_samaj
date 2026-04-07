import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    return (_jsxs("div", { className: "flex h-screen bg-gray-50", children: [_jsx(Sidebar, { isOpen: sidebarOpen, onToggle: () => setSidebarOpen(!sidebarOpen) }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx(TopNav, { onMenuClick: () => setSidebarOpen(!sidebarOpen) }), _jsx("main", { className: "flex-1 overflow-y-auto", children: _jsx("div", { className: "p-6 md:p-8", children: _jsx(Outlet, {}) }) })] })] }));
}
