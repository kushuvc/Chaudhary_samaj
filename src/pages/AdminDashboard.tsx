import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface AdminStats {
  totalUsers: number;
  recentUsers: number;
  activePremium: number;
  totalRevenue: number;
  totalProfiles: number;
  totalInterests: number;
  conversionRate: string;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  age: number;
  gender: string;
  location: string;
  education: string;
  occupation: string;
  subscription_plan: string;
  subscription_status: string;
  expires_at: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

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
      } else {
        setError('Failed to fetch stats');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page: number) => {
    setUsersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/users?page=${page}&limit=20`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.pages);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
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
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Refresh
            </button>
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
                <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-green-600">+{stats?.recentUsers || 0} this week</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats?.activePremium || 0}</p>
                <p className="text-xs text-gray-500">{stats?.conversionRate || 0}% conversion</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue || 0)}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats?.totalProfiles || 0}</p>
                <p className="text-xs text-gray-500">{stats?.totalInterests || 0} interests sent</p>
              </div>
            </div>
          </div>
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
                {usersLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
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
