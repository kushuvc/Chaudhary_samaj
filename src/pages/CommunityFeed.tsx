import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  CalendarDays,
  Clock3,
  MapPin,
  Megaphone,
  MessageCircle,
  Pin,
  Plus,
  Search,
  ThumbsUp,
  X,
} from 'lucide-react'
import authService from '../services/auth'
import communityFeedService, {
  CommunityPost,
  CommunityPostCategory,
  UpcomingMeeting,
} from '../services/communityFeed'

type PostTab = 'all' | CommunityPostCategory

const tabConfig: Array<{ id: PostTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'achievement', label: 'Achievements' },
  { id: 'lost_found', label: 'Lost & Found' },
  { id: 'news', label: 'News' },
  { id: 'celebration', label: 'Celebrations' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'update', label: 'Updates' },
]

const categoryStyle: Record<CommunityPostCategory, string> = {
  meeting: 'bg-indigo-100 text-indigo-700',
  news: 'bg-sky-100 text-sky-700',
  celebration: 'bg-amber-100 text-amber-700',
  update: 'bg-slate-100 text-slate-700',
  achievement: 'bg-emerald-100 text-emerald-700',
  lost_found: 'bg-rose-100 text-rose-700',
  announcement: 'bg-violet-100 text-violet-700',
}

const defaultPostForm = {
  title: '',
  content: '',
  category: 'update' as CommunityPostCategory,
  author: '',
}

const defaultMeetingForm = {
  title: '',
  meetingDate: '',
  location: '',
  host: '',
  agenda: '',
}

