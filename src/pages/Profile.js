import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Award, Briefcase, Camera, Edit3, GraduationCap, Heart, Languages, MapPin, Phone, Ruler, Save, User, Wallet } from 'lucide-react';
import matrimonyService from '../services/matrimony';
const initialFamilyMembers = [
    { id: 'fam-1', name: 'Ram Singh Chaudhary', relation: 'Father', phone: '+91 98765 43210' },
    { id: 'fam-2', name: 'Saraswati Devi', relation: 'Mother', phone: '+91 99887 77665' }
];
export default function Profile() {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoadingMatrimony, setIsLoadingMatrimony] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState({
        fullName: '',
        email: '',
        phone: '',
        location: '',
        occupation: '',
        education: '',
        bio: ''
    });
    const [matrimonyProfile, setMatrimonyProfile] = useState({
        age: '',
        maritalStatus: '',
        height: '',
        income: '',
        community: '',
        language: '',
        profileBio: '',
        preferredLocation: '',
        preferredEducation: '',
        preferredOccupation: ''
    });
    const [familyMembers] = useState(initialFamilyMembers);
    const [skills, setSkills] = useState(['Event Planning', 'Fundraising', 'Mentoring']);
    const [newSkill, setNewSkill] = useState('');
    useEffect(() => {
        const loadMemberProfile = async () => {
            try {
                const data = await matrimonyService.getMe();
                if (data) {
                    setProfile({
                        fullName: data.profile.fullName,
                        email: data.profile.email,
                        phone: data.profile.phone || '',
                        location: data.profile.location,
                        occupation: data.profile.occupation,
                        education: data.profile.education,
                        bio: data.profile.bio,
                    });
                    setMatrimonyProfile({
                        age: data.matrimony.age,
                        maritalStatus: data.matrimony.maritalStatus,
                        height: data.matrimony.height,
                        income: data.matrimony.income,
                        community: data.matrimony.community,
                        language: data.matrimony.language,
                        profileBio: data.matrimony.profileBio,
                        preferredLocation: data.matrimony.preferredLocation,
                        preferredEducation: data.matrimony.preferredEducation,
                        preferredOccupation: data.matrimony.preferredOccupation,
                    });
                }
            }
            catch (error) {
                console.error('Failed to load matrimony profile:', error);
            }
            finally {
                setIsLoadingMatrimony(false);
            }
        };
        void loadMemberProfile();
    }, []);
    const completionScore = useMemo(() => {
        const fields = [
            profile.fullName,
            profile.email,
            profile.phone,
            profile.location,
            profile.occupation,
            profile.education,
            profile.bio
        ];
        const filled = fields.filter((field) => field.trim().length > 0).length;
        return Math.round((filled / fields.length) * 100);
    }, [profile]);
    const matrimonyCompletionScore = useMemo(() => {
        const fields = Object.values(matrimonyProfile);
        const filled = fields.filter((field) => field.trim().length > 0).length;
        return Math.round((filled / fields.length) * 100);
    }, [matrimonyProfile]);
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await matrimonyService.updateMe({
                user: {
                    id: 'user-1',
                    fullName: profile.fullName,
                    email: profile.email,
                    phone: profile.phone,
                },
                profile: {
                    fullName: profile.fullName,
                    email: profile.email,
                    phone: profile.phone,
                    location: profile.location,
                    occupation: profile.occupation,
                    education: profile.education,
                    bio: profile.bio,
                },
                matrimony: {
                    ...matrimonyProfile,
                },
            });
            if (updated) {
                setProfile({
                    fullName: updated.profile.fullName,
                    email: updated.profile.email,
                    phone: updated.profile.phone || '',
                    location: updated.profile.location,
                    occupation: updated.profile.occupation,
                    education: updated.profile.education,
                    bio: updated.profile.bio,
                });
                setMatrimonyProfile(updated.matrimony);
            }
        }
        catch (error) {
            console.error('Failed to save matrimony profile:', error);
        }
        finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };
    const addSkill = () => {
        const value = newSkill.trim();
        if (!value || skills.includes(value))
            return;
        setSkills((prev) => [...prev, value]);
        setNewSkill('');
    };
    const removeSkill = (value) => {
        setSkills((prev) => prev.filter((item) => item !== value));
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50 p-4 md:p-6", children: _jsxs("div", { className: "mx-auto max-w-6xl space-y-6", children: [_jsxs("div", { className: "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm", children: [_jsxs("div", { className: "flex flex-col gap-5 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white", children: "AC" }), _jsx("button", { className: "absolute -bottom-2 -right-2 rounded-full bg-white p-2 shadow ring-1 ring-slate-200", children: _jsx(Camera, { size: 14, className: "text-slate-700" }) })] }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight text-slate-900", children: "My Profile" }), _jsx("p", { className: "text-sm text-slate-600", children: "Manage personal details and community visibility settings." })] })] }), _jsxs("button", { onClick: isEditing ? () => void handleSave() : () => setIsEditing(true), disabled: isSaving || isLoadingMatrimony, className: "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800", children: [isEditing ? _jsx(Save, { size: 16 }) : _jsx(Edit3, { size: 16 }), isSaving ? 'Saving...' : isEditing ? 'Save Profile' : 'Edit Profile'] })] }), _jsxs("div", { className: "mt-5 rounded-2xl bg-slate-50 p-4", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between text-sm", children: [_jsx("p", { className: "font-medium text-slate-700", children: "Profile Completion" }), _jsxs("p", { className: "font-bold text-emerald-700", children: [completionScore, "%"] })] }), _jsx("div", { className: "h-2.5 overflow-hidden rounded-full bg-slate-200", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500", style: { width: `${completionScore}%` } }) })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsx("h2", { className: "mb-4 text-lg font-bold text-slate-900", children: "Basic Information" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(User, { size: 14 }), " Full Name"] }), _jsx("input", { value: profile.fullName, onChange: (event) => setProfile((prev) => ({ ...prev, fullName: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Phone, { size: 14 }), " Phone"] }), _jsx("input", { value: profile.phone, onChange: (event) => setProfile((prev) => ({ ...prev, phone: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(MapPin, { size: 14 }), " Location"] }), _jsx("input", { value: profile.location, onChange: (event) => setProfile((prev) => ({ ...prev, location: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] })] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsx("h2", { className: "mb-4 text-lg font-bold text-slate-900", children: "Professional Information" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Briefcase, { size: 14 }), " Occupation"] }), _jsx("input", { value: profile.occupation, onChange: (event) => setProfile((prev) => ({ ...prev, occupation: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(GraduationCap, { size: 14 }), " Education"] }), _jsx("input", { value: profile.education, onChange: (event) => setProfile((prev) => ({ ...prev, education: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Bio" }), _jsx("textarea", { rows: 4, value: profile.bio, onChange: (event) => setProfile((prev) => ({ ...prev, bio: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] })] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsx("h2", { className: "mb-4 text-lg font-bold text-slate-900", children: "Family Contacts" }), _jsx("div", { className: "space-y-3", children: familyMembers.map((member) => (_jsxs("div", { className: "rounded-xl border border-slate-200 p-3", children: [_jsx("p", { className: "font-semibold text-slate-900", children: member.name }), _jsx("p", { className: "text-sm text-slate-600", children: member.relation }), _jsx("p", { className: "text-sm text-slate-700", children: member.phone })] }, member.id))) })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsx("h2", { className: "mb-4 text-lg font-bold text-slate-900", children: "Community Skills" }), _jsx("div", { className: "mb-3 flex flex-wrap gap-2", children: skills.map((skill) => (_jsxs("button", { onClick: () => removeSkill(skill), className: "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700", children: [_jsx(Award, { size: 13 }), skill] }, skill))) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { value: newSkill, onChange: (event) => setNewSkill(event.target.value), placeholder: "Add a skill", className: "flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400" }), _jsx("button", { onClick: addSkill, className: "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800", children: "Add" })] })] })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "mb-4 flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "text-lg font-bold text-slate-900", children: "Matrimony Profile" }), _jsxs("span", { className: "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700", children: ["Profile Completion ", matrimonyCompletionScore, "%"] })] }), isLoadingMatrimony ? (_jsx("div", { className: "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600", children: "Loading matrimony profile from the database..." })) : null, _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(User, { size: 14 }), " Age"] }), _jsx("input", { value: matrimonyProfile.age, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, age: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Heart, { size: 14 }), " Marital Status"] }), _jsx("input", { value: matrimonyProfile.maritalStatus, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, maritalStatus: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Ruler, { size: 14 }), " Height"] }), _jsx("input", { value: matrimonyProfile.height, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, height: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Wallet, { size: 14 }), " Income"] }), _jsx("input", { value: matrimonyProfile.income, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, income: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(Languages, { size: 14 }), " Languages"] }), _jsx("input", { value: matrimonyProfile.language, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, language: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsxs("span", { className: "mb-1 inline-flex items-center gap-1 font-medium text-slate-700", children: [_jsx(MapPin, { size: 14 }), " Community"] }), _jsx("input", { value: matrimonyProfile.community, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, community: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Matrimony Bio" }), _jsx("textarea", { rows: 4, value: matrimonyProfile.profileBio, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, profileBio: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Preferred Location" }), _jsx("input", { value: matrimonyProfile.preferredLocation, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, preferredLocation: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Preferred Education" }), _jsx("input", { value: matrimonyProfile.preferredEducation, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, preferredEducation: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsxs("label", { className: "block text-sm", children: [_jsx("span", { className: "mb-1 block font-medium text-slate-700", children: "Preferred Occupation" }), _jsx("input", { value: matrimonyProfile.preferredOccupation, onChange: (event) => setMatrimonyProfile((prev) => ({ ...prev, preferredOccupation: event.target.value })), disabled: !isEditing, className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50" })] }), _jsx("p", { className: "rounded-xl border border-dashed border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700", children: "Matrimony profile is now wired to the backend database and can sync with future verification flows later." })] })] })] })] }) }));
}
