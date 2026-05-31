import { Telegraf, Context, Markup } from 'telegraf';
import { loadSettings, updateSettings, AppSettings } from './settings';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { generatePriceList } from './ai';

let tgBot: Telegraf<Context> | null = null;
let baleBot: Telegraf<Context> | null = null;

// --- State Management ---
interface UserState {
  state: string;
  data: Record<string, any>;
}

const userStates: Record<string, UserState> = {};

function getState(userId: string | number): UserState {
  const key = String(userId);
  if (!userStates[key]) {
    userStates[key] = { state: 'IDLE', data: {} };
  }
  return userStates[key];
}

function setState(userId: string | number, state: string) {
  const key = String(userId);
  if (!userStates[key]) {
    userStates[key] = { state, data: {} };
  } else {
    userStates[key].state = state;
  }
}

function updateStateData(userId: string | number, field: string, value: any) {
  const key = String(userId);
  const s = getState(userId);
  s.data[field] = value;
}

function resetState(userId: string | number) {
  const key = String(userId);
  userStates[key] = { state: 'IDLE', data: {} };
}

// --- Dynamic JSON Database Access ---
function loadJsonDb(filename: string, defaultVal: any = {}): any {
  try {
    const fullPath = path.join(process.cwd(), filename);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`Database helper: ${filename} could not be read or does not exist. Using empty db.`);
  }
  return defaultVal;
}

