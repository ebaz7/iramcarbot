import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { loadSettings, updateSettings } from './server/settings';
import { generatePriceList } from './server/ai';
import { startScheduler, restartScheduler } from './server/scheduler';
import { startBot } from './server/bot';
import { parseExcelFile } from './server/excel';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// File Upload Setup
const upload = multer({ dest: 'uploads/' });

// API Routes
app.get('/api/settings', (req, res) => {
  res.json(loadSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = updateSettings(req.body);
  restartScheduler(); // Restart scheduler if interval changed
  startBot(); // Restart bot if token changed
  res.json(updated);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const data = parseExcelFile(req.file.path);
    fs.unlinkSync(req.file.path); // Clean up temp file
    res.json({ message: 'Excel file uploaded and processed successfully.', data });
  } catch (error) {
    res.status(500).send('Error processing Excel file: ' + error.message);
  }
});

app.post('/api/update-ai', async (req, res) => {
  try {
    const prices = await generatePriceList();
    updateSettings({ aiData: prices, lastUpdated: new Date().toISOString() });
    res.json({ message: 'AI Price Update Successful.', data: prices });
  } catch (error) {
    res.status(500).send('AI Update Failed: ' + error.message);
  }
});

app.get('/api/prices', (req, res) => {
  const settings = loadSettings();
  if (settings.priority === 'EXCEL' && settings.excelData && settings.excelData.length > 0) {
    res.json({ source: 'EXCEL', data: settings.excelData });
  } else if (settings.aiData && settings.aiData.length > 0) {
    res.json({ source: 'AI', data: settings.aiData });
  } else {
    res.json({ source: 'NONE', data: [] });
  }
});

// Start Services
startScheduler();
startBot();

// Vite Middleware (Development)
if (process.env.NODE_ENV !== 'production') {
  createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  }).then((vite) => {
    app.use(vite.middlewares);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  // Production (Static Files)
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
