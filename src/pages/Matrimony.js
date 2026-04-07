import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import matrimonyService from '../services/matrimony';
import { Lock, Search, Sliders, Bookmark, Eye } from 'lucide-react';
const defaultFilterOptions = {
    locations: ['Delhi', 'Gurugram', 'Noida', 'Jaipur', 'Chandigarh'],
    genders: ['male', 'female'],
    communities: ['Chaudhary'],
    subCommunities: ['Jat', 'Gujjar', 'General'],
    educations: ['B.Tech', 'M.Tech', 'MBA', 'B.Com', 'M.Com', 'MBBS'],
    occupations: ['Software Engineer', 'Business Owner', 'Doctor', 'Teacher', 'Government Officer'],
    maritalStatuses: ['Never Married', 'Divorced', 'Widowed'],
    languages: ['Hindi', 'English', 'Punjabi', 'Haryanvi'],
    ageBounds: { min: 18, max: 60 },
};
export default function Matrimony() {
    const [filteredProfiles, setFilteredProfiles] = useState([]);
    const [filterOptions, setFilterOptions] = useState(defaultFilterOptions);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('compatibility');
    const [savedFilters, setSavedFilters] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState(null);
    // Filter state
    const [filters, setFilters] = useState({
        ageRange: [18, 50],
        location: '',
        gender: '',
        community: '',
        subCommunity: '',
        education: '',
        occupation: '',
        maritalStatus: '',
        language: '',
    });
    // Load initial data
    useEffect(() => {
        void Promise.all([loadSavedFilters(), loadFilterOptions()]);
    }, []);
    useEffect(() => {
        void loadProfiles();
    }, [filters, searchQuery, sortBy, activeTab]);
    const sortProfiles = (items) => {
        const sorted = [...items];
        if (sortBy === 'compatibility') {
            sorted.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
        }
        else if (sortBy === 'new') {
            sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        else if (sortBy === 'education') {
            sorted.sort((a, b) => a.education.localeCompare(b.education));
        }
        else if (sortBy === 'nearby') {
            sorted.sort((a, b) => a.location.localeCompare(b.location));
        }
        return sorted;
    };
    const loadProfiles = async () => {
        setLoading(true);
        try {
            const data = await matrimonyService.getProfiles({
                ...filters,
                searchQuery,
                statusTab: activeTab,
            });
            setFilteredProfiles(sortProfiles(data));
        }
        catch (error) {
            console.error('Error loading profiles:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadSavedFilters = async () => {
        try {
            const data = await matrimonyService.getSavedFilters();
            setSavedFilters(data);
        }
        catch (error) {
            console.error('Error loading saved filters:', error);
        }
    };
    const loadFilterOptions = async () => {
        try {
            const data = await matrimonyService.getFilterOptions();
            setFilterOptions({
                ...defaultFilterOptions,
                ...data,
                locations: data.locations.length > 0 ? data.locations : defaultFilterOptions.locations,
                genders: data.genders.length > 0 ? data.genders : defaultFilterOptions.genders,
                communities: data.communities.length > 0 ? data.communities : defaultFilterOptions.communities,
                subCommunities: data.subCommunities.length > 0 ? data.subCommunities : defaultFilterOptions.subCommunities,
                educations: data.educations.length > 0 ? data.educations : defaultFilterOptions.educations,
                occupations: data.occupations.length > 0 ? data.occupations : defaultFilterOptions.occupations,
                maritalStatuses: data.maritalStatuses.length > 0
                    ? data.maritalStatuses
                    : defaultFilterOptions.maritalStatuses,
                languages: data.languages.length > 0 ? data.languages : defaultFilterOptions.languages,
            });
        }
        catch (error) {
            console.error('Error loading filter options:', error);
            setFilterOptions(defaultFilterOptions);
        }
    };
    const handleToggleShortlist = async (profileId) => {
        await matrimonyService.toggleShortlist(profileId);
        await matrimonyService.markAsViewed(profileId);
        loadProfiles();
    };
    const handleUnlock = async (profileId) => {
        // TODO: Integrate with payment system later
        await matrimonyService.unlockProfile(profileId);
        loadProfiles();
    };
    const handleApplySavedFilter = (filterId) => {
        const filter = savedFilters.find((f) => f.id === filterId);
        if (filter) {
            setFilters(filter.filters);
            setSelectedFilter(filterId);
        }
    };
    const handleResetFilters = () => {
        setFilters({
            ageRange: [18, 50],
            location: '',
            gender: '',
            community: '',
            subCommunity: '',
            education: '',
            occupation: '',
            maritalStatus: '',
            language: '',
        });
        setSearchQuery('');
        setSelectedFilter(null);
    };
    const ageMin = Math.min(filterOptions.ageBounds.min || 18, filters.ageRange?.[0] || 18);
    const ageMax = Math.max(filterOptions.ageBounds.max || 60, filters.ageRange?.[1] || 60);
    const ageOptions = Array.from({ length: ageMax - ageMin + 1 }, (_, index) => ageMin + index);
    const formatOptionLabel = (value) => value
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Matrimony" }), _jsx("p", { className: "text-gray-600", children: "Find your perfect match with our compatibility filtering" })] }), _jsx("div", { className: "mb-6 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-1", children: "Unlock Premium Features" }), _jsx("p", { className: "text-purple-100", children: "Get unlimited profile views and direct messaging" })] }), _jsx("button", { className: "bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition", children: "Upgrade Now" })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-4 gap-6", children: [_jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-white rounded-lg shadow sticky top-20", children: [_jsxs("div", { className: "p-4 border-b flex items-center justify-between", children: [_jsxs("h3", { className: "font-semibold text-gray-900 flex items-center gap-2", children: [_jsx(Sliders, { size: 18 }), "Filters"] }), _jsx("button", { onClick: handleResetFilters, className: "text-xs text-purple-600 hover:text-purple-700 font-medium", children: "Reset" })] }), _jsxs("div", { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Age Range" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("select", { value: filters.ageRange?.[0] || 18, onChange: (e) => setFilters({
                                                                ...filters,
                                                                ageRange: [parseInt(e.target.value, 10), filters.ageRange?.[1] || ageMax],
                                                            }), className: "w-1/2 px-2 py-2 border border-gray-300 rounded text-sm", children: ageOptions.map((age) => (_jsx("option", { value: age, children: age }, `age-min-${age}`))) }), _jsx("select", { value: filters.ageRange?.[1] || 50, onChange: (e) => setFilters({
                                                                ...filters,
                                                                ageRange: [filters.ageRange?.[0] || ageMin, parseInt(e.target.value, 10)],
                                                            }), className: "w-1/2 px-2 py-2 border border-gray-300 rounded text-sm", children: ageOptions.map((age) => (_jsx("option", { value: age, children: age }, `age-max-${age}`))) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Location" }), _jsxs("select", { value: filters.location || '', onChange: (e) => setFilters({ ...filters, location: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Locations" }), filterOptions.locations.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Gender" }), _jsxs("select", { value: filters.gender || '', onChange: (e) => setFilters({ ...filters, gender: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Genders" }), filterOptions.genders.map((option) => (_jsx("option", { value: option, children: formatOptionLabel(option) }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Community" }), _jsxs("select", { value: filters.community || '', onChange: (e) => setFilters({ ...filters, community: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Communities" }), filterOptions.communities.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Sub Community" }), _jsxs("select", { value: filters.subCommunity || '', onChange: (e) => setFilters({ ...filters, subCommunity: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Sub Communities" }), filterOptions.subCommunities.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Education" }), _jsxs("select", { value: filters.education || '', onChange: (e) => setFilters({ ...filters, education: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Education Levels" }), filterOptions.educations.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Occupation" }), _jsxs("select", { value: filters.occupation || '', onChange: (e) => setFilters({ ...filters, occupation: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Occupations" }), filterOptions.occupations.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Marital Status" }), _jsxs("select", { value: filters.maritalStatus || '', onChange: (e) => setFilters({ ...filters, maritalStatus: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Marital Status" }), filterOptions.maritalStatuses.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Language" }), _jsxs("select", { value: filters.language || '', onChange: (e) => setFilters({ ...filters, language: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Languages" }), filterOptions.languages.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] })] }), savedFilters.length > 0 && (_jsxs("div", { className: "border-t p-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Saved Filters" }), _jsx("div", { className: "space-y-2", children: savedFilters.map((filter) => (_jsx("button", { onClick: () => handleApplySavedFilter(filter.id), className: `w-full text-left px-3 py-2 rounded text-sm transition ${selectedFilter === filter.id
                                                    ? 'bg-purple-100 text-purple-700 font-medium'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: filter.name }, filter.id))) })] }))] }) }), _jsxs("div", { className: "lg:col-span-3", children: [_jsxs("div", { className: "mb-6 flex gap-4", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { size: 18, className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search by name, location, or bio...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" })] }), _jsxs("select", { value: sortBy, onChange: (e) => setSortBy(e.target.value), className: "px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500", children: [_jsx("option", { value: "compatibility", children: "Highest Compatibility" }), _jsx("option", { value: "new", children: "Newest Profiles" }), _jsx("option", { value: "nearby", children: "Nearby" }), _jsx("option", { value: "education", children: "By Education" })] })] }), _jsx("div", { className: "mb-6 flex gap-2 border-b", children: [
                                    { key: 'all', label: 'All Matches' },
                                    { key: 'shortlisted', label: 'Shortlisted' },
                                    { key: 'viewed', label: 'Viewed' },
                                    { key: 'locked', label: 'Locked Profiles' },
                                ].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.key), className: `px-4 py-2 font-medium border-b-2 transition ${activeTab === tab.key
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'}`, children: tab.label }, tab.key))) }), loading ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Loading profiles..." })] })) : filteredProfiles.length === 0 ? (_jsxs("div", { className: "text-center py-12 bg-gray-50 rounded-lg", children: [_jsx("p", { className: "text-gray-600 mb-4", children: "No profiles found with your filters" }), _jsx("button", { onClick: handleResetFilters, className: "text-purple-600 hover:text-purple-700 font-medium", children: "Clear all filters" })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Found ", filteredProfiles.length, " profile", filteredProfiles.length !== 1 ? 's' : ''] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: filteredProfiles.map((profile) => (_jsxs("div", { className: "bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden", children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: profile.image || 'https://via.placeholder.com/300x200', alt: profile.name, className: "w-full h-48 object-cover" }), !profile.isUnlocked && (_jsx("div", { className: "absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center", children: _jsx(Lock, { size: 32, className: "text-white" }) })), _jsx("button", { onClick: () => handleToggleShortlist(profile.id), className: `absolute top-4 right-4 p-2 rounded-full transition ${profile.isShortlisted
                                                                ? 'bg-red-500 text-white'
                                                                : 'bg-white text-gray-600 hover:bg-gray-100'}`, children: _jsx(Bookmark, { size: 20, className: profile.isShortlisted ? 'fill-current' : '' }) })] }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { children: [_jsxs("h3", { className: "font-semibold text-gray-900", children: [profile.name, ", ", profile.age] }), _jsx("p", { className: "text-xs text-gray-600", children: profile.location })] }), _jsxs("div", { className: "bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold", children: [profile.compatibilityScore, "% Match"] })] }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsx("span", { className: "inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs", children: profile.community }), _jsx("span", { className: "inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs", children: profile.maritalStatus })] }), _jsxs("div", { className: "text-sm text-gray-600 mb-3 space-y-1", children: [_jsxs("p", { children: [_jsx("strong", { children: "Education:" }), " ", profile.education] }), _jsxs("p", { children: [_jsx("strong", { children: "Profession:" }), " ", profile.occupation] }), _jsxs("p", { children: [_jsx("strong", { children: "Height:" }), " ", profile.height, " | ", _jsx("strong", { children: "Income:" }), ' ', profile.income] })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4 line-clamp-2", children: profile.bio }), profile.isViewed && (_jsxs("div", { className: "flex items-center gap-1 text-xs text-gray-500 mb-3", children: [_jsx(Eye, { size: 14 }), "Viewed"] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-purple-700 transition text-sm", children: "View Profile" }), !profile.isUnlocked && (_jsx("button", { onClick: () => handleUnlock(profile.id), className: "px-3 py-2 border border-purple-600 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition text-sm", children: "Unlock" }))] })] })] }, profile.id))) })] }))] })] })] }));
}
