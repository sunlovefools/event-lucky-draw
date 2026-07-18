# Refactor Plan — Event Station Quest Lucky Draw

Status: proposed · derived from codebase audit (2025-07-18)
Scope: `lib/` + `app/*/actions.ts` + `tests/` structure only. No behavior change intended in Phase 0–1.

## 1. Context

The app is a Next.js + Supabase "lucky draw" system with three roles (delegate, vendor, admin) plus a passive public draw screen. Architecturally it is already **ports-and-adapters (hexagonal)**: each `lib/*` module defines a `XStore` port and a `SupabaseXStore` adapter, and `app/*/actions.ts` are thin server-action controllers. That seam is sound and must be kept.

The problem is **cohesion and duplication**, not file count:

- One module (`lib/admin.ts`) holds 1000 lines / 17 responsibilities; its test mirror (`tests/admin.test.tsx`) is 1024 lines. Everything else is tiny by comparison.
- Shared domain concepts are defined in multiple places with drift.
- The only cross-module dependency (`public-draw.ts` → `lib/admin`) points at the giant module.

The fix is to **group by bounded context**, not to reduce file count. Folder names should "scream" the feature.

## 2. Design principles applied

- **Bounded context (DDD):** slice `lib/admin.ts` by feature (auth, stations, vendors, participants, draw, dashboard).
- **Single source of truth:** one `Station`, one `VendorAccount`, one `winnerHistoryFromRow`, one `normalizeUsername`.
- **Interface Segregation (SOLID):** split the 17-method `AdminStore` into per-feature ports.
- **Ports & Adapters (keep):** `XStore` interface + `SupabaseXStore` class stays the established seam.
- **Screaming architecture:** directory names announce the feature, mirroring `tests/`.

## 3. Confirmed smells (with evidence)

| Smell | Location |
|---|---|
| God module | `lib/admin.ts` (1000 lines, 17 exported fns) + `tests/admin.test.tsx` (1024 lines) |
| God interface | `AdminStore` at `lib/admin.ts` L111–133 (17 methods) |
| Duplicated type, two shapes | `VendorAccount` — `lib/admin.ts` L36 (`{id,username,stationId,stationName,active}`) vs `lib/vendor.ts` L13 (`{id,username,passwordHash,passwordSalt,station}`) |
| Duplicated type | `Station` (`lib/admin.ts` L30) vs `VendorStation` (`lib/vendor.ts` L7) — same `{id,name,active}` |
| Duplicated logic | `winnerHistoryFromRow` copied verbatim in `lib/admin.ts` L677 and `lib/public-draw.ts` L27 |
| Duplicated helper | `normalizeUsername` in `lib/admin.ts` L169 and `lib/vendor.ts` L83 |
| Backwards dependency | `lib/public-draw.ts` imports `AdminWinnerHistoryEntry` from `lib/admin` (the 1000-line module) |
| Repetitive controller | `app/admin/actions.ts` repeats `new SupabaseAdminStore()` + session lookup + error→redirect 9× (L25–175) |

## 4. Target structure

```
lib/
  shared/                         # single source of truth for cross-cutting domain concepts
    station.ts                    # Station (one shape) + stationFromRow
    vendor-account.ts             # VendorAccount (one shape) + fromRow
    winner-history.ts             # AdminWinnerHistoryEntry + winnerHistoryFromRow (single impl)
    normalize.ts                  # normalizeUsername, normalizeRegistrationNumber, normalizeFullName...
  participation/                  # (exists) readParticipationOpen + store/class
  auth/
    admin-auth.ts                 # authenticateAdmin, requireAdminSession, hashAdminPassword, session types
    vendor-auth.ts                # authenticateVendor, requireVendorSession, session types
  admin/
    stations.ts                   # listStations, createStation, editStation              (+ StationsStore)
    vendors.ts                    # listVendorAccounts, createVendorAccount, editVendorAccount (+ VendorsStore)
    participants.ts               # listParticipants, updateDelegateName, updateDelegateDrawStatus (+ ParticipantsStore)
    draw.ts                       # listWinnerHistory, drawLuckyWinner, getLuckyDrawPool, listLuckyDrawCandidates (+ DrawStore)
    dashboard.ts                  # getAdminDashboard (aggregates the above)
    exports.ts                    # (move lib/admin-exports.ts here)
  vendor/
    auth.ts                       # auth extracted from lib/vendor.ts
    portal.ts                     # getVendorDashboard, generateStationQr, QR status, scan history
  delegate/  stamp/  final-survey/  public-draw/   # (mostly as-is; public-draw imports from shared/winner-history)
```

