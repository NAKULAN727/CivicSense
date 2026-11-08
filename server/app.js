// CivicSense AI - Phase 11 Express Application
// Secure, Multi-Tenant Enterprise Backend Architecture.

import express from 'express';
import { correlationMiddleware } from './middleware/correlationMiddleware.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { createCorsMiddleware } from './middleware/corsConfig.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import workOrderRoutes from './routes/workOrder.routes.js';
import wardRoutes from './routes/ward.routes.js';
import municipalRoutes from './routes/municipal.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  // 1. Request correlation
  app.use(correlationMiddleware);

  // 2. Standard security headers
  app.use(securityHeadersMiddleware);

  // 3. Configurable CORS
  app.use(createCorsMiddleware());

  // 4. Safe body parsing
  app.use(express.json({ limit: '2mb' }));

  // 5. Rate limiting
  const apiLimiter = createRateLimiter({ name: 'api', maxRequests: 120, windowMs: 60000 });
  const authLimiter = createRateLimiter({ name: 'auth', maxRequests: 20, windowMs: 60000 });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // 6. API Route mounts
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/work-orders', workOrderRoutes);
  app.use('/api/wards', wardRoutes);
  app.use('/api/municipal', municipalRoutes);
  app.use('/api/telemetry', telemetryRoutes);
  app.use('/api/admin', adminRoutes);

  // 7. Catch-all for undefined API routes
  app.use('/api', (req, res) => {
    res.status(404).json({
      errorCode: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist.`,
      requestId: req.requestId
    });
  });

  // 8. Secure Structured Error Handler (no stack traces to client)
  app.use(errorHandler);

  return app;
}

export default createApp;
