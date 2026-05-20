import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle, Globe2, LockKeyhole, MoonStar, Save, ShieldCheck, Sun, Trash2, UserCog, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import authService from '../services/auth'

type ThemeMode = 'light' | 'dark' | 'system'

export default function Settings() {
  const navigate = useNavigate()
  const [account, setAccount] = useState({
    language: 'en-IN',
    timezone: 'Asia/Kolkata',
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
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    apiService.get<any>('/settings').then((res) => {
      if (res.success && res.data) {
        const d = res.data
        setAccount({
          language: d.language ?? 'en-IN',
          timezone: d.timezone ?? 'Asia/Kolkata',
        })
        if (d.notifications) setNotifications((prev) => ({ ...prev, ...d.notifications }))
        if (d.privacy) setPrivacy((prev) => ({ ...prev, ...d.privacy }))
      }
    }).catch(() => {})
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setSaveStatus('idle')
    setSaveError('')
    try {
      const res = await apiService.put<any>('/settings', {
        language: account.language,
        timezone: account.timezone,
        notifications: {
          communityAnnouncements: notifications.communityAnnouncements,
          matrimonyMatches: notifications.matrimonyMatches,
          eventReminders: notifications.eventReminders,
          securityAlerts: notifications.securityAlerts,
          marketingUpdates: notifications.marketingUpdates,
        },
        privacy: {
          showPhoneToConnections: privacy.showPhoneToConnections,
          showLocationPublicly: privacy.showLocationPublicly,
          profileSearchable: privacy.profileSearchable,
        },
      })
      if (res.success) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
        setSaveError(res.error ?? 'Failed to save settings')
      }
    } catch (err) {
      setSaveStatus('error')
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await apiService.delete<any>('/auth/account')
      if (res.success) {
        authService.logout()
        navigate('/login')
      } else {
        setDeleteError(res.error ?? 'Failed to delete account')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeleting(false)
    }
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
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saveStatus === 'success' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle size={15} /> Settings saved successfully
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500">
                <XCircle size={15} /> {saveError}
              </span>
            )}
          </div>
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

      {/* Danger Zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm">
        <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-bold text-red-700">
          <Trash2 size={18} /> Danger Zone
        </h2>
        <p className="mb-4 text-sm text-red-600">Permanently delete your account and all associated data. This cannot be undone.</p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError('') }}
          className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          <Trash2 size={15} /> Delete My Account
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Account</h3>
            </div>
            <p className="mb-2 text-sm text-slate-600">This will permanently delete your account, profile, matches, and all data. <strong>This action cannot be reversed.</strong></p>
            <p className="mb-3 text-sm font-medium text-slate-700">Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
            {deleteError && (
              <p className="mb-3 flex items-center gap-1.5 text-sm text-red-500"><XCircle size={14} /> {deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
