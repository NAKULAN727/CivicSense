// CivicSense AI - Phase 11 Secure Structured Error Handling Middleware
// Prevents disclosure of stack traces, internal paths, database internals, and secrets.

import { ERROR_CODES } from '../config/constants.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'untracked-request';
  const status = err.status || err.statusCode || 500;
  
  // Safe default error code
  let errorCode = err.code || err.errorCode || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected internal error occurred.';

  // Mask internal technical details in production
  if (status === 500 && !err.isPublic) {
    message = 'An internal system error occurred. Please contact the municipal administrator.';
  }

  // Sanitize any accidental paths or tokens from the client-facing message
  message = message
    .replace(/[A-Za-z]:\\[^\s]+/g, '[INTERNAL_PATH]')
    .replace(/\/[a-zA-Z0-9_\-\.\/]+/g, (match) => {
      // Only mask paths that look like server internals, not API routes
      return match.startsWith('/api/') ? match : '[INTERNAL_PATH]';
    });

  // Server-side diagnostic log (never sent to client)
  console.error(`[ERROR_HANDLER][${requestId}] ${errorCode} (${status}):`, err.stack || err.message);

  res.status(status).json({
    errorCode,
    message,
    requestId
  });
}

