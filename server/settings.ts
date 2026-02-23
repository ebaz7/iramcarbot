import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

export interface AppSettings {
  priority: 'AI' | 'EXCEL';
  aiSource: 'GEMINI' | 'DEEPSEEK' | 'OPENAI';
  updateInterval: number; // in hours
  lastUpdated: string | null;
  geminiApiKey: string;
  deepseekApiKey: string;
  openaiApiKey: string;
  telegramToken: string;
  excelData: any[] | null;
  aiData: any[] | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  priority: 'AI',
  aiSource: 'GEMINI',
  updateInterval: 24,
  lastUpdated: null,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  excelData: null,
  aiData: null,
};

export function loadSettings(): AppSettings {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}
