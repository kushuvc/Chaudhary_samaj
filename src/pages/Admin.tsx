import { useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, Shield, UserCheck, Users, XCircle } from 'lucide-react'

interface ModerationItem {
  id: string
  module: 'help-and-need' | 'community' | 'business'
  title: string
  reportedBy: string
  status: 'pending' | 'approved' | 'rejected'
}

const initialQueue: ModerationItem[] = [
  {
    id: 'mod-1',
    module: 'community',
    title: 'Post flagged for misinformation',
    reportedBy: 'Nitin Chaudhary',
    status: 'pending'
  },
  {
    id: 'mod-2',
    module: 'help-and-need',
    title: 'Financial request awaiting verification',
    reportedBy: 'Pooja Sharma',
    status: 'pending'
  },
  {
    id: 'mod-3',
    module: 'business',
    title: 'Business listing duplicate complaint',
    reportedBy: 'Rajat Verma',
    status: 'pending'
  }
]

const statusStyle: Record<ModerationItem['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700'
}

export default function Admin() {
  const [queue, setQueue] = useState<ModerationItem[]>(initialQueue)

  const updateStatus = (id: string, status: ModerationItem['status']) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  const pendingCount = queue.filter((item) => item.status === 'pending').length
  const approvedCount = queue.filter((item) => item.status === 'approved').length
  const rejectedCount = queue.filter((item) => item.status === 'rejected').length

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-red-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Placeholder</h1>
              <p className="mt-1 text-sm text-slate-600">Moderation, verification, and analytics controls ready for backend integration.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              <Shield size={16} /> Role: Super Admin
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Members</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-slate-900"><Users size={20} /> 2,486</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending Reviews</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-amber-700"><Clock3 size={20} /> {pendingCount}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Verified Accounts</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-emerald-700"><UserCheck size={20} /> 1,124</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Reports This Week</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-rose-700"><AlertTriangle size={20} /> 17</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Moderation Queue</h2>

            <div className="space-y-3">
              {queue.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {item.module}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[item.status]}`}>
                      {item.status}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">Reported by: {item.reportedBy}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => updateStatus(item.id, 'approved')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'rejected')}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, 'pending')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Move to Pending
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
                <BarChart3 size={18} /> Analytics Placeholder
              </h2>
              <p className="text-sm text-slate-600">Engagement, retention, and payment analytics widgets will be connected to admin APIs later.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Queue Summary</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  Pending <span className="font-bold text-amber-700">{pendingCount}</span>
                </p>
                <p className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  Approved <span className="font-bold text-emerald-700">{approvedCount}</span>
                </p>
                <p className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  Rejected <span className="font-bold text-rose-700">{rejectedCount}</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
