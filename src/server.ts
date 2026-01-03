import app from './app';
import { env, validateEnv } from './config/env';
import { initializeDatabase } from './config/database';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    // Validate environment variables
    console.log('🔍 Validating environment variables...');
    validateEnv();

    // Initialize database connection
    console.log('🔄 Connecting to database...');
    await initializeDatabase();

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   🚀 Smart Campus API Server          ║
╠════════════════════════════════════════╣
║                                      ║
║   Port: ${PORT.toString().padEnd(30)}║
║   URL: http://localhost:${PORT}${' '.repeat(13)}║
║   Health: /health                     ║
║   API: ${env.API_PREFIX.padEnd(31)}║
╚════════════════════════════════════════╝
      `);
      console.log('✅ Backend running successfully!\n');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('🛑 HTTP server closed');

        try {
          // Close database connection
          const { AppDataSource } = await import('./config/database');
          if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('🔌 Database connection closed');
          }

          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⏱️  Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      console.error('❌ Unhandled Rejection:', reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
