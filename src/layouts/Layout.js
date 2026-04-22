import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden bg-transparent text-slate-900", children: [_jsxs("div", { className: "pointer-events-none absolute inset-0 overflow-hidden", children: [_jsx("div", { className: "absolute -left-24 top-24 h-80 w-80 rounded-full bg-orange-200/35 blur-3xl" }), _jsx("div", { className: "absolute right-[-5rem] top-8 h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl" })] }), _jsx(Sidebar, { isOpen: sidebarOpen, onToggle: () => setSidebarOpen(!sidebarOpen) }), _jsxs("div", { className: "relative flex min-h-screen flex-col md:pl-[19rem]", children: [_jsx(TopNav, { onMenuClick: () => setSidebarOpen(true) }), _jsx("main", { className: "flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6", children: _jsx("div", { className: "mx-auto w-full max-w-[1500px]", children: _jsx(Outlet, {}) }) })] })] }));
}
