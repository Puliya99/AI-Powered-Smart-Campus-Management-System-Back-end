import { config } from 'dotenv'

config()

interface EnvConfig {
  // Server
  PORT: number
  API_PREFIX: string

  // Database
  DB_HOST: string
  DB_PORT: number
  DB_USER: string
  DB_PASSWORD: string
  DB_NAME: string
  DB_SSL: boolean

  // JWT
  JWT_SECRET: string
  JWT_EXPIRE: string
  JWT_REFRESH_SECRET: string
  JWT_REFRESH_EXPIRE: string

  // AI Service
  AI_SERVICE_URL: string

  // Upload
  MAX_FILE_SIZE: number
  UPLOAD_PATH: string

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number
  RATE_LIMIT_MAX_REQUESTS: number

  // CORS
  CORS_ORIGIN: string

  // Email (Optional)
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USER?: string
  SMTP_PASSWORD?: string
  EMAIL_FROM?: string
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue
  if (!value) {
    throw new Error(`❌ Environment variable ${key} is not defined`)
  }
  return value
}

const getEnvAsNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key]
  if (!value) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`❌ Environment variable ${key} is not defined`)
  }

  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`❌ Environment variable ${key} must be a number`)
  }

  return parsed
}

const getEnvAsBoolean = (
  key: string,
  defaultValue = false
): boolean => {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

export const env: EnvConfig = {
  // Server
  PORT: getEnvAsNumber('PORT', 5000),
  API_PREFIX: getEnv('API_PREFIX', '/api/v1'),

  // Database
  DB_HOST: getEnv('DB_HOST', 'localhost'),
  DB_PORT: getEnvAsNumber('DB_PORT', 5432),
  DB_USER: getEnv('DB_USER', 'postgres'),
  DB_PASSWORD: getEnv('DB_PASSWORD'),
  DB_NAME: getEnv('DB_NAME', 'smart_campus_db'),
  DB_SSL: getEnvAsBoolean('DB_SSL', false),

  // JWT (SECURE)
  JWT_SECRET: getEnv('JWT_SECRET'),
  JWT_EXPIRE: getEnv('JWT_EXPIRE', '15m'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRE: getEnv('JWT_REFRESH_EXPIRE', '30d'),

  // AI Service
  AI_SERVICE_URL: getEnv('AI_SERVICE_URL', 'http://localhost:8000'),

  // Upload
  MAX_FILE_SIZE: getEnvAsNumber(
    'MAX_FILE_SIZE',
    5 * 1024 * 1024
  ),
  UPLOAD_PATH: getEnv('UPLOAD_PATH', './uploads'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: getEnvAsNumber(
    'RATE_LIMIT_WINDOW_MS',
    15 * 60 * 1000
  ),
  RATE_LIMIT_MAX_REQUESTS: getEnvAsNumber(
    'RATE_LIMIT_MAX_REQUESTS',
    100
  ),

  // CORS (explicit)
  CORS_ORIGIN: getEnv('CORS_ORIGIN', '*'),

  // Email (Optional)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
}

// Validate critical environment variables
export const validateEnv = (): void => {
  const requiredVars = [
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ]

  const missing = requiredVars.filter(
    (key) => !process.env[key]
  )

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables: ${missing.join(', ')}`
    )
  }

  if (env.JWT_SECRET.length < 64) {
    throw new Error('❌ JWT_SECRET must be at least 64 characters')
  }

  if (env.JWT_REFRESH_SECRET.length < 64) {
    throw new Error('❌ JWT_REFRESH_SECRET must be at least 64 characters')
  }

  console.log('✅ Environment variables validated successfully')
}

export default env
