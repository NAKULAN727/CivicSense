// CivicSense AI - Enterprise Backend Service (Phase 12)
// Starts the enterprise backend on the configured port.

import { createApp } from './app.js';
import { config } from './config/environment.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log('==================================================');
  console.log(`CIVICSENSE AI — ENTERPRISE BACKEND SERVICE`);
  console.log(`Port:                     ${config.port}`);
  console.log(`Environment:              ${config.env}`);
  console.log(`Database Storage:         PERSISTENT (PostgreSQL / RLS Ready)`);
  console.log(`Authentication Mode:      ${config.auth.mode}`);
  console.log(`OIDC Federation:          NOT CONFIGURED (Sandbox Boundary)`);
  console.log(`Municipal Adapter Mode:   ${config.municipal.mode}`);
  console.log(`ERP Connector Status:     DISABLED (Sandbox Active)`);
  console.log('==================================================');
});

// Graceful termination handling
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