export default function CommunityFeed() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<PostTab>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'latest' | 'most_liked'>('latest')
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false)
  const [postForm, setPostForm] = useState(defaultPostForm)
  const [meetingForm, setMeetingForm] = useState(defaultMeetingForm)
  const [feedStats, setFeedStats] = useState<{ totalPosts: number; pinnedPosts: number; upcomingMeetings: number }>({
    totalPosts: 0,
    pinnedPosts: 0,
    upcomingMeetings: 0,
  })

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    const [postsResponse, meetingsResponse, statsResponse] = await Promise.all([
      communityFeedService.getPosts(),
      communityFeedService.getUpcomingMeetings(),
      communityFeedService.getStats(),
    ])

    if (postsResponse.success && postsResponse.data) {
      setPosts(postsResponse.data)
    } else {
      setPosts([])
    }

    if (meetingsResponse.success && meetingsResponse.data) {
      setMeetings(meetingsResponse.data)
    } else {
      setMeetings([])
    }

    if (statsResponse.success && statsResponse.data) {
      setFeedStats({
        totalPosts: statsResponse.data.totalPosts || 0,
        pinnedPosts: statsResponse.data.pinnedPosts || 0,
        upcomingMeetings: statsResponse.data.upcomingMeetings || 0,
      })
    }

    setLoading(false)
  }

  const postCountByTab = useMemo(() => {
    return posts.reduce<Record<PostTab, number>>(
      (acc, post) => {
        acc.all += 1
        acc[post.category] += 1
        return acc
      },
      {
        all: 0,
        meeting: 0,
        news: 0,
        celebration: 0,
        update: 0,
        achievement: 0,
        lost_found: 0,
        announcement: 0,
      }
    )
  }, [posts])

  const pinnedPosts = useMemo(() => posts.filter((post) => post.pinned), [posts])

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return posts
      .filter((post) => {
        const matchesTab = activeTab === 'all' || post.category === activeTab
        const matchesSearch =
          term.length === 0 ||
          post.title.toLowerCase().includes(term) ||
          post.content.toLowerCase().includes(term) ||
          post.author.toLowerCase().includes(term)

        return matchesTab && matchesSearch
      })
      .sort((a, b) => {
        if (sortBy === 'most_liked') {
          return b.likes - a.likes
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [activeTab, posts, searchTerm, sortBy])

  const achievementPosts = useMemo(
    () => posts.filter((post) => post.category === 'achievement').slice(0, 3),
    [posts]
  )
  const missingPosts = useMemo(() => posts.filter((post) => post.category === 'lost_found').slice(0, 3), [posts])

  const handleCreatePost = async () => {
    if (!postForm.title.trim() || !postForm.content.trim()) {
      window.alert('Please add title and content for the post')
      return
    }

    const currentUser = authService.getCurrentUser()

    const response = await communityFeedService.createPost({
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      category: postForm.category,
      author: postForm.author.trim() || currentUser?.fullName || 'Community Member',
    })

    if (!response.success) {
      window.alert(response.error || 'Unable to create post')
      return
    }

    await loadData()
    setShowCreatePostModal(false)
    setPostForm(defaultPostForm)
  }

  const handleCreateMeeting = async () => {
    if (
      !meetingForm.title.trim() ||
      !meetingForm.meetingDate.trim() ||
      !meetingForm.location.trim() ||
      !meetingForm.host.trim() ||
      !meetingForm.agenda.trim()
    ) {
      window.alert('Please fill all meeting fields')
      return
    }

    const response = await communityFeedService.createMeeting({
      title: meetingForm.title.trim(),
      meetingDate: meetingForm.meetingDate,
      location: meetingForm.location.trim(),
      host: meetingForm.host.trim(),
      agenda: meetingForm.agenda.trim(),
    })

    if (!response.success) {
      window.alert(response.error || 'Unable to create meeting')
      return
    }

    await loadData()
    setShowCreateMeetingModal(false)
    setMeetingForm(defaultMeetingForm)
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
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Social lane</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">Community Feed</h1>
            <p className="mt-3 max-w-xl text-slate-600">Live announcements, achievements, lost-and-found posts, and upcoming meetings presented in a cleaner discovery flow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateMeetingModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <CalendarDays size={18} /> Add Meeting
            </button>
            <button
              onClick={() => setShowCreatePostModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5"
            >
              <Plus size={18} /> Create Post
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.6rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-5 shadow-sm">
            <p className="text-sm text-indigo-700">Total Posts</p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">{feedStats.totalPosts}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 shadow-sm">
            <p className="text-sm text-emerald-700">Pinned Announcements</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{feedStats.pinnedPosts}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-rose-50 p-5 shadow-sm">
            <p className="text-sm text-amber-700">Upcoming Meetings</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{feedStats.upcomingMeetings}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({postCountByTab[tab.id] || 0})
            </button>
          ))}
        </div>

        <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
              placeholder="Search posts by title, content, or author"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-slate-400"
            />
          </div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as 'latest' | 'most_liked')}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
          >
            <option value="latest">Latest</option>
            <option value="most_liked">Most Liked</option>
          </select>
        </div>

      </section>

        <div className="mb-8 grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Pinned</h2>
                <Pin size={16} className="text-rose-500" />
              </div>

              {pinnedPosts.length === 0 ? (
                <p className="text-sm text-slate-500">No pinned posts available yet.</p>
              ) : (
                <div className="space-y-3">
                  {pinnedPosts.map((post) => (
                    <article key={post.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle[post.category]}`}>
                          {post.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <Pin size={12} /> Pinned
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{post.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{post.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              {loading ? (
                <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">Loading community posts...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <p className="text-lg font-semibold text-slate-700">No real posts found yet</p>
                  <p className="mt-1 text-sm text-slate-500">Create the first post or meeting to start this feed.</p>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle[post.category]}`}>
                        {post.category}
                      </span>
                      {post.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <Pin size={12} /> Pinned
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-slate-900">{post.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{post.content}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span>
                        By <span className="font-semibold text-slate-900">{post.author}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={14} /> {formatTimeAgo(post.createdAt)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                        <ThumbsUp size={14} /> {post.likes} likes
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                        <MessageCircle size={14} /> {post.comments} comments
                      </span>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Upcoming Meetings</h3>
              {meetings.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming meetings.</p>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <article key={meeting.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-900">{meeting.title}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                        <CalendarDays size={12} /> {new Date(meeting.meetingDate).toLocaleString('en-IN')}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                        <MapPin size={12} /> {meeting.location}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        Host: <span className="font-semibold text-slate-800">{meeting.host}</span>
                      </p>
                      <p className="mt-2 text-xs text-slate-500">Agenda: {meeting.agenda}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Achievements</h3>
              {achievementPosts.length === 0 ? (
                <p className="text-sm text-slate-500">No achievements posted yet.</p>
              ) : (
                <div className="space-y-2">
                  {achievementPosts.map((post) => (
                    <p key={post.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <Award size={14} className="mr-1 inline" /> {post.title}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Lost And Found Alerts</h3>
              {missingPosts.length === 0 ? (
                <p className="text-sm text-slate-500">No active alerts.</p>
              ) : (
                <div className="space-y-2">
                  {missingPosts.map((post) => (
                    <p key={post.id} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      <AlertTriangle size={14} className="mr-1 inline" /> {post.title}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800">
                <Megaphone size={14} /> Real data only
              </p>
              <p className="mt-1 text-sm text-indigo-700">This feed now reads directly from database records. No mock posts are shown.</p>
            </div>
          </aside>
        </div>

      {showCreatePostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold text-slate-900">Create Community Post</h2>
              <button onClick={() => setShowCreatePostModal(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Title *</label>
                <input
                  value={postForm.title}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
                  type="text"
                  placeholder="Enter a clear post title"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Category *</label>
                  <select
                    value={postForm.category}
                    onChange={(event) =>
                      setPostForm((prev) => ({
                        ...prev,
                        category: event.target.value as CommunityPostCategory,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                  >
                    <option value="meeting">Meeting Announcement</option>
                    <option value="achievement">Achievement</option>
                    <option value="lost_found">Lost And Found</option>
                    <option value="news">Community News</option>
                    <option value="celebration">Celebration</option>
                    <option value="announcement">Announcement</option>
                    <option value="update">General Update</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Author</label>
                  <input
                    value={postForm.author}
                    onChange={(event) => setPostForm((prev) => ({ ...prev, author: event.target.value }))}
                    type="text"
                    placeholder="Optional, defaults to your name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Post Content *</label>
                <textarea
                  value={postForm.content}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, content: event.target.value }))}
                  rows={5}
                  placeholder="Write announcement, achievement details, or lost-person alert"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreatePostModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button onClick={() => void handleCreatePost()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Publish Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold text-slate-900">Add Community Meeting</h2>
              <button onClick={() => setShowCreateMeetingModal(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Meeting Title *</label>
                <input
                  value={meetingForm.title}
                  onChange={(event) => setMeetingForm((prev) => ({ ...prev, title: event.target.value }))}
                  type="text"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Date And Time *</label>
                  <input
                    value={meetingForm.meetingDate}
                    onChange={(event) => setMeetingForm((prev) => ({ ...prev, meetingDate: event.target.value }))}
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Host *</label>
                  <input
                    value={meetingForm.host}
                    onChange={(event) => setMeetingForm((prev) => ({ ...prev, host: event.target.value }))}
                    type="text"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Location *</label>
                <input
                  value={meetingForm.location}
                  onChange={(event) => setMeetingForm((prev) => ({ ...prev, location: event.target.value }))}
                  type="text"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Agenda *</label>
                <textarea
                  value={meetingForm.agenda}
                  onChange={(event) => setMeetingForm((prev) => ({ ...prev, agenda: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateMeetingModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button onClick={() => void handleCreateMeeting()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Save Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
