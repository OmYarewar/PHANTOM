import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { loadPersistedSettings } from './config.js';
import { getSetting } from './memory/store.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pass getSetting to loadPersistedSettings
loadPersistedSettings(getSetting);

const app = express();

// Security and proxy configuration
if (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10));
} else {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Static frontend serving
const frontendPath = join(__dirname, '../frontend');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// API Routes
app.use('/api', apiRouter);

// Centralized Express Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err.stack || err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Unknown error')
  });
});

export default app;
