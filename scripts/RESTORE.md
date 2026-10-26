# Restoring from a Mac backup

Backups: `~/Documents/chaudhary-samaj-backups/<date>/` (daily at 1 PM via
launchd `com.chaudharysamaj.backup`, last 14 days kept, log in `backup.log`).
Each has `tables/*.json` (every row of every table), `photos/` (the
profile-photos bucket, same paths) and `manifest.json` (counts).

Only for a real disaster (data lost or corrupted). Ask before running anything
against production.

1. Point `DATABASE_URL` at an **empty** Postgres (a new Supabase project, or
   the old one after it has been cleared) and run `npm run server` once:
   `server/migrate.js` creates every table. Stop it.
2. Load the rows: for each `tables/<name>.json`, insert its rows into
   `<name>` (JSON columns such as `photos` go in as JSON). Load `users` first,
   then `matrimony_profiles`, then the rest. Reset sequences afterwards
   (`support_ticket_number_seq`, `user_subscriptions_id_seq`).
3. Upload `photos/` back into the `profile-photos` bucket with the same
   paths. If the Supabase project changed, the stored photo URLs contain the
   old project id: replace it in `matrimony_profiles.photos`.
4. Update Render env vars if the database or project changed, redeploy, and
   check `/api/health`, login, the Matrimony list and photos.

Stop the daily job: `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.chaudharysamaj.backup.plist`
