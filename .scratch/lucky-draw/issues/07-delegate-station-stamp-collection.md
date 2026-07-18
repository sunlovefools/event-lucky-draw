# 07 — Delegate station stamp collection

**What to build:** Delegates can collect a station stamp by scanning/opening a valid station QR. Used/expired/invalid QRs show clear errors. Duplicate scans consume the QR but do not award duplicate stamps.

**Blocked by:** 05 — Delegate station progress dashboard; 06 — Vendor portal with manual one-time QR generation

**Status:** ready-for-agent

- [ ] Valid QR awards station stamp
- [ ] Success message names station collected
- [ ] Expired/used/invalid QR shows clear error
- [ ] Duplicate station scan consumes QR without duplicate stamp
- [ ] Concurrent scans are first-successful-request-wins
- [ ] Stamp collection is blocked when participation is closed
