# Event Station Quest Lucky Draw

Hosted Next.js application scaffold for the event station quest lucky draw system.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in Supabase values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Apply Supabase migrations from `supabase/migrations` to the target project.
5. Seed an admin account:
   ```bash
   ADMIN_USERNAME=admin ADMIN_PASSWORD='use-a-real-password' npm run seed:admin
   ```
   Paste the generated SQL into the Supabase SQL editor and run it. The script upserts the admin account, so rerunning it rotates that admin password.
6. Run the app:
   ```bash
   npm run dev
   ```

## Health path

- `/` renders the app shell and shows database health.
- `/api/health` returns JSON health status and checks the Supabase `health_checks` table.

## Admin access

- `/admin` shows the protected admin dashboard.
- Admins are stored in `public.admin_accounts`.
- Generate seed SQL with:
  ```bash
  ADMIN_USERNAME=organizer ADMIN_PASSWORD='change-this-before-event-day' npm run seed:admin
  ```

## Validation

```bash
npm test
npm run typecheck
npm run build
```
