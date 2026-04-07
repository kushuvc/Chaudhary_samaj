import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  FileCheck,
  Filter,
  HandCoins,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import authService from '../services/auth'
import helpCenterService, {
  CreateHelpRequestPayload,
  HelpCategory,
  HelpRequest,
  HelpStatus,
  UrgencyLevel,
} from '../services/helpCenter'

type HelpTab = 'all' | HelpCategory

const tabConfig: Array<{ id: HelpTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'financial', label: 'Financial' },
  { id: 'medical', label: 'Medical' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'business', label: 'Business' },
  { id: 'general', label: 'General' },
]

const urgencyStyle: Record<UrgencyLevel, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-indigo-100 text-indigo-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const statusStyle: Record<HelpStatus, string> = {
  under_review: 'bg-amber-100 text-amber-800',
  open: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-700',
  rejected: 'bg-rose-100 text-rose-700',
}

const defaultRequestForm: CreateHelpRequestPayload = {
  title: '',
  category: 'financial',
  amount: undefined,
  urgency: 'medium',
  location: '',
  contact: '',
  description: '',
  reason: '',
  medicalCategory: '',
  expenseType: '',
  subType: '',
}

export default function HelpCenter() {
  const [requests, setRequests] = useState<HelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeTab, setActiveTab] = useState<HelpTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | UrgencyLevel>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | HelpStatus>('all')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [requestForm, setRequestForm] = useState<CreateHelpRequestPayload>(defaultRequestForm)
  const [selectedRequest, setSelectedRequest] = useState<HelpRequest | null>(null)
  const [supportAmount, setSupportAmount] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportContactMode, setSupportContactMode] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  const currentUserId = authService.getCurrentUserId()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests()
    }, 220)

    return () => window.clearTimeout(timer)
  }, [activeTab, urgencyFilter, statusFilter, searchTerm])

  const loadRequests = async () => {
    setLoading(true)
    setError('')

    const response = await helpCenterService.getHelpRequests({
      category: activeTab === 'all' ? undefined : activeTab,
      urgency: urgencyFilter === 'all' ? undefined : urgencyFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchTerm.trim() || undefined,
    })

    if (!response.success || !response.data) {
      setRequests([])
      setError(response.error || 'Unable to load Help and Need requests')
      setLoading(false)
      return
    }

    setRequests(response.data)
    setLoading(false)
  }

  const requestsByTab = useMemo(() => {
    return requests.reduce<Record<HelpTab, number>>(
      (acc, request) => {
        acc.all += 1
        acc[request.category] += 1
        return acc
      },
      { all: 0, financial: 0, medical: 0, jobs: 0, business: 0, general: 0 }
    )
  }, [requests])

  const handleCreateRequest = async () => {
    if (!requestForm.title || !requestForm.location || !requestForm.contact || !requestForm.description) {
      window.alert('Title, location, contact and details are required')
      return
    }

    const needsAmount = requestForm.category === 'financial' || requestForm.category === 'medical'
    if (needsAmount && (!requestForm.amount || Number(requestForm.amount) <= 0)) {
      window.alert('Please enter a valid amount needed')
      return
    }

    const payload: CreateHelpRequestPayload = {
      ...requestForm,
      amount: requestForm.amount ? Number(requestForm.amount) : undefined,
    }

    const response = await helpCenterService.createHelpRequest(payload)
    if (!response.success) {
      window.alert(response.error || 'Unable to create request')
      return
    }

    setShowCreateModal(false)
    setRequestForm(defaultRequestForm)
    await loadRequests()
  }

  const openSupportModal = (request: HelpRequest) => {
    setSelectedRequest(request)
    setSupportAmount('')
    setSupportMessage('')
    setSupportContactMode('')
    setIsAnonymous(false)
    setShowSupportModal(true)
  }

  const handleSupportRequest = async () => {
    if (!selectedRequest) return

    const numericAmount = Number(supportAmount || 0)
    const payload = {
      amount: Number.isFinite(numericAmount) ? numericAmount : 0,
      offerMessage: supportMessage,
      contactMode: supportContactMode,
      isAnonymous,
    }

    const response = await helpCenterService.offerHelp(selectedRequest.id, payload)
    if (!response.success) {
      window.alert(response.error || 'Unable to submit support')
      return
    }

    setShowSupportModal(false)
    setSelectedRequest(null)
    await loadRequests()
  }

  const formatTimeAgo = (isoDate: string) => {
    const now = Date.now()
    const posted = new Date(isoDate).getTime()
    const diffMinutes = Math.max(1, Math.floor((now - posted) / 60000))

    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Help and Need</h1>
            <p className="mt-2 text-slate-600">Community support board with safety-first moderation and fraud-risk screening.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            <Plus size={18} /> Create Request
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <ShieldCheck size={18} />
              <p className="font-semibold">Verification Status</p>
            </div>
            <p className="text-sm text-slate-600">Requests are marked pending, verified, or rejected after moderation review.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-amber-700">
              <ShieldAlert size={18} />
              <p className="font-semibold">Scam Risk Screening</p>
            </div>
            <p className="text-sm text-slate-600">High-risk language and unusual patterns are automatically moved to under review.</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-rose-700">
              <AlertTriangle size={18} />
              <p className="font-semibold">Safety Advisory</p>
            </div>
            <p className="text-sm text-slate-600">Never share OTPs, card PIN, or bank passwords. Report suspicious requests immediately.</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({requestsByTab[tab.id]})
            </button>
          ))}
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Search by title, location or member"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              value={urgencyFilter}
              onChange={(event) => setUrgencyFilter(event.target.value as 'all' | UrgencyLevel)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
            >
              <option value="all">All Urgency</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | HelpStatus)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          >
            <option value="all">All Status</option>
            <option value="under_review">Under Review</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading Help and Need requests...</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700">{error}</div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-700">No requests yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first request to start community support.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((request) => {
              const amountNeeded = request.amount ?? 0
              const amountCollected = request.collected ?? 0
              const progress = amountNeeded > 0 ? Math.min(100, Math.round((amountCollected / amountNeeded) * 100)) : 0
              const statusText = request.status.replace('_', ' ')
              const isOwnRequest = currentUserId === request.creatorUserId
              const supportDisabled = isOwnRequest || ['under_review', 'closed', 'rejected'].includes(request.status)

              return (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{request.category}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyStyle[request.urgency]}`}>
                      {request.urgency}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[request.status]}`}>
                      {statusText}
                    </span>
                  </div>

                  <h3 className="mb-1 text-lg font-bold text-slate-900">{request.title}</h3>
                  <p className="mb-3 line-clamp-3 text-sm text-slate-600">{request.description}</p>

                  <div className="mb-3 space-y-1 text-sm text-slate-600">
                    <p>
                      Posted by: <span className="font-semibold text-slate-900">{request.postedBy}</span>
                    </p>
                    <p>
                      Location: <span className="font-semibold text-slate-900">{request.location || 'Not specified'}</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <Clock3 size={14} /> {formatTimeAgo(request.postedAt)}
                    </p>
                  </div>

                  {amountNeeded > 0 && (
                    <div className="mb-4 rounded-xl bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Progress</span>
                        <span className="font-bold text-emerald-700">{progress}%</span>
                      </div>
                      <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-sm text-slate-600">
                        ₹{amountCollected.toLocaleString('en-IN')} collected / ₹{amountNeeded.toLocaleString('en-IN')} needed
                      </p>
                    </div>
                  )}

                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                    {request.verificationStatus === 'verified' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                        <ShieldCheck size={12} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                        <ShieldAlert size={12} /> {request.verificationStatus || 'pending'}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                      {(request.supporterCount || 0).toLocaleString('en-IN')} supporters
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                      <FileCheck size={12} /> Risk {request.riskScore || 0}
                    </span>
                  </div>

                  <button
                    disabled={supportDisabled}
                    onClick={() => openSupportModal(request)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition ${
                      supportDisabled ? 'cursor-not-allowed bg-slate-300' : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    <HandCoins size={16} />
                    {isOwnRequest ? 'Your Request' : supportDisabled ? 'Support Unavailable' : 'Support / Offer Help'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold text-slate-900">Create Help and Need Request</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Request Title *</label>
                <input
                  value={requestForm.title}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Category *</label>
                <select
                  value={requestForm.category}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, category: event.target.value as HelpCategory }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                >
                  <option value="financial">Financial</option>
                  <option value="medical">Medical</option>
                  <option value="jobs">Jobs</option>
                  <option value="business">Business</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Urgency *</label>
                <select
                  value={requestForm.urgency}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, urgency: event.target.value as UrgencyLevel }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {(requestForm.category === 'financial' || requestForm.category === 'medical') && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Amount Needed (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    value={requestForm.amount || ''}
                    onChange={(event) =>
                      setRequestForm((prev) => ({ ...prev, amount: event.target.value ? Number(event.target.value) : undefined }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Location *</label>
                <input
                  value={requestForm.location}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Contact Preference *</label>
                <input
                  value={requestForm.contact}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, contact: event.target.value }))}
                  placeholder="Phone, WhatsApp, Email"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </div>

              {requestForm.category === 'financial' && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Reason</label>
                  <input
                    value={requestForm.reason || ''}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {requestForm.category === 'medical' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Medical Category</label>
                    <input
                      value={requestForm.medicalCategory || ''}
                      onChange={(event) => setRequestForm((prev) => ({ ...prev, medicalCategory: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Hospital / Expense Type</label>
                    <input
                      value={requestForm.expenseType || ''}
                      onChange={(event) => setRequestForm((prev) => ({ ...prev, expenseType: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Request Details *</label>
                <textarea
                  rows={4}
                  value={requestForm.description}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </div>

              <div className="md:col-span-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                <strong>Safety Notice:</strong> avoid adding bank PIN/OTP details. Fraud-risk screening may place requests under review.
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRequest}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSupportModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Support Request</h3>
                <p className="text-sm text-slate-600">{selectedRequest.title}</p>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            {(selectedRequest.category === 'financial' || selectedRequest.category === 'medical') && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-semibold text-slate-700">Contribution Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={supportAmount}
                  onChange={(event) => setSupportAmount(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Support Message</label>
              <textarea
                rows={3}
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Preferred Contact Mode</label>
              <input
                value={supportContactMode}
                onChange={(event) => setSupportContactMode(event.target.value)}
                placeholder="Phone, WhatsApp, Email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400"
              />
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
              Post support anonymously
            </label>

            <div className="mb-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Support entries are recorded for moderation. Avoid sharing account PIN, OTP, or sensitive banking credentials.
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSupportModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSupportRequest}
                className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800"
              >
                Confirm Support
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
