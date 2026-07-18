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
| GET | `/draw` | `app/draw/page.tsx` → `app/draw/public-display.tsx` | Big-screen public lucky-draw display. Polls `/api/draw-state` every 3s and animates the reveal of the latest winner. | Client component (`"use client"`). Shows "waiting" / "drawing" / "revealed" phases. |
| GET | `/stamp/[token]` | `app/stamp/[token]/page.tsx` → `app/stamp/[token]/stamp-result.tsx` | Collects a station stamp for the QR `token`. If the delegate isn't registered yet, stashes the token in the `pending_stamp_token` cookie and redirects to `/?pendingStamp=true`; after registration the pending token is applied. | Dynamic segment `[token]` is the QR payload. Reads `delegate_session` cookie. |
| GET | `/api/health` | `app/api/health/route.ts` | JSON health probe. Runs a `health_checks` query against Supabase. | `200` when healthy, `503` otherwise. Body shape: `HealthStatus` (`ok`, `app`, `database`, `checkedAt`, optional `error`). |
| GET | `/api/draw-state` | `app/api/draw-state/route.ts` | Public JSON snapshot of the most recent draw winner. | `cache-control: no-store`. Body: `{ status: "waiting" \| "winner", winner }`. |

---

## 2. Authenticated routes (cookie-gated)

| Method | Path | File | Cookie | Purpose | Notes |
|--------|------|------|--------|---------|-------|
| GET | `/admin` | `app/admin/page.tsx` → `app/admin/admin-dashboard.tsx` | `admin_session` | Admin dashboard: participation toggle, stations, vendor accounts, lucky draw, winner history, exports, participants, scan audit. | Query param `error` (one of `invalid-login`, `login-required`, `station-invalid`, `vendor-invalid`, `draw-invalid`). Shows login form when not authed. |
| GET | `/admin/exports/[kind]` | `app/admin/exports/[kind]/route.ts` | `admin_session` | Streams a CSV export as a file download. | `[kind]` must be one of: `participants`, `station-completions`, `survey-responses`, `winner-history`, `scan-audit`. Unknown kind → `404`; missing/invalid session → `401`. |
| GET | `/vendor` | `app/vendor/page.tsx` → `app/vendor/vendor-portal.tsx` | `vendor_session` | Vendor station portal: generate stamp QRs and view scan history (auto-refreshes every 5s). | Query param `error` (one of `invalid-login`, `login-required`, `participation-closed`). Shows login form when not authed. |

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
| `createStationAction` | New station form | Create a station. Failure → `login-required` / `station-invalid`. |
| `editStationAction` | Save station form | Edit a station's name/active flag. |
| `createVendorAction` | New vendor form | Create vendor account + assign station. Failure → `login-required` / `vendor-invalid`. |
| `editVendorAction` | Save vendor form | Edit a vendor account. |
| `updateDelegateNameAction` | Save delegate form | Rename a participant. |
| `drawLuckyWinnerAction` | Draw winner form | Run a lucky draw with a `drawLabel`. Failure → `login-required` / `draw-invalid`. |
| `setDelegateDrawStatusAction` | "Manually include" / "Disqualify" | Set a delegate's draw status (`manual_include`, `disqualified`, etc.). |

All admin actions redirect back to `/admin` on success.

### Vendor — `app/vendor/actions.ts`
| Action | Trigger | Effect |
|--------|---------|--------|
| `loginVendorAction` | Vendor login form | Authenticate, set `vendor_session` cookie (path `/vendor`). Failure → `/vendor?error=invalid-login`. |
| `generateStationQrAction` | "Generate new QR" button | Mint a new station stamp QR for the vendor's station. Disabled when participation is closed. Failure → `participation-closed` / `login-required`. |

---

## 4. Routing diagram (happy path)

```
/                         delegate not identified → registration form
│                          delegate identified    → progress + final survey
├── /stamp/[token] ────── collect station stamp (or stash pending → redirect /)
├── /draw ─────────────── public winner display (polls /api/draw-state)
│
/admin ────────────────── login → /admin dashboard
│   └── /admin/exports/[kind]   CSV downloads
/vendor ───────────────── login → /vendor portal (generate QR, scan history)
/api/health ───────────── JSON health probe
/api/draw-state ───────── JSON latest winner
```

## 5. Session cookies

| Cookie | Set by | Scope | Purpose |
|--------|--------|-------|---------|
| `delegate_session` | `identifyDelegateAction` | `/` | Identifies a registered delegate across visits. |
| `pending_stamp_token` | `/stamp/[token]` | `/` (10 min) | Holds an unclaimed stamp token until the delegate registers. |
| `admin_session` | `loginAdminAction` | `/admin` | Admin dashboard access. |
| `vendor_session` | `loginVendorAction` | `/vendor` | Vendor portal access. |
