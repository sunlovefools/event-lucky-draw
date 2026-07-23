# Database

This document describes the `public` schema after applying every migration, including `20260723011000_remove_retired_tables.sql`.

The app uses a station-stamp workflow: a participant completes each active station, including the **Final Survey** station, to become eligible for the draw. Direct station links replaced vendor logins, and the old form-based survey was retired.

## Tables

### `health_checks`

Used only by the health endpoint to confirm that Supabase is reachable.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint` | Identity primary key. |
| `checked_at` | `timestamptz` | Defaults to `now()`. |

### `admin_accounts`

Administrator credentials.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `username` | `text` | Required and unique. |
| `password_hash` | `text` | Required password hash. |
| `password_salt` | `text` | Required salt used to create the hash. |
| `active` | `boolean` | Required; defaults to `true`. |
| `created_at` | `timestamptz` | Required; defaults to `now()`. |

### `admin_sessions`

Logged-in admin browser sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; application-generated session ID. |
| `admin_id` | `uuid` | Required FK to `admin_accounts.id`; deleted with its admin. |
| `created_at` | `timestamptz` | Required; defaults to `now()`. |
| `expires_at` | `timestamptz` | Required session expiry. |

### `event_settings`

Single-row event configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` | Primary key, constrained to `1`. |
| `participation_open` | `boolean` | Required; defaults to `true`. |
| `updated_at` | `timestamptz` | Required; defaults to `now()`. |
| `updated_by_admin_id` | `uuid` | Optional FK to `admin_accounts.id`; becomes `NULL` if that admin is deleted. |

### `stations`

Exhibition stations. One active station must be named `Final Survey`; it is the final required stamp.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `name` | `text` | Required and unique. |
| `active` | `boolean` | Required; defaults to `true`. Inactive stations do not count toward eligibility. |
| `created_at` | `timestamptz` | Required; defaults to `now()`. |

### `delegates`

Imported event participants who can collect stamps and be entered into the draw.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `registration_number` | `text` | Required and unique badge/participant identifier. |
| `title` | `text` | Required; defaults to an empty string. |
| `full_name` | `text` | Required. |
| `created_at` | `timestamptz` | Required; defaults to `now()`. |
| `eligible_at` | `timestamptz` | Set when the Final Survey station is successfully stamped. |
| `draw_status` | `text` | Required; defaults to `auto`. Admins may use `eligible` or `excluded` as overrides. |

### `delegate_sessions`

Logged-in delegate browser sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; application-generated session ID. |
| `delegate_id` | `uuid` | Required FK to `delegates.id`; deleted with the delegate. |
| `created_at` | `timestamptz` | Required; defaults to `now()`. |
| `expires_at` | `timestamptz` | Required session expiry. |

### `delegate_station_stamps`

One completed station per delegate. The unique pair prevents duplicate stamps.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `delegate_id` | `uuid` | Required FK to `delegates.id`; deleted with the delegate. |
| `station_id` | `uuid` | Required FK to `stations.id`; deletion is restricted while stamps exist. |
| `collected_at` | `timestamptz` | Required; defaults to `now()`. |

Constraint: `unique (delegate_id, station_id)`.

### `scan_audit_logs`

Records each station scan attempt, including successful, duplicate, invalid, and locked scans.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `delegate_id` | `uuid` | Optional FK to `delegates.id`; becomes `NULL` if the delegate is deleted. |
| `station_id` | `uuid` | Optional FK to `stations.id`; becomes `NULL` if the station is deleted. |
| `qr_token` | `text` | Required scanned badge payload; retained under its historical column name. |
| `result` | `text` | Required outcome, such as `success`, `duplicate`, or `locked`. |
| `consumed` | `boolean` | Required; whether the scan resulted in or confirmed a stamp. |
| `scanned_at` | `timestamptz` | Required; defaults to `now()`. |

### `draw_rounds`

Draw-session records. The current round has `closed_at IS NULL`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `round_number` | `integer` | Required display/order number. |
| `opened_at` | `timestamptz` | Required; defaults to `now()`. |
| `closed_at` | `timestamptz` | Optional close timestamp. |

### `winner_history`

Winners drawn during a round. A delegate can appear only once until the winner history is reset.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key; generated UUID. |
| `delegate_id` | `uuid` | Required FK to `delegates.id`; deletion is restricted. Globally unique. |
| `round_id` | `uuid` | Required FK to `draw_rounds.id`; deletion is restricted. |
| `won_at` | `timestamptz` | Required; defaults to `now()`. |

## Database functions

| Function | Purpose |
| --- | --- |
| `admin_participant_progress()` | Returns delegate progress, with `survey_submitted` derived from the Final Survey station stamp. |
| `admin_station_summaries()` | Returns per-station completion totals for the admin dashboard and exports. |
| `admin_scan_audit_logs()` | Returns audit entries joined to delegate and station names. |

## Removed tables

The cleanup migration removes `final_survey_responses`, `vendor_accounts`, and `vendor_sessions`. The first belonged to the retired form survey; the latter two belonged to the replaced vendor-login flow. Earlier migrations already removed `station_qr_tokens`.