function saveJsonDb(filename: string, data: any) {
  try {
    const fullPath = path.join(process.cwd(), filename);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving database ${filename}:`, e);
  }
}

// Default Fallbacks
const DEFAULT_CAR_DB: Record<string, any> = {
  "ایران خودرو": {
    "models": [
      {
        "name": "پژو 207",
        "variants": [
          { "name": "دنده ای هیدرولیک", "factoryPrice": 490000000, "marketPrice": 780000000 },
          { "name": "اتوماتیک TU5P", "factoryPrice": 610000000, "marketPrice": 960000000 }
        ]
      },
      {
        "name": "تارا",
        "variants": [
          { "name": "دنده ای V1", "factoryPrice": 580000000, "marketPrice": 810000000 },
          { "name": "اتوماتیک V4", "factoryPrice": 690000000, "marketPrice": 950000000 }
        ]
      }
    ]
  },
  "سایپا": {
    "models": [
      {
        "name": "شاهین",
        "variants": [
          { "name": "دنده ای G", "factoryPrice": 435000000, "marketPrice": 720000000 },
          { "name": "اتوماتیک CVT", "factoryPrice": 640000000, "marketPrice": 840000000 }
        ]
      },
      {
        "name": "کوییک",
        "variants": [
          { "name": "دنده ای GX-L", "factoryPrice": 370000000, "marketPrice": 445000000 }
        ]
      }
    ]
  }
};

const DEFAULT_MOBILE_DB: Record<string, any> = {
  "Apple": {
    "models": [
      {
        "name": "iPhone 15 Pro Max",
        "variants": [
          { "name": "256GB CH Active", "officialPrice": 75000000, "marketPrice": 87000000 }
        ]
      }
    ]
  },
  "Samsung": {
    "models": [
      {
        "name": "Galaxy S24 Ultra",
        "variants": [
          { "name": "256GB RAM 12", "officialPrice": 68000000, "marketPrice": 70500000 }
        ]
      }
    ]
  }
};

function getEffectiveCarDb(): Record<string, any> {
  const settings = loadSettings();
  const carDbExcel = loadJsonDb('car_db_excel.json', {});
  const carDbAi = loadJsonDb('car_db_ai.json', {});

  const priority = settings.priority || 'AI';
  if (priority === 'AI') {
    return Object.keys(carDbAi).length > 0 ? carDbAi : (Object.keys(carDbExcel).length > 0 ? carDbExcel : DEFAULT_CAR_DB);
  } else {
    return Object.keys(carDbExcel).length > 0 ? carDbExcel : (Object.keys(carDbAi).length > 0 ? carDbAi : DEFAULT_CAR_DB);
  }
}

function getEffectiveMobileDb(): Record<string, any> {
  const settings = loadSettings();
  const mobileDbExcel = loadJsonDb('mobile_db_excel.json', {});
  const mobileDbAi = loadJsonDb('mobile_db_ai.json', {});

  const priority = settings.priority || 'AI';
  if (priority === 'AI') {
    return Object.keys(mobileDbAi).length > 0 ? mobileDbAi : (Object.keys(mobileDbExcel).length > 0 ? mobileDbExcel : DEFAULT_MOBILE_DB);
  } else {
    return Object.keys(mobileDbExcel).length > 0 ? mobileDbExcel : (Object.keys(mobileDbAi).length > 0 ? mobileDbAi : DEFAULT_MOBILE_DB);
  }
}

const PAINT_CONDITIONS = [
  { label: "بدون رنگ (سالم)", drop: 0 },
  { label: "لیسه گیری / خط و خش جزئی", drop: 0.02 },
  { label: "یک لکه رنگ (گلگیر/درب)", drop: 0.04 },
  { label: "دو لکه رنگ", drop: 0.07 },
  { label: "یک درب/گلگیر تعویض", drop: 0.05 },
  { label: "دور رنگ", drop: 0.25 },
  { label: "سقف و ستون رنگ", drop: 0.40 },
  { label: "تمام رنگ", drop: 0.35 },
  { label: "تعویض اتاق (قانونی)", drop: 0.30 }
];

const YEARS = [1404, 1403, 1402, 1401, 1400, 1399, 1398, 1397, 1396, 1395, 1394, 1393, 1392, 1391, 1390];

// --- Admin Helper ---
function isBotAdminPlatform(userId: string | number, platform: 'telegram' | 'bale'): boolean {
  const settings = loadSettings();
  const uidStr = String(userId);
  if (platform === 'telegram') {
    const ownerId = settings.tgOwnerId || settings.ownerId;
    const admins = settings.tgAdmins || settings.admins || [];
    if (ownerId && String(ownerId) === uidStr) {
      return true;
    }
    if (admins && admins.map(String).includes(uidStr)) {
      return true;
    }
    // Setup first caller auto-register for ease of use
    if (!ownerId && !settings.ownerId) {
      updateSettings({ tgOwnerId: uidStr, ownerId: uidStr });
      return true;
    }
  } else {
    // Bale
    const ownerId = settings.baleOwnerId;
    const admins = settings.baleAdmins || [];
    if (ownerId && String(ownerId) === uidStr) {
      return true;
    }
    if (admins && admins.map(String).includes(uidStr)) {
      return true;
    }
    // Setup first caller auto-register for ease of use
    if (!ownerId) {
      updateSettings({ baleOwnerId: uidStr });
      return true;
    }
  }
  return false;
}

function registerUser(userId: string | number) {
  const settings = loadSettings();
  const uidStr = String(userId);
  const usersList = settings.users || [];
  if (!usersList.includes(uidStr)) {
    usersList.push(uidStr);
    updateSettings({ users: usersList });
  }
}

function getMainMenuMarkupPlatform(userId: string | number, platform: 'telegram' | 'bale') {
  const settings = loadSettings();
  const c = settings.menuConfig || {
    calc: { label: "🧮 ماشین‌حساب", url: "https://www.hamrah-mechanic.com/carprice/", active: true, type: "webapp" },
    market: { label: "🌐 قیمت بازار", url: "https://www.iranjib.ir/showgroup/45/", active: true, type: "webapp" },
    prices: { label: "📋 لیست قیمت", active: true, type: "internal" },
    estimate: { label: "💰 تخمین قیمت", active: true, type: "internal" },
    mobile_webapp: { label: "📱 قیمت موبایل (سایت)", url: "https://www.mobile.ir/phones/prices.aspx", active: true, type: "webapp" },
    mobile_list: { label: "📲 لیست موبایل (ربات)", active: true, type: "internal" },
    search: { label: "🔍 جستجو", active: true, type: "internal" },
    channel: { label: "📢 کانال ما", url: "https://t.me/CarPrice_Channel", active: true, type: "link" },
    support: { label: "📞 پشتیبانی", active: true, type: "dynamic" }
  };

  const keyboard: any[][] = [];

  // Row 1: Web Apps / Links
  const row1: any[] = [];
  if (c.calc?.active) row1.push(Markup.button.webApp(c.calc.label, c.calc.url || "https://www.hamrah-mechanic.com/carprice/"));
  if (c.market?.active) row1.push(Markup.button.webApp(c.market.label, c.market.url || "https://www.iranjib.ir/showgroup/45/"));
  if (row1.length > 0) keyboard.push(row1);

  // Row 2: Prices + Estimator internal callback
  const row2: any[] = [];
  if (c.prices?.active) row2.push(Markup.button.callback(c.prices.label, "menu_prices"));
  if (c.estimate?.active) row2.push(Markup.button.callback(c.estimate.label, "menu_estimate"));
  if (row2.length > 0) keyboard.push(row2);

  // Row 3: Mobile
  const row3: any[] = [];
  if (c.mobile_webapp?.active) row3.push(Markup.button.webApp(c.mobile_webapp.label, c.mobile_webapp.url || "https://www.mobile.ir/phones/prices.aspx"));
  if (c.mobile_list?.active) row3.push(Markup.button.callback(c.mobile_list.label, "menu_mobile_list"));
  if (row3.length > 0) keyboard.push(row3);

  // Row 4: Search + Support (Dynamic)
  const row4: any[] = [];
  if (c.search?.active) row4.push(Markup.button.callback(c.search.label, "menu_search"));
  if (c.support?.active) {
    if (settings.supportMode === 'link' && settings.supportValue) {
      row4.push(Markup.button.url(c.support.label, settings.supportValue));
    } else {
      row4.push(Markup.button.callback(c.support.label, "menu_support"));
    }
  }
  if (row4.length > 0) keyboard.push(row4);

  // 👑 Admin Panel Button if user is admin
  if (isBotAdminPlatform(userId, platform)) {
    keyboard.push([Markup.button.callback("👑 پنل مدیریت", "admin_home")]);
  }

  // Row 5/Footer: Channel & Sponsor
  const footer: any[] = [];
  if (c.channel?.active && c.channel.url) {
    footer.push(Markup.button.url(c.channel.label, c.channel.url));
  }

  const sponsorName = platform === 'telegram'
    ? (settings.tgSponsorName || settings.sponsorName)
    : (settings.baleSponsorName || '');
  const sponsorUrl = platform === 'telegram'
    ? (settings.tgSponsorUrl || settings.sponsorUrl)
    : (settings.baleSponsorUrl || '');

  if (sponsorName && sponsorUrl) {
    footer.push(Markup.button.url(`⭐ ${sponsorName}`, sponsorUrl));
  }
  if (footer.length > 0) keyboard.push(footer);

  return Markup.inlineKeyboard(keyboard);
}

function getAdminHomeMarkupPlatform(platform: 'telegram' | 'bale') {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⚙️ مدیریت منو", "admin_menus")],
    [Markup.button.callback("✨ مرکز کنترل AI", "admin_ai_control")],
    [Markup.button.callback("📂 مدیریت اکسل", "admin_excel_management")],
    [Markup.button.callback("📞 تنظیم پشتیبانی", "admin_set_support")],
    [Markup.button.callback("👥 ادمین‌ها", "admin_manage_admins")],
    [Markup.button.callback("💾 بکاپ دیتابیس", "admin_backup_menu")],
    [Markup.button.callback(`⭐ تنظیم اسپانسر (${platform === 'telegram' ? 'تلگرام' : 'بله'})`, "admin_set_sponsor")],
    [Markup.button.callback("📣 ارسال پیام همگانی", "admin_broadcast")],
    [Markup.button.callback("🔙 خروج", "main_menu")]
  ]);
}

function getExcelManagementMarkup() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📥 دانلود فایل نمونه (Template)", "admin_download_template")],
    [Markup.button.callback("📤 آپلود فایل تکمیل شده", "admin_update_excel")],
    [Markup.button.callback("🔙 بازگشت", "admin_home")]
  ]);
}

function getAiControlMarkup() {
  const settings = loadSettings();
  const source = settings.aiSource || 'GEMINI';
  const priority = settings.priority || 'AI';
  const schedule = settings.updateInterval || 24;

  return Markup.inlineKeyboard([
    [Markup.button.callback("⚙️ منبع دیتا (Source)", "noop")],
    [
      Markup.button.callback((source === 'GEMINI' ? '✅ ' : '') + 'Gemini', 'ai_set_source_GEMINI'),
      Markup.button.callback((source === 'DEEPSEEK' ? '✅ ' : '') + 'DeepSeek', 'ai_set_source_DEEPSEEK'),
      Markup.button.callback((source === 'OPENAI' ? '✅ ' : '') + 'ChatGPT', 'ai_set_source_OPENAI')
    ],
    [Markup.button.callback("⚖️ اولویت (Priority)", "noop")],
    [
      Markup.button.callback((priority === 'EXCEL' ? '✅ ' : '') + 'اکسل', 'ai_set_priority_EXCEL'),
      Markup.button.callback((priority === 'AI' ? '✅ ' : '') + 'هوش مصنوعی', 'ai_set_priority_AI')
    ],
    [Markup.button.callback("⏰ زمانبندی آپدیت خودکار", "noop")],
    [
      Markup.button.callback((schedule === 1 ? '✅ ' : '') + '1h', 'ai_set_schedule_1'),
      Markup.button.callback((schedule === 6 ? '✅ ' : '') + '6h', 'ai_set_schedule_6'),
      Markup.button.callback((schedule === 12 ? '✅ ' : '') + '12h', 'ai_set_schedule_12'),
      Markup.button.callback((schedule === 24 ? '✅ ' : '') + '24h', 'ai_set_schedule_24')
    ],
    [Markup.button.callback("🔄 آپدیت قیمت‌ها (همین الان)", "ai_update_now")],
    [Markup.button.callback("🔙 بازگشت", "admin_home")]
  ]);
}

function getMenuManagementMarkup() {
  const settings = loadSettings();
  const c = settings.menuConfig || {};
  const keyboard: any[][] = [];

  Object.entries(c).forEach(([key, val]: [string, any]) => {
    const status = val.active ? "✅" : "❌";
    keyboard.push([Markup.button.callback(`${status} ${val.label}`, `edit_menu_${key}`)]);
  });

  keyboard.push([Markup.button.callback("🔙 بازگشت", "admin_home")]);
  return Markup.inlineKeyboard(keyboard);
}

function getEditMenuItemMarkup(key: string, val: any) {
  const statusText = val.active ? "فعال ✅" : "غیرفعال ❌";
  const keyboard = [
    [Markup.button.callback("✏️ تغییر نام دکمه", `menu_set_label_${key}`)],
    [Markup.button.callback("👁️ تغییر وضعیت (روشن/خاموش)", `menu_toggle_${key}`)]
  ];
  if ("url" in val) {
    keyboard.push([Markup.button.callback("🔗 تغییر لینک", `menu_set_url_${key}`)]);
  }
  keyboard.push([Markup.button.callback("🔙 بازگشت", "admin_menus")]);
  return Markup.inlineKeyboard(keyboard);
}

// Format currency helper
function formatPrice(p: any): string {
  try {
    const val = Number(String(p).replace(/,/g, ''));
    if (isNaN(val) || val === 0) return String(p);
    return `${val.toLocaleString()} تومان`;
  } catch {
    return String(p);
  }
}

// Register Handlers
function registerHandlers(botInstance: Telegraf<Context>, platform: 'telegram' | 'bale') {
  const isBotAdmin = (userId: string | number) => isBotAdminPlatform(userId, platform);
  const getMainMenuMarkup = (userId: string | number) => getMainMenuMarkupPlatform(userId, platform);
  const getAdminHomeMarkup = () => getAdminHomeMarkupPlatform(platform);

  botInstance.start((ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      registerUser(userId);
      resetState(userId);
    }
    const name = ctx.from?.first_name || 'کاربر عزیز';
    return ctx.reply(
      `👋 سلام ${name}! به بزرگ‌ترین ربات قیمت‌گذاری هوشمند خودرو و موبایل خوش آمدید.\n\nمنوی اصلی خدمات ربات:`,
      getMainMenuMarkup(userId || 0)
    );
  });

  botInstance.help((ctx) => ctx.reply('برای استفاده از ربات دستور /start را ارسال کرده و از منوها استفاده فرمایید.'));

  // --- main_menu callback ---
  botInstance.action('main_menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) resetState(userId);
    try {
      await ctx.editMessageText(
        `👋 منوی اصلی ربات در خدمت شماست:\n\nلطفاً یکی از گزینه‌های زیر را انتخاب کنید:`,
        getMainMenuMarkup(userId || 0)
      );
    } catch {
      await ctx.reply(`👋 خدمات اصلی ربات:`, getMainMenuMarkup(userId || 0));
    }
  });

  // --- commands for admin ---
  botInstance.command('admin', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      resetState(userId);
      await ctx.reply("🛠 **پنل مدیریت ربات کارپی**", getAdminHomeMarkup());
    } else {
      await ctx.reply("❌ شما دسترسی لازم برای این بخش را ندارید.");
    }
  });

  // --- ADMIN: admin_home callback ---
  botInstance.action('admin_home', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      resetState(userId);
      try {
        await ctx.editMessageText("🛠 **پنل مدیریت بخش‌های مختلف ربات:**", getAdminHomeMarkup());
      } catch {
        await ctx.reply("🛠 **پنل مدیریت بخش‌های مختلف ربات:**", getAdminHomeMarkup());
      }
    }
  });

  // --- ADMIN: Menu configuration ---
  botInstance.action('admin_menus', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      try {
        await ctx.editMessageText("⚙️ **مدیریت منوی کلیدهای میانبر**\n\nتغییر روشن/خاموش بودن یا عنوان کلیدها:", getMenuManagementMarkup());
      } catch {}
    }
  });

  // Action: edit_menu_<key>
  botInstance.action(/^edit_menu_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const key = ctx.match[1];
      const settings = loadSettings();
      const val = settings.menuConfig?.[key];
      if (val) {
        const toggleStr = val.active ? "فعال ✅" : "غیرفعال ❌";
        let labelText = `🔧 **ویرایش کلید میانبر: ${val.label}**\nوضعیت فعلی: ${toggleStr}\n`;
        if (val.url) labelText += `🔗 لینک پیوند: ${val.url}`;
        try {
          await ctx.editMessageText(labelText, getEditMenuItemMarkup(key, val));
        } catch {}
      }
    }
  });

  // Action: menu_toggle_<key>
  botInstance.action(/^menu_toggle_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const key = ctx.match[1];
      const settings = loadSettings();
      if (settings.menuConfig && settings.menuConfig[key]) {
        settings.menuConfig[key].active = !settings.menuConfig[key].active;
        updateSettings({ menuConfig: settings.menuConfig });
        ctx.answerCbQuery(`وضعیت دکمه تغییر کرد`);
        // Refresh page
        const val = settings.menuConfig[key];
        const toggleStr = val.active ? "فعال ✅" : "غیرفعال ❌";
        let labelText = `🔧 **ویرایش کلید میانبر: ${val.label}**\nوضعیت فعلی: ${toggleStr}\n`;
        if (val.url) labelText += `🔗 لینک پیوند: ${val.url}`;
        try {
          await ctx.editMessageText(labelText, getEditMenuItemMarkup(key, val));
        } catch {}
      }
    }
  });

  // Action: menu_set_label_<key>
  botInstance.action(/^menu_set_label_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const key = ctx.match[1];
      setState(userId, 'ADM_EDIT_LABEL');
      updateStateData(userId, 'edit_key', key);
      await ctx.reply(`✍️ لطفاً نام جدید دکمه را وارد کرده و ارسال کنید:`);
    }
  });

  // Action: menu_set_url_<key>
  botInstance.action(/^menu_set_url_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const key = ctx.match[1];
      setState(userId, 'ADM_EDIT_URL');
      updateStateData(userId, 'edit_key', key);
      await ctx.reply(`🔗 لطفاً آدرس اینترنتی (با https شروع شود) جدید را بنویسید:`);
    }
  });

  // --- ADMIN: AI Control ---
  botInstance.action('admin_ai_control', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      try {
        await ctx.editMessageText("✨ **مرکز تنظیمات قیمت‌گذاری هوشمند ربات**", getAiControlMarkup());
      } catch {}
    }
  });

  // Actions of AI Setups
  botInstance.action(/^ai_set_source_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const src = ctx.match[1] as 'GEMINI' | 'DEEPSEEK' | 'OPENAI';
      updateSettings({ aiSource: src });
      ctx.answerCbQuery(`منبع به ${src} تغییر یافت.`);
      try { await ctx.editMessageText("✨ **مرکز تنظیمات قیمت‌گذاری هوشمند ربات**", getAiControlMarkup()); } catch {}
    }
  });

  botInstance.action(/^ai_set_priority_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const prio = ctx.match[1] as 'AI' | 'EXCEL';
      updateSettings({ priority: prio });
      ctx.answerCbQuery(`اولویت به ${prio === 'AI' ? 'هوش مصنوعی' : 'اکسل'} تغییر یافت.`);
      try { await ctx.editMessageText("✨ **مرکز تنظیمات قیمت‌گذاری هوشمند ربات**", getAiControlMarkup()); } catch {}
    }
  });

  botInstance.action(/^ai_set_schedule_(.+)$/, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const sch = parseInt(ctx.match[1]);
      updateSettings({ updateInterval: sch });
      ctx.answerCbQuery(`زمانبندی آپدیت به ${sch} ساعت تغییر تنظیم شد.`);
      try { await ctx.editMessageText("✨ **مرکز تنظیمات قیمت‌گذاری هوشمند ربات**", getAiControlMarkup()); } catch {}
    }
  });

  botInstance.action('ai_update_now', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      await ctx.reply("⏳ در حال استعلام قیمت‌های بازار از موتورهای هوشمند و بروزرسانی دیتابیس... لطفاً صبور باشید.");
      try {
        const prices = await generatePriceList();
        updateSettings({ aiData: prices, lastUpdated: new Date().toISOString() });
        // update JSON too so both python-oriented compatibility is preserved
        const formattedTree: Record<string, any> = {};
        prices.forEach((p: any) => {
          const b = p.brand || 'سایر';
          if (!formattedTree[b]) formattedTree[b] = { models: [] };
          let m = formattedTree[b].models.find((item: any) => item.name === p.model);
          if (!m) {
            m = { name: p.model, variants: [] };
            formattedTree[b].models.push(m);
          }
          m.variants.push({
            name: `مدل ${p.year}`,
            marketPrice: p.price,
            factoryPrice: Math.round(p.price * 0.88),
          });
        });
        saveJsonDb('car_db_ai.json', formattedTree);
        await ctx.reply("✅ دیتابیس هوشمند ربات با موفقیت بروز شد.");
      } catch (err: any) {
        await ctx.reply(`❌ بروزرسانی با خطا مواجه شد: ${err.message}`);
      }
    }
  });

  // --- ADMIN: Excel management ---
  botInstance.action('admin_excel_management', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      try {
        await ctx.editMessageText(
          "📊 **بخش مدیریت و آپلود اکسل قیمت‌ها**\n\nمی‌توانید نمونه جدول فایل قیمت‌ها را دریافت کرده و پس از پرکردن ارسال فرمایید.",
          getExcelManagementMarkup()
        );
      } catch {}
    }
  });

  botInstance.action('admin_download_template', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      try {
        const car_df = [
          { type: 'car', brand: 'ایران خودرو', model: 'پژو 207', variant: 'دنده ای هیدرولیک', factoryPrice: 450000000, marketPrice: 750000000 },
          { type: 'mobile', brand: 'Samsung', model: 'Galaxy S24 Ultra', variant: '256GB', factoryPrice: 0, marketPrice: 75000000 }
        ];
        const ws = xlsx.utils.json_to_sheet(car_df);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
        const templatePath = path.join(process.cwd(), "template.xlsx");
        xlsx.writeFile(wb, templatePath);

        await ctx.replyWithDocument({ source: templatePath, filename: 'template.xlsx' }, {
          caption: '📝 فایل نمونه اکسل قیمت‌ها\nستون type باید شامل car یا mobile باشد.\nلطفا اطلاعات را تکمیل و دوباره به ربات فایل دهید.'
        });
        setTimeout(() => {
          try { fs.unlinkSync(templatePath); } catch {}
        }, 5000);
      } catch (e: any) {
        await ctx.reply(`❌ خطا در ساخت تمپلیت: ${e.message}`);
      }
    }
  });

  botInstance.action('admin_update_excel', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      setState(userId, 'ADM_WAIT_EXCEL');
      await ctx.reply("📂 لطفاً فایل اکسل تکمیل شده خود را (انواع .xlsx) با دکمه پیوست فایل به ربات ارسال کنید.");
    }
  });

  // --- ADMIN: Set Support button ---
  botInstance.action('admin_set_support', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      setState(userId, 'ADM_SET_SUPPORT');
      await ctx.reply(
        "📞 **تنظیم روش ارتباط مشتری و بخش پشتیبانی**\n\n" +
        "یک متن ساده بنویسید (مثال: شماره تلفن یا توضیحات پشتیبانی) و یا یک پیوند (شروع با @ یا http) ارسال فرمایید تا دکمه لینک مستقیم شود:"
      );
    }
  });

  // --- ADMIN: Manage Admins ---
  botInstance.action('admin_manage_admins', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const settings = loadSettings();
      let ownerId = '';
      let admins: string[] = [];
      if (platform === 'telegram') {
        ownerId = settings.tgOwnerId || settings.ownerId || '';
        admins = settings.tgAdmins || settings.admins || [];
      } else {
        ownerId = settings.baleOwnerId || '';
        admins = settings.baleAdmins || [];
      }

      let msg = `👥 **لیست مدیران ارشد سیستم (${platform === 'telegram' ? 'تلگرام' : 'بله'}):**\n\n👑 مالک اصلی: \`${ownerId || 'تنظیم نشده'}\`\n`;
      if (admins && admins.length > 0) {
        msg += "👨‍💻 مدیران فرعی ثبت شده:\n" + admins.map((id, index) => `${index + 1}. \`${id}\``).join('\n');
      } else {
        msg += "⚠️ مدیر فرعی اضافه نشده است.";
      }

      try {
        await ctx.editMessageText(msg, Markup.inlineKeyboard([
          [Markup.button.callback("➕ افزودن ادمین جدید", "admin_add_new_admin")],
          [Markup.button.callback("🔙 بازگشت", "admin_home")]
        ]));
      } catch {}
    }
  });

  botInstance.action('admin_add_new_admin', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      setState(userId, 'ADM_ADD_ADMIN');
      await ctx.reply("🔢 لطفاً شناسه عددی (Telegram ID) ادمین جدید را به صورت عددی تایپ و ارسال کنید:");
    }
  });

  // --- ADMIN: Database Backup Menu ---
  botInstance.action('admin_backup_menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const settings = loadSettings();
      const backupH = settings.backupInterval || 24;
      try {
        await ctx.editMessageText(
          `💾 **مدیریت پشتیبان دیتابیس**\n\nتنظیم زمانبندی و دانلود مستقیم فایل پشتیبان دیتابیس پیکربندی:\nزمانبندی فعلی: هر ${backupH} ساعت`,
          Markup.inlineKeyboard([
            [Markup.button.callback("📥 دریافت بکاپ تنظیمات سیستم (همین الان)", "backup_get_now")],
            [Markup.button.callback("🔙 بازگشت", "admin_home")]
          ])
        );
      } catch {}
    }
  });

  botInstance.action('backup_get_now', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      const settingsPath = path.join(process.cwd(), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        await ctx.replyWithDocument({ source: settingsPath, filename: 'settings_backup.json' }, {
          caption: '💾 فایل کامل بکاپ کل پیکربندی و لیست قیمت‌ها'
        });
      } else {
        await ctx.reply("❌ فایل تنظیماتی یافت نشد.");
      }
    }
  });

  // --- ADMIN: Sponsor Setting ---
  botInstance.action('admin_set_sponsor', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      setState(userId, 'ADM_SPONSOR_NAME');
      await ctx.reply("⭐ لطفاً عنوان تبلیغات/اسپانسر (مثلا: کانال خودرو آریا) را ارسال کنید:");
    }
  });

  // --- ADMIN: Sponsor Setting ---
  botInstance.action('admin_broadcast', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId && isBotAdmin(userId)) {
      setState(userId, 'ADM_BCAST');
      await ctx.reply("📢 لطفاً متن پیام همگانی خود را که می‌خواهید به تمام کاربران ارسال شود بنویسید:");
    }
  });

  // --- USER callback: support ---
  botInstance.action('menu_support', async (ctx) => {
    const settings = loadSettings();
    await ctx.reply(settings.supportValue || "📞 بخش پشتیبانی در خدمت شماست.");
  });

  // --- USER: Search callback ---
  botInstance.action('menu_search', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) setState(userId, 'SEARCH');
    await ctx.reply("🔍 لطفاً نام یا کلمه کلیدی خودرو یا گوشی موبایل مورد نظر را ارسال کنید:", Markup.inlineKeyboard([
      [Markup.button.callback("🔙 انصراف و بازگشت", "main_menu")]
    ]));
  });

  // --- STATE-BASED AND GENERAL TEXT HANDLING ---
  botInstance.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    registerUser(userId);

    const text = ctx.message.text.trim();
    const stateInfo = getState(userId);

    // Command /id check
    if (text === "/id") {
      return ctx.reply(`🆔 شناسه تلگرام شما: \`${userId}\``);
    }

    // Command /search check
    if (text.startsWith("/search ")) {
      const q = text.replace("/search ", "").trim();
      return runSearch(ctx, q);
    }

    // Command /estimate check
    if (text.startsWith("/estimate ")) {
      const q = text.replace("/estimate ", "").trim();
      return runSimpleEstimate(ctx, q);
    }

    // State handling
    switch (stateInfo.state) {
      case 'SEARCH': {
        resetState(userId);
        return runSearch(ctx, text);
      }

      case 'ADM_EDIT_LABEL': {
        const key = stateInfo.data.edit_key;
        const settings = loadSettings();
        if (settings.menuConfig && settings.menuConfig[key]) {
          settings.menuConfig[key].label = text;
          updateSettings({ menuConfig: settings.menuConfig });
          await ctx.reply(`✅ نام دکمه با موفقیت به "${text}" تغییر یافت.`);
        }
        resetState(userId);
        return;
      }

      case 'ADM_EDIT_URL': {
        const key = stateInfo.data.edit_key;
        if (!text.startsWith("http")) {
          return ctx.reply("⚠️ آدرس اینترنتی نامعتبر است! حتماً با http:// یا https:// شروع شود.");
        }
        const settings = loadSettings();
        if (settings.menuConfig && settings.menuConfig[key]) {
          settings.menuConfig[key].url = text;
          updateSettings({ menuConfig: settings.menuConfig });
          await ctx.reply(`✅ پیوند دکمه میانبر با موفقیت بروزرسانی شد.`);
        }
        resetState(userId);
        return;
      }

      case 'ADM_SET_SUPPORT': {
        let mode: 'link' | 'text' = 'text';
        let value = text;
        if (text.startsWith("http")) {
          mode = 'link';
        } else if (text.startsWith("@")) {
          mode = 'link';
          value = `https://t.me/${text.replace("@", "")}`;
        }
        updateSettings({ supportMode: mode, supportValue: value });
        await ctx.reply(`✅ بخش پشتیبانی با موفقیت تنظیم شد.`);
        resetState(userId);
        return;
      }

      case 'ADM_ADD_ADMIN': {
        const adminIdInput = text.trim();
        const settings = loadSettings();
        if (platform === 'telegram') {
          const currentAdmins = settings.tgAdmins || settings.admins || [];
          if (!currentAdmins.includes(adminIdInput)) {
            currentAdmins.push(adminIdInput);
            updateSettings({ tgAdmins: currentAdmins, admins: currentAdmins });
            await ctx.reply(`✅ مدیر فرعی تلگرام با شناسه ${adminIdInput} به سیستم اضافه شد.`);
          } else {
            await ctx.reply(`⚠️ این شناسه از قبل در لیست مدیران تلگرام موجود بود.`);
          }
        } else {
          const currentAdmins = settings.baleAdmins || [];
          if (!currentAdmins.includes(adminIdInput)) {
            currentAdmins.push(adminIdInput);
            updateSettings({ baleAdmins: currentAdmins });
            await ctx.reply(`✅ مدیر فرعی بله با شناسه ${adminIdInput} به سیستم اضافه شد.`);
          } else {
            await ctx.reply(`⚠️ این شناسه از قبل در لیست مدیران بله موجود بود.`);
          }
        }
        resetState(userId);
        return;
      }

      case 'ADM_SPONSOR_NAME': {
        updateStateData(userId, 'sponsor_name', text);
        setState(userId, 'ADM_SPONSOR_LINK');
        await ctx.reply(`🔗 حالا پیوند اینترنتی اسپانسر را ارسال کنید (مانند https://t.me/CarPrice_Channel):`);
        return;
      }

      case 'ADM_SPONSOR_LINK': {
        const sName = stateInfo.data.sponsor_name;
        if (!text.startsWith("http")) {
          return ctx.reply("⚠️ آدرس نامعتبر است. حتما با http شروع شود.");
        }
        if (platform === 'telegram') {
          updateSettings({ tgSponsorName: sName, tgSponsorUrl: text, sponsorName: sName, sponsorUrl: text });
        } else {
          updateSettings({ baleSponsorName: sName, baleSponsorUrl: text });
        }
        await ctx.reply(`✅ اسپانسر با موفقیت در منوی شروع فعال شد.`);
        resetState(userId);
        return;
      }

      case 'ADM_BCAST': {
        const settings = loadSettings();
        const userList = settings.users || [];
        await ctx.reply(`📢 در حال ارسال همگانی پیام برای ${userList.length} کاربر...`);
        let count = 0;
        for (const uid of userList) {
          try {
            await ctx.telegram.sendMessage(uid, text);
            count++;
          } catch {}
        }
        await ctx.reply(`✅ پیام همگانی با موفقیت به ${count} نفر ارسال رسید.`);
        resetState(userId);
        return;
      }

      case 'EST_MILEAGE': {
        const num = parseInt(text.replace(/,/g, ''));
        if (isNaN(num)) {
          return ctx.reply("⚠️ فقط عدد معتبر وارد کنید:");
        }
        updateStateData(userId, 'mileage', num);
        setState(userId, 'EST_PAINT');
        
        // Show paint options
        const kb: any[][] = [];
        for (let i = 0; i < PAINT_CONDITIONS.length; i += 2) {
          const row = [Markup.button.callback(PAINT_CONDITIONS[i].label, `paint_${i}`)];
          if (i + 1 < PAINT_CONDITIONS.length) {
            row.push(Markup.button.callback(PAINT_CONDITIONS[i+1].label, `paint_${i+1}`));
          }
          kb.push(row);
        }
        await ctx.reply("🎨 وضعیت بدنه خودرو را انتخاب کنید:", Markup.inlineKeyboard(kb));
        return;
      }
    }
  });

  // Handle excel parser in chat
  botInstance.on('document', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !isBotAdmin(userId)) return;

    const stateInfo = getState(userId);
    if (stateInfo.state === 'ADM_WAIT_EXCEL') {
      const doc = ctx.message.document;
      if (!doc.file_name?.endsWith('.xlsx') && !doc.file_name?.endsWith('.xls')) {
        return ctx.reply("❌ فرمت فایل فرستاده شده اکسل نیست.");
      }

      await ctx.reply("⏳ در حال دانلود و آنالیز فایل دیتابیس اکسل...");
      try {
        const fileId = doc.file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        
        const axios = require('axios');
        const response = await axios.get(link.href, { responseType: 'arraybuffer' });
        const dataBuffer = Buffer.from(response.data);
        const workbook = xlsx.read(dataBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = xlsx.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          return ctx.reply("❌ فایل فرستاده شده خالی یا نامعتبر است.");
        }

        const carTree: Record<string, any> = {};
        const mobTree: Record<string, any> = {};
        let carCount = 0;
        let mobCount = 0;

        rows.forEach((row: any) => {
          const type = String(row.type || 'car').toLowerCase().trim();
          const brand = String(row.brand || '').trim();
          const model = String(row.model || '').trim();
          const variant = String(row.variant || '').trim();
          const fPrice = Number(row.factoryPrice || 0);
          const mPrice = Number(row.marketPrice || 0);

          if (!brand || !model) return;

          if (type === 'car') {
            carCount++;
            if (!carTree[brand]) carTree[brand] = { models: [] };
            let m = carTree[brand].models.find((item: any) => item.name === model);
            if (!m) {
              m = { name: model, variants: [] };
              carTree[brand].models.push(m);
            }
            m.variants.push({ name: variant, factoryPrice: fPrice, marketPrice: mPrice });
          } else {
            mobCount++;
            if (!mobTree[brand]) mobTree[brand] = { models: [] };
            let m = mobTree[brand].models.find((item: any) => item.name === model);
            if (!m) {
              m = { name: model, variants: [] };
              mobTree[brand].models.push(m);
            }
            m.variants.push({ name: variant, officialPrice: fPrice, marketPrice: mPrice });
          }
        });

        if (carCount > 0) saveJsonDb('car_db_excel.json', carTree);
        if (mobCount > 0) saveJsonDb('mobile_db_excel.json', mobTree);

        // Map flat to settings.excelData
        const flatData = rows.map((r: any) => ({
          brand: r.brand,
          model: r.model + (r.variant ? ` (${r.variant})` : ''),
          year: 1403,
          price: Number(r.marketPrice) || Number(r.price) || 0,
          currency: 'تومان'
        }));
        updateSettings({ excelData: flatData });

        await ctx.reply(`✅ فایل اکسل با موفقیت پردازش شد!\n🚗 تعداد خودرو: ${carCount}\n📱 تعداد گوشی: ${mobCount}`);
        resetState(userId);
      } catch (err: any) {
        await ctx.reply(`❌ فورا در ذخیره فایل خطا رخ داد: ${err.message}`);
      }
    }
  });

  // --- CAR ACTIONS ---
  botInstance.action('menu_prices', async (ctx) => {
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("🚗 لیست کلی قیمت خودروها", "car_list_full")],
      [Markup.button.callback("🏢 تفکیک بر اساس کارخانه سازنده", "car_list_categories")],
      [Markup.button.callback("🔙 بازگشت", "main_menu")]
    ]);
    await ctx.reply("🚗 نحوه نمایش لیست قیمت خودرو را انتخاب کنید:", kb);
  });

  botInstance.action('car_list_full', async (ctx) => {
    const db = getEffectiveCarDb();
    let msg = `🚗 **لیست قیمت روز خودرو بازار ایران**\n\n`;
    let found = false;

    Object.entries(db).forEach(([brand, data]: [string, any]) => {
      msg += `🏢 **${brand}**\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n`;
      data.models?.forEach((model: any) => {
        model.variants?.forEach((v: any) => {
          found = true;
          msg += `🔹 **${model.name} (${v.name})**\n`;
          if (v.factoryPrice) msg += `   🔹 کارخانه: ${formatPrice(v.factoryPrice)}\n`;
          msg += `   🔸 بازار: ${formatPrice(v.marketPrice)}\n\n`;
        });
      });
    });

    if (!found) {
      return ctx.reply("⚠️ موردی در دیتابیس یافت نشد.");
    }

    if (msg.length > 4000) {
      const chunks = msg.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }
  });

  botInstance.action('car_list_categories', async (ctx) => {
    const db = getEffectiveCarDb();
    const kb: any[][] = [];
    Object.keys(db).forEach((brand) => {
      kb.push([Markup.button.callback(brand, `car_b_${brand}`)]);
    });
    kb.push([Markup.button.callback("🔙 بازگشت", "menu_prices")]);
    await ctx.reply("🏢 شرکت سازنده را انتخاب کنید:", Markup.inlineKeyboard(kb));
  });

  botInstance.action(/^car_b_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const db = getEffectiveCarDb();
    const data = db[brand];
    if (data && data.models) {
      const kb: any[][] = [];
      data.models.forEach((m: any) => {
        kb.push([Markup.button.callback(m.name, `car_m_${brand}_${m.name}`)]);
      });
      kb.push([Markup.button.callback("🔙 بازگشت", "car_list_categories")]);
      await ctx.reply(`🚗 مدل‌های شرکت **${brand}**:`, Markup.inlineKeyboard(kb));
    }
  });

  botInstance.action(/^car_m_(.+)_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const model = ctx.match[2];
    const db = getEffectiveCarDb();
    const modelData = db[brand]?.models?.find((m: any) => m.name === model);
    if (modelData) {
      const kb: any[][] = [];
      modelData.variants?.forEach((v: any, index: number) => {
        kb.push([Markup.button.callback(v.name || 'تیپ معمولی', `car_v_${brand}_${model}_${index}`)]);
      });
      kb.push([Markup.button.callback("🔙 بازگشت", `car_b_${brand}`)]);
      await ctx.reply(`تیپ و مشخصات **${model}**:`, Markup.inlineKeyboard(kb));
    }
  });

  botInstance.action(/^car_v_(.+)_(.+)_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const model = ctx.match[2];
    const index = parseInt(ctx.match[3]);
    const db = getEffectiveCarDb();
    const variant = db[brand]?.models?.find((m: any) => m.name === model)?.variants?.[index];

    if (variant) {
      let text = `📊 **جزئیات و استعلام قیمت خودرو**\n\n`;
      text += `🚗 **مدل:** ${brand} ${model}\n`;
      text += `⚙️ **تیپ:** ${variant.name}\n`;
      text += `─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n`;
      if (variant.factoryPrice) text += `🏭 **قیمت کارخانه:** ${formatPrice(variant.factoryPrice)}\n`;
      text += `📉 **قیمت بازار:** ${formatPrice(variant.marketPrice)}\n`;

      const kb = Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت", `car_m_${brand}_${model}`)]]);
      await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
    }
  });

  // --- MOBILE ACTIONS ---
  botInstance.action('menu_mobile_list', async (ctx) => {
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📋 لیست قیمت همگانی موبایل", "mob_list_full")],
      [Markup.button.callback("🏢 تفکیک بر اساس برند", "mob_list_categories")],
      [Markup.button.callback("🔙 بازگشت", "main_menu")]
    ]);
    await ctx.reply("📱 نحوه نمایش قیمت گوشی‌های موبایل را انتخاب کنید:", kb);
  });

  botInstance.action('mob_list_full', async (ctx) => {
    const db = getEffectiveMobileDb();
    let msg = `📱 **لیست قیمت انواع موبایل بازار ایران**\n\n`;
    let found = false;

    Object.entries(db).forEach(([brand, data]: [string, any]) => {
      msg += `🏢 **برند ${brand}**\n─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n`;
      data.models?.forEach((model: any) => {
        model.variants?.forEach((v: any) => {
          found = true;
          msg += `🔹 **${model.name} (${v.name})**\n`;
          if (v.officialPrice) msg += `   🔹 قیمت گارانتی: ${formatPrice(v.officialPrice)}\n`;
          msg += `   🔸 قیمت بازار: ${formatPrice(v.marketPrice)}\n\n`;
        });
      });
    });

    if (!found) {
      return ctx.reply("⚠️ لیست موبایل خالی است.");
    }

    if (msg.length > 4000) {
      const chunks = msg.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) await ctx.reply(chunk, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }
  });

  botInstance.action('mob_list_categories', async (ctx) => {
    const db = getEffectiveMobileDb();
    const kb: any[][] = [];
    Object.keys(db).forEach((brand) => {
      kb.push([Markup.button.callback(brand, `mob_b_${brand}`)]);
    });
    kb.push([Markup.button.callback("🔙 بازگشت", "menu_mobile_list")]);
    await ctx.reply("🏢 شرکت سازنده گوشی را انتخاب کنید:", Markup.inlineKeyboard(kb));
  });

  botInstance.action(/^mob_b_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const db = getEffectiveMobileDb();
    const data = db[brand];
    if (data && data.models) {
      const kb: any[][] = [];
      data.models.forEach((m: any) => {
        kb.push([Markup.button.callback(m.name, `mob_m_${brand}_${m.name}`)]);
      });
      kb.push([Markup.button.callback("🔙 بازگشت", "mob_list_categories")]);
      await ctx.reply(`📱 مدل‌های شرکت **${brand}**:`, Markup.inlineKeyboard(kb));
    }
  });

  botInstance.action(/^mob_m_(.+)_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const model = ctx.match[2];
    const db = getEffectiveMobileDb();
    const modelData = db[brand]?.models?.find((m: any) => m.name === model);
    if (modelData) {
      const kb: any[][] = [];
      modelData.variants?.forEach((v: any, index: number) => {
        kb.push([Markup.button.callback(v.name || 'مدل معمولی', `mob_v_${brand}_${model}_${index}`)]);
      });
      kb.push([Markup.button.callback("🔙 بازگشت", `mob_b_${brand}`)]);
      await ctx.reply(`حافظه و تیپ‌های **${model}**:`, Markup.inlineKeyboard(kb));
    }
  });

  botInstance.action(/^mob_v_(.+)_(.+)_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const model = ctx.match[2];
    const index = parseInt(ctx.match[3]);
    const db = getEffectiveMobileDb();
    const variant = db[brand]?.models?.find((m: any) => m.name === model)?.variants?.[index];

    if (variant) {
      let text = `📊 **جزئیات و استعلام قیمت گوشی موبایل**\n\n`;
      text += `📱 **برند / مدل:** ${brand} ${model}\n`;
      text += `⚙️ **حافظه / رام:** ${variant.name}\n`;
      text += `─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n`;
      if (variant.officialPrice) text += `🛡 **قیمت گارانتی رسمی:** ${formatPrice(variant.officialPrice)}\n`;
      text += `📉 **قیمت فروشگاهی بازار:** ${formatPrice(variant.marketPrice)}\n`;

      const kb = Markup.inlineKeyboard([[Markup.button.callback("🔙 بازگشت", `mob_m_${brand}_${model}`)]]);
      await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
    }
  });

  // --- CAR ESTIMATION WIZARD ---
  botInstance.action('menu_estimate', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) setState(userId, 'EST_BRAND');
    const db = getEffectiveCarDb();
    const kb: any[][] = [];
    Object.keys(db).forEach((brand) => {
      kb.push([Markup.button.callback(brand, `est_b_${brand}`)]);
    });
    kb.push([Markup.button.callback("🔙 انصراف و بازگشت", "main_menu")]);
    await ctx.reply("🚗 **قدم اول: کارشناسی قیمت خودرو شما**\n\nلطفاً برند تولیدکننده خودروی خود را انتخاب کنید:", Markup.inlineKeyboard(kb));
  });

  botInstance.action(/^est_b_(.+)$/, async (ctx) => {
    const brand = ctx.match[1];
    const userId = ctx.from?.id;
    if (userId) {
      updateStateData(userId, 'brand', brand);
      setState(userId, 'EST_MODEL');
    }
    const db = getEffectiveCarDb();
    const models = db[brand]?.models || [];
    const kb: any[][] = [];
    models.forEach((m: any) => {
      kb.push([Markup.button.callback(m.name, `est_m_${m.name}`)]);
    });
    kb.push([Markup.button.callback("🔙 انصراف", "main_menu")]);
    await ctx.reply(`🚗 **مدل تولیدی ${brand}** را انتخاب کنید:`, Markup.inlineKeyboard(kb));
  });

  botInstance.action(/^est_m_(.+)$/, async (ctx) => {
    const model = ctx.match[1];
    const userId = ctx.from?.id;
    if (userId) {
      updateStateData(userId, 'model', model);
      setState(userId, 'EST_YEAR');
    }
    const kb: any[][] = [];
    let row: any[] = [];
    YEARS.forEach((year, index) => {
      row.push(Markup.button.callback(String(year), `est_y_${year}`));
      if ((index + 1) % 3 === 0) {
        kb.push(row);
        row = [];
      }
    });
    if (row.length > 0) kb.push(row);
    kb.push([Markup.button.callback("🔙 انصراف", "main_menu")]);
    await ctx.reply(`📅 **سال ساخت** خودروی خود را انتخاب کنید:`, Markup.inlineKeyboard(kb));
  });

  botInstance.action(/^est_y_(.+)$/, async (ctx) => {
    const year = parseInt(ctx.match[1]);
    const userId = ctx.from?.id;
    if (userId) {
      updateStateData(userId, 'year', year);
      setState(userId, 'EST_MILEAGE');
    }
    await ctx.reply("🛣 لطفاً **کارکرد خودرو (کیلومتر)** را فقط به صورت عدد بنویسید و ارسال کنید:");
  });

  botInstance.action(/^paint_(.+)$/, async (ctx) => {
    const paint_idx = parseInt(ctx.match[1]);
    const userId = ctx.from?.id;
    if (!userId) return;

    const stateInfo = getState(userId);
    const condition = PAINT_CONDITIONS[paint_idx];
    const { brand, model, year, mileage } = stateInfo.data;

    let zeroPrice = 800000000; // Default fallback: 800M
    const db = getEffectiveCarDb();
    const brandData = db[brand];
    if (brandData && brandData.models) {
      const matchModel = brandData.models.find((item: any) => item.name === model);
      if (matchModel && matchModel.variants && matchModel.variants.length > 0) {
        zeroPrice = Number(matchModel.variants[0].marketPrice) || 800000000;
      }
    }

    // Heuristics
    const age = 1404 - Number(year || 1403);
    let ageDrop = age === 0 ? 0 : (age === 1 ? 0.05 : 0.05 + ((age - 1) * 0.035));
    if (age > 10) ageDrop = 0.40;

    const diff = Number(mileage || 0) - (age * 20000);
    let mileageDrop = diff > 0 ? (diff / 10000) * 0.01 : (diff / 10000) * 0.005;
    mileageDrop = Math.max(Math.min(mileageDrop, 0.15), -0.05);

    const totalDrop = ageDrop + mileageDrop + condition.drop;
    const finalPrice = Math.round((zeroPrice * (1 - totalDrop)) / 1000000) * 1000000;

    const todayStr = new Date().toLocaleDateString('fa-IR');
    const result = `🎯 **کارشناسی و تخمین قیمت بازار خودرو**\n` +
      `📅 تاریخ تخمین: ${todayStr}\n\n` +
      `🚗 **خودرو:** ${brand} ${model}\n` +
      `📅 **سال ساخت:** ${year} | 🛣 **کارکرد:** ${Number(mileage).toLocaleString()} کیلومتر\n` +
      `🎨 **وضعیت بدنه و رنگ:** ${condition.label}\n` +
      `─ ─ ─ ─ ─ ─ ─ ─ ─ ─\n` +
      `💰 **محدوده ارزش تخمینی:** ${finalPrice.toLocaleString()} تومان\n\n` +
      `⚠️ توجه: این ارزش حدودی است و طبق الگوریتم کارشناسی بازار تخمین زده شده است.`;

    const kb = Markup.inlineKeyboard([[Markup.button.callback("🏠 بازگشت به منوی اصلی", "main_menu")]]);
    await ctx.reply(result, { parse_mode: 'Markdown', ...kb });
    resetState(userId);
  });
}

