import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpRight,
  BadgeIndianRupee,
  Building2,
  CalendarDays,
  Grid2X2,
  HandHeart,
  LayoutDashboard,
  Medal,
  Settings,
  UserCircle2,
  Users,
} from 'lucide-react'
import BrandArtwork from './BrandArtwork'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  description: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, description: 'Home base and featured lanes' },
  { label: 'Community', path: '/community', icon: Users, description: 'Conversations, updates, and posts' },
  { label: 'Events', path: '/events', icon: CalendarDays, description: 'Meetups, ceremonies, and planning' },
  { label: 'Business', path: '/business', icon: Building2, description: 'Local services and vendors' },
  { label: 'Matrimony', path: '/matrimony', icon: Medal, description: 'Matching and discovery' },
  { label: 'Help Center', path: '/help-and-need', icon: HandHeart, description: 'Requests, help, and support' },
  { label: 'Profile', path: '/profile', icon: UserCircle2, description: 'Your public identity and details' },
  { label: 'Settings', path: '/settings', icon: Settings, description: 'Preferences and account control' },
  { label: 'Admin', path: '/admin', icon: BadgeIndianRupee, description: 'Operational tools and oversight' },
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm md:hidden" onClick={onToggle} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[19rem] flex-col border-r border-white/10 bg-[#07111c] text-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-start gap-4 border-b border-white/10 p-6">
          <div className="h-16 w-16 rounded-3xl bg-white/5 p-2 ring-1 ring-white/10">
            <BrandArtwork className="h-full w-full" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.35em] text-orange-200/80">Chaudhary Samaj</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Curated lanes</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              A premium discovery shell with fast section switching and zero clutter.
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-4 flex items-center justify-between px-2 text-xs uppercase tracking-[0.28em] text-slate-400">
            <span>Sections</span>
            <Grid2X2 size={14} />
          </div>

          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        onToggle()
                      }
                    }}
                    className={({ isActive }) =>
                      [
                        'group flex items-start gap-3 rounded-3xl border px-4 py-3 text-left transition-all duration-200',
                        isActive
                          ? 'border-orange-400/40 bg-white/10 shadow-[0_18px_40px_rgba(249,115,22,0.15)]'
                          : 'border-transparent bg-white/0 hover:border-white/10 hover:bg-white/5',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                            isActive ? 'bg-orange-500 text-white' : 'bg-white/10 text-orange-200'
                          }`}
                        >
                          <Icon size={18} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                            <span>{item.label}</span>
                            <ArrowUpRight
                              size={14}
                              className={`transition-transform duration-200 ${
                                isActive ? 'translate-x-0 opacity-100' : 'opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                              }`}
                            />
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-slate-950 shadow-[0_18px_40px_rgba(249,115,22,0.22)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-900/70">Live now</p>
            <p className="mt-2 text-sm font-semibold">Fresh sections, premium flow, no alert clutter.</p>
            <p className="mt-2 text-xs leading-5 text-slate-900/70">
              Designed for quick taps, swipes, and smooth discovery on web and mobile.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
