import { app } from './app.js';
import { config, getJwtSecret } from './config/index.js';
import { seedDatabase } from './db/seed/seedRunner.js';

async function bootstrap() {
  try {
    // Validate JWT_SECRET exists at startup
    getJwtSecret();

    // Run migrations and ensure database is seeded
    await seedDatabase();

    const server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`🚀 POS Enterprise API running on http://localhost:${config.port}`);
      console.log(`🛡️  Security Profile: OWASP Defense-in-Depth Enabled`);
      console.log(`📦 Database Engine: SQLite (Adapter Pattern Active)`);
      console.log(`📍 Branch: ${config.shop.name} (${config.shop.address})`);
      console.log(`=======================================================`);
    });

    // Graceful Shutdown handling (Section 2.2)
    const shutdown = async () => {
      console.log('\n[Server] Gracefully shutting down...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('[Bootstrap Error]: Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
