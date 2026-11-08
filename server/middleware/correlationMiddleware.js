// CivicSense AI - Phase 11 Request Correlation Middleware
// Assigns request-scoped correlation identifier for end-to-end tracing.
// Uses Node's crypto.randomUUID() – ZERO Math.random().

import crypto from 'node:crypto';

export function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || 
                        req.headers['x-request-id'] || 
                        crypto.randomUUID();

  req.correlationId = correlationId;
  req.requestId = correlationId;

  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  next();
}

