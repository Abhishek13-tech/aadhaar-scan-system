# 🔐 Aadhaar OCR — Full-Stack Web App

A secure, modern full-stack web application for scanning Indian Aadhaar documents and extracting structured information such as **Name, Date of Birth, Gender, and masked Aadhaar number** using AI-powered OCR.

The application provides a complete authenticated workflow with **user registration, JWT authentication, document processing, scan history, statistics, and privacy-focused data handling**.

> **Privacy First:** Uploaded document images are processed in memory and are not persisted as image files. Only extracted and masked information is stored for authenticated users.

---

## 🌐 Live Demo

**Live Application:**
https://aadhaar-scan-system.vercel.app

> Create an account and explore the Aadhaar scanning dashboard.

---

## ✨ Key Features

* 🔍 AI-powered Aadhaar OCR
* 📄 Supports JPEG, PNG, WEBP and PDF documents
* 🤖 Vision-based structured data extraction
* 🔐 JWT-based authentication
* 🔑 Password hashing using bcrypt
* 👤 User-specific scan history
* 📊 Upload and processing statistics
* 🛡️ Aadhaar number masking
* 🗑️ Delete individual scan records
* ⚡ FastAPI asynchronous backend
* 💾 MongoDB database
* 📱 Modern responsive React interface
* 🚀 Production deployment support with Vercel and Render
* 🔒 Sensitive document images are not permanently stored

---

## 🛠️ Tech Stack

| Layer               | Technologies                                      |
| ------------------- | ------------------------------------------------- |
| Frontend            | React 19, Tailwind CSS, shadcn/ui, Sonner, Lucide |
| Backend             | FastAPI, Motor, PyMuPDF, Pillow                   |
| Database            | MongoDB                                           |
| OCR / AI            | GPT Vision via `emergentintegrations`             |
| Authentication      | JWT, bcrypt                                       |
| API Communication   | Axios, REST API                                   |
| Frontend Deployment | Vercel                                            |
| Backend Deployment  | Render                                            |
| Database Hosting    | MongoDB Atlas                                     |

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      User           │
                    │  Uploads Document   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │ Authentication/UI   │
                    └──────────┬──────────┘
                               │
                         REST API + JWT
                               │
                               ▼
                    ┌─────────────────────┐
                    │    FastAPI Backend  │
                    │ Validation + Auth   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ AI Vision / OCR     │
                    │ Structured Extract  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ MongoDB             │
                    │ Masked Scan History │
                    └─────────────────────┘
```

---

## 📁 Project Structure

```text
aadhaar-scan-system/
│
├── backend/
│   ├── server.py
│   ├── auth.py
│   ├── history.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.css
│   │   ├── lib/
│   │   │   └── api.js
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   ├── AppShell.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── ui/
│   │   └── pages/
│   │       ├── Login
│   │       ├── Signup
│   │       ├── Dashboard
│   │       ├── Upload
│   │       ├── History
│   │       └── Profile
│   │
│   ├── package.json
│   └── .env.example
│
├── docs/
│   └── screenshots/
│
├── .gitignore
└── README.md
```

---

## 🔐 Authentication & Security

The application implements multiple security measures for protecting user accounts and sensitive document information.

### Authentication

* JWT-based authentication
* Bearer token authorization
* bcrypt password hashing
* Protected API routes
* User-specific scan history
* Token-based frontend authentication

### Document Security

* Uploaded files are processed in memory
* Uploaded images are not permanently persisted
* Supported file types are restricted
* Maximum upload size is limited
* Aadhaar numbers are masked before storage
* Only masked Aadhaar information is stored in scan history

### Important Privacy Notice

This project is **not affiliated with or endorsed by UIDAI**.

The application is intended as a technical demonstration of AI-powered document processing and should not be considered an official Aadhaar verification service.

---

## 📸 Screenshots

Add screenshots of the application in:

```text
docs/screenshots/
```

Recommended screenshots:

1. Login page
2. Signup page
3. Dashboard
4. Aadhaar upload/scanner page
5. OCR result
6. Scan history
7. User profile

Example:

```markdown
![Login](docs/screenshots/login.png)

![Dashboard](docs/screenshots/dashboard.png)

![Aadhaar Scanner](docs/screenshots/upload.png)

![OCR Result](docs/screenshots/result.png)

![Scan History](docs/screenshots/history.png)
```

---

## ⚙️ Local Development

### Prerequisites

Make sure you have:

* Python 3.11+
* Node.js 18+
* npm
* MongoDB
* Required AI/OCR API credentials

---

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd aadhaar-scan-system
```

---

### 2. Backend Setup

```bash
cd backend
```

Create a virtual environment:

### Windows

```bash
python -m venv .venv
.venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file based on `.env.example`.

Example:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="aadhaar_ocr"
CORS_ORIGINS="*"

EMERGENT_LLM_KEY="your-api-key"

JWT_SECRET="your-secure-secret"
JWT_EXP_MINUTES="10080"
```