Tests mirror the split:

```
tests/
  admin/{stations,vendors,participants,draw,dashboard,auth}.test.tsx   # from tests/admin.test.tsx
  vendor/{auth,portal}.test.tsx                                        # from tests/vendor.test.tsx
  delegate.test.tsx  stamp.test.tsx  final-survey.test.tsx  public-draw.test.tsx
```

## 5. Phased plan (each phase independently committable; keep `npm test && npm run typecheck` green)

### Phase 0 — Kill duplication (lowest risk, pure move)
- Create `lib/shared/{station,vendor-account,winner-history,normalize}.ts`.
- Move `Station`, `VendorAccount` (pick one canonical shape; adapt call sites), `winnerHistoryFromRow`, `normalizeUsername` into shared.
- Repoint `lib/admin.ts`, `lib/vendor.ts`, `lib/public-draw.ts` references at `lib/shared/*`.
- `public-draw.ts` no longer imports from `lib/admin`.
- No logic change; tests stay green.

### Phase 1 — Decompose `lib/admin.ts` (move, don't rewrite)
- Create `lib/admin/{auth,stations,vendors,participants,draw,dashboard}.ts`.
- Move functions out of `lib/admin.ts` into the matching feature file.
- Keep a composed `AdminStore` type temporarily (union of the per-feature method sets) so `SupabaseAdminStore` and `actions.ts` keep compiling.
- Split `tests/admin.test.tsx` into `tests/admin/*.test.tsx` aligned to each feature file.

### Phase 2 — Narrow the ports (Interface Segregation)
- Replace the single `AdminStore` with per-feature interfaces: `StationsStore`, `VendorsStore`, `ParticipantsStore`, `DrawStore`, `DashboardStore`, `AdminAuthStore`.
- Split `SupabaseAdminStore` into `SupabaseStationsStore`, `SupabaseVendorsStore`, `SupabaseParticipantsStore`, `SupabaseDrawStore`, `SupabaseDashboardStore`, `SupabaseAdminAuthStore`.
- `getAdminDashboard` takes only the stores it aggregates.
- Update `app/admin/actions.ts` to construct the specific store each action needs.

### Phase 3 — Split `lib/vendor.ts`
- Move auth → `lib/vendor/auth.ts`; portal/QR/scan-history → `lib/vendor/portal.ts`.
- Split `tests/vendor.test.tsx` into `tests/vendor/{auth,portal}.test.tsx`.

### Phase 4 — DRY the controller
- Add `withAdminSession(store, fn)` helper in `app/admin/actions.ts` to remove the 9× `currentAdminSessionId()` + `redirect`-on-error boilerplate and the fragile template-string error mapping.

### Phase 5 (optional) — Cookie constants
- Collapse the 1-line `app/*/session.ts` cookie constants into one `lib/session-cookies.ts`.

## 6. Payoffs

- Every file's purpose is obvious from its path (screaming architecture).
- The 1000-line god module and its 1024-line test twin no longer exist.
- One definition for `Station`, `VendorAccount`, `winnerHistoryFromRow`, `normalizeUsername` → no drift.
- `public-draw` depends on `shared`, not on the admin god module.
- Per-feature stores make testing and future feature work local, not global.

## 7. Guardrails

- Phases are **moves, not rewrites** — preserve function signatures and behavior.
- Keep `npm test`, `npm run typecheck`, `npm run build` green after each phase.
- Commit per phase so any step is revertable.
