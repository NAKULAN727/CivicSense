// CivicSense AI - Phase 11 Configurable CORS Middleware
// Disallows wildcard '*' in production; restricts access to configured origins.

import cors from 'cors';
import { config } from '../config/environment.js';

export function createCorsMiddleware() {
  const allowedOrigins = config.security.allowedOrigins;

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) in development
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || (config.env === 'development' && origin.startsWith('http://localhost:'))) {
        return callback(null, true);
      }

      const err = new Error(`CORS blocked: Origin '${origin}' is not authorized.`);
      err.status = 403;
      err.code = 'CORS_FORBIDDEN';
      return callback(err);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID', 'X-Tenant-ID'],
    credentials: true,
    maxAge: 86400
  });
}

