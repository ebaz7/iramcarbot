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
  baleToken: string;
  excelData: any[] | null;
  aiData: any[] | null;

  // New admin and dynamic bot parameters for high-fidelity restore
  ownerId: string;
  admins: string[];
  users: string[];
  sponsorName: string;
  sponsorUrl: string;

  // Platform-specific configurations
  tgOwnerId?: string;
  tgAdmins?: string[];
  tgSponsorName?: string;
  tgSponsorUrl?: string;

  baleOwnerId?: string;
  baleAdmins?: string[];
  baleSponsorName?: string;
  baleSponsorUrl?: string;

  supportMode: 'link' | 'text';
  supportValue: string;
  backupInterval: number; // in hours
  telegramProxy?: string;
  menuConfig?: Record<string, { label: string; url?: string; active: boolean; type: string }>;
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
  baleToken: process.env.BALE_TOKEN || '',
  telegramProxy: '',
  excelData: null,
  aiData: null,

  ownerId: '',
  admins: [],
  users: [],
  sponsorName: '',
  sponsorUrl: '',

  tgOwnerId: '',
  tgAdmins: [],
  tgSponsorName: '',
  tgSponsorUrl: '',

  baleOwnerId: '',
  baleAdmins: [],
  baleSponsorName: '',
  baleSponsorUrl: '',

  supportMode: 'text',
  supportValue: '📞 پشتیبانی ربات\n\nبرای هرگونه سوال، نظر یا گزارش مشکلات با آیدی مدیر در ارتباط باشید:\n📢 @CarPrice_Channel',
  backupInterval: 24,
  menuConfig: {
    calc: { label: "🧮 ماشین‌حساب", url: "https://www.hamrah-mechanic.com/carprice/", active: true, type: "webapp" },
    market: { label: "🌐 قیمت بازار", url: "https://www.iranjib.ir/showgroup/45/", active: true, type: "webapp" },
    prices: { label: "📋 لیست قیمت", active: true, type: "internal" },
    estimate: { label: "💰 تخمین قیمت", active: true, type: "internal" },
    mobile_webapp: { label: "📱 قیمت موبایل (سایت)", url: "https://www.mobile.ir/phones/prices.aspx", active: true, type: "webapp" },
    mobile_list: { label: "📲 لیست موبایل (ربات)", active: true, type: "internal" },
    search: { label: "🔍 جستجو", active: true, type: "internal" },
    channel: { label: "📢 کانال ما", url: "https://t.me/CarPrice_Channel", active: true, type: "link" },
    support: { label: "📞 پشتیبانی", active: true, type: "dynamic" }
  }
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
