import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  ChevronRight,
  Clock3,
  HeartHandshake,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import BrandArtwork from '../components/BrandArtwork'

const sectionCards = [
  {
    title: 'Community Feed',
    description: 'Fresh conversations, announcements, and local updates in a premium card stack.',
    to: '/community',
    icon: Users,
    accent: 'from-orange-500 to-amber-400',
    meta: 'Best for daily discovery',
  },
  {
    title: 'Events',
    description: 'Browse ceremonies, planning, and contribution tracking in one place.',
    to: '/events',
    icon: CalendarDays,
    accent: 'from-slate-900 to-slate-700',
    meta: 'Runs like a premium booking lane',
  },
  {
    title: 'Business',
    description: 'Explore verified services, vendors, and local partners with a swipe-friendly layout.',
    to: '/business',
    icon: Store,
    accent: 'from-indigo-600 to-violet-500',
    meta: 'Local commerce spotlight',
  },
  {
    title: 'Matrimony',
    description: 'A polished matching lane with focused profiles and quick shortlists.',
    to: '/matrimony',
    icon: HeartHandshake,
    accent: 'from-rose-500 to-fuchsia-500',
    meta: 'High-intent discovery',
  },
  {
    title: 'Help Center',
    description: 'Support requests and community help, presented with a calm, clean flow.',
    to: '/help-and-need',
    icon: Megaphone,
    accent: 'from-emerald-500 to-teal-500',
    meta: 'Assistance without friction',
  },
  {
    title: 'Settings',
    description: 'Account controls and preferences, tucked away in a focused utility lane.',
    to: '/settings',
    icon: LayoutDashboard,
    accent: 'from-slate-500 to-slate-700',
    meta: 'Keep the system tuned',
  },
]

const metrics = [
  { label: 'Live lanes', value: '06', icon: Sparkles, tone: 'text-orange-600' },
  { label: 'Active members', value: '1.2k', icon: Users, tone: 'text-slate-900' },
  { label: 'Upcoming events', value: '24', icon: CalendarDays, tone: 'text-indigo-600' },
  { label: 'Community support', value: '98%', icon: HeartHandshake, tone: 'text-emerald-600' },
]

const highlights = [
  {
    title: 'Featured route',
    description: 'Choose a section from the left drawer and move through the app without losing context.',
    icon: ChevronRight,
  },
  {
    title: 'Premium motion',
    description: 'Cards lift and slide on hover so the whole surface feels alive, not static.',
    icon: Clock3,
  },
  {
    title: 'No alerts for now',
    description: 'The notifications lane is hidden to keep the UI focused on discovery.',
    icon: BadgeIndianRupee,
  },
]

export default function Dashboard() {
  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[#08101a] p-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] md:p-8">
        <div className="absolute -right-24 -top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-200/90 backdrop-blur">
              <Sparkles size={15} />
              Swiggy-style discovery. CRED-like polish.
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl">
              One premium home for community, events, business, and matches.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              This reconstruction turns the app into a clean discovery experience with a left-sliding section rail, rich cards,
              and a strong visual hierarchy. Alerts are hidden for now so the interface stays focused.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/community"
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:-translate-y-0.5"
              >
                Explore community <ArrowRight size={16} />
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Browse events <ChevronRight size={16} />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Style</p>
                <p className="mt-2 text-sm font-semibold text-white">Bold, premium, and fast</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Motion</p>
                <p className="mt-2 text-sm font-semibold text-white">Sliding section rails</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Alerts</p>
                <p className="mt-2 text-sm font-semibold text-white">Hidden for now</p>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_25px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl">
              <BrandArtwork className="mx-auto h-[18rem] w-full max-w-[20rem] drop-shadow-[0_24px_50px_rgba(0,0,0,0.45)]" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Quick note</p>
                <p className="mt-2 text-sm font-semibold text-white">The left drawer now owns all sections.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Visual system</p>
                <p className="mt-2 text-sm font-semibold text-white">Orange, slate, cream, and glass.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <article key={metric.label} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className={`mt-2 text-3xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                  <Icon size={20} />
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Choose a section</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Each lane slides in from the left.</h2>
            </div>
            <div className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:inline-flex">
              <LayoutDashboard size={15} className="mr-2" />
              Interactive shell
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sectionCards.map((card, index) => {
              const Icon = card.icon

              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(15,23,42,0.12)]"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg shadow-black/10`}>
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-950">{card.title}</h3>
                    </div>
                    <ChevronRight size={18} className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{card.meta}</p>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Visual notes</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Why this feels more like Swiggy or CRED</h2>
          </div>

          <div className="space-y-3">
            {highlights.map((highlight) => {
              const Icon = highlight.icon

              return (
                <article key={highlight.title} className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50 p-4 transition hover:bg-white">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{highlight.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{highlight.description}</p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="rounded-[1.5rem] bg-gradient-to-br from-orange-500 to-amber-400 p-5 text-slate-950 shadow-[0_20px_50px_rgba(249,115,22,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-900/70">Fast access</p>
            <p className="mt-2 text-lg font-semibold">The left drawer owns navigation, the cards own discovery.</p>
            <p className="mt-2 text-sm leading-6 text-slate-900/75">
              Use this as the new foundation, then we can tune each section one by one to match the same visual language.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-white/70 bg-[#111827] p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.15)] lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Highlighted lane</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Curated cards with room to breathe</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-orange-200">
              Alerts hidden by design
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-sm font-semibold text-white">Primary action</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Every section card now behaves like a lane you can jump into quickly.</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                Open section <ArrowRight size={15} />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-sm font-semibold text-white">Secondary action</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">The UI keeps your eye on the content instead of on notification chrome.</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white">
                <MapPin size={15} />
                Stay focused
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Next step</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">If you want, I can now restyle every page to match this shell.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Community, business, events, help, matrimony, profile, and settings can all share the same premium card language.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              to="/community"
              className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open community <ArrowRight size={15} />
            </Link>
            <Link
              to="/business"
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open business <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
