# Release and testing checklist

Keep this up to date as features change. Tick through it before each Play
release. Automated tests cover the server; the lists below are what only a
person with a phone can check.

## Release status (update each build)

| Build | Date | Status |
| --- | --- | --- |
| v47 | 24 Oct 2026 | Built (`~/Downloads/build-v47.aab` + `mapping-v47.txt`). **Upload this one** (v46 was never uploaded). Since v45: new logo icon + splash, large-text fixes (Language/Welcome scroll, nav-bar insets on Login, profile detail, report sheet, Settings pop-ups, Filters header), Housewife in mother's occupation. Run the Large text and R8 smoke tests on a phone. |
| v46 | 24 Oct 2026 | Built (`~/Downloads/build-v46.aab` + `mapping-v46.txt`). v45 plus the new Chaudhary Matrimony logo as the home-screen icon (adaptive, maroon `#791611` background) and splash. Superseded by v47 before upload. |
| v45 | 19 Oct 2026 | Built (`~/Downloads/build-v45.aab` + `mapping-v45.txt`). v44 plus full R8 optimization and optimized resource shrinking (Play "R8 optimization" warning). **Upload this one**; run the R8 smoke test on a phone (Plans/billing, camera scanner, photo upload were not reachable on the emulator without signing in). |
| v44 | 18 Oct 2026 | **Uploaded to Play Console 18 Oct, status Active** (track not yet confirmed; ReTrace mapping and native debug symbols attached automatically from the bundle). Built (`~/Downloads/build-v44.aab` + `mapping-v44.txt`). v43 plus Play Console fixes: R8 minify/obfuscation on, no manifest orientation locks (phones lock portrait at runtime). Superseded by v45. Mapping file in App bundle explorer → Downloads → ReTrace mapping file). |
| v43 | 18 Oct 2026 | Aadhaar/email verification, discount handling, DOB editing, misuse warnings. Superseded by v44. |
| v40 | 10 Oct 2026 | Last build before verification. |

### Support ticket setup (one time)
- [ ] Render: `SUPPORT_INBOUND_TOKEN` = output of `openssl rand -hex 24`; `PUBLIC_API_BASE_URL` set. Redeploy.
- [ ] Namecheap → Advanced DNS → Mail Settings: MX for host `reply` → `inbound1.sendinblue.com` (10) and `inbound2.sendinblue.com` (20). If this needs "Custom MX", first re-add the five `@` MX records `eforward1–3.registrar-servers.com` (10), `eforward4` (15), `eforward5` (20) so support@ forwarding keeps working; test it at once, and switch back to "Email Forwarding" if it breaks.
- [ ] Namecheap → Email forwarding: add a second rule `support` → `support@reply.chaudharysamaj.com` (keep the Gmail one).
- [ ] Admin → Support → "Connect Brevo inbound mail".
- [ ] Mail support@ from a personal address: a ticket appears, the auto-reply with CS-number arrives, replying from the admin panel reaches the sender, and their answer lands in the same ticket.

### Open items before v43 goes to production

- [ ] `AADHAAR_FINGERPRINT_SECRET` set on Render with the exact name (64 random hex chars from `openssl rand -hex 32`), saved in a password manager.
- [ ] Server deployed from `mobile-app-postgres` (merge to `main` first if Render deploys `main`). Check `GET /api/health`, then that `/admin` shows a Verification section.
- [ ] Real Aadhaar QR verified on a test install (see "Aadhaar" below) — the reader has only been tested with self-signed QR codes.
- [ ] Play Console → App content → Data safety: add name, date of birth, gender collected for identity verification (not shared, can be deleted).
- [x] v44 uploaded (mapping file already included in the bundle, no manual upload needed).
- [ ] Confirm v44 (not v42, which is also Active and lacks the R8/orientation fixes) is the build rolling out to production; test v44 on a real phone first (Plans prices load + purchase sheet opens under R8).
- [ ] After upload, Play Console → Release dashboard: "DEX code optimization" and "orientation restrictions" should clear. "Deprecated edge-to-edge APIs" will remain — it comes from React Native / react-native-screens / expo-image-picker, not our code; revisit after the next Expo SDK upgrade.
- [ ] v44 raised two more (19 Oct). "R8 optimization": optimization and optimized resource shrinking were off (template used `proguard-android.txt`) — fixed in v45 by `plugins/withR8Optimization.js`; the third point, "upgrade to Android Gradle plugin 9", waits for an Expo SDK that ships it (SDK 54 / RN 0.81 use AGP 8.11). "Bitmap image optimization" points at `U8.c$b$a` = expo-notifications' `DownloadImageKt` (fetches the image of a rich push notification) — library code, we send no push images; ignore.
- [ ] Later, once most members are on v44+: create the `verified-discount` offer in Play Console (see CLAUDE.md).
- [ ] Optional: lawyer review of `site/terms.html`; decide on 24-hour grievance acknowledgement.

## Automated (run before every commit)

```bash
npm test                     # expect all pass (425 as of v43)
cd apps/mobile && npx tsc --noEmit -p .
```