// Global search logic
async function runSearch(ctx: any, query: string) {
  const qClean = query.toLowerCase().trim();
  const results: string[] = [];

  // Search Cars
  const carDb = getEffectiveCarDb();
  Object.entries(carDb).forEach(([brand, bData]: [string, any]) => {
    if (brand.toLowerCase().includes(qClean)) {
      results.push(`🏢 **کارخانه:** ${brand}`);
    }
    bData.models?.forEach((m: any) => {
      if (m.name.toLowerCase().includes(qClean)) {
        results.push(`🚗 **خودرو:** ${m.name} (${brand})`);
      }
      m.variants?.forEach((v: any) => {
        if (v.name?.toLowerCase().includes(qClean)) {
          results.push(`🔹 **تیپ:** ${v.name} (${m.name}) ➔ ${formatPrice(v.marketPrice)}`);
        }
      });
    });
  });

  // Search Mobiles
  const mobileDb = getEffectiveMobileDb();
  Object.entries(mobileDb).forEach(([brand, bData]: [string, any]) => {
    if (brand.toLowerCase().includes(qClean)) {
      results.push(`🏢 **برند موبایل:** ${brand}`);
    }
    bData.models?.forEach((m: any) => {
      if (m.name.toLowerCase().includes(qClean)) {
        results.push(`📲 **مدل گوشی:** ${m.name} (${brand})`);
      }
      m.variants?.forEach((v: any) => {
        if (v.name?.toLowerCase().includes(qClean)) {
          results.push(`🔸 **مدل:** ${m.name} (${v.name}) ➔ ${formatPrice(v.marketPrice)}`);
        }
      });
    });
  });

  if (results.length === 0) {
    return ctx.reply(`❌ موردی برای عبارت "${query}" یافت نشد. شیوه صحیح نوشتن را چک کنید.`);
  }

  const matches = results.slice(0, 15);
  let answer = `🔍 **نتایج جستجوی کاتالوگی برای: "${query}"**\n\n` + matches.join('\n\n');
  if (results.length > 15) {
    answer += '\n\n... و بیشتر';
  }

  const kb = Markup.inlineKeyboard([[Markup.button.callback("🏠 منوی اصلی", "main_menu")]]);
  await ctx.reply(answer, { parse_mode: 'Markdown', ...kb });
}

