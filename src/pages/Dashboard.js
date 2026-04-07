import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Dashboard() {
    return (_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-8", children: "Dashboard" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [1, 2, 3, 4].map((i) => (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "text-gray-500 text-sm font-medium", children: ["Section ", i] }), _jsx("div", { className: "text-3xl font-bold text-primary-600 mt-2", children: i * 10 })] }, i))) })] }));
}
