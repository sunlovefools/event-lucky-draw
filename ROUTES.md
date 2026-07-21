# Application Routes

This document maps every URL and every server action in the **Event Station Quest Lucky Draw** app (Next.js 15 App Router).

> **Two kinds of endpoints**
> - **Routes** — real URLs you can visit (`page.tsx` = UI, `route.ts` = raw response).
> - **Server Actions** — `async function`s in `app/**/actions.ts` used as `<form action={...}>`. They have **no own URL**; they run on submit and then `redirect()` to a route. They only exist under `app/admin/actions.ts`, `app/delegate/actions.ts`, `app/final-survey/actions.ts`, and `app/vendor/actions.ts`.
>
> There is no `middleware.ts`. Authentication is enforced inside each page/route by reading a session cookie and showing a login form when the cookie is missing.

---

## 1. Public routes (no authentication)

| Method | Path | File | Purpose | Notes |
|--------|------|------|---------|-------|
| GET | `/` | `app/page.tsx` → `app/home.tsx` | Delegate landing / "join the lucky draw" page. Shows app + database health, and the delegate's station progress / final survey when already identified. | Query params: `error` (one of `registration-closed`, `delegate-invalid`, `survey-invalid`), `pendingStamp` (`"true"`). Reads `delegate_session` cookie. |
| POST | `/api/vendor/scan` | `app/api/vendor/scan/route.ts` | Vendor scans a delegate's badge QR: stamps the delegate for the vendor's assigned station. Returns JSON (`VendorScanResult`) consumed by the vendor portal scanner. | Reads `vendor_session` cookie. Rejects unregistered/duplicate/invalid badges and closed participation. |
| GET | `/api/health` | `app/api/health/route.ts` | JSON health probe. Runs a `health_checks` query against Supabase. | `200` when healthy, `503` otherwise. Body shape: `HealthStatus` (`ok`, `app`, `database`, `checkedAt`, optional `error`). |
| GET | `/api/draw-state` | `app/api/draw-state/route.ts` | Public JSON snapshot of the current round latest winner. | `cache-control: no-store`. Body: `{ status: "waiting" | "winner", winner }`. Used by `/admin/draw`. |
| POST | `/api/draw` | `app/api/draw/route.ts` | Admin-gated JSON draw trigger. | Reads `admin_session`, selects a winner server-side from the current round candidate pool, and returns `{ ok, winner/error }`. |

---

## 2. Authenticated routes (cookie-gated)

| Method | Path | File | Cookie | Purpose | Notes |
|--------|------|------|--------|---------|-------|
| GET | `/admin` | `app/admin/page.tsx` → `app/admin/admin-dashboard.tsx` | `admin_session` | Admin dashboard: participation toggle, stations, vendor accounts, draw round reset/delete, winner history, exports, participants, scan audit. | Query param `error` (one of `invalid-login`, `login-required`, `station-invalid`, `vendor-invalid`, `draw-invalid`). Shows login form when not authed. |
| GET | `/admin/draw` | `app/admin/draw/page.tsx` → `app/admin/draw/admin-draw-display.tsx` | `admin_session` | Admin-presented lucky-draw screen. | Admin shares this screen with the crowd; the Draw button calls `POST /api/draw` and the display polls `/api/draw-state`. |
| GET | `/admin/exports/[kind]` | `app/admin/exports/[kind]/route.ts` | `admin_session` | Streams a CSV export as a file download. | `[kind]` must be one of: `participants`, `station-completions`, `survey-responses`, `winner-history`, `scan-audit`. Unknown kind → `404`; missing/invalid session → `401`. |
| GET | `/vendor` | `app/vendor/page.tsx` → `app/vendor/vendor-portal.tsx` | `vendor_session` | Vendor station portal: scan delegate badge QRs to stamp them, and view scan history (auto-refreshes every 5s). | Query param `error` (one of `invalid-login`, `login-required`, `participation-closed`). Shows login form when not authed. |

