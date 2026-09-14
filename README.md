## Backend Deploy Quick Start (Render)

This repository now includes `render.yaml` for one-click Render setup.

### Required environment variable

Set `DATABASE_URL` in Render using this format for Supabase:

`postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?uselibpqcompat=true&sslmode=require`

For OTP delivery, set either `SMTP_SERVICE` plus `SMTP_USER` and `SMTP_PASS`, or the host-based SMTP vars `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.

### Render settings

- Build Command: `npm install`
- Start Command: `npm run server`
- Health Check Path: `/api/health`

### Verify after deploy

- `GET /api/health`
- `GET /api/community/posts`
- `GET /api/help-requests`

### Frontend API wiring

- Web app: set `VITE_API_URL` to your deployed API base, for example `https://chaudhary-samaj.onrender.com/api`.
- Mobile app: `apps/mobile/eas.json` already injects `EXPO_PUBLIC_API_BASE_URL` for EAS preview and production builds.
- Local web development can keep using the default same-origin `/api` proxy from `vite.config.ts`.

Use this prompt in Copilot:

Build a **frontend-only web app** for a **community platform** with a clean, modern UI and a modular structure so backend APIs can be added later.

## Tests

```bash
npm test
```

No setup: the runner starts a throwaway Postgres cluster (`embedded-postgres`),
gives every server instance its own database, and tears the whole thing down
afterwards. Nothing touches the real database, and no test can send an email or
reach a payment provider — those credentials are blanked for the child process.

Run one file with `node tests/run.mjs tests/auth.test.mjs`.

The suites boot a real server and drive it over HTTP rather than importing the
route handlers. The bugs worth catching here — auth bypass, the paywall, OTP
leaks — have all lived in the seam between route, middleware and database,
which a unit test on any one of those would have missed.

| File | Covers |
| --- | --- |
| `auth.test.mjs` | Session tokens, forged and expired JWTs, signup and login |
| `paywall.test.mjs` | The free allowance, locked profiles, subscription state |
| `security.test.mjs` | Admin gating, removed debug routes, payment endpoints |
| `otp.test.mjs` | Codes, throttling, and production fail-closed behaviour |
| `validation.test.mjs` | Injection attempts, pagination limits, privilege escalation |
| `contract.test.mjs` | Every endpoint the mobile app calls is still routed |
| `interests.test.mjs` | Interest and messaging flows |
| `unit.test.mjs` | Postgres TLS selection, email sender parsing |

## Goal

Create a scalable community app UI with these sections:

1. **Matrimony**
2. **Events**
3. **Help Center**
4. **Business / Marketing**
5. **Community / General Meeting**
6. **Future Features Ready Architecture**

Do **not** build backend logic yet. Use mock data, local state, and reusable components. Keep everything structured so API integration can be added later without rewriting the UI.

## Tech stack

* React + TypeScript
* Tailwind CSS
* React Router
* Component-based architecture
* Use mock JSON data for now
* Keep code clean, reusable, and production-style

## Main app structure

Create a dashboard layout with:

* Left sidebar navigation
* Top search bar
* Main content area
* Responsive mobile menu
* Cards, tables, filters, tabs, and modal drawers

---

# 1) Matrimony section

This is **not swipe-based**. It should work like a filtered compatibility list.

### Features

* Profile filters:

  * age range
  * location
  * religion/community
  * education
  * occupation
  * marital status
  * height
  * income
  * language
* Show a list of compatible profiles after filter selection
* Each profile card should have:

  * photo placeholder
  * name
  * age
  * location
  * community
  * profession
  * short bio
  * compatibility score
  * “View Profile” button
  * “Unlock Profile” button
* Unlock should be a frontend placeholder only
* Show locked details section with blurred cards or locked badge
* Add a premium banner for future paid unlocking/subscription
* Add tabs:

  * All Matches
  * Shortlisted
  * Viewed
  * Locked Profiles

### UI behavior

* Use search + filters
* Sorting options:

  * compatibility high to low
  * new profiles
  * nearby
  * education
* Add a saved filter panel
* Make it easy to later connect to subscription/payment backend

---

# 2) Events section

Create an event management UI for community events.

