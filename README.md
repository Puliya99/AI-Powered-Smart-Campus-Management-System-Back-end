# AI-Powered Smart Campus Management System – Backend

## 📌 Overview
This backend service powers the AI-Powered Smart Campus Management System, providing secure APIs for student management, academic operations, financial tracking, AI analytics, chatbot integration, and online assessments with anti-cheating mechanisms.

The backend is built using **Node.js, Express, TypeScript, PostgreSQL, and TypeORM**, following enterprise-level architecture and best practices.

---

## 🧠 Core Features
- **Multi-role Authentication**: Secure JWT-based auth for Admin, Staff, Lecturer, and Student roles.
- **Academic Management**: Comprehensive management of students, lecturers, programs, batches, and enrollments.
- **Operational Tracking**: Attendance, payments, assignments, and results management.
- **Online Quiz & Exam System**: Time-limited assessments with auto-grading.
- **Anti-Cheating Mechanisms**: **Face detection-based monitoring** for online quizzes.
- **AI Analytics**: Student performance risk prediction and lecturer effectiveness analysis.
- **Real-time Communication**: Integrated notifications and live updates via Socket.io.

---

## 🛠️ Technology Stack
| Component | Technology |
|:---|:---|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Language** | TypeScript |
| **ORM** | TypeORM |
| **Database** | PostgreSQL |
| **Real-time** | Socket.io |
| **Authentication** | JWT + bcrypt |
| **AI Integration** | Python (separate AI module) |
| **Security** | Helmet, CORS, Express-Rate-Limit |

---

## 📋 Requirements
- **Node.js**: v18.x or higher
- **npm**: v8.x or higher
- **PostgreSQL**: v14.x or higher
- **AI Service**: A running instance of the companion AI service (optional for core features)

---

## 🚀 Getting Started

### 1️⃣ Installation
```bash
npm install
```

### 2️⃣ Environment Configuration
Create a `.env` file in the root directory and configure the following variables:

```env
# Server Configuration
PORT=5000
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=smart_campus_db
DB_SSL=false

# JWT Configuration
JWT_SECRET=your_super_secret_key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRE=30d

# AI Service Configuration
AI_SERVICE_URL=http://localhost:8000

# File Upload Configuration
MAX_FILE_SIZE=5242880 # 5MB
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
```

### 3️⃣ Database Setup
Ensure PostgreSQL is running and the database specified in `DB_NAME` exists. Run migrations to set up the schema:

```bash
# Using the TypeORM CLI script
npm run typeorm migration:run -- -d ./src/config/database.ts
```

### 4️⃣ Running the Server
**Development Mode (with hot-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

---

## 📜 Available Scripts
- `npm run dev`: Starts the development server using `ts-node-dev`.
- `npm run build`: Compiles TypeScript to JavaScript in the `dist/` directory.
- `npm start`: Runs the compiled server from `dist/server.js`.
- `npm run typeorm`: CLI tool for TypeORM management.

---

## 📂 Project Structure
```text
src/
├── ai/                 # AI integration and analytics logic
├── config/             # Configuration (Database, Env, Socket, etc.)
├── controllers/        # Express controllers (Request handling)
├── dto/                # Data Transfer Objects & Validation schemas
├── entities/           # TypeORM Database Entities (Models)
├── middleware/         # Custom middleware (Auth, Error, Validation)
├── migrations/         # TypeORM Database Migrations
├── routes/             # API Route definitions
├── services/           # Business logic layer
├── utils/              # Helper functions and Logger
├── app.ts              # Express application setup
└── server.ts           # Entry point for the server
```

---

## 📡 API Endpoints
The API is versioned under `/api/v1`. Key modules include:
- `POST /auth/login`: User authentication
- `GET /students`: Student management
- `GET /quizzes`: Online assessment management
- `GET /performance`: AI-powered performance analytics
- `GET /notifications`: Real-time user notifications

*(Detailed API documentation via Swagger is supported - TODO: Add Swagger UI path)*

---

## 🧪 Testing
Unit and integration tests are managed via **Jest**.

```bash
# Run tests
npm test
# TODO: Add specific test scripts if they are defined in package.json
```

---

## 📈 AI Capabilities
- **Performance Prediction**: Predicts students at risk based on historical data.
- **Eligibility Analysis**: Detects exam eligibility risks.
- **Sentiment Analysis**: Analyzes feedback from students and staff.
- **Face Detection**: Real-time cheating detection during online assessments.

---

## 📌 License
ISC License.

---
© 2026 AI-Powered Smart Campus Management System