---

## 3. Server Actions (form submissions — no URL of their own)

All actions `redirect()` after running. Failure paths redirect back to the originating page with an `?error=` query param.

### Delegate — `app/delegate/actions.ts`
| Action | Trigger | Effect |
|--------|---------|--------|
| `identifyDelegateAction` | Home "Continue" form | Identify/register delegate, set `delegate_session` cookie. If a pending stamp token exists, redirect to `/stamp/<token>`; else `/`. On failure → `/?error=registration-closed` or `/?error=delegate-invalid`. |

### Final survey — `app/final-survey/actions.ts`
| Action | Trigger | Effect |
|--------|---------|--------|
| `submitFinalSurveyAction` | Home final-survey form | Submit satisfaction/favorite/feedback for the current delegate session. On failure → `/?error=survey-invalid`. |

### Admin — `app/admin/actions.ts`
| Action | Trigger | Effect |
|--------|---------|--------|
| `loginAdminAction` | Admin login form | Authenticate, set `admin_session` cookie (path `/admin`). Failure → `/admin?error=invalid-login`. |
| `setParticipationAction` | Participation toggle | Open/close event participation. Failure → `/admin?error=login-required`. |
| `createStationAction` | New station form | Create a station (a booth). Each vendor account links to exactly one station. Failure → `login-required` / `station-invalid`. |
| `editStationAction` | Save station form | Rename a station / toggle its active flag. |
| `createVendorAction` | New vendor form | Create a vendor account and link it to exactly one station. Failure → `login-required` / `vendor-invalid`. |
| `editVendorAction` | Save vendor form | Edit a vendor account's username / active flag. |
| `revokeVendorSessionAction` | "Sign out device" button | Revoke one device's vendor session. A vendor account can be signed in on multiple devices at once. Failure → `login-required`. |
| `updateDelegateNameAction` | Save delegate form | Rename a participant. |
| `resetDrawRoundAction` | Admin dashboard reset form | Close the current draw round and open a fresh round. Failure → `login-required` / `draw-invalid`. |
| `deleteDrawRoundAction` | Past-round delete form | Delete a completed non-current round and its winner-history rows. Failure → `login-required` / `draw-invalid`. |
| `setDelegateDrawStatusAction` | "Manually include" / "Disqualify" | Set a delegate's draw status (`manual_include`, `disqualified`, etc.). |

All admin actions redirect back to `/admin` on success.

### Vendor — `app/vendor/actions.ts`
| Action | Trigger | Effect |
|--------|---------|--------|
| `loginVendorAction` | Vendor login form | Authenticate, set `vendor_session` cookie (path `/vendor`). Failure → `/vendor?error=invalid-login`. |


---

## 4. Routing diagram (happy path)

```
/                         delegate not identified → registration form
│                          delegate identified    → progress + final survey
├── /vendor ───────────── vendor scans delegate badge QR → stamps delegate
/admin ────────────────── login → /admin dashboard
│   ├── /admin/stations ── booth management (name, active, link to a vendor account)
│   ├── /admin/vendors ──── vendor accounts (each = exactly one station) + active device sessions
│   ├── /admin/draw ─────── admin-presented draw screen (POST /api/draw + polls /api/draw-state)
│   └── /admin/exports/[kind]   CSV downloads
/vendor ───────────────── login → /vendor portal (generate QR, scan history)
/api/health ───────────── JSON health probe
/api/draw-state ───────── JSON current-round latest winner
/api/draw ─────────────── POST admin-gated draw trigger
```

## 5. Session cookies

| Cookie | Set by | Scope | Purpose |
|--------|--------|-------|---------|
| `delegate_session` | `identifyDelegateAction` | `/` | Identifies a registered delegate across visits. |

| `admin_session` | `loginAdminAction` | `/admin` | Admin dashboard access. |
| `vendor_session` | `loginVendorAction` | `/vendor` | Vendor portal access. |
