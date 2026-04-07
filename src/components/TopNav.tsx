import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import authService from '../services/auth'

interface TopNavProps {
  onMenuClick: () => void
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const currentUser = authService.getCurrentUser()
  const initials = (currentUser?.fullName || 'User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
        {/* Left Section - Menu & Search */}
        <div className="flex items-center gap-4 flex-1">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
        </div>

        {/* Right Section - Notifications & User Menu */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <Link
            to="/notifications"
            className="p-2 hover:bg-gray-100 rounded-lg relative"
            aria-label="Notifications"
          >
            <span className="text-xl">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
            >
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">
                {initials}
              </div>
              <span className="hidden sm:inline text-sm font-medium">{currentUser?.fullName || 'User'}</span>
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  👤 My Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  ⚙️ Settings
                </Link>
                <hr className="my-2" />
                <button
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => {
                    setShowUserMenu(false)
                    authService.logout()
                    navigate('/login', { replace: true })
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