Start the backend:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Backend API:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/api/health
```

---

## 💻 Frontend Setup

Open a new terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Start the frontend:

```bash
npm start
```

The application will normally be available at:

```text
http://localhost:3000
```

---

## 🔌 API Reference

| Method | Endpoint             | Authentication | Description              |
| ------ | -------------------- | -------------- | ------------------------ |
| GET    | `/api/health`        | No             | Service health check     |
| POST   | `/api/auth/register` | No             | Register a new user      |
| POST   | `/api/auth/login`    | No             | Login user               |
| GET    | `/api/auth/me`       | Yes            | Get current user         |
| POST   | `/api/auth/logout`   | Yes            | Logout client session    |
| POST   | `/api/upload`        | Yes            | Upload document for OCR  |
| GET    | `/api/history`       | Yes            | Get user's scan history  |
| DELETE | `/api/history/{id}`  | Yes            | Delete a scan record     |
| GET    | `/api/stats`         | Yes            | Get user scan statistics |

Authentication uses:

```text
Authorization: Bearer <JWT_TOKEN>
```

---

## 📄 Supported Documents

The application supports:

* JPEG
* PNG
* WEBP
* PDF

Maximum upload size:

```text
10 MB
```

---

## 🤖 OCR Processing Flow

```text
Upload Aadhaar Document
          ↓
File Validation
          ↓
Image / PDF Processing
          ↓
AI Vision OCR
          ↓
Structured Field Extraction
          ↓
Aadhaar Number Masking
          ↓
Validation
          ↓
Store Masked Information
          ↓
Display Result
```

Example extracted response:

```json
{
  "success": true,
  "name": "Example User",
  "dob": "14/08/1992",
  "gender": "Male",
  "aadhaar_masked": "XXXX XXXX 9012",
  "aadhaar_valid": true,
  "confidence": "high"
}
```

> Full Aadhaar numbers should not be exposed in API responses or stored in the application database.

---

## 📊 Dashboard

The authenticated dashboard provides:

* Total uploads
* Successful scans
* Failed scans
* Latest upload information
* Recent scan history
* User profile information

---

## 🗂️ Scan History

Authenticated users can:

* View previous OCR results
* View masked Aadhaar information
* Check processing information
* Delete individual history records

Each user's history is isolated from other users through authenticated API access.

---

## 🚀 Deployment

### Frontend — Vercel

Recommended deployment flow:

```text
GitHub
   ↓
Vercel
   ↓
React Frontend
```

Set the frontend environment variable:

```env
REACT_APP_BACKEND_URL=<your-deployed-backend-url>
```

Build command:

```bash
npm run build
```

---

### Backend — Render

Recommended deployment flow:

```text
GitHub
   ↓
Render
   ↓
FastAPI Backend
```

Start command:

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Configure the required environment variables on the deployment platform.

---

### Database — MongoDB Atlas

MongoDB Atlas can be used as the production database.

Configure:

```env
MONGO_URL=<your-mongodb-atlas-connection-string>
DB_NAME=<your-database-name>
```

---

## 🧪 Testing

The application should be tested for:

* User registration
* User login
* Invalid login credentials
* Protected routes
* Document upload
* Invalid file types
* Oversized files
* OCR extraction
* Aadhaar masking
* Scan history
* History deletion
* Dashboard statistics
* API health status

---

## 🛡️ Security Checklist

Before production deployment:

* [ ] Never commit `.env` files
* [ ] Use strong JWT secrets
* [ ] Use production database credentials
* [ ] Configure CORS correctly
* [ ] Keep API keys private
* [ ] Enable HTTPS
* [ ] Restrict allowed upload types
* [ ] Enforce upload size limits
* [ ] Never expose full Aadhaar numbers unnecessarily
* [ ] Remove test credentials from the repository

---

## 🎯 What This Project Demonstrates

This project demonstrates practical experience with:

* Full-stack web development
* React application development
* REST API development
* FastAPI
* MongoDB
* JWT authentication
* Password hashing
* AI-powered OCR
* Computer vision workflows
* Document processing
* File validation
* Data masking
* Secure API design
* Cloud deployment
* Git and GitHub

---

## 🔮 Future Improvements

Possible future enhancements include:

* Improved OCR confidence scoring
* Additional Indian identity document support
* Advanced document authenticity checks
* Role-based access control
* Audit logging
* Rate limiting
* Improved image preprocessing
* Automated security testing
* Docker-based deployment
* CI/CD pipeline
* More detailed analytics
* Multi-language support

---

## ⚠️ Disclaimer

This project is an independent educational and technical project.

It is **not affiliated with, sponsored by, or endorsed by UIDAI or the Government of India**.

Users should avoid uploading real sensitive identity documents to public or demonstration deployments unless appropriate privacy, security, consent, and compliance measures are in place.

---

## 📄 License

This project is currently provided for educational and demonstration purposes.

No separate open-source license has been specified.

---

## 👨‍💻 Project

**Aadhaar OCR — Full-Stack Web Application**

Built using modern web technologies, AI-powered OCR, secure authentication, and cloud deployment.
