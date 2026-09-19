import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Globe2, LockKeyhole, MoonStar, Save, ShieldCheck, Sun, Trash2, UserCog, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import authService from '../services/auth';
export default function Settings() {
    const navigate = useNavigate();
    const [account, setAccount] = useState({
        language: 'en-IN',
        timezone: 'Asia/Kolkata',
    });
    const [notifications, setNotifications] = useState({
        communityAnnouncements: true,
        matrimonyMatches: true,
        eventReminders: true,
        securityAlerts: true,
        marketingUpdates: false,
    });
    const [privacy, setPrivacy] = useState({
        showPhoneToConnections: false,
        showLocationPublicly: true,
        profileSearchable: true,
        twoFactorEnabled: false,
    });
    const [theme, setTheme] = useState('light');
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    const [saveError, setSaveError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    useEffect(() => {
        apiService.get('/settings').then((res) => {
            if (res.success && res.data) {
                const d = res.data;
                setAccount({
                    language: d.language ?? 'en-IN',
                    timezone: d.timezone ?? 'Asia/Kolkata',
                });
                if (d.notifications)
                    setNotifications((prev) => ({ ...prev, ...d.notifications }));
                if (d.privacy)
                    setPrivacy((prev) => ({ ...prev, ...d.privacy }));
            }
        }).catch(() => { });
    }, []);
    const saveSettings = async () => {
        setSaving(true);
        setSaveStatus('idle');
        setSaveError('');
        try {
            const res = await apiService.put('/settings', {
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
            });
            if (res.success) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
            else {
                setSaveStatus('error');
                setSaveError(res.error ?? 'Failed to save settings');
            }
        }
        catch (err) {
            setSaveStatus('error');
            setSaveError('Network error. Please try again.');
        }
        finally {
            setSaving(false);
        }
    };
    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE')
            return;
        setDeleting(true);
        setDeleteError('');
        try {
            const res = await apiService.delete('/auth/account');
            if (res.success) {
                authService.logout();
                navigate('/login');
            }
            else {
                setDeleteError(res.error ?? 'Failed to delete account');
            }
        }
        catch {
            setDeleteError('Network error. Please try again.');
        }
        finally {
            setDeleting(false);
        }
    };
    return (_jsxs("div", { className: "space-y-6 pb-8", children: [_jsx("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Control lane" }), _jsx("h1", { className: "mt-2 text-4xl font-semibold tracking-tight text-slate-950", children: "Settings" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm text-slate-600", children: "Control account preferences, privacy rules, and notifications." })] }), _jsxs("div", { className: "flex flex-col items-end gap-2", children: [_jsxs("button", { onClick: saveSettings, disabled: saving, className: "inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed", children: [_jsx(Save, { size: 16 }), " ", saving ? 'Saving...' : 'Save Changes'] }), saveStatus === 'success' && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600", children: [_jsx(CheckCircle, { size: 15 }), " Settings saved successfully"] })), saveStatus === 'error' && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm font-medium text-red-500", children: [_jsx(XCircle, { size: 15 }), " ", saveError] }))] })] }) }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsxs("h2", { className: "mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900", children: [_jsx(UserCog, { size: 18 }), " Account Preferences"] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Globe2, { size: 14 }), " Language"] }), _jsxs("select", { value: account.language, onChange: (event) => setAccount((prev) => ({ ...prev, language: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none", children: [_jsx("option", { value: "en-IN", children: "English (India)" }), _jsx("option", { value: "hi-IN", children: "Hindi" }), _jsx("option", { value: "pa-IN", children: "Punjabi" })] })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Timezone" }), _jsxs("select", { value: account.timezone, onChange: (event) => setAccount((prev) => ({ ...prev, timezone: event.target.value })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none", children: [_jsx("option", { value: "Asia/Kolkata", children: "Asia/Kolkata" }), _jsx("option", { value: "Asia/Dubai", children: "Asia/Dubai" }), _jsx("option", { value: "Europe/London", children: "Europe/London" })] })] })] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsxs("h2", { className: "mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900", children: [_jsx(Bell, { size: 18 }), " Notification Preferences"] }), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Community announcements", _jsx("input", { type: "checkbox", checked: notifications.communityAnnouncements, onChange: (event) => setNotifications((prev) => ({ ...prev, communityAnnouncements: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Matrimony match alerts", _jsx("input", { type: "checkbox", checked: notifications.matrimonyMatches, onChange: (event) => setNotifications((prev) => ({ ...prev, matrimonyMatches: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Event reminders", _jsx("input", { type: "checkbox", checked: notifications.eventReminders, onChange: (event) => setNotifications((prev) => ({ ...prev, eventReminders: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Security alerts", _jsx("input", { type: "checkbox", checked: notifications.securityAlerts, onChange: (event) => setNotifications((prev) => ({ ...prev, securityAlerts: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Marketing updates", _jsx("input", { type: "checkbox", checked: notifications.marketingUpdates, onChange: (event) => setNotifications((prev) => ({ ...prev, marketingUpdates: event.target.checked })) })] })] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsxs("h2", { className: "mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900", children: [_jsx(ShieldCheck, { size: 18 }), " Privacy & Security"] }), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Show phone to accepted connections", _jsx("input", { type: "checkbox", checked: privacy.showPhoneToConnections, onChange: (event) => setPrivacy((prev) => ({ ...prev, showPhoneToConnections: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Show location publicly", _jsx("input", { type: "checkbox", checked: privacy.showLocationPublicly, onChange: (event) => setPrivacy((prev) => ({ ...prev, showLocationPublicly: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Allow profile in search results", _jsx("input", { type: "checkbox", checked: privacy.profileSearchable, onChange: (event) => setPrivacy((prev) => ({ ...prev, profileSearchable: event.target.checked })) })] }), _jsxs("label", { className: "flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5", children: ["Enable 2FA (placeholder)", _jsx("input", { type: "checkbox", checked: privacy.twoFactorEnabled, onChange: (event) => setPrivacy((prev) => ({ ...prev, twoFactorEnabled: event.target.checked })) })] })] }), _jsxs("button", { className: "mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50", children: [_jsx(LockKeyhole, { size: 15 }), " Change Password"] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsx("h2", { className: "mb-4 text-lg font-bold text-slate-900", children: "Appearance" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("button", { onClick: () => setTheme('light'), className: `flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${theme === 'light' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`, children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Sun, { size: 15 }), " Light"] }), theme === 'light' && 'Active'] }), _jsxs("button", { onClick: () => setTheme('dark'), className: `flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${theme === 'dark' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`, children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(MoonStar, { size: 15 }), " Dark"] }), theme === 'dark' && 'Active'] }), _jsxs("button", { onClick: () => setTheme('system'), className: `flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm ${theme === 'system' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`, children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Globe2, { size: 15 }), " System"] }), theme === 'system' && 'Active'] })] }), _jsx("p", { className: "mt-4 text-xs text-slate-500", children: "Theme persistence and server sync will be connected when backend preferences API is added." })] })] }), _jsxs("section", { className: "rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm", children: [_jsxs("h2", { className: "mb-1 inline-flex items-center gap-2 text-lg font-bold text-red-700", children: [_jsx(Trash2, { size: 18 }), " Danger Zone"] }), _jsx("p", { className: "mb-4 text-sm text-red-600", children: "Permanently delete your account and all associated data. This cannot be undone." }), _jsxs("button", { onClick: () => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(''); }, className: "inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors", children: [_jsx(Trash2, { size: 15 }), " Delete My Account"] })] }), showDeleteModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl", children: [_jsxs("div", { className: "mb-4 flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-red-100", children: _jsx(AlertTriangle, { size: 20, className: "text-red-600" }) }), _jsx("h3", { className: "text-lg font-bold text-slate-900", children: "Delete Account" })] }), _jsxs("p", { className: "mb-2 text-sm text-slate-600", children: ["This will permanently delete your account, profile, matches, and all data. ", _jsx("strong", { children: "This action cannot be reversed." })] }), _jsxs("p", { className: "mb-3 text-sm font-medium text-slate-700", children: ["Type ", _jsx("span", { className: "font-mono font-bold text-red-600", children: "DELETE" }), " to confirm:"] }), _jsx("input", { type: "text", value: deleteConfirmText, onChange: (e) => setDeleteConfirmText(e.target.value), placeholder: "Type DELETE here", className: "mb-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-400" }), deleteError && (_jsxs("p", { className: "mb-3 flex items-center gap-1.5 text-sm text-red-500", children: [_jsx(XCircle, { size: 14 }), " ", deleteError] })), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setShowDeleteModal(false), disabled: deleting, className: "flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50", children: "Cancel" }), _jsx("button", { onClick: handleDeleteAccount, disabled: deleteConfirmText !== 'DELETE' || deleting, className: "flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed", children: deleting ? 'Deleting...' : 'Yes, Delete Forever' })] })] }) }))] }));
}