// Simple heuristic text command estimator
async function runSimpleEstimate(ctx: any, query: string) {
  const parts = query.split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply("⚠️ روش استفاده به صورت دستور زیر:\n\n`/estimate پژو۲۰۷ ۱۳۹۹ ۲۰۰۰۰` (برند سال کارکرد)");
  }

  let baseVal = 700000000;
  if (query.includes("۲۰۷") || query.includes("207")) baseVal = 780000000;
  else if (query.includes("دنا")) baseVal = 1050000000;
  else if (query.includes("شاهین")) baseVal = 740000000;
  else if (query.includes("تارا")) baseVal = 920000000;
  else if (query.includes("کوییک")) baseVal = 420000000;

  const low = baseVal * 0.95;
  const high = baseVal * 1.05;

  const out = `💰 **تخمین قیمت فرضی خودرو شما:**\n\n📊 مشخصات ورودی: ${query}\n\n💵 محدوده ارزش تقریبی بازار:\n**${low.toLocaleString()}** الی **${high.toLocaleString()}** تومان\n\n⚠️ توجه: این قیمت فرضی با کارشناسی حداقلی است.`;
  await ctx.reply(out, { parse_mode: 'Markdown' });
}

// --- BOT INITIALIZATION ---
export function startBot() {
  const settings = loadSettings();
  const tgToken = settings.telegramToken || process.env.TELEGRAM_TOKEN;
  const baleToken = settings.baleToken || process.env.BALE_TOKEN;

  if (!tgToken && !baleToken) {
    console.warn('Neither Telegram nor Bale Bot Tokens are configured. Bot will not start.');
    return;
  }

  // 1. Stop existing Telegram Bot
  if (tgBot) {
    try {
      tgBot.stop('Restarting');
    } catch (err) {
      console.warn('Telegram Bot was not running or failed to stop:', err);
    }
    tgBot = null;
  }
  // 2. Stop existing Bale Bot
  if (baleBot) {
    try {
      baleBot.stop('Restarting');
    } catch (err) {
      console.warn('Bale Bot was not running or failed to stop:', err);
    }
    baleBot = null;
  }

  // 3. Start Telegram Bot
  if (tgToken) {
    const proxyUrl = settings.telegramProxy;
    let telegrafOptions: any = {};
    if (proxyUrl) {
      console.log(`Setting up Telegram bot proxy: ${proxyUrl}`);
      try {
        if (proxyUrl.startsWith('socks')) {
          telegrafOptions = {
            telegram: {
              agent: new SocksProxyAgent(proxyUrl)
            }
          };
        } else {
          telegrafOptions = {
            telegram: {
              agent: new HttpsProxyAgent(proxyUrl)
            }
          };
        }
      } catch (err) {
        console.error('Error creating proxy agent for Telegram:', err);
      }
    }

    tgBot = new Telegraf(tgToken, telegrafOptions);
    registerHandlers(tgBot, 'telegram');
    tgBot.launch().then(() => {
      console.log('Telegram Bot started successfully.');
    }).catch((err) => {
      console.error('Failed to start Telegram Bot:', err);
    });
  }

  // 4. Start Bale Bot
  if (baleToken) {
    baleBot = new Telegraf(baleToken, {
      telegram: { apiRoot: 'https://tapi.bale.ai' }
    });
    registerHandlers(baleBot, 'bale');
    baleBot.launch().then(() => {
      console.log('Bale Bot started successfully.');
    }).catch((err) => {
      console.error('Failed to start Bale Bot:', err);
    });
  }

  // Enable graceful stop
  process.once('SIGINT', () => {
    try { tgBot?.stop('SIGINT'); } catch (e) {}
    try { baleBot?.stop('SIGINT'); } catch (e) {}
  });
  process.once('SIGTERM', () => {
    try { tgBot?.stop('SIGTERM'); } catch (e) {}
    try { baleBot?.stop('SIGTERM'); } catch (e) {}
  });
}

export function stopBot() {
  if (tgBot) {
    try {
      tgBot.stop();
    } catch (e) {}
    tgBot = null;
    console.log('Telegram Bot stopped.');
  }
  if (baleBot) {
    try {
      baleBot.stop();
    } catch (e) {}
    baleBot = null;
    console.log('Bale Bot stopped.');
  }
}
