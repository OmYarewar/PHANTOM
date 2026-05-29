import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { loadPersistedSettings } from './config.js';
import { initDB, getSetting } from './memory/store.js';
import apiRouter from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Initialize database
initDB();

// Load persisted settings from DB (API keys, workspace, etc.)
loadPersistedSettings(getSetting);

// Create Express app
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:1337',
    'http://127.0.0.1:1337'
  ]
}));
app.use(express.json({ limit: '50mb' }));

// Optional API authentication middleware
app.use('/api', (req, res, next) => {
  const token = process.env.API_TOKEN || process.env.AUTH_TOKEN;
  if (token) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});

// API routes
app.use('/api', apiRouter);

// Serve frontend
const distPath = join(ROOT, 'frontend');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

export default app;
