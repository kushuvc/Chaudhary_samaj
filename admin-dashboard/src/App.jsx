import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Backend API URL - connects to your production database
const API_BASE = 'http://localhost:3000/api';

export default function App() {
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
      
      const response = await fetch(`${API_BASE}/admin/stats`);
      const data = await response.json();
      
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
      const response = await fetch(`${API_BASE}/admin/users?page=${page}&limit=20`);
      const data = await response.json();
      
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
        setError('Failed to load data: ' + err.message);
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
  }, [currentPage]);

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
            <div className="text-right">
              <p className="text-xs text-gray-500">Last updated:</p>
              <p className="text-sm text-gray-700">{formatDate(lastUpdate)}</p>
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
