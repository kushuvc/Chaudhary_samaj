import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Building2,
  ExternalLink,
  Filter,
  ImagePlus,
  MapPin,
  Megaphone,
  Phone,
  Search,
  Sparkles,
  Star,
  Tags,
  TrendingUp,
  X
} from 'lucide-react'
import businessService, {
  BusinessCategory,
  BusinessListing,
  CreateBusinessListingPayload,
} from '../services/business'

type CategoryFilter = 'all' | BusinessCategory
type VerificationFilter = 'all' | 'verified' | 'unverified'
type TrendingFilter = 'all' | 'trending' | 'not_trending'

const categoryLabels: Record<BusinessCategory, string> = {
  food: 'Food',
  education: 'Education',
  healthcare: 'Healthcare',
  retail: 'Retail',
  professional: 'Professional',
  home_services: 'Home Services'
}

export default function Business() {
  const [businesses, setBusinesses] = useState<BusinessListing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [location, setLocation] = useState('all')
  const [verification, setVerification] = useState<VerificationFilter>('all')
  const [trending, setTrending] = useState<TrendingFilter>('all')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessListing | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [form, setForm] = useState<CreateBusinessListingPayload>({
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
  })

  useEffect(() => {
    void loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    setLoading(true)
    const response = await businessService.getBusinesses()
    if (response.success && response.data) {
      setBusinesses(response.data)
    }
    setLoading(false)
  }

  const updateForm = (key: keyof CreateBusinessListingPayload, value: string) => {
    if (key === 'serviceTags' || key === 'services' || key === 'gallery') {
      const list = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      setForm((prev) => ({ ...prev, [key]: list }))
      return
    }

    setForm((prev) => ({ ...prev, [key]: value }))
  }

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
    })
    setCreateError('')
  }

  const submitCreateListing = async () => {
    setCreateError('')
    setCreateBusy(true)

    const response = await businessService.createBusinessListing(form)
    setCreateBusy(false)

    if (!response.success || !response.data) {
      setCreateError(response.error || 'Unable to create listing')
      return
    }

    setShowCreateModal(false)
    resetCreateForm()
    await loadBusinesses()
  }

  const locations = useMemo(() => {
    return ['all', ...Array.from(new Set(businesses.map((item) => item.location))).sort()]
  }, [businesses])

  const featuredBusinesses = useMemo(() => businesses.filter((item) => item.featured), [businesses])
  const promotedBusinesses = useMemo(() => businesses.filter((item) => item.promoted), [businesses])

  const filteredBusinesses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return businesses
      .filter((item) => {
        const matchesSearch =
          term.length === 0 ||
          item.name.toLowerCase().includes(term) ||
          item.ownerName.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.serviceTags.some((tag) => tag.toLowerCase().includes(term))

        const matchesCategory = category === 'all' || item.category === category
        const matchesLocation = location === 'all' || item.location === location
        const matchesVerification =
          verification === 'all' ||
          (verification === 'verified' ? item.verified : !item.verified)
        const matchesTrending =
          trending === 'all' ||
          (trending === 'trending' ? item.trending : !item.trending)

        return (
          matchesSearch &&
          matchesCategory &&
          matchesLocation &&
          matchesVerification &&
          matchesTrending
        )
      })
      .sort((a, b) => {
        if (a.promoted !== b.promoted) return a.promoted ? -1 : 1
        if (a.trending !== b.trending) return a.trending ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [businesses, category, location, searchTerm, trending, verification])

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
        <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Marketplace lane</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">Business & Marketing</h1>
            <p className="mt-3 max-w-xl text-slate-600">Promote trusted community businesses with a premium discovery layout and future-ready monetization placeholders.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5"
          >
            <Building2 size={18} /> Add Business Listing
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-orange-700">
              <Megaphone size={18} />
              <p className="font-semibold">Paid Promotion Placeholder</p>
            </div>
            <p className="text-sm text-slate-700">Reserve premium ad slots for top visibility. Subscription and billing APIs can be connected here later.</p>
          </div>
          <div className="rounded-[1.6rem] border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sky-700">
              <TrendingUp size={18} />
              <p className="font-semibold">Trending Businesses</p>
            </div>
            <p className="text-sm text-slate-700">{businesses.filter((item) => item.trending).length} listings are trending this week.</p>
          </div>
        </div>

      </section>

        <div className="mb-8 grid gap-4 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Search business, owner, service"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-slate-400"
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
            <Filter size={16} className="text-slate-500" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
              className="w-full bg-transparent text-sm outline-none"
            >
              <option value="all">All Categories</option>
              {(Object.keys(categoryLabels) as BusinessCategory[]).map((key) => (
                <option key={key} value={key}>
                  {categoryLabels[key]}
                </option>
              ))}
            </select>
          </label>

          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
          >
            {locations.map((city) => (
              <option key={city} value={city}>
                {city === 'all' ? 'All Locations' : city}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={verification}
              onChange={(event) => setVerification(event.target.value as VerificationFilter)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
            <select
              value={trending}
              onChange={(event) => setTrending(event.target.value as TrendingFilter)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="all">Any Trend</option>
              <option value="trending">Trending</option>
              <option value="not_trending">Not Trending</option>
            </select>
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Featured Businesses</h2>
              <Sparkles size={16} className="text-amber-500" />
            </div>
            {featuredBusinesses.length === 0 ? (
              <p className="text-sm text-slate-500">No featured businesses yet.</p>
            ) : (
              <div className="space-y-3">
                {featuredBusinesses.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedBusiness(item)}
                    className="flex w-full items-start justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.location} • {categoryLabels[item.category]}</p>
                    </div>
                    <ExternalLink size={16} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Promoted Listings</h2>
              <Megaphone size={16} className="text-rose-500" />
            </div>
            {promotedBusinesses.length === 0 ? (
              <p className="text-sm text-slate-500">No promoted businesses right now.</p>
            ) : (
              <div className="space-y-3">
                {promotedBusinesses.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedBusiness(item)}
                    className="flex w-full items-start justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">Owned by {item.ownerName}</p>
                    </div>
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">Ad</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 grid gap-6 xl:grid-cols-[1fr_280px]">
          <div>
            {loading ? (
              <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading business listings...</div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-lg font-semibold text-slate-700">No businesses matched your filters</p>
                <p className="mt-1 text-sm text-slate-500">Post a listing to get started, or broaden your search filters.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredBusinesses.map((business) => (
                  <article key={business.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="h-36 w-full bg-slate-200">
                      {business.bannerImage ? (
                        <img src={business.bannerImage} alt={business.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <ImagePlus size={24} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {categoryLabels[business.category]}
                        </span>
                        {business.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <BadgeCheck size={12} /> Verified
                          </span>
                        )}
                        {business.trending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            <TrendingUp size={12} /> Trending
                          </span>
                        )}
                        {business.promoted && (
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Promoted</span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">{business.name}</h3>
                      <p className="text-sm text-slate-500">Owner: {business.ownerName}</p>

                      <p className="mt-2 text-sm text-slate-600">{business.description}</p>

                      <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} /> {business.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Star size={14} className="text-amber-500" /> {business.rating ?? 'N/A'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {business.serviceTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => setSelectedBusiness(business)}
                          className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          View Business
                        </button>
                        <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                          Contact
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Categories</h3>
              <div className="space-y-2">
                {(Object.keys(categoryLabels) as BusinessCategory[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>{categoryLabels[key]}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {businesses.filter((item) => item.category === key).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Ad Slot Placeholder</h3>
              <p className="text-sm text-slate-500">Future banner campaign inventory and impression analytics can be rendered here.</p>
            </div>
          </aside>
        </div>

      {selectedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="relative h-56 bg-slate-100">
              {selectedBusiness.bannerImage ? (
                <img src={selectedBusiness.bannerImage} alt={selectedBusiness.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <ImagePlus size={28} />
                </div>
              )}
              <button
                onClick={() => setSelectedBusiness(null)}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 shadow-sm transition hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedBusiness.name}</h2>
                  <p className="mt-1 text-slate-600">Owned by {selectedBusiness.ownerName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedBusiness.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck size={12} /> Verified
                    </span>
                  )}
                  {selectedBusiness.promoted && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Promoted</span>
                  )}
                </div>
              </div>

              <p className="mb-5 text-slate-700">{selectedBusiness.description}</p>

              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                    <MapPin size={14} /> {selectedBusiness.location}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                    <Phone size={14} /> {selectedBusiness.contactPhone}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Reviews Placeholder</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
                    <Star size={14} className="text-amber-500" /> {selectedBusiness.rating ?? 'N/A'} ({selectedBusiness.reviewCount ?? 0})
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Service List</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedBusiness.services.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      <Tags size={12} /> {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Gallery Placeholder</h3>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {selectedBusiness.gallery.slice(0, 3).map((image) => (
                    <img key={image} src={image} alt="Business gallery" className="h-28 w-full rounded-xl object-cover" />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Call Business
                </button>
                <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Send Message
                </button>
                <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Share Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Post New Business Listing</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetCreateForm()
                }}
                className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Business Name"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                value={form.ownerName}
                onChange={(event) => updateForm('ownerName', event.target.value)}
                placeholder="Owner Name"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as BusinessCategory }))}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              >
                {(Object.keys(categoryLabels) as BusinessCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {categoryLabels[key]}
                  </option>
                ))}
              </select>
              <input
                value={form.location}
                onChange={(event) => updateForm('location', event.target.value)}
                placeholder="Location"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                value={form.contactPhone}
                onChange={(event) => updateForm('contactPhone', event.target.value)}
                placeholder="Contact Phone"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                value={form.contactEmail || ''}
                onChange={(event) => updateForm('contactEmail', event.target.value)}
                placeholder="Contact Email (optional)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={3}
                placeholder="Business Description"
                className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                onChange={(event) => updateForm('serviceTags', event.target.value)}
                placeholder="Service Tags (comma separated)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                onChange={(event) => updateForm('services', event.target.value)}
                placeholder="Services (comma separated)"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                value={form.bannerImage || ''}
                onChange={(event) => updateForm('bannerImage', event.target.value)}
                placeholder="Banner Image URL (optional)"
                className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
              <input
                onChange={(event) => updateForm('gallery', event.target.value)}
                placeholder="Gallery URLs (comma separated, optional)"
                className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
              />
            </div>

            {createError && (
              <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{createError}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetCreateForm()
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={createBusy}
                onClick={() => void submitCreateListing()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createBusy ? 'Posting...' : 'Post Listing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