### Features

* Event list cards showing:

  * event title
  * date
  * location
  * organizer
  * guest count
  * money expected
  * money collected
  * status
* Event detail page/modal should show:

  * invited guests
  * RSVP status
  * manual contribution record
  * notes from host
  * total collected amount
  * remaining amount
* Since payment is **not integrated now**, create a **manual money tracking UI**
* The host can mark:

  * money received
  * amount received
  * date
  * payment mode like cash/UPI/manual
  * notes
* Add button:

  * Create Event
  * Invite Guests
  * Record Contribution
  * Export List UI button placeholder

### UI behavior

* Show guest table with columns:

  * guest name
  * RSVP
  * amount promised
  * amount received
  * balance
  * status
* Add filters:

  * upcoming
  * past
  * pending payment
  * fully collected

---

# 3) Help Center section

Create a community help posting system with 3 parts:

### Part A: Financial Help

* Post request title
* amount needed
* reason
* urgency
* location
* contact preference
* verification badge placeholder

### Part B: Medical Help

* medical category
* hospital/expense type
* amount needed
* urgency
* documents upload placeholder
* request status

### Part C: Other Help

Include:

* job search
* business promotion support
* housing help
* education help
* general assistance

### UI features

* Help cards with:

  * title
  * category
  * amount needed
  * collected / progress bar
  * urgency badge
  * time posted
* Tabs:

  * Financial
  * Medical
  * Jobs
  * Business
  * General
* Add a “Create Help Request” modal
* Add a “Support / Offer Help” button
* Add verification and moderation placeholders

---

# 4) Business / Marketing section

Create a section where users can promote their business.

### Features

* Business listing cards with:

  * business name
  * category
  * owner name
  * description
  * contact info
  * location
  * service tags
* Add business filters:

  * category
  * location
  * verified
  * trending
* Add a business profile page with:

  * banner
  * gallery placeholder
  * service list
  * reviews placeholder
  * contact buttons
* Add featured business cards
* Add a paid promotion banner placeholder for future monetization

### UI behavior

* Show:

  * promoted business
  * latest business posts
  * categories
  * ad slot placeholder
* Keep this module free for now, but structured for future payment/ads integration

---

# 5) Community / General Meeting section

Create a community feed for common announcements and meetings.

### Features

* Community posts like:

  * meeting announcement
  * community news
  * celebration post
  * general updates
* Post card should have:

  * title
  * author
  * date
  * category
  * likes/comments placeholders
* Add:

  * create post modal
  * category filter
  * pinned announcements
  * upcoming meeting card

---

# 6) Future-ready features

Build the frontend in a way that new sections can be added later easily.

### Add a modular system for future pages like:

* donations
* volunteer management
* chat
* notifications
* membership/subscription
* verified badges
* admin moderation
* analytics dashboard

### Important

* Use reusable components
* Keep data in separate mock files
* Use clean folder structure
* Prepare empty service files for future backend APIs
* Use dummy states for:

  * loading
  * empty list
  * no search result
  * locked content
  * premium upgrade prompt

---

# Pages to create

1. **Login / Signup**
2. **Dashboard**
3. **Matrimony**
4. **Events**
5. **Help Center**
6. **Business / Marketing**
7. **Community Feed**
8. **Profile**
9. **Notifications**
10. **Settings**
11. **Admin placeholder page**

---

# Design style

* Modern Indian community platform feel
* Trustworthy, clean, premium, and simple
* Rounded cards
* Soft shadows
* Responsive layout
* Strong typography
* Light and dark mode ready
* Nice empty states and subtle animations

---

# Step-by-step build order

1. Create app shell and routing
2. Build dashboard layout and sidebar
3. Build matrimony filter list UI
4. Build event module with manual guest money record UI
5. Build help center with 3 help categories
6. Build business marketing section
7. Build community feed and meeting posts
8. Add profile, notifications, and settings pages
9. Add reusable mock data and components
10. Add placeholders for future backend integration

---

# Output expectation

Generate the full frontend code with:

* working navigation
* reusable components
* mock data
* responsive layout
* polished UI
* no backend implementation yet

Make the code easy to extend later when backend comes.
