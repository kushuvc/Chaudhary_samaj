import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, FileCheck, Filter, HandCoins, Plus, Search, ShieldAlert, ShieldCheck, X, } from 'lucide-react';
import authService from '../services/auth';
import helpCenterService from '../services/helpCenter';
const tabConfig = [
    { id: 'all', label: 'All' },
    { id: 'financial', label: 'Financial' },
    { id: 'medical', label: 'Medical' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'business', label: 'Business' },
    { id: 'general', label: 'General' },
];
const urgencyStyle = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-indigo-100 text-indigo-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
};
const statusStyle = {
    under_review: 'bg-amber-100 text-amber-800',
    open: 'bg-sky-100 text-sky-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-100 text-slate-700',
    rejected: 'bg-rose-100 text-rose-700',
};
const defaultRequestForm = {
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
};
export default function HelpCenter() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [requestForm, setRequestForm] = useState(defaultRequestForm);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [supportAmount, setSupportAmount] = useState('');
    const [supportMessage, setSupportMessage] = useState('');
    const [supportContactMode, setSupportContactMode] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const currentUserId = authService.getCurrentUserId();
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadRequests();
        }, 220);
        return () => window.clearTimeout(timer);
    }, [activeTab, urgencyFilter, statusFilter, searchTerm]);
    const loadRequests = async () => {
        setLoading(true);
        setError('');
        const response = await helpCenterService.getHelpRequests({
            category: activeTab === 'all' ? undefined : activeTab,
            urgency: urgencyFilter === 'all' ? undefined : urgencyFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: searchTerm.trim() || undefined,
        });
        if (!response.success || !response.data) {
            setRequests([]);
            setError(response.error || 'Unable to load Help and Need requests');
            setLoading(false);
            return;
        }
        setRequests(response.data);
        setLoading(false);
    };
    const requestsByTab = useMemo(() => {
        return requests.reduce((acc, request) => {
            acc.all += 1;
            acc[request.category] += 1;
            return acc;
        }, { all: 0, financial: 0, medical: 0, jobs: 0, business: 0, general: 0 });
    }, [requests]);
    const handleCreateRequest = async () => {
        if (!requestForm.title || !requestForm.location || !requestForm.contact || !requestForm.description) {
            window.alert('Title, location, contact and details are required');
            return;
        }
        const needsAmount = requestForm.category === 'financial' || requestForm.category === 'medical';
        if (needsAmount && (!requestForm.amount || Number(requestForm.amount) <= 0)) {
            window.alert('Please enter a valid amount needed');
            return;
        }
        const payload = {
            ...requestForm,
            amount: requestForm.amount ? Number(requestForm.amount) : undefined,
        };
        const response = await helpCenterService.createHelpRequest(payload);
        if (!response.success) {
            window.alert(response.error || 'Unable to create request');
            return;
        }
        setShowCreateModal(false);
        setRequestForm(defaultRequestForm);
        await loadRequests();
    };
    const openSupportModal = (request) => {
        setSelectedRequest(request);
        setSupportAmount('');
        setSupportMessage('');
        setSupportContactMode('');
        setIsAnonymous(false);
        setShowSupportModal(true);
    };
    const handleSupportRequest = async () => {
        if (!selectedRequest)
            return;
        const numericAmount = Number(supportAmount || 0);
        const payload = {
            amount: Number.isFinite(numericAmount) ? numericAmount : 0,
            offerMessage: supportMessage,
            contactMode: supportContactMode,
            isAnonymous,
        };
        const response = await helpCenterService.offerHelp(selectedRequest.id, payload);
        if (!response.success) {
            window.alert(response.error || 'Unable to submit support');
            return;
        }
        setShowSupportModal(false);
        setSelectedRequest(null);
        await loadRequests();
    };
    const formatTimeAgo = (isoDate) => {
        const now = Date.now();
        const posted = new Date(isoDate).getTime();
        const diffMinutes = Math.max(1, Math.floor((now - posted) / 60000));
        if (diffMinutes < 60)
            return `${diffMinutes}m ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24)
            return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-b from-stone-50 via-white to-emerald-50 p-4 md:p-6", children: [_jsxs("div", { className: "mx-auto max-w-7xl", children: [_jsxs("div", { className: "mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight text-slate-900 md:text-4xl", children: "Help and Need" }), _jsx("p", { className: "mt-2 text-slate-600", children: "Community support board with safety-first moderation and fraud-risk screening." })] }), _jsxs("button", { onClick: () => setShowCreateModal(true), className: "inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700", children: [_jsx(Plus, { size: 18 }), " Create Request"] })] }), _jsxs("div", { className: "mb-6 grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-emerald-700", children: [_jsx(ShieldCheck, { size: 18 }), _jsx("p", { className: "font-semibold", children: "Verification Status" })] }), _jsx("p", { className: "text-sm text-slate-600", children: "Requests are marked pending, verified, or rejected after moderation review." })] }), _jsxs("div", { className: "rounded-2xl border border-amber-100 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-amber-700", children: [_jsx(ShieldAlert, { size: 18 }), _jsx("p", { className: "font-semibold", children: "Scam Risk Screening" })] }), _jsx("p", { className: "text-sm text-slate-600", children: "High-risk language and unusual patterns are automatically moved to under review." })] }), _jsxs("div", { className: "rounded-2xl border border-rose-100 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-rose-700", children: [_jsx(AlertTriangle, { size: 18 }), _jsx("p", { className: "font-semibold", children: "Safety Advisory" })] }), _jsx("p", { className: "text-sm text-slate-600", children: "Never share OTPs, card PIN, or bank passwords. Report suspicious requests immediately." })] })] }), _jsx("div", { className: "mb-5 flex flex-wrap gap-2", children: tabConfig.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`, children: [tab.label, " (", requestsByTab[tab.id], ")"] }, tab.id))) }), _jsxs("div", { className: "mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto]", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 18, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), type: "text", placeholder: "Search by title, location or member", className: "w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-emerald-400" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Filter, { size: 16, className: "text-slate-500" }), _jsxs("select", { value: urgencyFilter, onChange: (event) => setUrgencyFilter(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400", children: [_jsx("option", { value: "all", children: "All Urgency" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" }), _jsx("option", { value: "critical", children: "Critical" })] })] }), _jsxs("select", { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "under_review", children: "Under Review" }), _jsx("option", { value: "open", children: "Open" }), _jsx("option", { value: "in_progress", children: "In Progress" }), _jsx("option", { value: "resolved", children: "Resolved" }), _jsx("option", { value: "closed", children: "Closed" }), _jsx("option", { value: "rejected", children: "Rejected" })] })] }), loading ? (_jsx("div", { className: "rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm", children: "Loading Help and Need requests..." })) : error ? (_jsx("div", { className: "rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700", children: error })) : requests.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center", children: [_jsx("p", { className: "text-lg font-semibold text-slate-700", children: "No requests yet" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Create your first request to start community support." })] })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: requests.map((request) => {
                            const amountNeeded = request.amount ?? 0;
                            const amountCollected = request.collected ?? 0;
                            const progress = amountNeeded > 0 ? Math.min(100, Math.round((amountCollected / amountNeeded) * 100)) : 0;
                            const statusText = request.status.replace('_', ' ');
                            const isOwnRequest = currentUserId === request.creatorUserId;
                            const supportDisabled = isOwnRequest || ['under_review', 'closed', 'rejected'].includes(request.status);
                            return (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700", children: request.category }), _jsx("span", { className: `rounded-full px-2.5 py-1 text-xs font-semibold ${urgencyStyle[request.urgency]}`, children: request.urgency }), _jsx("span", { className: `rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[request.status]}`, children: statusText })] }), _jsx("h3", { className: "mb-1 text-lg font-bold text-slate-900", children: request.title }), _jsx("p", { className: "mb-3 line-clamp-3 text-sm text-slate-600", children: request.description }), _jsxs("div", { className: "mb-3 space-y-1 text-sm text-slate-600", children: [_jsxs("p", { children: ["Posted by: ", _jsx("span", { className: "font-semibold text-slate-900", children: request.postedBy })] }), _jsxs("p", { children: ["Location: ", _jsx("span", { className: "font-semibold text-slate-900", children: request.location || 'Not specified' })] }), _jsxs("p", { className: "flex items-center gap-1", children: [_jsx(Clock3, { size: 14 }), " ", formatTimeAgo(request.postedAt)] })] }), amountNeeded > 0 && (_jsxs("div", { className: "mb-4 rounded-xl bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-medium text-slate-700", children: "Progress" }), _jsxs("span", { className: "font-bold text-emerald-700", children: [progress, "%"] })] }), _jsx("div", { className: "mb-2 h-2.5 overflow-hidden rounded-full bg-slate-200", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500", style: { width: `${progress}%` } }) }), _jsxs("p", { className: "text-sm text-slate-600", children: ["\u20B9", amountCollected.toLocaleString('en-IN'), " collected / \u20B9", amountNeeded.toLocaleString('en-IN'), " needed"] })] })), _jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2 text-xs", children: [request.verificationStatus === 'verified' ? (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700", children: [_jsx(ShieldCheck, { size: 12 }), " Verified"] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700", children: [_jsx(ShieldAlert, { size: 12 }), " ", request.verificationStatus || 'pending'] })), _jsxs("span", { className: "rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600", children: [(request.supporterCount || 0).toLocaleString('en-IN'), " supporters"] }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600", children: [_jsx(FileCheck, { size: 12 }), " Risk ", request.riskScore || 0] })] }), _jsxs("button", { disabled: supportDisabled, onClick: () => openSupportModal(request), className: `inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition ${supportDisabled ? 'cursor-not-allowed bg-slate-300' : 'bg-slate-900 hover:bg-slate-800'}`, children: [_jsx(HandCoins, { size: 16 }), isOwnRequest ? 'Your Request' : supportDisabled ? 'Support Unavailable' : 'Support / Offer Help'] })] }, request.id));
                        }) }))] }), showCreateModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: _jsxs("div", { className: "max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl", children: [_jsxs("div", { className: "sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900", children: "Create Help and Need Request" }), _jsx("button", { onClick: () => setShowCreateModal(false), className: "rounded-lg p-2 text-slate-500 transition hover:bg-slate-100", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "grid gap-4 p-5 md:grid-cols-2", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Request Title *" }), _jsx("input", { value: requestForm.title, onChange: (event) => setRequestForm((prev) => ({ ...prev, title: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Category *" }), _jsxs("select", { value: requestForm.category, onChange: (event) => setRequestForm((prev) => ({ ...prev, category: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400", children: [_jsx("option", { value: "financial", children: "Financial" }), _jsx("option", { value: "medical", children: "Medical" }), _jsx("option", { value: "jobs", children: "Jobs" }), _jsx("option", { value: "business", children: "Business" }), _jsx("option", { value: "general", children: "General" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Urgency *" }), _jsxs("select", { value: requestForm.urgency, onChange: (event) => setRequestForm((prev) => ({ ...prev, urgency: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400", children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" }), _jsx("option", { value: "critical", children: "Critical" })] })] }), (requestForm.category === 'financial' || requestForm.category === 'medical') && (_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Amount Needed (\u20B9) *" }), _jsx("input", { type: "number", min: 1, value: requestForm.amount || '', onChange: (event) => setRequestForm((prev) => ({ ...prev, amount: event.target.value ? Number(event.target.value) : undefined })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] })), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Location *" }), _jsx("input", { value: requestForm.location, onChange: (event) => setRequestForm((prev) => ({ ...prev, location: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Contact Preference *" }), _jsx("input", { value: requestForm.contact, onChange: (event) => setRequestForm((prev) => ({ ...prev, contact: event.target.value })), placeholder: "Phone, WhatsApp, Email", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), requestForm.category === 'financial' && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Reason" }), _jsx("input", { value: requestForm.reason || '', onChange: (event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] })), requestForm.category === 'medical' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Medical Category" }), _jsx("input", { value: requestForm.medicalCategory || '', onChange: (event) => setRequestForm((prev) => ({ ...prev, medicalCategory: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Hospital / Expense Type" }), _jsx("input", { value: requestForm.expenseType || '', onChange: (event) => setRequestForm((prev) => ({ ...prev, expenseType: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] })] })), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Request Details *" }), _jsx("textarea", { rows: 4, value: requestForm.description, onChange: (event) => setRequestForm((prev) => ({ ...prev, description: event.target.value })), className: "w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("div", { className: "md:col-span-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-700", children: [_jsx("strong", { children: "Safety Notice:" }), " avoid adding bank PIN/OTP details. Fraud-risk screening may place requests under review."] }), _jsxs("div", { className: "md:col-span-2 flex justify-end gap-3 pt-2", children: [_jsx("button", { onClick: () => setShowCreateModal(false), className: "rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200", children: "Cancel" }), _jsx("button", { onClick: handleCreateRequest, className: "rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700", children: "Submit Request" })] })] })] }) })), showSupportModal && selectedRequest && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-bold text-slate-900", children: "Support Request" }), _jsx("p", { className: "text-sm text-slate-600", children: selectedRequest.title })] }), _jsx("button", { onClick: () => setShowSupportModal(false), className: "rounded-lg p-2 text-slate-500 transition hover:bg-slate-100", children: _jsx(X, { size: 16 }) })] }), (selectedRequest.category === 'financial' || selectedRequest.category === 'medical') && (_jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Contribution Amount (\u20B9)" }), _jsx("input", { type: "number", min: 0, value: supportAmount, onChange: (event) => setSupportAmount(event.target.value), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] })), _jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Support Message" }), _jsx("textarea", { rows: 3, value: supportMessage, onChange: (event) => setSupportMessage(event.target.value), className: "w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Preferred Contact Mode" }), _jsx("input", { value: supportContactMode, onChange: (event) => setSupportContactMode(event.target.value), placeholder: "Phone, WhatsApp, Email", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-400" })] }), _jsxs("label", { className: "mb-4 flex items-center gap-2 text-sm text-slate-700", children: [_jsx("input", { type: "checkbox", checked: isAnonymous, onChange: (event) => setIsAnonymous(event.target.checked) }), "Post support anonymously"] }), _jsx("div", { className: "mb-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600", children: "Support entries are recorded for moderation. Avoid sharing account PIN, OTP, or sensitive banking credentials." }), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx("button", { onClick: () => setShowSupportModal(false), className: "rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200", children: "Cancel" }), _jsx("button", { onClick: handleSupportRequest, className: "rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800", children: "Confirm Support" })] })] }) }))] }));
}
