import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'server', 'db.json');

export interface PriceData {
  cars: any; // Simplified for now
  mobiles: any;
  lastUpdated: string;
  source: 'AI' | 'Excel';
}

export interface Config {
  updateInterval: number; // in hours
  priority: 'AI' | 'Excel';
  geminiApiKey: string;
  telegramToken: string;
  adminIds: number[];
  channelUrl: string;
  sponsor: { name: string; url: string };
  support: { mode: 'text' | 'link'; value: string };
}

export interface DB {
  prices: PriceData;
  config: Config;
}

const DEFAULT_DB: DB = {
  prices: {
    cars: {},
    mobiles: {},
    lastUpdated: '',
    source: 'AI',
  },
  config: {
    updateInterval: 24,
    priority: 'AI',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    telegramToken: process.env.TELEGRAM_TOKEN || '',
    adminIds: [],
    channelUrl: 'https://t.me/CarPrice_Channel',
    sponsor: { name: '', url: '' },
    support: { mode: 'text', value: 'Send your message...' },
  },
};

export const loadDB = (): DB => {
  if (!fs.existsSync(DB_FILE)) {
    saveDB(DEFAULT_DB);
    return DEFAULT_DB;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading DB:', error);
    return DEFAULT_DB;
  }
};

export const saveDB = (data: DB) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

export const updateConfig = <K extends keyof Config>(key: K, value: Config[K]) => {
  const db = loadDB();
  db.config[key] = value;
  saveDB(db);
};

export const updatePrices = (prices: Partial<PriceData>) => {
  const db = loadDB();
  db.prices = { ...db.prices, ...prices, lastUpdated: new Date().toISOString() };
  saveDB(db);
};
