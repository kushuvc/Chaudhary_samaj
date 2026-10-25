# Chaudhary Samaj — project guide for Claude

A matrimony app for the Chaudhary Samaj community in India. The shipped product
is the **Android app** (Google Play, package `com.chaudharysamaj.mobile`) backed
by a Node/Express API on Render with Postgres on Supabase. Operator: Kush Vijay
Chaudhary, Bhavnagar, Gujarat. Support: support@chaudharysamaj.com.

Working branch: `mobile-app-postgres` (pushed to `origin`, github.com/kushuvc/Chaudhary_samaj).
`main` is the default branch — check which branch Render deploys before saying
a server change is live.

Release checklist and manual test list: [TESTING.md](TESTING.md).

## Repository map

| Path | What it is |
| --- | --- |
| `server/index.js` | The whole API (Express, ~6k lines): auth, matrimony, payments, admin, verification. Routes are inline. |
| `server/fast-queries.js` | Postgres read paths with their own small cache (`invalidateFastCache`). Profile listing/detail map rows via `mapPublicProfile`. |
| `server/migrate.js` | Schema changes. Append idempotent SQL to the `migrations` array (keep the RLS loop last). Runs on every `npm run server`. |
| `server/aadhaar-qr.js` | Aadhaar Secure QR decode + UIDAI signature check + name/DOB/gender matching. |
| `server/certs/aadhaar/` | UIDAI public certificates (from uidai.gov.in "Data and Downloads"). |
| `server/play-billing.js` | Google Play subscription verification (subscriptionsv2) and acknowledgement. |
| `server/support.js`, `support/gmail-forwarder.gs`, `server/help-page.js` | Support tickets: support@ → Namecheap forward → operator's Gmail → free Apps Script (`support/gmail-forwarder.gs`, every 5 min) → `POST /api/support/inbound?token=SUPPORT_INBOUND_TOKEN` → ticket CS-1001… with an auto-acknowledgement (member's language, or en+hi+gu) that links `/help?lang=` (public page: common questions in `help-page.js` + active `app_guide_sections`). Threading by `#CS-n` in the subject (only from the ticket's own address); quoted text trimmed; no auto-reply to automated mail or our own domains; one ticket (and one ack) per sender per IST day — more mail that day joins today's ticket quietly — and 60 acks in all (`SUPPORT_AUTO_REPLY_DAILY_MAX`); admin notice once per sender per day, 20 in all (`SUPPORT_ADMIN_NOTICE_DAILY_MAX`) — Brevo's 300/day is shared with login codes. "Block sender" (address or a non-public domain) in the ticket view drops their future mail (`support_blocked_senders`); Gmail blocking does not help because the forwarder reads Spam. Admin → Support tab: thread, member info, reply from support@ (`SUPPORT_FROM`, `SUPPORT_REPLY_TO`), close/reopen, copy-the-script card. Brevo inbound parsing was not used: it appears to need Brevo's Professional plan. |
| `server/admin-alerts.js` | Hourly check that emails admins (Brevo) once per milestone: members 25/50/100/250…, paying 5/10/15/25…, buyers of each plan 10/25/50/100/250… (from `plan_purchases`, one row per paid order, distinct buyers; at 100 yearly buyers the email reminds to hide or reprice yearly before view limits), database or photo storage 70%/90% of `DB_LIMIT_MB`/`STORAGE_LIMIT_MB` (default free plan 500/1024; set 8192/102400 after Supabase Pro). Sent keys in `admin_alerts_sent`; recipients = `ADMIN_ALERT_EMAIL` or all admins. Overview → "Email me a summary now". `ADMIN_ALERTS=off` disables. Photo egress is not measurable here. |
| `server/push.js`, `email.js`, `sms.js` | Expo push, Brevo email OTP, MSG91 SMS (unconfigured on purpose). |
| `server/guide-defaults.js` | In-app guide sections, seeded once into `app_guide_sections`. |
| `server/db.js` | Legacy SQLite fallback paths; production uses Postgres (`pgQuery`). |
| `site/` | Static pages served by the API: `admin.html` (the real admin panel at `/admin`), `terms.html`, `privacy-policy.html`, `child-safety.html`, `delete-account.html`, `index.html`. |
| `apps/mobile/` | Expo SDK 54 / React Native app. Screens in `src/screens`, API client `src/services/api.ts`, strings `src/context/LanguageContext.tsx`. |
| `packages/shared-types` | Types shared with the app (`MatrimonyProfile`, etc.). |
| `tests/` | Integration tests (see Testing). |
| `src/`, `admin-dashboard/` | Older web app and older admin UI. Not the shipped product; leave alone unless asked. |

## How the app works

- **Tabs:** Home, Matrimony, Interests, Messages, Plans, Profile, Settings. Root stack also has Notifications and Verification screens.
- **Signup** (`navigation/AppNavigator.tsx` AuthFlow): profile type → basic details (email code required) → personal → religious → location → professional → additional (account is created here) → photos → **Aadhaar verify (skippable)** → horoscope → star → eating habits → interests.
- **Email typos:** signup refuses a misspelt provider (`gamil.com`, `gmail.con`, `yaho.com`…) with "Did you mean …@gmail.com?" and a one-tap fix — app `src/utils/emailTypo.ts`, server `server/email-typo.js` (`EMAIL_TYPO`, signup only; login untouched). Keep the two copies in step; `tests/email-typo.test.mjs` compares them.
- **Login:** email + password, or emailed code. Phone login exists but returns 503 in production (no SMS provider — see Decisions).
- **Listing:** server returns only the opposite gender, hides blocked members both ways. Free members see a limited number of profiles (`subscription_rules` per gender: free/paid, price, free_profile_limit; women free by default). Locked profiles arrive as `{ id, isLocked }` only.
- **Pricing (live, 24 Oct 2026):** both genders get 2 free profiles (`subscription_rules`: `is_free=false`, `free_profile_limit=2`); active plans Monthly ₹199, Quarterly ₹500, Yearly ₹1,500. Free members never download other members' photos beyond those 2 (locked profiles carry no photo), so photo bandwidth scales with paying members.
- **Daily profile views (built Oct 2026, OFF until ~500 members):** `subscription_plans.daily_profile_views` (NULL = unlimited, every plan today). Admin → Plans → "Profile views per day". Enforced only in `GET /api/matrimony/profiles/:id` for members on a plan (not free-for-gender, not free members — they have `free_profile_limit`): new profiles past the cap per IST day get 403 `DAILY_VIEW_LIMIT`; re-opening a profile the same day and people with an interest stay open; counts in `profile_daily_views` (pruned after 7 days). The listing cards are not counted. App shows "{n} full profiles a day" in the plan perks and a translated limit message. Don't take it from current subscribers mid-term: change the Play listing/plan text first and announce it.
- **Plans:** admin-editable in `subscription_plans` (code, duration, price, `play_product_id`, capabilities like contact numbers / hiding own number). Sold only through Google Play Billing (`expo-iap`, `services/playBilling.ts`). Server verifies every purchase token with Google and acknowledges it. Razorpay code exists for a future web checkout only.
- **Interests → match → chat**; phone numbers only per plan capabilities and mutual interest.
- **Safety:** report (`member_reports`) and block (`member_blocks`); admin reviews reports at `/admin#reports`. Last step after an email warning: **Remove member** (on a report or in Members; `DELETE /api/admin/users/:id`, reason + typing REMOVE) deletes the account, photos and chats via the same `deleteMemberData` as self-delete, closes open reports as actioned, and records email/phone/Aadhaar fingerprint in `removed_members` so signup (`ACCOUNT_REMOVED`) and Aadhaar verification refuse them. It does **not** cancel a Play subscription; the panel shows the order id to cancel in Play Console.
- **Admin panel** `/admin` (sign in with an `is_admin` account): Overview, Reports, Support (tickets from support@), Verification, Members, Plans, Free access, Google Play health, Notifications (broadcast push), App guide.
- **Languages:** English, Hindi, Gujarati. Every key must exist in all three; UI text must come from `t()`.

## Verification (built Oct 2026)

- **Email:** `users.email_verified_at`, set on signup (signup already requires a code), code login and password reset. Older accounts can verify from the Verification screen.
- **Aadhaar (offline Secure QR):** member scans the QR on their card / e-Aadhaar PDF / mAadhaar app (`components/AadhaarVerify.tsx`, `expo-camera`). Server (`POST /api/verification/aadhaar`, consent required) checks the RSA-SHA256 signature against every UIDAI cert, reads name/DOB/gender/last-4, compares with the profile:
  - match → `verified` at once (✓ badge); mismatch → `review` → admin approves/rejects at `/admin#verify`.
  - One card per account via HMAC fingerprint keyed by `AADHAAR_FINGERPRINT_SECRET` (falls back to `JWT_SECRET`). **Never change that secret once members have verified.**
  - Stored in `member_verifications`: status, name, DOB, gender, last 4 digits, fingerprint. Never the Aadhaar number, address, photo or QR.
  - Once verified, name and date of birth are locked (server drops changes in `PUT /api/matrimony/me`).
  - The QR byte layout is reverse-engineered (UIDAI publishes none); V2 and unversioned layouts handled, unknown shapes refused. **Not yet confirmed against a real card** — see TESTING.md.
- **Where it shows:** ✓ on listing cards and detail, "Verified profiles only" filter (`verifiedOnly=1`), warning line on unverified profiles, Home "Stay safe" notice (don't trust even verified profiles blindly) and "Please verify your profile" card, Profile tab card, signup step with a language-specific how-to guide.
- **Verified-member discount:** a Play Console offer with id **`verified-discount`** (developer-determined eligibility, 50% off for the first N periods) on each subscription's base plan. The app sends exactly one offer token per purchase (`playBilling.ts` `buy(sku, useVerifiedOffer)`); the server logs a purchase of that offer by an unverified account. Nothing shows until the offer exists in Play Console. Create it only after most members are on v43+ (older builds sent every offer token).
- **Profile DOB:** Profile tab edits date of birth with a date picker; age is computed from it (server too). A changed DOB goes through the 18+ gate.

## Decisions to respect

- **No phone/SMS verification** — TRAI DLT registration was not wanted; Firebase phone auth too expensive in India. Don't propose it again unless asked.
- **Verification is optional**, encouraged by the badge, banners and the discount. Making Aadhaar mandatory was rejected (drop-off, untested QR reader, likely legal risk for private services after the 2018 Aadhaar judgment).
- **Never screen members by religion.** The framing is "real person, genuine samaj member".
- **Terms** (`site/terms.html`): members are responsible for their own dealings; the badge only means Aadhaar details matched; using someone else's Aadhaar is a crime (IT Act 66C/66D, BNS); operator not liable for fraud by members. Grievances: acknowledge within 48 hours, resolve within 15 days (IT Rules 2021 expect 24-hour acknowledgement — the user chose to keep 48). A lawyer review was recommended.

## Commands

```bash
npm test                                   # all integration tests (embedded Postgres, ~1–2 min)
node tests/run.mjs tests/verification.test.mjs   # one file
npm run mobile:typecheck                   # or: cd apps/mobile && npx tsc --noEmit -p .
npm run server                             # migrate + start API on :3000 (uses .env — that is the REAL database)
```

**Building the Android AAB** — only when the user explicitly asks ("make aab"); never on your own after a change, they batch several changes into one build. Local, with the JDK in `~/Library/Java`, from `apps/mobile`:

```bash
export JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/jdk-17.0.20.1+1/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$PATH"
npx eas build --platform android --profile production --local --non-interactive --output "$HOME/Downloads/build-vNN.aab"
```

- Output always goes to **`~/Downloads/build-vNN.aab`** (user's preference). EAS bumps `versionCode` in `apps/mobile/app.json` automatically; then commit "Bump versionCode to NN for the local AAB build" and push.
- `expo-doctor` warnings during the build are non-fatal. Signing comes from EAS credentials (logged in as `kushnew`).
- Adding a native package (like `expo-camera`) needs a new AAB; JS-only changes still ship via a new AAB here (no OTA set up).
- Release builds use **R8** minify + resource shrinking (via `expo-build-properties`, template `proguard-android.txt`). **Do not turn on R8's optimization pass** (`proguard-android-optimize.txt` / `android.r8.optimizedResourceShrinking`): it was tried in v45–v47 and silently broke expo-image-picker — tapping Add Photo did nothing, no error, no photo uploads for a day in production (24 Oct 2026). Play Console's "R8 optimization isn't enabled" notice is only a recommendation; ignore it. Before shipping any build-config change, install a local `./gradlew assembleRelease` on the emulator and tap Add Photo, the Aadhaar scanner and Plans. Keep the mapping file: build with `EAS_LOCAL_BUILD_SKIP_CLEANUP=1 EAS_LOCAL_BUILD_WORKINGDIR=<dir>`, copy `.../outputs/mapping/release/mapping.txt` to `~/Downloads/mapping-vNN.txt`, and upload it in Play Console with the bundle. If a library breaks under R8, add keep rules via `extraProguardRules` in app.json.
- Orientation: the manifest is unrestricted (Play large-screen policy). `App.tsx` locks portrait at runtime on phones; `plugins/withUnlockedOrientation.js` removes library activities' portrait locks.

## Testing conventions

- Tests boot the real server against a throwaway Postgres per file and drive it over HTTP (`tests/helpers/harness.mjs`: `startServer`, `signUpUser`, `server.sql`, `server.request`). No test touches the real DB, email, SMS or payment providers.
- Aadhaar tests sign their own QR codes with a generated key via `AADHAAR_CERT_DIR`.
- `tests/i18n.test.mjs` fails if a key is missing in any language, left blank, copied from English, or if a screen hardcodes English text.
- Add a test with every server behaviour change. Run the full suite before committing.

## Code conventions

- Comments explain *why*, often naming the bug a line fixes. Match that density and tone.
- Server: `pgQuery(sql, params)`; after writes that affect listings call `invalidateFastCache('publicProfiles')` (and `cacheInvalidate('memberPayload:<id>')` for the member's own payload).
- New tables/columns go in `server/migrate.js` (idempotent `IF NOT EXISTS`), never by editing old migrations.
- Guide text in `guide-defaults.js` is seeded once (`ON CONFLICT DO NOTHING`); changing an existing section's text needs the admin panel or a new key.
- Mobile strings: add to all three blocks in `LanguageContext.tsx` as `    key: 'value',` single-line entries (the i18n test parses that shape).
- Mobile layout: the app draws edge to edge (behind the Android navigation bar), and some members use the largest font and display size. Every screen and bottom sheet must scroll when its content is taller than the screen (`ScrollView` with `contentContainerStyle={{ flexGrow: 1 }}` keeps the normal layout), and the last scrollable content or sheet needs `paddingBottom: … + insets.bottom` (`useSafeAreaInsets`). Tab screens are covered by the tab bar. Fixed in Oct 2026 for Language, Welcome, Login, profile detail (+ its Report sheet), Settings language/delete pop-ups and the Filters header.

## Environment (Render)

Hosting (Oct 2026): Render **free** web service in **Oregon (us-west)** behind Render's Cloudflare; Supabase **free** project in **Tokyo** (ap-northeast-1, pooler). Every query crosses the Pacific, so a request with several queries takes ~0.5–1 s. When upgrading, move both to Singapore (or Mumbai) together. Free-tier limits that bind first: Supabase photo egress (5 GB/month) and storage (1 GB), Brevo 300 emails/day, Render 0.1 CPU / 512 MB.

`DATABASE_URL`, `JWT_SECRET` (≥32 chars, required), `ALLOWED_ORIGINS`, `PUBLIC_API_BASE_URL`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (photos), `BREVO_API_KEY` (email codes), `PLAY_PACKAGE_NAME`, `PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_RTDN_TOKEN`, `REVIEW_ACCOUNT_EMAIL` / `REVIEW_ACCOUNT_OTP` (Play reviewer login), `AADHAAR_FINGERPRINT_SECRET` (exact spelling; set once, never change). `SUPPORT_INBOUND_TOKEN` (secret the Gmail script sends; without it the hook refuses everything), optional `SUPPORT_REPLY_TO`, `SUPPORT_FROM`, `SUPPORT_HELP_URL`, `ADMIN_ALERT_EMAIL`, `DB_LIMIT_MB`, `STORAGE_LIMIT_MB`. Razorpay and MSG91 vars exist but are unused. **Keep-alive:** `server/keep-alive.js` pings `RENDER_EXTERNAL_URL/api/health` (set by Render automatically) every 10 minutes so the free instance never sleeps; `KEEP_ALIVE=off` or moving to a paid plan makes it unnecessary. It only fits the 750 free hours while this is the sole free service in the workspace. The app talks to `https://www.chaudharysamaj.com/api` (`apps/mobile/eas.json`).
