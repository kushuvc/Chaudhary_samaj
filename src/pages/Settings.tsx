import { useState } from 'react'
import { Bell, Globe2, LockKeyhole, MoonStar, Save, ShieldCheck, Sun, UserCog } from 'lucide-react'

type ThemeMode = 'light' | 'dark' | 'system'

export default function Settings() {
  const [account, setAccount] = useState({
    language: 'en-IN',
    timezone: 'Asia/Kolkata',
    publicProfile: true,
  })

  const [notifications, setNotifications] = useState({
    communityAnnouncements: true,
    matrimonyMatches: true,
    eventReminders: true,
    securityAlerts: true,
    marketingUpdates: false,
  })

  const [privacy, setPrivacy] = useState({
    showPhoneToConnections: false,
    showLocationPublicly: true,
    profileSearchable: true,
    twoFactorEnabled: false,
  })

  const [theme, setTheme] = useState<ThemeMode>('light')

  const saveSettings = () => {
    window.alert('Settings saved locally (frontend placeholder).')
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Control lane</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Settings</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">Control account preferences, privacy rules, and notifications.</p>
          </div>
          <button
            onClick={saveSettings}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCog size={18} /> Account Preferences
          </h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Globe2 size={14} /> Language</span>
              <select
                value={account.language}
                onChange={(event) => setAccount((prev) => ({ ...prev, language: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="pa-IN">Punjabi</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Timezone</span>
              <select
                value={account.timezone}
                onChange={(event) => setAccount((prev) => ({ ...prev, timezone: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={account.publicProfile}
                onChange={(event) => setAccount((prev) => ({ ...prev, publicProfile: event.target.checked }))}
              />
              Public profile visibility
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <Bell size={18} /> Notification Preferences
          </h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Community announcements
              <input
                type="checkbox"
                checked={notifications.communityAnnouncements}
                onChange={(event) => setNotifications((prev) => ({ ...prev, communityAnnouncements: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Matrimony match alerts
              <input
                type="checkbox"
                checked={notifications.matrimonyMatches}
                onChange={(event) => setNotifications((prev) => ({ ...prev, matrimonyMatches: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Event reminders
              <input
                type="checkbox"
                checked={notifications.eventReminders}
                onChange={(event) => setNotifications((prev) => ({ ...prev, eventReminders: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Security alerts
              <input
                type="checkbox"
                checked={notifications.securityAlerts}
                onChange={(event) => setNotifications((prev) => ({ ...prev, securityAlerts: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Marketing updates
              <input
                type="checkbox"
                checked={notifications.marketingUpdates}
                onChange={(event) => setNotifications((prev) => ({ ...prev, marketingUpdates: event.target.checked }))}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldCheck size={18} /> Privacy & Security
          </h2>
          <div className="space-y-3 text-sm">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Show phone to accepted connections
              <input
                type="checkbox"
                checked={privacy.showPhoneToConnections}
                onChange={(event) => setPrivacy((prev) => ({ ...prev, showPhoneToConnections: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Show location publicly
              <input
                type="checkbox"
                checked={privacy.showLocationPublicly}
                onChange={(event) => setPrivacy((prev) => ({ ...prev, showLocationPublicly: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Allow profile in search results
              <input
                type="checkbox"
                checked={privacy.profileSearchable}
                onChange={(event) => setPrivacy((prev) => ({ ...prev, profileSearchable: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              Enable 2FA (placeholder)
              <input
                type="checkbox"
                checked={privacy.twoFactorEnabled}
                onChange={(event) => setPrivacy((prev) => ({ ...prev, twoFactorEnabled: event.target.checked }))}
              />
            </label>
          </div>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <LockKeyhole size={15} /> Change Password
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Appearance</h2>
          <div className="space-y-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                theme === 'light' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="inline-flex items-center gap-2"><Sun size={15} /> Light</span>
              {theme === 'light' && 'Active'}
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                theme === 'dark' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="inline-flex items-center gap-2"><MoonStar size={15} /> Dark</span>
              {theme === 'dark' && 'Active'}
            </button>

            <button
              onClick={() => setTheme('system')}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                theme === 'system' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="inline-flex items-center gap-2"><Globe2 size={15} /> System</span>
              {theme === 'system' && 'Active'}
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">Theme persistence and server sync will be connected when backend preferences API is added.</p>
        </section>
      </div>
    </div>
  )
}
