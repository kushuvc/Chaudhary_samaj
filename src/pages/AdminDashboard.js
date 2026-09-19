import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
export function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState(null);
    const API_BASE = 'http://localhost:3000/api';
    useEffect(() => {
        fetchStats();
        fetchUsers(1);
    }, []);
    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE}/admin/stats`);
            const data = await response.json();
            if (data.success) {
                setStats(data.data);
            }
            else {
                setError('Failed to fetch stats');
            }
        }
        catch (err) {
            setError('Failed to connect to server');
        }
        finally {
            setLoading(false);
        }
    };
    const fetchUsers = async (page) => {
        setUsersLoading(true);
        try {
            const response = await fetch(`${API_BASE}/admin/users?page=${page}&limit=20`);
            const data = await response.json();
            if (data.success) {
                setUsers(data.data.users);
                setTotalPages(data.data.pagination.pages);
                setCurrentPage(page);
            }
        }
        catch (err) {
            console.error('Failed to fetch users:', err);
        }
        finally {
            setUsersLoading(false);
        }
    };
    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
        }
        catch {
            return dateString;
        }
    };
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(amount);
    };
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-xl", children: "Loading dashboard..." }) }));
    }
    if (error) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsxs("div", { className: "text-red-600 text-xl", children: ["Error: ", error] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("div", { className: "bg-white shadow-sm border-b", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center py-4", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Admin Dashboard" }), _jsx("button", { onClick: fetchStats, className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition", children: "Refresh" })] }) }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: [_jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 bg-blue-100 rounded-lg p-3", children: _jsx("div", { className: "text-blue-600 text-2xl font-bold", children: "\uD83D\uDC65" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Total Users" }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: stats?.totalUsers || 0 }), _jsxs("p", { className: "text-xs text-green-600", children: ["+", stats?.recentUsers || 0, " this week"] })] })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 bg-green-100 rounded-lg p-3", children: _jsx("div", { className: "text-green-600 text-2xl font-bold", children: "\uD83D\uDC8E" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Premium Users" }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: stats?.activePremium || 0 }), _jsxs("p", { className: "text-xs text-gray-500", children: [stats?.conversionRate || 0, "% conversion"] })] })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 bg-yellow-100 rounded-lg p-3", children: _jsx("div", { className: "text-yellow-600 text-2xl font-bold", children: "\uD83D\uDCB0" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Total Revenue" }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: formatCurrency(stats?.totalRevenue || 0) }), _jsx("p", { className: "text-xs text-gray-500", children: "From subscriptions" })] })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 bg-purple-100 rounded-lg p-3", children: _jsx("div", { className: "text-purple-600 text-2xl font-bold", children: "\uD83D\uDC91" }) }), _jsxs("div", { className: "ml-4", children: [_jsx("p", { className: "text-sm font-medium text-gray-600", children: "Matrimony Profiles" }), _jsx("p", { className: "text-2xl font-bold text-gray-900", children: stats?.totalProfiles || 0 }), _jsxs("p", { className: "text-xs text-gray-500", children: [stats?.totalInterests || 0, " interests sent"] })] })] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Recent Users" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "User" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Details" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Subscription" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Joined" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: usersLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "Loading users..." }) })) : users.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "No users found" }) })) : (users.map((user) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: user.full_name }), _jsx("div", { className: "text-sm text-gray-500", children: user.email }), user.phone && _jsx("div", { className: "text-xs text-gray-400", children: user.phone })] }) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsxs("div", { className: "text-sm text-gray-900", children: [user.age && `${user.age} yrs`, user.gender && ` • ${user.gender}`, user.location && ` • ${user.location}`] }), _jsxs("div", { className: "text-xs text-gray-500", children: [user.education && `${user.education}`, user.occupation && ` • ${user.occupation}`] })] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [user.subscription_status === 'active' ? (_jsx("span", { className: "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800", children: user.subscription_plan || 'Premium' })) : (_jsx("span", { className: "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800", children: "Free" })), user.expires_at && (_jsxs("div", { className: "text-xs text-gray-500 mt-1", children: ["Expires ", formatDate(user.expires_at)] }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: formatDate(user.created_at) })] }, user.id)))) })] }) }), totalPages > 1 && (_jsx("div", { className: "px-6 py-4 border-t border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Page ", currentPage, " of ", totalPages] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx("button", { onClick: () => fetchUsers(currentPage - 1), disabled: currentPage === 1, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => fetchUsers(currentPage + 1), disabled: currentPage === totalPages, className: "px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }) }))] })] })] }));
}
