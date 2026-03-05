# AI-Powered Smart Campus Management System — Backend

## Overview

The server-side API for the AI-Powered Smart Campus Management System. Provides secure RESTful APIs for academic management, financial tracking, AI analytics, real-time communication, and online assessments with anti-cheating mechanisms.

Built with **Node.js**, **Express**, **TypeScript**, **PostgreSQL**, and **TypeORM**.

---

## Core Features

- **Multi-role Authentication** — JWT-based auth with Admin, Staff, Lecturer, and Student roles
- **Academic Management** — Students, lecturers, programs, modules, batches, enrollments, centers
- **Operational Tracking** — Attendance, payments, assignments, results, schedules
- **Online Quiz System** — Time-limited assessments with auto-grading and violation tracking
- **AI Analytics** — Student performance risk prediction via ML (proxied to Python AI module)
- **RAG Chatbot** — Lecture material Q&A using Gemini LLM + FAISS vector search
- **AI Proctoring** — YOLOv8m object detection + MediaPipe head pose estimation
- **Real-time Communication** — Socket.IO for notifications and WebRTC signaling
- **Video Meetings** — WebRTC-based online classes with participant tracking
- **WebAuthn/Passkey** — Biometric attendance via kiosk terminals
- **Email Integration** — SMTP emails for account creation and password resets
- **Library System** — Book management with borrowing tracking

---

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.9 |
| Runtime | Node.js | 18+ |
| Framework | Express.js | 4.22 |
| ORM | TypeORM | 0.3.28 |
| Database | PostgreSQL (pg driver) | 8.16 |
| Auth | JWT (jsonwebtoken 9.0), bcrypt 6.0 + bcryptjs 2.4, WebAuthn | — |
| Real-time | Socket.IO | 4.8 |
| File Uploads | Multer 1.4 (UUID filenames, 5 MB limit) | — |
| Email | Nodemailer | 7.0 |
| Logging | Winston 3.19, Morgan 1.10 | — |
| Security | Helmet 7.2, express-rate-limit 7.5, CORS | — |
| Validation | class-validator 0.14, class-transformer 0.5 | — |
| Compression | compression | 1.8 |
| Excel Export | XLSX | 0.18 |
| Test Framework | Jest 29.7 + Supertest 6.3 + ts-jest | — |

---

## Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **npm** v9+
- **PostgreSQL** v14+ — local instance, or a hosted service such as [Neon](https://neon.tech) (set `DB_SSL=true` for Neon)

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

Update all required values (see [Environment Variables](#environment-variables)).

### 3. Database Setup

Ensure your PostgreSQL instance is running and the database named in `DB_NAME` exists.

> **Neon:** Create the database in the Neon console before starting. Auto-DB-creation does not apply to hosted/SSL connections.
>
> **Local PostgreSQL:** TypeORM will attempt to create the database on first run if it does not exist, then auto-sync the schema from entities (`synchronize: true`).

### 4. Run the Server

**Development (hot-reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

The server starts on port `5000` by default.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with `ts-node-dev` (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/server.js` |
| `npm test` | Run tests with Jest |
| `npm run test:coverage` | Run Jest with coverage report (output: `coverage/`) |
| `npm run typeorm` | TypeORM CLI wrapper |
| `npm run test-predict` | Run AI prediction smoke-test script |

---

## Environment Variables

Copy `Back-end/.env.example` to `Back-end/.env` and fill in all required values.

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | **required** |
| `DB_NAME` | Database name | `neondb` |
| `DB_SSL` | Enable SSL (`true` for Neon / hosted) | `false` |
| `JWT_SECRET` | JWT signing secret (≥32 chars) | **required** |
| `JWT_EXPIRE` | Access token expiry | `7d` |
| `JWT_REFRESH_SECRET` | Refresh token secret | **required** |
| `JWT_REFRESH_EXPIRE` | Refresh token expiry | `30d` |
| `AI_SERVICE_URL` | Python AI module base URL | `http://localhost:8001` |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |
| `GEMINI_API_KEY` | Google Gemini API key | **required** |
| `MAX_FILE_SIZE` | Max upload size (bytes) | `5242880` |
| `UPLOAD_PATH` | Upload storage directory | `./uploads` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `1000` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username / email address | — |
| `SMTP_PASSWORD` | SMTP password or app password | **required** |
| `EMAIL_FROM` | Sender email address | — |
| `LOG_LEVEL` | Winston log level | `info` |
| `FRONTEND_URL` | Frontend URL (used in email links) | `http://localhost:3000` |
| `WEBAUTHN_RP_NAME` | WebAuthn relying party name | — |
| `WEBAUTHN_RP_ID` | WebAuthn relying party ID | — |
| `WEBAUTHN_ORIGIN` | WebAuthn expected origin | — |

---

## Project Structure

```
Back-end/
├── src/
│   ├── server.ts            # Entry: env validation, DB init, HTTP server,
│   │                        # Socket.IO, scheduler, graceful shutdown
│   ├── app.ts               # Express app: middleware stack + route mounting
│   ├── config/
│   │   ├── database.ts      # TypeORM DataSource (PostgreSQL, SSL, connection pool)
│   │   ├── env.ts           # Type-safe environment variable loader
│   │   └── socket.ts        # Socket.IO: WebRTC signaling + push notifications
│   ├── controllers/         # 27 request handler modules
│   ├── routes/
│   │   ├── index.ts         # Master router — mounts all sub-routers at /api/v1
│   │   └── *.routes.ts      # 28 route definition files
│   ├── services/
│   │   ├── ai.service.ts    # HTTP proxy to Python AI module
│   │   ├── auth.service.ts  # Register, login, JWT, password management
│   │   ├── email.service.ts # SMTP emails via Nodemailer
│   │   ├── scheduler.service.ts  # Weekly batch AI prediction runner
│   │   └── ...              # attendance, dashboard, notification, user, etc.
│   ├── entities/            # 31 TypeORM entities (PostgreSQL tables)
│   │   ├── User, Student, Lecturer, Admin
│   │   ├── Program, Module, Batch, Center, Enrollment
│   │   ├── Schedule, Attendance
│   │   ├── LectureNote, MaterialChunk
│   │   ├── Quiz, QuizQuestion, QuizAnswer, QuizAttempt, QuizViolation
│   │   ├── Assignment, Submission, Result
│   │   ├── Payment, Prediction, Feedback
│   │   ├── Notification, Setting
│   │   ├── VideoMeeting, MeetingParticipant
│   │   ├── LibraryBook, Borrowing
│   │   └── WebAuthnCredential
│   ├── enums/               # Role, AttendanceStatus, BatchStatus, PaymentStatus, etc.
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification + role-based authorization
│   │   ├── error.middleware.ts   # Global error handler
│   │   └── upload.middleware.ts  # Multer config (UUID filenames, 5 MB, allowed types)
│   ├── dto/                 # Data Transfer Objects with class-validator decorators
│   ├── utils/
│   │   ├── logger.ts        # Winston logger (file + console transports)
│   │   └── ApiResponse.ts   # Standardized JSON response wrapper
│   ├── types/
│   ├── validators/
│   ├── repositories/
│   ├── scripts/
│   │   └── test-prediction.ts
│   └── tests/               # Jest test directory
│       ├── unit/            # Unit tests (controllers, services, utils)
│       ├── integration/     # Integration tests (API routes via Supertest)
│       └── setup.ts         # Jest global setup (DB, env, mocks)
├── uploads/                 # File upload storage (git-ignored)
├── logs/                    # Winston log files: combined.log, error.log
├── dist/                    # Compiled output (git-ignored)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Middleware Stack

Applied in order:

1. **Helmet** — Security headers
2. **CORS** — Configurable origin via `CORS_ORIGIN`
3. **Rate Limiting** — Auth endpoints: 20 req/15 min; general API: configurable via env
4. **Body Parser** — JSON and URL-encoded (10 MB limit)
5. **Compression** — Gzip responses
6. **Morgan** — HTTP request logging
7. **Route Handlers**
8. **Error Middleware** — Global error handler with standardized `ApiResponse` shape

---

## Authentication & Authorization

- **JWT access tokens** signed with `JWT_SECRET`, default 7-day expiry
- **Refresh tokens** signed with `JWT_REFRESH_SECRET`, 30-day expiry
- Passwords hashed with **bcryptjs** (10 salt rounds) via TypeORM `@BeforeInsert`/`@BeforeUpdate` hooks
- `AuthMiddleware` provides: `authenticate`, `authorize(...roles)`, `isAdmin`, `isLecturerOrAdmin`, `isStudent`
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
| `/library` | Book management + borrowing |

---

## Database

- **PostgreSQL** with TypeORM 0.3.28
- `synchronize: true` — auto-syncs schema from entities on startup (**disable in production**)
- Connection pool: min 2, max 10
- SSL support via `DB_SSL=true` (required for Neon and other hosted providers)
- **31 entities** covering the full domain model

---

## Architecture

```
Browser (React SPA, port 3000)
    │
    ├── HTTP Bearer JWT ────────► Express API (port 5000)
    └── Socket.IO ──────────────► Express API (WebRTC signaling + notifications)

Express API
    ├── TypeORM ────────────────► PostgreSQL (Neon or local)
    └── Axios ──────────────────► Python FastAPI AI Module (port 8001)
                                      ├── RandomForest  (risk prediction)
                                      ├── FAISS + Gemini (RAG chatbot)
                                      └── YOLOv8m + MediaPipe (proctoring)
```

---

## Testing

- **Framework:** Jest + Supertest + ts-jest
- **Run:** `npm test` · with coverage: `npm run test:coverage`
- **Directory:** `src/tests/` — `unit/` and `integration/` subdirectories
- **Coverage output:** `coverage/` (lcov + html)
- **Path aliases** are resolved via `moduleNameMapper` in `jest.config.ts`

---

## License

MIT — see `LICENSE`.

Copyright © 2026 Pulinda Mathagadeera
