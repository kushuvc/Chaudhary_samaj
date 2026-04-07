import { useState, useEffect } from 'react'
import matrimonyService, {
  MatrimonyProfile,
  MatrimonyFilter,
  MatrimonyFilterOptions,
  SavedFilter,
} from '../services/matrimony'
import { Lock, Search, Sliders, Bookmark, Eye } from 'lucide-react'

const defaultFilterOptions: MatrimonyFilterOptions = {
  locations: ['Delhi', 'Gurugram', 'Noida', 'Jaipur', 'Chandigarh'],
  genders: ['male', 'female'],
  communities: ['Chaudhary'],
  subCommunities: ['Jat', 'Gujjar', 'General'],
  educations: ['B.Tech', 'M.Tech', 'MBA', 'B.Com', 'M.Com', 'MBBS'],
  occupations: ['Software Engineer', 'Business Owner', 'Doctor', 'Teacher', 'Government Officer'],
  maritalStatuses: ['Never Married', 'Divorced', 'Widowed'],
  languages: ['Hindi', 'English', 'Punjabi', 'Haryanvi'],
  ageBounds: { min: 18, max: 60 },
}

export default function Matrimony() {
  const [filteredProfiles, setFilteredProfiles] = useState<MatrimonyProfile[]>([])
  const [filterOptions, setFilterOptions] = useState<MatrimonyFilterOptions>(defaultFilterOptions)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'shortlisted' | 'viewed' | 'locked'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'compatibility' | 'new' | 'nearby' | 'education'>('compatibility')
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)

  // Filter state
  const [filters, setFilters] = useState<MatrimonyFilter>({
    ageRange: [18, 50],
    location: '',
    gender: '',
    community: '',
    subCommunity: '',
    education: '',
    occupation: '',
    maritalStatus: '',
    language: '',
  })

  // Load initial data
  useEffect(() => {
    void Promise.all([loadSavedFilters(), loadFilterOptions()])
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [filters, searchQuery, sortBy, activeTab])

  const sortProfiles = (items: MatrimonyProfile[]) => {
    const sorted = [...items]

    if (sortBy === 'compatibility') {
      sorted.sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    } else if (sortBy === 'new') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy === 'education') {
      sorted.sort((a, b) => a.education.localeCompare(b.education))
    } else if (sortBy === 'nearby') {
      sorted.sort((a, b) => a.location.localeCompare(b.location))
    }

    return sorted
  }

  const loadProfiles = async () => {
    setLoading(true)
    try {
      const data = await matrimonyService.getProfiles({
        ...filters,
        searchQuery,
        statusTab: activeTab,
      })
      setFilteredProfiles(sortProfiles(data))
    } catch (error) {
      console.error('Error loading profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSavedFilters = async () => {
    try {
      const data = await matrimonyService.getSavedFilters()
      setSavedFilters(data)
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const data = await matrimonyService.getFilterOptions()
      setFilterOptions({
        ...defaultFilterOptions,
        ...data,
        locations: data.locations.length > 0 ? data.locations : defaultFilterOptions.locations,
        genders: data.genders.length > 0 ? data.genders : defaultFilterOptions.genders,
        communities: data.communities.length > 0 ? data.communities : defaultFilterOptions.communities,
        subCommunities:
          data.subCommunities.length > 0 ? data.subCommunities : defaultFilterOptions.subCommunities,
        educations: data.educations.length > 0 ? data.educations : defaultFilterOptions.educations,
        occupations: data.occupations.length > 0 ? data.occupations : defaultFilterOptions.occupations,
        maritalStatuses:
          data.maritalStatuses.length > 0
            ? data.maritalStatuses
            : defaultFilterOptions.maritalStatuses,
        languages: data.languages.length > 0 ? data.languages : defaultFilterOptions.languages,
      })
    } catch (error) {
      console.error('Error loading filter options:', error)
      setFilterOptions(defaultFilterOptions)
    }
  }

  const handleToggleShortlist = async (profileId: string) => {
    await matrimonyService.toggleShortlist(profileId)
    await matrimonyService.markAsViewed(profileId)
    loadProfiles()
  }

  const handleUnlock = async (profileId: string) => {
    // TODO: Integrate with payment system later
    await matrimonyService.unlockProfile(profileId)
    loadProfiles()
  }

  const handleApplySavedFilter = (filterId: string) => {
    const filter = savedFilters.find((f) => f.id === filterId)
    if (filter) {
      setFilters(filter.filters)
      setSelectedFilter(filterId)
    }
  }

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
    })
    setSearchQuery('')
    setSelectedFilter(null)
  }

  const ageMin = Math.min(filterOptions.ageBounds.min || 18, filters.ageRange?.[0] || 18)
  const ageMax = Math.max(filterOptions.ageBounds.max || 60, filters.ageRange?.[1] || 60)
  const ageOptions = Array.from({ length: ageMax - ageMin + 1 }, (_, index) => ageMin + index)

  const formatOptionLabel = (value: string) =>
    value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Matrimony</h1>
        <p className="text-gray-600">Find your perfect match with our compatibility filtering</p>
      </div>

      {/* Premium Banner */}
      <div className="mb-6 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Unlock Premium Features</h3>
            <p className="text-purple-100">Get unlimited profile views and direct messaging</p>
          </div>
          <button className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition">
            Upgrade Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow sticky top-20">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sliders size={18} />
                Filters
              </h3>
              <button
                onClick={handleResetFilters}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Reset
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Age Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age Range
                </label>
                <div className="flex gap-2">
                  <select
                    value={filters.ageRange?.[0] || 18}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        ageRange: [parseInt(e.target.value, 10), filters.ageRange?.[1] || ageMax],
                      })
                    }
                    className="w-1/2 px-2 py-2 border border-gray-300 rounded text-sm"
                  >
                    {ageOptions.map((age) => (
                      <option key={`age-min-${age}`} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.ageRange?.[1] || 50}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        ageRange: [filters.ageRange?.[0] || ageMin, parseInt(e.target.value, 10)],
                      })
                    }
                    className="w-1/2 px-2 py-2 border border-gray-300 rounded text-sm"
                  >
                    {ageOptions.map((age) => (
                      <option key={`age-max-${age}`} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <select
                  value={filters.location || ''}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Locations</option>
                  {filterOptions.locations.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <select
                  value={filters.gender || ''}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Genders</option>
                  {filterOptions.genders.map((option) => (
                    <option key={option} value={option}>
                      {formatOptionLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Community */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Community
                </label>
                <select
                  value={filters.community || ''}
                  onChange={(e) => setFilters({ ...filters, community: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Communities</option>
                  {filterOptions.communities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub Community */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Community
                </label>
                <select
                  value={filters.subCommunity || ''}
                  onChange={(e) => setFilters({ ...filters, subCommunity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Sub Communities</option>
                  {filterOptions.subCommunities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Education */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Education
                </label>
                <select
                  value={filters.education || ''}
                  onChange={(e) => setFilters({ ...filters, education: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Education Levels</option>
                  {filterOptions.educations.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Occupation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Occupation
                </label>
                <select
                  value={filters.occupation || ''}
                  onChange={(e) => setFilters({ ...filters, occupation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Occupations</option>
                  {filterOptions.occupations.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marital Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Marital Status
                </label>
                <select
                  value={filters.maritalStatus || ''}
                  onChange={(e) => setFilters({ ...filters, maritalStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Marital Status</option>
                  {filterOptions.maritalStatuses.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={filters.language || ''}
                  onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Languages</option>
                  {filterOptions.languages.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div className="border-t p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Saved Filters</h4>
                <div className="space-y-2">
                  {savedFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleApplySavedFilter(filter.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                        selectedFilter === filter.id
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search and Sort */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, location, or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="compatibility">Highest Compatibility</option>
              <option value="new">Newest Profiles</option>
              <option value="nearby">Nearby</option>
              <option value="education">By Education</option>
            </select>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-2 border-b">
            {[
              { key: 'all', label: 'All Matches' },
              { key: 'shortlisted', label: 'Shortlisted' },
              { key: 'viewed', label: 'Viewed' },
              { key: 'locked', label: 'Locked Profiles' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="mt-2 text-gray-600">Loading profiles...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-4">No profiles found with your filters</p>
              <button
                onClick={handleResetFilters}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Found {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''}
              </p>

              {/* Profile Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="relative">
                      <img
                        src={profile.image || 'https://via.placeholder.com/300x200'}
                        alt={profile.name}
                        className="w-full h-48 object-cover"
                      />
                      {!profile.isUnlocked && (
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                          <Lock size={32} className="text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => handleToggleShortlist(profile.id)}
                        className={`absolute top-4 right-4 p-2 rounded-full transition ${
                          profile.isShortlisted
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Bookmark
                          size={20}
                          className={profile.isShortlisted ? 'fill-current' : ''}
                        />
                      </button>
                    </div>

                    {/* Card Content */}
                    <div className="p-4">
                      {/* Name and Compatibility Score */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {profile.name}, {profile.age}
                          </h3>
                          <p className="text-xs text-gray-600">{profile.location}</p>
                        </div>
                        <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">
                          {profile.compatibilityScore}% Match
                        </div>
                      </div>

                      {/* Community and Status */}
                      <div className="flex gap-2 mb-3">
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                          {profile.community}
                        </span>
                        <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          {profile.maritalStatus}
                        </span>
                      </div>

                      {/* Profile Details */}
                      <div className="text-sm text-gray-600 mb-3 space-y-1">
                        <p>
                          <strong>Education:</strong> {profile.education}
                        </p>
                        <p>
                          <strong>Profession:</strong> {profile.occupation}
                        </p>
                        <p>
                          <strong>Height:</strong> {profile.height} | <strong>Income:</strong>{' '}
                          {profile.income}
                        </p>
                      </div>

                      {/* Bio */}
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{profile.bio}</p>

                      {/* Status Badge */}
                      {profile.isViewed && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                          <Eye size={14} />
                          Viewed
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-purple-700 transition text-sm">
                          View Profile
                        </button>
                        {!profile.isUnlocked && (
                          <button
                            onClick={() => handleUnlock(profile.id)}
                            className="px-3 py-2 border border-purple-600 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition text-sm"
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
