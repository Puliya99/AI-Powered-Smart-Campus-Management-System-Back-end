import { config } from 'dotenv'

config()

interface EnvConfig {
  // Server
  NODE_ENV: string
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
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`)
  }
  return value
}

const getEnvAsNumber = (key: string, defaultValue?: number): number => {
  const value = process.env[key]
  if (!value) {
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Environment variable ${key} is not defined`)
  }
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`)
  }
  return parsed
}

const getEnvAsBoolean = (
  key: string,
  defaultValue: boolean = false
): boolean => {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

export const env: EnvConfig = {
  // Server
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: getEnvAsNumber('PORT', 5000),
  API_PREFIX: getEnv('API_PREFIX', '/api/v1'),

  // Database
  DB_HOST: getEnv('DB_HOST', 'localhost'),
  DB_PORT: getEnvAsNumber('DB_PORT', 5432),
  DB_USER: getEnv('DB_USER', 'postgres'),
  DB_PASSWORD: getEnv('DB_PASSWORD', '1234'),
  DB_NAME: getEnv('DB_NAME', 'smart_campus_db'),
  DB_SSL: getEnvAsBoolean('DB_SSL', false),

  // JWT
  JWT_SECRET: getEnv('JWT_SECRET'),
  JWT_EXPIRE: getEnv('JWT_EXPIRE', '7d'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET', getEnv('JWT_SECRET')),
  JWT_REFRESH_EXPIRE: getEnv('JWT_REFRESH_EXPIRE', '30d'),

  // AI Service
  AI_SERVICE_URL: getEnv('AI_SERVICE_URL', 'http://localhost:8000'),

  // Upload
  MAX_FILE_SIZE: getEnvAsNumber('MAX_FILE_SIZE', 5242880), // 5MB default
  UPLOAD_PATH: getEnv('UPLOAD_PATH', './uploads'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: getEnvAsNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: getEnvAsNumber('RATE_LIMIT_MAX_REQUESTS', 100),

  // CORS
  CORS_ORIGIN: getEnv('CORS_ORIGIN', '*'),

  // Email (Optional)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT)
    : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
}

// Validate critical environment variables
export const validateEnv = (): void => {
  const requiredVars = ['DB_PASSWORD', 'JWT_SECRET']

  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    )
  }

  console.log('✅ Environment variables validated successfully')
}

export default env
