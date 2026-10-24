import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config, isOriginAllowed, rateLimitConfig } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDb } from './db/index.js';

// Routers
import { authRouter } from './modules/auth/authRouter.js';
import { catalogRouter } from './modules/catalog/catalogRouter.js';
import { inventoryRouter } from './modules/inventory/inventoryRouter.js';
import { sessionRouter } from './modules/cash-sessions/sessionRouter.js';
import { salesRouter } from './modules/sales/salesRouter.js';
import { returnsRouter } from './modules/returns/returnsRouter.js';
import { customersRouter } from './modules/customers/customersRouter.js';
import { purchasingRouter } from './modules/purchasing/purchasingRouter.js';
import { reportsRouter } from './modules/reports/reportsRouter.js';
import { usersRouter } from './modules/users/usersRouter.js';
import { settingsRouter } from './modules/settings/settingsRouter.js';

export const app = express();

// 1. Security Headers (OWASP)
app.use(
  helmet({
    contentSecurityPolicy: false, // frontend is SPA and served separately or through reverse proxy
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Centralized CORS Allowlist
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin || '')) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Access denied for this origin.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// 3. Body parsers with bounded limit to prevent Denial of Service
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Request Correlation ID
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// 5. Rate Limiting for sensitive authentication endpoints
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

// 6. Mount API v1 Routes
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1', catalogRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/cash-sessions', sessionRouter);
app.use('/api/v1/sales', salesRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/purchasing', purchasingRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/settings', settingsRouter);

// 7. System Health Check Endpoint (Sanitized, no infrastructure information disclosure)
app.get('/api/v1/health', async (req, res) => {
  const db = getDb();
  const dbHealth = await db.healthCheck();
  res.json({
    status: dbHealth.status === 'ok' ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.status === 'ok' ? 'connected' : 'disconnected',
    },
  });
});

// 8. Serve Frontend SPA in Production / Staging (Canonical path: apps/web/dist)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canonicalWebDist = path.resolve(process.cwd(), 'apps/web/dist');
const possibleWebDistPaths = [
  canonicalWebDist,
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(__dirname, '../../../web/dist'),
  path.resolve(__dirname, '../../../apps/web/dist'),
];
const webDistPath = possibleWebDistPaths.find((p) => fs.existsSync(p)) || canonicalWebDist;

if (webDistPath) {
  app.use(express.static(webDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// 9. 404 handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint [${req.method} ${req.originalUrl}] does not exist.`,
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
});

// 10. Centralized Error Handler (Masks sensitive internal info)
app.use(errorHandler);

