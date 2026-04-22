import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, CalendarDays, Clock3, MapPin, Megaphone, MessageCircle, Pin, Plus, Search, ThumbsUp, X, } from 'lucide-react';
import authService from '../services/auth';
import communityFeedService from '../services/communityFeed';
const tabConfig = [
    { id: 'all', label: 'All' },
    { id: 'meeting', label: 'Meetings' },
    { id: 'achievement', label: 'Achievements' },
    { id: 'lost_found', label: 'Lost & Found' },
    { id: 'news', label: 'News' },
    { id: 'celebration', label: 'Celebrations' },
    { id: 'announcement', label: 'Announcements' },
    { id: 'update', label: 'Updates' },
];
const categoryStyle = {
    meeting: 'bg-indigo-100 text-indigo-700',
    news: 'bg-sky-100 text-sky-700',
    celebration: 'bg-amber-100 text-amber-700',
    update: 'bg-slate-100 text-slate-700',
    achievement: 'bg-emerald-100 text-emerald-700',
    lost_found: 'bg-rose-100 text-rose-700',
    announcement: 'bg-violet-100 text-violet-700',
};
const defaultPostForm = {
    title: '',
    content: '',
    category: 'update',
    author: '',
};
const defaultMeetingForm = {
    title: '',
    meetingDate: '',
    location: '',
    host: '',
    agenda: '',
};
export default function CommunityFeed() {
    const [posts, setPosts] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [showCreatePostModal, setShowCreatePostModal] = useState(false);
    const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false);
    const [postForm, setPostForm] = useState(defaultPostForm);
    const [meetingForm, setMeetingForm] = useState(defaultMeetingForm);
    const [feedStats, setFeedStats] = useState({
        totalPosts: 0,
        pinnedPosts: 0,
        upcomingMeetings: 0,
    });
    useEffect(() => {
        void loadData();
    }, []);
    const loadData = async () => {
        setLoading(true);
        const [postsResponse, meetingsResponse, statsResponse] = await Promise.all([
            communityFeedService.getPosts(),
            communityFeedService.getUpcomingMeetings(),
            communityFeedService.getStats(),
        ]);
        if (postsResponse.success && postsResponse.data) {
            setPosts(postsResponse.data);
        }
        else {
            setPosts([]);
        }
        if (meetingsResponse.success && meetingsResponse.data) {
            setMeetings(meetingsResponse.data);
        }
        else {
            setMeetings([]);
        }
        if (statsResponse.success && statsResponse.data) {
            setFeedStats({
                totalPosts: statsResponse.data.totalPosts || 0,
                pinnedPosts: statsResponse.data.pinnedPosts || 0,
                upcomingMeetings: statsResponse.data.upcomingMeetings || 0,
            });
        }
        setLoading(false);
    };
    const postCountByTab = useMemo(() => {
        return posts.reduce((acc, post) => {
            acc.all += 1;
            acc[post.category] += 1;
            return acc;
        }, {
            all: 0,
            meeting: 0,
            news: 0,
            celebration: 0,
            update: 0,
            achievement: 0,
            lost_found: 0,
            announcement: 0,
        });
    }, [posts]);
    const pinnedPosts = useMemo(() => posts.filter((post) => post.pinned), [posts]);
    const filteredPosts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return posts
            .filter((post) => {
            const matchesTab = activeTab === 'all' || post.category === activeTab;
            const matchesSearch = term.length === 0 ||
                post.title.toLowerCase().includes(term) ||
                post.content.toLowerCase().includes(term) ||
                post.author.toLowerCase().includes(term);
            return matchesTab && matchesSearch;
        })
            .sort((a, b) => {
            if (sortBy === 'most_liked') {
                return b.likes - a.likes;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [activeTab, posts, searchTerm, sortBy]);
    const achievementPosts = useMemo(() => posts.filter((post) => post.category === 'achievement').slice(0, 3), [posts]);
    const missingPosts = useMemo(() => posts.filter((post) => post.category === 'lost_found').slice(0, 3), [posts]);
    const handleCreatePost = async () => {
        if (!postForm.title.trim() || !postForm.content.trim()) {
            window.alert('Please add title and content for the post');
            return;
        }
        const currentUser = authService.getCurrentUser();
        const response = await communityFeedService.createPost({
            title: postForm.title.trim(),
            content: postForm.content.trim(),
            category: postForm.category,
            author: postForm.author.trim() || currentUser?.fullName || 'Community Member',
        });
        if (!response.success) {
            window.alert(response.error || 'Unable to create post');
            return;
        }
        await loadData();
        setShowCreatePostModal(false);
        setPostForm(defaultPostForm);
    };
    const handleCreateMeeting = async () => {
        if (!meetingForm.title.trim() ||
            !meetingForm.meetingDate.trim() ||
            !meetingForm.location.trim() ||
            !meetingForm.host.trim() ||
            !meetingForm.agenda.trim()) {
            window.alert('Please fill all meeting fields');
            return;
        }
        const response = await communityFeedService.createMeeting({
            title: meetingForm.title.trim(),
            meetingDate: meetingForm.meetingDate,
            location: meetingForm.location.trim(),
            host: meetingForm.host.trim(),
            agenda: meetingForm.agenda.trim(),
        });
        if (!response.success) {
            window.alert(response.error || 'Unable to create meeting');
            return;
        }
        await loadData();
        setShowCreateMeetingModal(false);
        setMeetingForm(defaultMeetingForm);
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
    return (_jsxs("div", { className: "space-y-6 pb-8", children: [_jsxs("section", { className: "rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: [_jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { className: "max-w-2xl", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Social lane" }), _jsx("h1", { className: "mt-2 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl", children: "Community Feed" }), _jsx("p", { className: "mt-3 max-w-xl text-slate-600", children: "Live announcements, achievements, lost-and-found posts, and upcoming meetings presented in a cleaner discovery flow." })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: () => setShowCreateMeetingModal(true), className: "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50", children: [_jsx(CalendarDays, { size: 18 }), " Add Meeting"] }), _jsxs("button", { onClick: () => setShowCreatePostModal(true), className: "inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5", children: [_jsx(Plus, { size: 18 }), " Create Post"] })] })] }), _jsxs("div", { className: "mt-6 grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-[1.6rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-5 shadow-sm", children: [_jsx("p", { className: "text-sm text-indigo-700", children: "Total Posts" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-indigo-900", children: feedStats.totalPosts })] }), _jsxs("div", { className: "rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 shadow-sm", children: [_jsx("p", { className: "text-sm text-emerald-700", children: "Pinned Announcements" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-emerald-900", children: feedStats.pinnedPosts })] }), _jsxs("div", { className: "rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-rose-50 p-5 shadow-sm", children: [_jsx("p", { className: "text-sm text-amber-700", children: "Upcoming Meetings" }), _jsx("p", { className: "mt-1 text-2xl font-bold text-amber-900", children: feedStats.upcomingMeetings })] })] }), _jsx("div", { className: "mb-5 flex flex-wrap gap-2", children: tabConfig.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`, children: [tab.label, " (", postCountByTab[tab.id] || 0, ")"] }, tab.id))) }), _jsxs("div", { className: "mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 18, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), type: "text", placeholder: "Search posts by title, content, or author", className: "w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-slate-400" })] }), _jsxs("select", { value: sortBy, onChange: (event) => setSortBy(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none", children: [_jsx("option", { value: "latest", children: "Latest" }), _jsx("option", { value: "most_liked", children: "Most Liked" })] })] })] }), _jsxs("div", { className: "mb-8 grid gap-6 xl:grid-cols-[1fr_320px]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "rounded-2xl bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Pinned" }), _jsx(Pin, { size: 16, className: "text-rose-500" })] }), pinnedPosts.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No pinned posts available yet." })) : (_jsx("div", { className: "space-y-3", children: pinnedPosts.map((post) => (_jsxs("article", { className: "rounded-xl border border-slate-200 bg-slate-50 p-4", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [_jsx("span", { className: `rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle[post.category]}`, children: post.category }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700", children: [_jsx(Pin, { size: 12 }), " Pinned"] })] }), _jsx("h3", { className: "text-base font-bold text-slate-900", children: post.title }), _jsx("p", { className: "mt-1 text-sm text-slate-600", children: post.content })] }, post.id))) }))] }), _jsx("section", { className: "space-y-4", children: loading ? (_jsx("div", { className: "rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm", children: "Loading community posts..." })) : filteredPosts.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center", children: [_jsx("p", { className: "text-lg font-semibold text-slate-700", children: "No real posts found yet" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Create the first post or meeting to start this feed." })] })) : (filteredPosts.map((post) => (_jsxs("article", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: `rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle[post.category]}`, children: post.category }), post.pinned && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700", children: [_jsx(Pin, { size: 12 }), " Pinned"] }))] }), _jsx("h3", { className: "text-xl font-bold text-slate-900", children: post.title }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-600", children: post.content }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600", children: [_jsxs("span", { children: ["By ", _jsx("span", { className: "font-semibold text-slate-900", children: post.author })] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock3, { size: 14 }), " ", formatTimeAgo(post.createdAt)] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3 text-sm", children: [_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700", children: [_jsx(ThumbsUp, { size: 14 }), " ", post.likes, " likes"] }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700", children: [_jsx(MessageCircle, { size: 14 }), " ", post.comments, " comments"] })] })] }, post.id)))) })] }), _jsxs("aside", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Upcoming Meetings" }), meetings.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No upcoming meetings." })) : (_jsx("div", { className: "space-y-3", children: meetings.map((meeting) => (_jsxs("article", { className: "rounded-xl border border-slate-200 p-3", children: [_jsx("p", { className: "font-semibold text-slate-900", children: meeting.title }), _jsxs("p", { className: "mt-1 inline-flex items-center gap-1 text-xs text-slate-600", children: [_jsx(CalendarDays, { size: 12 }), " ", new Date(meeting.meetingDate).toLocaleString('en-IN')] }), _jsxs("p", { className: "mt-1 inline-flex items-center gap-1 text-xs text-slate-600", children: [_jsx(MapPin, { size: 12 }), " ", meeting.location] }), _jsxs("p", { className: "mt-2 text-xs text-slate-600", children: ["Host: ", _jsx("span", { className: "font-semibold text-slate-800", children: meeting.host })] }), _jsxs("p", { className: "mt-2 text-xs text-slate-500", children: ["Agenda: ", meeting.agenda] })] }, meeting.id))) }))] }), _jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Achievements" }), achievementPosts.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No achievements posted yet." })) : (_jsx("div", { className: "space-y-2", children: achievementPosts.map((post) => (_jsxs("p", { className: "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800", children: [_jsx(Award, { size: 14, className: "mr-1 inline" }), " ", post.title] }, post.id))) }))] }), _jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Lost And Found Alerts" }), missingPosts.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No active alerts." })) : (_jsx("div", { className: "space-y-2", children: missingPosts.map((post) => (_jsxs("p", { className: "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800", children: [_jsx(AlertTriangle, { size: 14, className: "mr-1 inline" }), " ", post.title] }, post.id))) }))] }), _jsxs("div", { className: "rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm", children: [_jsxs("p", { className: "inline-flex items-center gap-2 text-sm font-semibold text-indigo-800", children: [_jsx(Megaphone, { size: 14 }), " Real data only"] }), _jsx("p", { className: "mt-1 text-sm text-indigo-700", children: "This feed now reads directly from database records. No mock posts are shown." })] })] })] }), showCreatePostModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4", children: _jsxs("div", { className: "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl", children: [_jsxs("div", { className: "sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900", children: "Create Community Post" }), _jsx("button", { onClick: () => setShowCreatePostModal(false), className: "rounded-lg p-2 text-slate-500 transition hover:bg-slate-100", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "grid gap-4 p-5", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Title *" }), _jsx("input", { value: postForm.title, onChange: (event) => setPostForm((prev) => ({ ...prev, title: event.target.value })), type: "text", placeholder: "Enter a clear post title", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Category *" }), _jsxs("select", { value: postForm.category, onChange: (event) => setPostForm((prev) => ({
                                                        ...prev,
                                                        category: event.target.value,
                                                    })), className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400", children: [_jsx("option", { value: "meeting", children: "Meeting Announcement" }), _jsx("option", { value: "achievement", children: "Achievement" }), _jsx("option", { value: "lost_found", children: "Lost And Found" }), _jsx("option", { value: "news", children: "Community News" }), _jsx("option", { value: "celebration", children: "Celebration" }), _jsx("option", { value: "announcement", children: "Announcement" }), _jsx("option", { value: "update", children: "General Update" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Author" }), _jsx("input", { value: postForm.author, onChange: (event) => setPostForm((prev) => ({ ...prev, author: event.target.value })), type: "text", placeholder: "Optional, defaults to your name", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Post Content *" }), _jsx("textarea", { value: postForm.content, onChange: (event) => setPostForm((prev) => ({ ...prev, content: event.target.value })), rows: 5, placeholder: "Write announcement, achievement details, or lost-person alert", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => setShowCreatePostModal(false), className: "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Cancel" }), _jsx("button", { onClick: () => void handleCreatePost(), className: "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800", children: "Publish Post" })] })] })] }) })), showCreateMeetingModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4", children: _jsxs("div", { className: "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl", children: [_jsxs("div", { className: "sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900", children: "Add Community Meeting" }), _jsx("button", { onClick: () => setShowCreateMeetingModal(false), className: "rounded-lg p-2 text-slate-500 transition hover:bg-slate-100", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "grid gap-4 p-5", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Meeting Title *" }), _jsx("input", { value: meetingForm.title, onChange: (event) => setMeetingForm((prev) => ({ ...prev, title: event.target.value })), type: "text", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Date And Time *" }), _jsx("input", { value: meetingForm.meetingDate, onChange: (event) => setMeetingForm((prev) => ({ ...prev, meetingDate: event.target.value })), type: "datetime-local", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Host *" }), _jsx("input", { value: meetingForm.host, onChange: (event) => setMeetingForm((prev) => ({ ...prev, host: event.target.value })), type: "text", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Location *" }), _jsx("input", { value: meetingForm.location, onChange: (event) => setMeetingForm((prev) => ({ ...prev, location: event.target.value })), type: "text", className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-semibold text-slate-700", children: "Agenda *" }), _jsx("textarea", { value: meetingForm.agenda, onChange: (event) => setMeetingForm((prev) => ({ ...prev, agenda: event.target.value })), rows: 4, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => setShowCreateMeetingModal(false), className: "rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Cancel" }), _jsx("button", { onClick: () => void handleCreateMeeting(), className: "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800", children: "Save Meeting" })] })] })] }) }))] }));
}
