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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
  app.get('*all', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(500).send(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="color: #ef4444; margin-bottom: 20px;">⚠️ پوشه خروجی (Build) یافت نشد!</h1>
          <p style="font-size: 18px; margin-bottom: 10px; direction: rtl;">ابتدا باید پروژه را با دستور زیر بیلد کنید تا فایل‌های فرانت‌اند ساخته شوند:</p>
          <code style="background: #1e293b; padding: 10px 20px; border-radius: 8px; font-size: 16px; color: #10b981; margin: 15px 0;">npm run build</code>
          <p style="font-size: 14px; color: #94a3b8; direction: rtl; margin-top: 20px;">پس از اجرای دستور فوق، مجدداً سرور را با دستور <code>npm start</code> اجرا کنید.</p>
        </div>
      `);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
