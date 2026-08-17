# Aadhaar OCR — Full-Stack Web App

A secure, modern web app to scan Indian Aadhaar cards and extract structured fields (Name, DOB, Gender, masked Aadhaar number) using GPT-5.2 Vision. Fully authenticated dashboard with per-user history.

> **Privacy**: Uploaded images are never persisted. Everything is processed in memory and discarded after extraction. Only the extracted (masked) fields are saved.

---

## Stack

| Layer       | Tech                                                   |
| ----------- | ------------------------------------------------------ |
| Frontend    | React 19 + Tailwind CSS + shadcn/ui + sonner + lucide  |
| Backend     | FastAPI + Motor (async MongoDB) + PyMuPDF + Pillow     |
| Database    | MongoDB                                                |
| OCR         | GPT-5.2 Vision via `emergentintegrations` (Universal Key) |
| Auth        | JWT (Bearer) + bcrypt                                  |

---

## Project Structure
```
.
├── backend/
│   ├── server.py              # FastAPI app + /api/upload OCR
│   ├── auth.py                # JWT, bcrypt, /api/auth/* router
│   ├── history.py             # Scan model, /api/history + /api/stats
│   ├── requirements.txt       # Python deps (incl. private --extra-index-url)
│   └── .env                   # See sample below
├── frontend/
│   ├── src/
│   │   ├── App.js, App.css, index.css
│   │   ├── lib/api.js                    # Axios + token interceptor
│   │   ├── contexts/AuthContext.jsx
│   │   ├── components/AppShell.jsx, ProtectedRoute.jsx, ui/*
│   │   └── pages/Login, Signup, Dashboard, Upload, History, Profile
│   ├── package.json
│   └── .env                   # REACT_APP_BACKEND_URL
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

---

## Local Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and **Yarn** (do **not** use npm — see `package.json`)
- MongoDB running locally on `mongodb://localhost:27017` (or remote URI)

### 2. Backend
```bash
cd backend

# Create virtual env (recommended)
python3 -m venv .venv && source .venv/bin/activate     # Linux/Mac
# .venv\Scripts\activate                               # Windows

# Install deps. emergentintegrations is hosted on a private index; the URL is
# already pinned at the top of requirements.txt via --extra-index-url, so a
# normal pip install works:
pip install -r requirements.txt
```

Create `backend/.env`:
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="aadhaar_ocr"
CORS_ORIGINS="*"

# Get this from your Emergent profile (Universal Key). Required for OCR.
EMERGENT_LLM_KEY="sk-emergent-XXXXXXXXXXXX"

# Auth
JWT_SECRET="change-me-to-a-64-char-random-hex"
JWT_EXP_MINUTES="10080"

# Demo seed user (auto-created on startup; idempotent)
DEMO_USER_EMAIL="demo@aadhaarscan.app"
DEMO_USER_PASSWORD="Demo@1234"
DEMO_USER_NAME="Demo User"
```

Run:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Health check: http://localhost:8000/api/health

### 3. Frontend
```bash
cd frontend
yarn install
```

Create `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Run:
```bash
npm start
```
Open <http://localhost:3001>.

---

## Demo Credentials
The backend seeds a demo account on first startup:

| Email | Password |
| --- | --- |
| `demo@aadhaarscan.app` | `Demo@1234` |

---

## API Reference

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET    | `/api/health`            | —   | Service status |
| POST   | `/api/auth/register`     | —   | `{email, password, name}` → `{token, user}` |
| POST   | `/api/auth/login`        | —   | `{email, password}` → `{token, user}` |
| GET    | `/api/auth/me`           | ✅  | Current user |
| POST   | `/api/auth/logout`       | ✅  | Stateless — client discards token |
| POST   | `/api/upload`            | ✅  | `multipart/form-data` `file=` (JPEG/PNG/WEBP/PDF, ≤ 10 MB) |
| GET    | `/api/history?limit=50`  | ✅  | Newest scans first |
| DELETE | `/api/history/{id}`      | ✅  | Delete one record |
| GET    | `/api/stats`             | ✅  | `{total_uploads, successful, failed, last_upload_at}` |

Auth is `Authorization: Bearer <jwt>`.

### Sample upload response
```json
{
  "success": true,
  "name": "Rahul Sharma",
  "dob": "14/08/1992",
  "gender": "Male",
  "aadhaar_masked": "XXXX XXXX 9012",
  "aadhaar_valid": true,
  "confidence": "high",
  "message": "Aadhaar fields extracted successfully",
  "processed_at": "2026-04-28T06:44:31.093359+00:00"
}
```
The full 12-digit number is **never** returned by the API.

---

## Deployment

### Frontend → Vercel
1. Push to GitHub.
2. Import the repo in Vercel, root = `frontend/`.
3. Build command: `yarn build`. Output dir: `build`.
4. Set env var `REACT_APP_BACKEND_URL` = your deployed backend URL.

### Backend → Render
1. New Web Service → connect repo, root = `backend/`.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Set env vars: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `JWT_SECRET`, `JWT_EXP_MINUTES`, optionally `DEMO_USER_*`, `CORS_ORIGINS=https://<your-vercel-domain>`.

### Database → MongoDB Atlas
Create a free cluster, whitelist Render IPs (or `0.0.0.0/0` for testing), and use the connection string as `MONGO_URL`.

---

## Security Notes
- Passwords hashed with **bcrypt** (auto-salted).
- JWT signed with HS256 + `JWT_SECRET`. Stored in browser `localStorage` and sent as `Bearer` header.
- Aadhaar number is **always** masked server-side as `XXXX XXXX 1234` before any response or DB write — the raw 12-digit number leaves only the LLM call and is immediately discarded.
- Uploaded files cap at 10 MB; MIME whitelist (JPEG/PNG/WEBP/PDF).
- Not affiliated with UIDAI.

---

## Troubleshooting

**`ERROR: Could not find a version that satisfies the requirement emergentintegrations`**
Make sure you ran `pip install -r requirements.txt` — the file already contains the custom `--extra-index-url` directive on line 1. If installing the package directly, use:
```bash
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

**Frontend can't reach backend**
Confirm `REACT_APP_BACKEND_URL` is set in `frontend/.env` and that you restarted `yarn start` after editing.

**OCR returns `success:false` with "OCR service error"**
Check `EMERGENT_LLM_KEY` is set and your Universal Key has balance.

---

## License
Private. © Built with [Emergent](https://emergent.sh).
