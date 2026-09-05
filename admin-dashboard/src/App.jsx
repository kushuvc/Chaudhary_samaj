import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Backend API URL - connects to your production database
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TOKEN_KEY = 'chaudhary_admin_token';

/**
 * The /api/admin routes require a bearer token from an account flagged
 * is_admin. Previously this dashboard called them with no credentials at all,
 * which meant anyone who could reach the API could read the whole user table.
 */
async function adminFetch(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    const err = new Error(data.error || 'Not authorised');
    err.authFailed = true;
    throw err;
  }
  return data;
}

function LoginScreen({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');

      const token = data.data.authToken;
      // Confirm the account actually has admin rights before storing anything,
      // so a non-admin gets told now rather than at the first empty dashboard.
      await adminFetch('/admin/stats', token);

      localStorage.setItem(TOKEN_KEY, token);
      onAuthenticated(token);
    } catch (err) {
      setError(err.authFailed ? 'This account does not have admin access.' : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-lg shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Admin sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Chaudhary Samaj dashboard</p>

        <label className="block text-sm font-medium mb-1" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          autoComplete="username"
          required
        />

        <label className="block text-sm font-medium mb-1" htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-5"
          autoComplete="current-password"
          required
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white rounded py-2 font-semibold disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [stats, setStats] = useState({
    totalUsers: 0,
    recentUsers: 0,
    activePremium: 0,
    totalRevenue: 0,
    totalProfiles: 0,
    totalInterests: 0,
    conversionRate: '0'
  });
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchStats = async () => {
    try {
      console.log('Fetching stats from backend API...');
      
      const data = await adminFetch('/admin/stats', token);
      
      console.log('Stats response:', data);
      
      if (data.success) {
        setStats(data.data);
      } else {
        setError('Failed to fetch stats: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to fetch stats: ' + err.message);
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      const data = await adminFetch(`/admin/users?page=${page}&limit=20`, token);
      
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.pages);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch users:', data.error);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchChartData = async () => {
    try {
      // For now, create sample chart data - can be enhanced later
      const today = new Date();
      const data = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
          date: format(date, 'MMM dd'),
          users: Math.floor(Math.random() * 10) + 1
        });
      }
      setChartData(data);
    } catch (err) {
      console.error('Error fetching chart data:', err);
    }
  };

  useEffect(() => {
    // Initial data fetch
    const loadData = async () => {
      try {
        console.log('Loading data from backend...');
        await fetchStats();
        await fetchUsers(1);
        await fetchChartData();
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        if (err.authFailed) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        } else {
          setError('Failed to load data: ' + err.message);
        }
        setLoading(false);
      }
    };
    
    loadData();

    // Set up polling for real-time updates (every 30 seconds)
    const interval = setInterval(async () => {
      await fetchStats();
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, token]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  if (!token) {
    return <LoginScreen onAuthenticated={(next) => { setToken(next); setLoading(true); }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading admin dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Production Admin Dashboard</h1>
              <p className="text-sm text-green-600">Real-time updates from Supabase</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-xs text-gray-500">Last updated:</p>
                <p className="text-sm text-gray-700">{formatDate(lastUpdate)}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 border rounded px-3 py-1.5"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <div className="text-blue-600 text-2xl font-bold">👥</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-green-600">+{stats.recentUsers} this week</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <div className="text-green-600 text-2xl font-bold">💎</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Premium Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activePremium}</p>
                <p className="text-xs text-gray-500">{stats.conversionRate}% conversion</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <div className="text-yellow-600 text-2xl font-bold">💰</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-gray-500">From subscriptions</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <div className="text-purple-600 text-2xl font-bold">💑</div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Matrimony Profiles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProfiles}</p>
                <p className="text-xs text-gray-500">{stats.totalInterests} interests sent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Registrations (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.phone && <div className="text-xs text-gray-400">{user.phone}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.age && `${user.age} yrs`}
                          {user.gender && ` • ${user.gender}`}
                          {user.location && ` • ${user.location}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.education && `${user.education}`}
                          {user.occupation && ` • ${user.occupation}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.subscription_status === 'active' ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {user.subscription_plan || 'Premium'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Free
                          </span>
                        )}
                        {user.expires_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            Expires {formatDate(user.expires_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchUsers(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchUsers(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
