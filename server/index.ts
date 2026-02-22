import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { loadDB, updateConfig, updatePrices } from './db';
import { updatePricesFromAI } from './services/ai';
import { parseExcel } from './services/excel';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// API Routes FIRST
app.get('/api/config', (req, res) => {
  const db = loadDB();
  res.json(db.config);
});

app.post('/api/config', (req, res) => {
  const { updateInterval, priority } = req.body;
  if (updateInterval !== undefined) updateConfig('updateInterval', updateInterval);
  if (priority !== undefined) updateConfig('priority', priority);
  startScheduler();
  res.json({ success: true });
});

app.get('/api/prices', (req, res) => {
  const db = loadDB();
  res.json(db.prices);
});

app.post('/api/update-ai', async (req, res) => {
  try {
    await updatePricesFromAI();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update from AI' });
  }
});

// File Upload
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-excel', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const filePath = req.file.path;
    const data = parseExcel(filePath);
    fs.unlinkSync(filePath); // Clean up
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse Excel' });
  }
});

// Vite Middleware (for dev) or Static Files (for prod)
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static('dist'));
}

// Start Scheduler
startScheduler();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