## Manual test list (on a phone, internal-testing install)

### R8 / release-build smoke test (every build — minify can strip code a library needs)
- [ ] App launches; Home, Matrimony, Plans, Profile tabs open without a crash.
- [ ] Plans: Play prices load (on a device with Play Store signed in); purchase sheet opens.
- [ ] Verification: camera scanner opens and shows a preview.
- [ ] Photo upload and crop work; push notification arrives.
- [ ] Phone: stays portrait when rotated. Tablet/foldable: rotates.

### Large text (every build that touches layout)
Android Settings → Display → Font size **largest** and Display size **largest**, 3-button navigation. Old members use this; buttons used to end up under the navigation bar.
- [ ] Language screen: Gujarati and Continue reachable (scroll). Welcome: Create your profile and Log in reachable.
- [ ] Login: "Create a profile" scrolls clear of the navigation bar. Signup steps: bottom button visible.
- [ ] Profile detail: last section clears the bar; Report sheet scrolls and Cancel / Send report stay visible.
- [ ] Settings: language picker shows Gujarati fully; Delete Account buttons above the bar. Filters: Done visible.
- [ ] Same screens at normal size look unchanged.

### Signup
- [ ] Full signup in English; email code arrives; under-18 date of birth is refused.
- [ ] After photos, the **Aadhaar step** appears with the guide open; "I'll do this later" skips to horoscope.
- [ ] Same in Hindi and Gujarati: guide, warnings and buttons translated.
- [ ] Profile for a son/daughter: guide says scan *their* Aadhaar.

### Aadhaar verification (needs real cards)
- [ ] Scan the QR on a **printed card (2019 or later)** → "Aadhaar verified" when name/DOB/gender match.
- [ ] Scan an **e-Aadhaar PDF** shown on another screen (download at myaadhaar.uidai.gov.in; PDF password = first 4 letters of name in capitals + birth year).
- [ ] Scan from the **mAadhaar app**.
- [ ] If any real QR fails with "not signed by UIDAI" or "could not read": copy the `[aadhaar]` line from Render logs and fix `server/aadhaar-qr.js` (layout or certificate).
- [ ] Profile name differs slightly (nickname) → "Under review"; appears in `/admin#verify`; Approve → badge shows; Reject with note → member sees the note and can scan again.
- [ ] Same Aadhaar on a second account → "already linked to another account".
- [ ] Old pre-2018 card QR → "older Aadhaar QR without a signature".
- [ ] Camera permission denied → clear message; allow → scanner opens; Cancel closes it.
- [ ] Consent unticked → Scan button disabled.

### After verification
- [ ] ✓ next to the name on Matrimony cards and on the profile detail; "Email verified" line shows.
- [ ] Unverified profiles show the orange "not Aadhaar verified" warning.
- [ ] Filters → "Verified profiles only" shows only ✓ profiles.
- [ ] Profile tab: name and date of birth show "Locked after Aadhaar verification" and cannot be edited.
- [ ] Home: "Please verify your profile" card disappears; the green "Stay safe" notice always shows.

### Profile editing
- [ ] Before verification: Edit → change name and date of birth with the picker → Save → age updates.
- [ ] Choosing a date that makes the member under 18 → error, nothing saved.

### Home
- [ ] "Stay safe" notice (mentions even verified profiles can be misused).
- [ ] Unverified: "Please verify your profile" card → opens Verification. Under review: shows "Under review".

### Plans and payments
- [ ] Plans list shows Play prices; purchase opens Google Play; after paying, access unlocks (server verified + acknowledged — check Render logs).
- [ ] Once `verified-discount` exists: verified member sees the discounted price with the regular one struck through and pays the discount; unverified member sees "Get 50% off with Aadhaar verification" and pays full price.
- [ ] Restore purchases works after reinstall.

### Matching and messaging
- [ ] Only the opposite gender is listed; free limit respected; locked cards prompt to subscribe.
- [ ] Send interest → other side accepts → chat works → phone number per plan rules.
- [ ] Report a profile → it disappears for the reporter → shows in `/admin#reports`. Block works both ways.

### Account and settings
- [ ] Language switch (en/hi/gu) and dark mode across Home, Profile, Verification, Plans.
- [ ] Notifications arrive (interest, accepted, profile viewed, admin broadcast).
- [ ] Delete account removes the member (and their verification record).

### Admin panel (`/admin`)
- [ ] Sign in with an admin account; Verification tab count matches the queue; Approve / Reject / Revoke work.
- [ ] Overview → "Email me a summary now": the summary email (members, paying, database, storage) arrives at the admin address.
- [ ] Reports: a member with several reports shows "N reports"; **Remove member** asks for a reason and REMOVE, then the reports move to Actioned marked REMOVED and the member is gone from Members. Signing up again with that email shows the "account was removed" message.
- [ ] Reports, Members, Plans, Free access, Google Play health, Notifications, App guide all load.
- [ ] App guide shows the "Get verified, and trust verified profiles" section (seeded on first deploy).
