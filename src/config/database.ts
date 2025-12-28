import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

// Database configuration
const dbConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'smart_campus_db',
  synchronize: true, // Always sync schema with entities
  logging: true, // Always show SQL queries
  entities: [path.join(__dirname, '../entities/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../migrations/**/*{.ts,.js}')],
  subscribers: [],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 10, // Maximum pool size
    min: 2, // Minimum pool size
    idleTimeoutMillis: 30000,
  },
};

export const AppDataSource = new DataSource(dbConfig);

// Create database if it doesn't exist
const createDatabaseIfNotExists = async (): Promise<void> => {
  const { Client } = require('pg');

  // Connect to postgres database to create our database
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.username,
    password: dbConfig.password,
    database: 'postgres', // Connect to default postgres database first
  });

  try {
    await client.connect();

    // Check if database exists
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      dbConfig.database,
    ]);

    if (result.rowCount === 0) {
      // Database doesn't exist, create it
      console.log(`📦 Creating database: ${dbConfig.database}...`);
      await client.query(`CREATE DATABASE ${dbConfig.database}`);
      console.log(`✅ Database '${dbConfig.database}' created successfully`);
    } else {
      console.log(`✅ Database '${dbConfig.database}' already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error);
    throw error;
  } finally {
    await client.end();
  }
};

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    // First, create database if it doesn't exist
    await createDatabaseIfNotExists();

    // Then initialize TypeORM connection
    await AppDataSource.initialize();

    console.log('✅ Database connection established successfully');
    console.log('📊 Database:', dbConfig.database);
    console.log('🔌 Host:', dbConfig.host);
    console.log('⚙️  Synchronize:', dbConfig.synchronize ? 'ON' : 'OFF');
    console.log('📝 Logging:', dbConfig.logging ? 'ON' : 'OFF');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    process.exit(1);
  }
};

export default AppDataSource;
