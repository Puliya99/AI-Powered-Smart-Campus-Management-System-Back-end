# AI-Powered Smart Campus Management System – Backend

## 📌 Overview
This backend service powers the AI-Powered Smart Campus Management System, providing secure APIs for student management, academic operations, financial tracking, AI analytics, chatbot integration, and online assessments with anti-cheating mechanisms.

The backend is built using **Node.js, Express, TypeScript, PostgreSQL, and TypeORM**, following enterprise-level architecture and best practices.

---

## 🧠 Core Features
- Multi-role authentication (Admin, Staff, Lecturer, Student)
- Student, lecturer, program, batch & enrollment management
- Attendance, payments, assignments & results management
- Online quiz & exam system
- **Face detection–based anti-cheating for quizzes**
- AI-powered student risk prediction
- Lecturer effectiveness analysis
- Real-time notifications
- Secure JWT authentication

---

## 🛠️ Technology Stack
| Component | Technology |
|--------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| ORM | TypeORM |
| Database | PostgreSQL |
| Authentication | JWT + bcrypt |
| AI Integration | Python (separate module) |
| Hosting | Firebase / Cloud |

---

## 📂 Project Structure
src/
├── entities/ # Database models
├── controllers/ # API controllers
├── services/ # Business logic
├── routes/ # Route definitions
├── middleware/ # Auth, role, validation
├── dto/ # Request validation DTOs
├── ai/ # AI integration logic
├── utils/ # Helpers and utilities
├── app.ts # Express app
└── server.ts # Server entry

yaml
Copy code

---

## 🔐 Authentication
- JWT-based authentication
- Role-based authorization middleware
- Password hashing using bcrypt
- Token expiration & refresh handling

---

## 🧪 Online Quiz & Anti-Cheating
- Time-limited quizzes
- One attempt per student
- Auto grading
- **AI-powered face detection monitoring**
- Automatic quiz cancellation on violation
- Lecturer notification on cheating detection

---

## 🚀 Getting Started

### 1️⃣ Install Dependencies
```bash
npm install
2️⃣ Configure Environment
Create .env:

env
Copy code
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=1234
DB_NAME=smart_campus
JWT_SECRET=your_secret
3️⃣ Run Migrations
bash
Copy code
npm run migration:run
4️⃣ Start Server
bash
Copy code
npm run dev
📡 API Documentation
RESTful APIs

Swagger/OpenAPI supported

Standard JSON responses

🔒 Security Measures
Input validation

SQL injection prevention

Role-based access control

Rate limiting

Secure password storage

📈 AI Capabilities
Predict student performance risk

Detect exam eligibility risk

Analyze feedback sentiment

Generate recommendations

📌 License
Academic / Educational Use Only

yaml
Copy code
