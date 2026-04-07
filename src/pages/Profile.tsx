import { useEffect, useMemo, useState } from 'react'
import { Award, Briefcase, Camera, Edit3, GraduationCap, Heart, Languages, MapPin, Phone, Ruler, Save, User, Wallet } from 'lucide-react'
import matrimonyService from '../services/matrimony'

interface FamilyMember {
  id: string
  name: string
  relation: string
  phone: string
}

const initialFamilyMembers: FamilyMember[] = [
  { id: 'fam-1', name: 'Ram Singh Chaudhary', relation: 'Father', phone: '+91 98765 43210' },
  { id: 'fam-2', name: 'Saraswati Devi', relation: 'Mother', phone: '+91 99887 77665' }
]

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoadingMatrimony, setIsLoadingMatrimony] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    occupation: '',
    education: '',
    bio: ''
  })
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
  })
  const [familyMembers] = useState<FamilyMember[]>(initialFamilyMembers)
  const [skills, setSkills] = useState(['Event Planning', 'Fundraising', 'Mentoring'])
  const [newSkill, setNewSkill] = useState('')

  useEffect(() => {
    const loadMemberProfile = async () => {
      try {
        const data = await matrimonyService.getMe()
        if (data) {
          setProfile({
            fullName: data.profile.fullName,
            email: data.profile.email,
            phone: data.profile.phone || '',
            location: data.profile.location,
            occupation: data.profile.occupation,
            education: data.profile.education,
            bio: data.profile.bio,
          })

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
          })
        }
      } catch (error) {
        console.error('Failed to load matrimony profile:', error)
      } finally {
        setIsLoadingMatrimony(false)
      }
    }

    void loadMemberProfile()
  }, [])

  const completionScore = useMemo(() => {
    const fields = [
      profile.fullName,
      profile.email,
      profile.phone,
      profile.location,
      profile.occupation,
      profile.education,
      profile.bio
    ]
    const filled = fields.filter((field) => field.trim().length > 0).length
    return Math.round((filled / fields.length) * 100)
  }, [profile])

  const matrimonyCompletionScore = useMemo(() => {
    const fields = Object.values(matrimonyProfile)
    const filled = fields.filter((field) => field.trim().length > 0).length
    return Math.round((filled / fields.length) * 100)
  }, [matrimonyProfile])

  const handleSave = async () => {
    setIsSaving(true)

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
      })

      if (updated) {
        setProfile({
          fullName: updated.profile.fullName,
          email: updated.profile.email,
          phone: updated.profile.phone || '',
          location: updated.profile.location,
          occupation: updated.profile.occupation,
          education: updated.profile.education,
          bio: updated.profile.bio,
        })
        setMatrimonyProfile(updated.matrimony)
      }
    } catch (error) {
      console.error('Failed to save matrimony profile:', error)
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const addSkill = () => {
    const value = newSkill.trim()
    if (!value || skills.includes(value)) return
    setSkills((prev) => [...prev, value])
    setNewSkill('')
  }

  const removeSkill = (value: string) => {
    setSkills((prev) => prev.filter((item) => item !== value))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
                  AC
                </div>
                <button className="absolute -bottom-2 -right-2 rounded-full bg-white p-2 shadow ring-1 ring-slate-200">
                  <Camera size={14} className="text-slate-700" />
                </button>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Profile</h1>
                <p className="text-sm text-slate-600">Manage personal details and community visibility settings.</p>
              </div>
            </div>
            <button
              onClick={isEditing ? () => void handleSave() : () => setIsEditing(true)}
              disabled={isSaving || isLoadingMatrimony}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
              {isSaving ? 'Saving...' : isEditing ? 'Save Profile' : 'Edit Profile'}
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <p className="font-medium text-slate-700">Profile Completion</p>
              <p className="font-bold text-emerald-700">{completionScore}%</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${completionScore}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Basic Information</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><User size={14} /> Full Name</span>
                <input
                  value={profile.fullName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, fullName: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Phone size={14} /> Phone</span>
                <input
                  value={profile.phone}
                  onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><MapPin size={14} /> Location</span>
                <input
                  value={profile.location}
                  onChange={(event) => setProfile((prev) => ({ ...prev, location: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Professional Information</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Briefcase size={14} /> Occupation</span>
                <input
                  value={profile.occupation}
                  onChange={(event) => setProfile((prev) => ({ ...prev, occupation: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><GraduationCap size={14} /> Education</span>
                <input
                  value={profile.education}
                  onChange={(event) => setProfile((prev) => ({ ...prev, education: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Bio</span>
                <textarea
                  rows={4}
                  value={profile.bio}
                  onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Family Contacts</h2>
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div key={member.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{member.name}</p>
                  <p className="text-sm text-slate-600">{member.relation}</p>
                  <p className="text-sm text-slate-700">{member.phone}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Community Skills</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => removeSkill(skill)}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700"
                >
                  <Award size={13} />
                  {skill}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(event) => setNewSkill(event.target.value)}
                placeholder="Add a skill"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400"
              />
              <button
                onClick={addSkill}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Matrimony Profile</h2>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              Profile Completion {matrimonyCompletionScore}%
            </span>
          </div>

          {isLoadingMatrimony ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Loading matrimony profile from the database...
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><User size={14} /> Age</span>
                <input
                  value={matrimonyProfile.age}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, age: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Heart size={14} /> Marital Status</span>
                <input
                  value={matrimonyProfile.maritalStatus}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, maritalStatus: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Ruler size={14} /> Height</span>
                <input
                  value={matrimonyProfile.height}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, height: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Wallet size={14} /> Income</span>
                <input
                  value={matrimonyProfile.income}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, income: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><Languages size={14} /> Languages</span>
                <input
                  value={matrimonyProfile.language}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, language: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 inline-flex items-center gap-1 font-medium text-slate-700"><MapPin size={14} /> Community</span>
                <input
                  value={matrimonyProfile.community}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, community: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Matrimony Bio</span>
                <textarea
                  rows={4}
                  value={matrimonyProfile.profileBio}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, profileBio: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Preferred Location</span>
                <input
                  value={matrimonyProfile.preferredLocation}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, preferredLocation: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Preferred Education</span>
                <input
                  value={matrimonyProfile.preferredEducation}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, preferredEducation: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Preferred Occupation</span>
                <input
                  value={matrimonyProfile.preferredOccupation}
                  onChange={(event) => setMatrimonyProfile((prev) => ({ ...prev, preferredOccupation: event.target.value }))}
                  disabled={!isEditing}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 disabled:bg-slate-50"
                />
              </label>

              <p className="rounded-xl border border-dashed border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Matrimony profile is now wired to the backend database and can sync with future verification flows later.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
