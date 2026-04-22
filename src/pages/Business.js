import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Building2, ExternalLink, Filter, ImagePlus, MapPin, Megaphone, Phone, Search, Sparkles, Star, Tags, TrendingUp, X } from 'lucide-react';
import businessService from '../services/business';
const categoryLabels = {
    food: 'Food',
    education: 'Education',
    healthcare: 'Healthcare',
    retail: 'Retail',
    professional: 'Professional',
    home_services: 'Home Services'
};
export default function Business() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('all');
    const [location, setLocation] = useState('all');
    const [verification, setVerification] = useState('all');
    const [trending, setTrending] = useState('all');
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createBusy, setCreateBusy] = useState(false);
    const [form, setForm] = useState({
        name: '',
        category: 'professional',
        ownerName: '',
        description: '',
        contactPhone: '',
        contactEmail: '',
        location: '',
        serviceTags: [],
        bannerImage: '',
        gallery: [],
        services: [],
    });
    useEffect(() => {
        void loadBusinesses();
    }, []);
    const loadBusinesses = async () => {
        setLoading(true);
        const response = await businessService.getBusinesses();
        if (response.success && response.data) {
            setBusinesses(response.data);
        }
        setLoading(false);
    };
    const updateForm = (key, value) => {
        if (key === 'serviceTags' || key === 'services' || key === 'gallery') {
            const list = value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            setForm((prev) => ({ ...prev, [key]: list }));
            return;
        }
        setForm((prev) => ({ ...prev, [key]: value }));
    };
    const resetCreateForm = () => {
        setForm({
            name: '',
            category: 'professional',
            ownerName: '',
            description: '',
            contactPhone: '',
            contactEmail: '',
            location: '',
            serviceTags: [],
            bannerImage: '',
            gallery: [],
            services: [],
        });
        setCreateError('');
    };
    const submitCreateListing = async () => {
        setCreateError('');
        setCreateBusy(true);
        const response = await businessService.createBusinessListing(form);
        setCreateBusy(false);
        if (!response.success || !response.data) {
            setCreateError(response.error || 'Unable to create listing');
            return;
        }
        setShowCreateModal(false);
        resetCreateForm();
        await loadBusinesses();
    };
    const locations = useMemo(() => {
        return ['all', ...Array.from(new Set(businesses.map((item) => item.location))).sort()];
    }, [businesses]);
    const featuredBusinesses = useMemo(() => businesses.filter((item) => item.featured), [businesses]);
    const promotedBusinesses = useMemo(() => businesses.filter((item) => item.promoted), [businesses]);
    const filteredBusinesses = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return businesses
            .filter((item) => {
            const matchesSearch = term.length === 0 ||
                item.name.toLowerCase().includes(term) ||
                item.ownerName.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term) ||
                item.serviceTags.some((tag) => tag.toLowerCase().includes(term));
            const matchesCategory = category === 'all' || item.category === category;
            const matchesLocation = location === 'all' || item.location === location;
            const matchesVerification = verification === 'all' ||
                (verification === 'verified' ? item.verified : !item.verified);
            const matchesTrending = trending === 'all' ||
                (trending === 'trending' ? item.trending : !item.trending);
            return (matchesSearch &&
                matchesCategory &&
                matchesLocation &&
                matchesVerification &&
                matchesTrending);
        })
            .sort((a, b) => {
            if (a.promoted !== b.promoted)
                return a.promoted ? -1 : 1;
            if (a.trending !== b.trending)
                return a.trending ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [businesses, category, location, searchTerm, trending, verification]);
    return (_jsxs("div", { className: "space-y-6 pb-8", children: [_jsxs("section", { className: "relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8", children: [_jsx("div", { className: "absolute -right-20 -top-16 h-56 w-56 rounded-full bg-orange-200/40 blur-3xl" }), _jsx("div", { className: "absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" }), _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", children: [_jsxs("div", { className: "max-w-2xl", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: "Marketplace lane" }), _jsx("h1", { className: "mt-2 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl", children: "Business & Marketing" }), _jsx("p", { className: "mt-3 max-w-xl text-slate-600", children: "Promote trusted community businesses with a premium discovery layout and future-ready monetization placeholders." })] }), _jsxs("button", { onClick: () => setShowCreateModal(true), className: "inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5", children: [_jsx(Building2, { size: 18 }), " Add Business Listing"] })] }), _jsxs("div", { className: "mt-6 grid gap-4 lg:grid-cols-3", children: [_jsxs("div", { className: "rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm lg:col-span-2", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-orange-700", children: [_jsx(Megaphone, { size: 18 }), _jsx("p", { className: "font-semibold", children: "Paid Promotion Placeholder" })] }), _jsx("p", { className: "text-sm text-slate-700", children: "Reserve premium ad slots for top visibility. Subscription and billing APIs can be connected here later." })] }), _jsxs("div", { className: "rounded-[1.6rem] border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-5 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2 text-sky-700", children: [_jsx(TrendingUp, { size: 18 }), _jsx("p", { className: "font-semibold", children: "Trending Businesses" })] }), _jsxs("p", { className: "text-sm text-slate-700", children: [businesses.filter((item) => item.trending).length, " listings are trending this week."] })] })] })] }), _jsxs("div", { className: "mb-8 grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5", children: [_jsxs("div", { className: "relative md:col-span-2 xl:col-span-2", children: [_jsx(Search, { size: 18, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), _jsx("input", { value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), type: "text", placeholder: "Search business, owner, service", className: "w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-slate-400" })] }), _jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5", children: [_jsx(Filter, { size: 16, className: "text-slate-500" }), _jsxs("select", { value: category, onChange: (event) => setCategory(event.target.value), className: "w-full bg-transparent text-sm outline-none", children: [_jsx("option", { value: "all", children: "All Categories" }), Object.keys(categoryLabels).map((key) => (_jsx("option", { value: key, children: categoryLabels[key] }, key)))] })] }), _jsx("select", { value: location, onChange: (event) => setLocation(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none", children: locations.map((city) => (_jsx("option", { value: city, children: city === 'all' ? 'All Locations' : city }, city))) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("select", { value: verification, onChange: (event) => setVerification(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none", children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "verified", children: "Verified" }), _jsx("option", { value: "unverified", children: "Unverified" })] }), _jsxs("select", { value: trending, onChange: (event) => setTrending(event.target.value), className: "rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none", children: [_jsx("option", { value: "all", children: "Any Trend" }), _jsx("option", { value: "trending", children: "Trending" }), _jsx("option", { value: "not_trending", children: "Not Trending" })] })] })] }), _jsxs("div", { className: "mb-8 grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Featured Businesses" }), _jsx(Sparkles, { size: 16, className: "text-amber-500" })] }), featuredBusinesses.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No featured businesses yet." })) : (_jsx("div", { className: "space-y-3", children: featuredBusinesses.slice(0, 3).map((item) => (_jsxs("button", { onClick: () => setSelectedBusiness(item), className: "flex w-full items-start justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-900", children: item.name }), _jsxs("p", { className: "text-xs text-slate-500", children: [item.location, " \u2022 ", categoryLabels[item.category]] })] }), _jsx(ExternalLink, { size: 16, className: "text-slate-400" })] }, item.id))) }))] }), _jsxs("div", { className: "rounded-2xl bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Promoted Listings" }), _jsx(Megaphone, { size: 16, className: "text-rose-500" })] }), promotedBusinesses.length === 0 ? (_jsx("p", { className: "text-sm text-slate-500", children: "No promoted businesses right now." })) : (_jsx("div", { className: "space-y-3", children: promotedBusinesses.slice(0, 3).map((item) => (_jsxs("button", { onClick: () => setSelectedBusiness(item), className: "flex w-full items-start justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-slate-900", children: item.name }), _jsxs("p", { className: "text-xs text-slate-500", children: ["Owned by ", item.ownerName] })] }), _jsx("span", { className: "rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700", children: "Ad" })] }, item.id))) }))] })] }), _jsxs("div", { className: "mb-8 grid gap-6 xl:grid-cols-[1fr_280px]", children: [_jsx("div", { children: loading ? (_jsx("div", { className: "rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm", children: "Loading business listings..." })) : filteredBusinesses.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center", children: [_jsx("p", { className: "text-lg font-semibold text-slate-700", children: "No businesses matched your filters" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Post a listing to get started, or broaden your search filters." })] })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: filteredBusinesses.map((business) => (_jsxs("article", { className: "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", children: [_jsx("div", { className: "h-36 w-full bg-slate-200", children: business.bannerImage ? (_jsx("img", { src: business.bannerImage, alt: business.name, className: "h-full w-full object-cover" })) : (_jsx("div", { className: "flex h-full items-center justify-center text-slate-400", children: _jsx(ImagePlus, { size: 24 }) })) }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700", children: categoryLabels[business.category] }), business.verified && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700", children: [_jsx(BadgeCheck, { size: 12 }), " Verified"] })), business.trending && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700", children: [_jsx(TrendingUp, { size: 12 }), " Trending"] })), business.promoted && (_jsx("span", { className: "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700", children: "Promoted" }))] }), _jsx("h3", { className: "text-lg font-bold text-slate-900", children: business.name }), _jsxs("p", { className: "text-sm text-slate-500", children: ["Owner: ", business.ownerName] }), _jsx("p", { className: "mt-2 text-sm text-slate-600", children: business.description }), _jsxs("div", { className: "mt-3 flex items-center gap-4 text-sm text-slate-600", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(MapPin, { size: 14 }), " ", business.location] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Star, { size: 14, className: "text-amber-500" }), " ", business.rating ?? 'N/A'] })] }), _jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: business.serviceTags.slice(0, 3).map((tag) => (_jsx("span", { className: "inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600", children: tag }, tag))) }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { onClick: () => setSelectedBusiness(business), className: "flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800", children: "View Business" }), _jsx("button", { className: "rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Contact" })] })] })] }, business.id))) })) }), _jsxs("aside", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-2xl bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Categories" }), _jsx("div", { className: "space-y-2", children: Object.keys(categoryLabels).map((key) => (_jsxs("button", { onClick: () => setCategory(key), className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100", children: [_jsx("span", { children: categoryLabels[key] }), _jsx("span", { className: "rounded-full bg-slate-100 px-2 py-0.5 text-xs", children: businesses.filter((item) => item.category === key).length })] }, key))) })] }), _jsxs("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm", children: [_jsx("h3", { className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Ad Slot Placeholder" }), _jsx("p", { className: "text-sm text-slate-500", children: "Future banner campaign inventory and impression analytics can be rendered here." })] })] })] }), selectedBusiness && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl", children: [_jsxs("div", { className: "relative h-56 bg-slate-100", children: [selectedBusiness.bannerImage ? (_jsx("img", { src: selectedBusiness.bannerImage, alt: selectedBusiness.name, className: "h-full w-full object-cover" })) : (_jsx("div", { className: "flex h-full items-center justify-center text-slate-400", children: _jsx(ImagePlus, { size: 28 }) })), _jsx("button", { onClick: () => setSelectedBusiness(null), className: "absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 shadow-sm transition hover:bg-white", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-slate-900", children: selectedBusiness.name }), _jsxs("p", { className: "mt-1 text-slate-600", children: ["Owned by ", selectedBusiness.ownerName] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [selectedBusiness.verified && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700", children: [_jsx(BadgeCheck, { size: 12 }), " Verified"] })), selectedBusiness.promoted && (_jsx("span", { className: "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700", children: "Promoted" }))] })] }), _jsx("p", { className: "mb-5 text-slate-700", children: selectedBusiness.description }), _jsxs("div", { className: "mb-6 grid gap-4 md:grid-cols-3", children: [_jsxs("div", { className: "rounded-xl bg-slate-50 p-4", children: [_jsx("p", { className: "mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Location" }), _jsxs("p", { className: "inline-flex items-center gap-1 text-sm font-semibold text-slate-800", children: [_jsx(MapPin, { size: 14 }), " ", selectedBusiness.location] })] }), _jsxs("div", { className: "rounded-xl bg-slate-50 p-4", children: [_jsx("p", { className: "mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Contact" }), _jsxs("p", { className: "inline-flex items-center gap-1 text-sm font-semibold text-slate-800", children: [_jsx(Phone, { size: 14 }), " ", selectedBusiness.contactPhone] })] }), _jsxs("div", { className: "rounded-xl bg-slate-50 p-4", children: [_jsx("p", { className: "mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Reviews Placeholder" }), _jsxs("p", { className: "inline-flex items-center gap-1 text-sm font-semibold text-slate-800", children: [_jsx(Star, { size: 14, className: "text-amber-500" }), " ", selectedBusiness.rating ?? 'N/A', " (", selectedBusiness.reviewCount ?? 0, ")"] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Service List" }), _jsx("div", { className: "flex flex-wrap gap-2", children: selectedBusiness.services.map((item) => (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700", children: [_jsx(Tags, { size: 12 }), " ", item] }, item))) })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "mb-3 text-sm font-bold uppercase tracking-wide text-slate-700", children: "Gallery Placeholder" }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2 md:grid-cols-3", children: selectedBusiness.gallery.slice(0, 3).map((image) => (_jsx("img", { src: image, alt: "Business gallery", className: "h-28 w-full rounded-xl object-cover" }, image))) })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { className: "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800", children: "Call Business" }), _jsx("button", { className: "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Send Message" }), _jsx("button", { className: "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Share Listing" })] })] })] }) })), showCreateModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl", children: [_jsxs("div", { className: "mb-5 flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-slate-900", children: "Post New Business Listing" }), _jsx("button", { onClick: () => {
                                        setShowCreateModal(false);
                                        resetCreateForm();
                                    }, className: "rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx("input", { value: form.name, onChange: (event) => updateForm('name', event.target.value), placeholder: "Business Name", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { value: form.ownerName, onChange: (event) => updateForm('ownerName', event.target.value), placeholder: "Owner Name", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("select", { value: form.category, onChange: (event) => setForm((prev) => ({ ...prev, category: event.target.value })), className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500", children: Object.keys(categoryLabels).map((key) => (_jsx("option", { value: key, children: categoryLabels[key] }, key))) }), _jsx("input", { value: form.location, onChange: (event) => updateForm('location', event.target.value), placeholder: "Location", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { value: form.contactPhone, onChange: (event) => updateForm('contactPhone', event.target.value), placeholder: "Contact Phone", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { value: form.contactEmail || '', onChange: (event) => updateForm('contactEmail', event.target.value), placeholder: "Contact Email (optional)", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("textarea", { value: form.description, onChange: (event) => updateForm('description', event.target.value), rows: 3, placeholder: "Business Description", className: "md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { onChange: (event) => updateForm('serviceTags', event.target.value), placeholder: "Service Tags (comma separated)", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { onChange: (event) => updateForm('services', event.target.value), placeholder: "Services (comma separated)", className: "rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { value: form.bannerImage || '', onChange: (event) => updateForm('bannerImage', event.target.value), placeholder: "Banner Image URL (optional)", className: "md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" }), _jsx("input", { onChange: (event) => updateForm('gallery', event.target.value), placeholder: "Gallery URLs (comma separated, optional)", className: "md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500" })] }), createError && (_jsx("p", { className: "mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700", children: createError })), _jsxs("div", { className: "mt-6 flex justify-end gap-2", children: [_jsx("button", { onClick: () => {
                                        setShowCreateModal(false);
                                        resetCreateForm();
                                    }, className: "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50", children: "Cancel" }), _jsx("button", { disabled: createBusy, onClick: () => void submitCreateListing(), className: "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60", children: createBusy ? 'Posting...' : 'Post Listing' })] })] }) }))] }));
}
