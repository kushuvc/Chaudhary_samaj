import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutGrid, Menu, Search, Sparkles, UserCircle2 } from 'lucide-react'
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
    <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 backdrop-blur-xl">
      <div className="flex h-[4.5rem] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 md:inline-flex">
            <Sparkles size={14} />
            Curated discovery
          </div>

          <div className="relative hidden min-w-0 flex-1 max-w-2xl md:block">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search members, listings, events, and posts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm lg:inline-flex"
          >
            <LayoutGrid size={15} />
            Explore lanes
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-400 text-sm font-bold text-slate-950">
                {initials}
              </div>
              <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-slate-800 sm:inline">
                {currentUser?.fullName || 'User'}
              </span>
              <ChevronDown size={15} className="hidden text-slate-400 sm:inline" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Signed in as</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{currentUser?.fullName || 'User'}</p>
                </div>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <UserCircle2 size={16} />
                  My Profile
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <LayoutGrid size={16} />
                  Settings
                </Link>
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setShowUserMenu(false)
                    authService.logout()
                    navigate('/login', { replace: true })
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
