// CivicSense AI - Phase 11 Standard Secure HTTP Headers Middleware
// Enforces CSP, X-Content-Type-Options, Referrer-Policy, and conditional HSTS.

export function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing (clickjacking defense)
  res.setHeader('X-Frame-Options', 'DENY');

  // Modern referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"
  );

  // HSTS only enabled when actual HTTPS connection is established
  const isHttps = Boolean(req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https');
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
