// CivicSense AI - Phase 11 Rate Limiting Middleware
// In-memory sliding window rate limiter with deterministic counters.

import { config } from '../config/environment.js';
import { ERROR_CODES } from '../config/constants.js';

export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || config.security.rateLimit.windowMs;
  const maxRequests = options.maxRequests || config.security.rateLimit.maxRequests;
  const name = options.name || 'general';

  // Key -> { count: number, resetTime: number }
  const requests = new Map();

  // Periodic cleanup
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetTime) {
        requests.delete(key);
      }
    }
  }, Math.max(windowMs, 10000));
  cleanupInterval.unref();

  return (req, res, next) => {
    const clientKey = req.ip || req.connection?.remoteAddress || 'unknown-client';
    const key = `${name}:${clientKey}`;
    const now = Date.now();

    let record = requests.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(key, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      return res.status(429).json({
        errorCode: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: `Too many requests on ${name} endpoint. Rate limit of ${maxRequests} requests per ${Math.round(windowMs / 1000)}s exceeded.`,
        requestId: req.requestId || 'unknown'
      });
    }

    next();
  };
}

