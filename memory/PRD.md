# Aadhaar OCR — Product Requirements (Living Doc)

## Original Problem Statement
Originally: Build a full-stack web app for Aadhaar Card Detection and OCR. User uploads → sees Name / DOB / Gender / masked Aadhaar.
Then: add JWT auth, dashboard, history, profile, security.
Then (this iteration): add Admin role + Admin Console (E) and dark mode toggle.

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + sonner + lucide + recharts. Routes: `/login`, `/signup` (public), `/`, `/upload`, `/history`, `/profile` (auth), `/admin` (admin only).
- **Backend**: FastAPI + Motor (async MongoDB) + PyMuPDF + Pillow. Modular routers: `auth.py`, `history.py`, `admin.py`. OCR via `emergentintegrations` GPT-5.2 Vision.
- **Database**: MongoDB collections — `users`, `scans`, `audit_logs`.
- **Auth**: stateless JWT (HS256) via Bearer header; bcrypt password hashing; `is_active` flag enforced at login + every authenticated request.
- **Theming**: light/dark via `.dark` class on `<html>` + global CSS overrides in `index.css`. Persisted in `localStorage` (`aadhaar.theme`).

## Implemented (with dates)

### 2026-04-28 — Initial MVP
- `POST /api/upload` (auth) — JPEG/PNG/WEBP/PDF support, 10 MB cap, in-memory only, masked Aadhaar in response.
- GPT-5.2 Vision via `emergentintegrations.ImageContent` (base64) — verified accurate on synthetic Aadhaar.
- Server-side masking (`XXXX XXXX 1234`) + 12-digit validation + DOB & gender normalisation.
- Scanner UI with reticle dropzone, camera capture, preview, scanner-beam loader, results grid, download JSON.
- 11/11 backend pytest cases passing.

### 2026-05-07 — Auth + Dashboard + History (iteration 2)
- JWT register/login/me/logout (`/api/auth/*`).
- Sidebar + protected routes.
- Dashboard with stats (`/api/stats`) + recent activity (`/api/history`).
- History page with delete.
- Profile page with downloadable source ZIP.
- IBM Plex typography, saffron+green+light-grey theme.

### 2026-05-07 — Admin + Dark Mode (iteration 3)
- `users.role` (`user`/`admin`) and `users.is_active` (bool).
- Admin seed (`admin@aadhaarscan.app` / `Admin@1234`) + idempotent demo seed; old user docs backfilled.
- New `/api/admin/*` router:
  - `GET /admin/users` (with per-user scan counts)
  - `PATCH /admin/users/{id}` (toggle is_active or role; self-protection: 400)
  - `DELETE /admin/users/{id}` (cascades scans; self-protection: 400)
  - `GET /admin/stats` (totals + 30-day uploads time-series)
  - `GET /admin/audit` (newest first)
- `audit_logs` collection: register, login, admin actions.
- Disabled-account check enforced in both `/login` and `get_current_user`.
- Frontend: `/admin` route with `AdminRoute` guard, Admin Console with Overview / Users / Audit tabs (recharts line chart, KPIs, outcome split bar), search + role/status badges + enable/disable + promote/demote + delete actions.
- Dark mode toggle (sidebar + mobile header), `localStorage` persistence, `prefers-color-scheme` initial fallback.
- Tests: 29/29 backend pytest cases passing (auth, admin RBAC, self-protection, disable-blocks-login, OCR regression, history scoping, masking guarantee).

## Backlog (Prioritised)

### P1 — High value next
- [ ] Verhoeff checksum on Aadhaar number (catches typos / fakes server-side)
- [ ] Manual edit/correct extracted fields before saving
- [ ] Bulk upload (multiple cards) + CSV export of history
- [ ] HTTP 5xx for upstream LLM errors (currently 200 success=false)
- [ ] Tighten CORS to explicit frontend origin

### P2
- [ ] More document types: PAN, DL, Voter ID, Passport (multi-ID scanner)
- [ ] Aadhaar QR code scanning (offline cryptographic validation)
- [ ] Face detection on uploaded ID photo
- [ ] Bounding-box overlay on preview from LLM coordinates
- [ ] Public REST API + per-user API keys + rate limiting

### P3
- [ ] PWA / installable mobile app with offline queue
- [ ] Email weekly digest
- [ ] Share read-only scan links (with expiry)
- [ ] Stripe subscription tiers

## Test Credentials
- Admin: `admin@aadhaarscan.app` / `Admin@1234`
- Demo:  `demo@aadhaarscan.app`  / `Demo@1234`

## Next Actions
1. Ship for user review.
2. Pick from P1 backlog based on user direction.
