import { Link, useLocation } from 'react-router-dom'

interface NavItem {
  label: string
  path: string
  icon: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Matrimony', path: '/matrimony', icon: '💍' },
  { label: 'Events', path: '/events', icon: '🎉' },
  { label: 'Help and Need', path: '/help-and-need', icon: '🤝' },
  { label: 'Business', path: '/business', icon: '💼' },
  { label: 'Community', path: '/community', icon: '👥' },
  { label: 'Notifications', path: '/notifications', icon: '🔔' },
  { label: 'Profile', path: '/profile', icon: '👤' },
  { label: 'Settings', path: '/settings', icon: '⚙️' },
  { label: 'Admin', path: '/admin', icon: '🔐' },
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 block md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static w-64 h-screen bg-white border-r border-gray-200 transform transition-transform duration-200 z-40 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-primary-700">Chaudhary</h1>
          <p className="text-sm text-gray-500 mt-1">Community Platform</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => {
                      // Close sidebar on mobile after navigation
                      if (window.innerWidth < 768) {
                        onToggle()
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500">© 2026 Chaudhary Samaj</p>
        </div>
      </aside>
    </>
  )
}
