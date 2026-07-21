# Vendor scans the delegate's Badge QR to collect stamps

Stamp collection used to run in the delegate's direction: the vendor generated a one-time, expiring `Station QR` token that the delegate scanned, which then stamped the delegate for that station. That flow was judged too complicated for staff and delegates. We reversed the direction: the **vendor's device scans the delegate's `Badge QR`** (their registration number), and the vendor's logged-in `Station` stamps the delegate. The delegate's `Badge QR` is the *same* QR they already use to register/access their stamp passport, so no new delegate-facing QR is introduced.

## Considered Options

- **Vendor scans delegate Badge QR (chosen).** Lightest change, reuses the badge the delegate already carries, and matches "exactly the same QR" — the delegate registers by scanning their badge and is stamped when the vendor scans that same badge.
- **Vendor scans a new delegate passport QR displayed on the delegate's phone.** Contradicts "exactly the same QR" (the delegate would still register via the badge) and adds UI.
- **Keep generating a Station QR but flip who points the camera.** Still requires the delegate to hold a generated QR, so it simplifies nothing.

## Consequences

- A stamp can only be granted to an **already-registered delegate**; scanning an unregistered badge is rejected with "register first" (the stamp needs the delegate's `fullName` for the success message, and stamps only attach to real delegates).
- The station being stamped is implied by the **vendor's session**, not by anything in the scanned QR.
- The one-time `Station QR` machinery (`station_qr_tokens` table, `consume_station_qr_token()` function, `qr_token_id` columns, the `/stamp/[token]` delegate route, `generateStationQrAction`) is retired. `scan_audit_logs` is kept and repurposed to record the scanned `Badge QR` payload + vendor station + result.
- The vendor portal shows the stamp result **inline on the vendor device** ("Successful Stamped [name] QR! Ask him/her to refresh their page to look at the stamp!"); the delegate refreshes their stamp passport manually to see the new stamp.
