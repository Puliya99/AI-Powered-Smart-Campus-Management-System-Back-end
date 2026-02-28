# AI-Powered Smart Campus Management System - Backend

## Overview

The server-side API for the AI-Powered Smart Campus Management System. Provides secure RESTful APIs for academic management, financial tracking, AI analytics, real-time communication, and online assessments with anti-cheating mechanisms.

Built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL**, and **TypeORM**. Includes a companion **Python FastAPI** microservice for AI/ML features.

---

## Core Features

- **Multi-role Authentication** - JWT-based auth with Admin, Staff, Lecturer, and Student roles
- **Academic Management** - Students, lecturers, programs, modules, batches, enrollments
- **Operational Tracking** - Attendance, payments, assignments, results, schedules
- **Online Quiz System** - Time-limited assessments with auto-grading and violation tracking
- **AI Analytics** - Student performance risk prediction via ML (RandomForest)
- **RAG Chatbot** - Lecture material Q&A using Gemini LLM + FAISS vector search
- **AI Proctoring** - YOLOv8m object detection + MediaPipe head pose estimation
- **Real-time Communication** - Socket.IO for notifications and WebRTC signaling
- **Video Meetings** - WebRTC-based online classes with participant tracking
- **WebAuthn/Passkey** - Biometric attendance via kiosk terminals
- **Email Integration** - SMTP emails for account creation, password resets

---

## Technology Stack

### Node.js API

| Category | Technology |
|---|---|
| Language | TypeScript 5.9 |
| Runtime | Node.js |
| Framework | Express.js 4.22 |
| ORM | TypeORM 0.3.28 |
| Database | PostgreSQL (pg 8.16) |
| Auth | JWT (jsonwebtoken 9.0), bcryptjs, WebAuthn |
| Real-time | Socket.IO 4.8 |
| File Uploads | Multer 1.4 (UUID filenames, 5MB limit) |
| Email | Nodemailer 7.0 |
| Logging | Winston 3.19, Morgan 1.10 |
| Security | Helmet 7.2, express-rate-limit 7.5, CORS |
| Validation | class-validator 0.14, class-transformer 0.5 |
| Compression | compression 1.8 |
| Testing | Jest, Supertest, ts-jest |

### AI Module (Python)

| Category | Technology |
|---|---|
| Language | Python 3.9+ |
| Framework | FastAPI |
| ML | Scikit-learn (RandomForestClassifier), Pandas, NumPy |
| Embeddings | Sentence-Transformers (all-MiniLM-L6-v2) |
| Vector Search | FAISS |
| LLM | Google Gemini (via google-genai SDK) |
| Proctoring | YOLOv8m (ultralytics), MediaPipe, OpenCV |

---

## Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **npm** v9+
- **PostgreSQL** v14+
- **Python** 3.9+ (for AI module)

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Update the values as needed (see [Environment Variables](#environment-variables)).

### 3. Database Setup

Ensure PostgreSQL is running. The server will auto-create the database specified in `DB_NAME` if it does not exist. TypeORM `synchronize: true` auto-syncs the schema from entities on startup.

### 4. Start the AI Module (optional, required for AI features)

```bash
cd ai-module
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 5. Run the Server

**Development (with hot-reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with `ts-node-dev` (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/server.js` |
| `npm run test` | Run tests with Jest |
| `npm run typeorm` | TypeORM CLI wrapper |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `smart_campus_db` |
| `DB_SSL` | Enable SSL | `false` |
| `JWT_SECRET` | JWT signing secret | **required** |
| `JWT_EXPIRE` | Token expiry | `7d` |
| `JWT_REFRESH_SECRET` | Refresh token secret | **required** |
| `JWT_REFRESH_EXPIRE` | Refresh token expiry | `30d` |
| `AI_SERVICE_URL` | Python AI module URL | `http://localhost:8001` |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |
| `GEMINI_API_KEY` | Google Gemini API key | **required** |
| `MAX_FILE_SIZE` | Max upload size (bytes) | `5242880` |
| `UPLOAD_PATH` | Upload directory | `./uploads` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP server port | - |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `EMAIL_FROM` | Sender email address | - |
| `LOG_LEVEL` | Winston log level | `info` |
| `FRONTEND_URL` | Frontend URL (for emails) | `http://localhost:3000` |
| `WEBAUTHN_RP_NAME` | WebAuthn relying party name | - |
| `WEBAUTHN_RP_ID` | WebAuthn relying party ID | - |
| `WEBAUTHN_ORIGIN` | WebAuthn expected origin | - |

---

## Project Structure

```
Back-end/
├── src/
│   ├── server.ts            # Entry: env validation, DB init, HTTP server,
│   │                        # Socket.IO, scheduler, graceful shutdown
│   ├── app.ts               # Express app: middleware stack + route mounting
│   ├── config/
│   │   ├── database.ts      # TypeORM DataSource (PostgreSQL, auto-create DB)
│   │   ├── env.ts           # Type-safe environment variable loader
│   │   └── socket.ts        # Socket.IO for WebRTC signaling + notifications
│   ├── controllers/         # 29 request handler modules
│   ├── routes/
│   │   ├── index.ts         # Master router, mounts all sub-routers at /api/v1
│   │   └── *.routes.ts      # 27 route definition files
│   ├── services/
│   │   ├── ai.service.ts    # Proxy to Python AI module
│   │   ├── auth.service.ts  # Register, login, JWT, password management
│   │   ├── email.service.ts # SMTP emails via Nodemailer
│   │   ├── scheduler.service.ts  # Weekly batch AI prediction runner
│   │   └── ...              # attendance, dashboard, notification, user, etc.
│   ├── entities/            # 21 TypeORM entities (PostgreSQL tables)
│   │   ├── User.entity.ts, Student.entity.ts, Lecturer.entity.ts
│   │   ├── Program.entity.ts, Module.entity.ts, Batch.entity.ts, Center.entity.ts
│   │   ├── Enrollment.entity.ts, Schedule.entity.ts, Attendance.entity.ts
│   │   ├── LectureNote.entity.ts, MaterialChunk.entity.ts
│   │   ├── Quiz.entity.ts, QuizQuestion.entity.ts, QuizAnswer.entity.ts,
│   │   │   QuizAttempt.entity.ts, QuizViolation.entity.ts
│   │   ├── Assignment.entity.ts, Submission.entity.ts, Result.entity.ts
│   │   ├── Payment.entity.ts, Prediction.entity.ts, Feedback.entity.ts
│   │   ├── Notification.entity.ts, Setting.entity.ts
│   │   ├── VideoMeeting.entity.ts, MeetingParticipant.entity.ts
│   │   └── WebAuthnCredential.entity.ts
│   ├── enums/               # Role, AttendanceStatus, BatchStatus, PaymentStatus, etc.
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification + role-based authorization
│   │   ├── error.middleware.ts   # Global error handler
│   │   └── upload.middleware.ts  # Multer config (UUID filenames, 5MB, allowed types)
│   ├── dto/                 # Data Transfer Objects with class-validator decorators
│   ├── utils/
│   │   ├── logger.ts        # Winston logger (file + console transports)
│   │   └── ApiResponse.ts   # Standardized JSON response wrapper
│   ├── types/
│   ├── validators/
│   ├── repositories/
│   ├── scripts/
│   └── tests/
├── ai-module/
│   └── main.py              # Python FastAPI AI microservice
├── uploads/                 # File upload storage
├── logs/                    # Winston log files (combined.log, error.log)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Middleware Stack

Applied in order:

1. **Helmet** - Security headers
2. **CORS** - Configurable origin via `CORS_ORIGIN`
3. **Rate Limiting** - Auth endpoints: 20 req/15min; general API: 100 req/15min
4. **Body Parser** - JSON and URL-encoded (10MB limit)
5. **Compression** - Gzip responses
6. **Morgan** - HTTP request logging
7. **Route Handlers**
8. **Error Middleware** - Global error handler with standardized responses

---

## Authentication & Authorization

- **JWT tokens** signed with `JWT_SECRET`, default 7-day expiry
- **Refresh tokens** with `JWT_REFRESH_SECRET`, 30-day expiry
- Passwords hashed with **bcryptjs** (10 salt rounds) via TypeORM `@BeforeInsert`/`@BeforeUpdate` hooks
- `AuthMiddleware` class provides: `authenticate`, `authorize(...roles)`, `isAdmin`, `isLecturerOrAdmin`, `isStudent`
- **WebAuthn/Passkey** via `@simplewebauthn/server` for biometric kiosk attendance
- **Four roles:** ADMIN, USER (staff), LECTURER, STUDENT

---

## API Endpoints

All endpoints are mounted under `/api/v1`.

### Auth & Password

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/change-password` | Change password |
| PUT | `/auth/profile` | Update profile |
| POST | `/auth/logout` | Logout |
| POST | `/password/forgot-password` | Send reset email |
| POST | `/password/reset-password` | Reset password |

### Academic Resources

| Prefix | Description |
|---|---|
| `/students` | CRUD + stats + WebAuthn endpoints |
| `/lecturers` | CRUD + stats |
| `/programs` | CRUD + stats + dropdown |
| `/modules` | CRUD + stats + dropdown |
| `/batches` | CRUD + stats + enrollment list |
| `/centers` | CRUD + stats |
| `/enrollments` | Enroll, withdraw, list by student/batch |

### Operations

| Prefix | Description |
|---|---|
| `/schedules` | CRUD + by-date + by-lecturer |
| `/attendance` | Mark, CRUD, reports by schedule/student/batch |
| `/quizzes` | Create, add questions, publish, start/submit attempt, results |
| `/assignments` | CRUD by module, submit, grade, download |
| `/results` | By module, upsert, bulk-upsert, my-results |
| `/payments` | CRUD + student payments + receipt upload |

### Analytics & Communication

| Prefix | Description |
|---|---|
| `/dashboard` | Role-specific dashboard data |
| `/performance` | By student, by batch, overall |
| `/ai` | Predict exam risk, train model, student features |
| `/reports` | Enrollment, payment, attendance reports |
| `/notifications` | List, mark-read, mark-all-read |
| `/feedback` | Submit, respond, CRUD |
| `/lecture-notes` | CRUD by module |
| `/video-meetings` | Create, join, leave, end, participants |
| `/settings` | System settings CRUD |
| `/users` | User management CRUD + stats |
| `/kiosk` | Public kiosk attendance (passkey/fingerprint) |

---

## Database

- **PostgreSQL** with TypeORM 0.3.28
- `synchronize: true` - auto-syncs schema from entities on startup
- Connection pool: min 2, max 10
- Auto-creates database if it doesn't exist
- SSL support via `DB_SSL` env var
- **21 entities** covering the full domain model

---

## AI Module

A standalone Python FastAPI microservice at `ai-module/main.py`.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/train` | Train RandomForest on historical student data |
| POST | `/predict` | Predict exam failure risk (HIGH/MEDIUM/LOW) |
| POST | `/process-material` | Upload PDF/DOCX/PPTX, extract text, embed, store in FAISS |
| POST | `/chat` | RAG chatbot: embed query, retrieve chunks, answer via Gemini |
| POST | `/api/proctor/detect-objects` | YOLOv8m object detection (phone, book, laptop) |
| POST | `/api/proctor/head-pose` | MediaPipe head pose + eye closure detection |
| POST | `/api/proctor/analyze` | Combined proctoring analysis |
| GET | `/api/proctor/health` | Health check |

### ML Features for Risk Prediction

Attendance percentage, assignment scores, quiz averages, GPA, missed classes, late submissions, face violations, payment delay days, previous exam scores.

### AI Module Setup

```bash
cd ai-module
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

---

## Architecture

```
Browser (React SPA)
    |
    |-- HTTP (Bearer JWT) --> Express API (port 5000)
    |-- Socket.IO ----------> Express API (WebRTC signaling + notifications)
    |
Express API
    |-- TypeORM --> PostgreSQL (smart_campus_db)
    |-- Axios   --> Python FastAPI AI Module (port 8001)
                        |-- FAISS (in-memory vector store)
                        |-- Google Gemini (external LLM)
                        |-- YOLOv8m + MediaPipe (proctoring)
                        |-- RandomForest (risk prediction)
```

---

## Testing

- **Framework:** Jest + Supertest + ts-jest
- **Run:** `npm test`
- **Directory:** `src/tests/`

---

## License

ISC
