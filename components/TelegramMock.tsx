import React, { useState, useEffect, useRef } from 'react';
import { BotState, ChatMessage, InlineButton, EstimateData, CarDatabase, CarBrand } from '../types';
import { CAR_DB, MOBILE_DB, YEARS, PAINT_CONDITIONS } from '../constants';
import { Send, Menu, ArrowLeft, RefreshCw, ShieldAlert, Users, Megaphone, Star, Upload, FileSpreadsheet, Download, Clock, Filter, Phone, UserPlus, Globe, Database, Save, Settings, Sparkles } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Default Config similar to Python
const DEFAULT_MENU_CONFIG: any = {
    "calc": {"label": "🧮 ماشین‌حساب", "url": "https://www.hamrah-mechanic.com/carprice/", "active": true, "type": "webapp"},
    "market": {"label": "🌐 قیمت بازار", "url": "https://www.iranjib.ir/showgroup/45/", "active": true, "type": "webapp"},
    "prices": {"label": "📋 لیست قیمت", "active": true, "type": "internal"},
    "estimate": {"label": "💰 تخمین قیمت", "active": true, "type": "internal"},
    "mobile_webapp": {"label": "📱 قیمت موبایل (سایت)", "url": "https://www.mobile.ir/phones/prices.aspx", "active": true, "type": "webapp"},
    "mobile_list": {"label": "📲 لیست موبایل (ربات)", "active": true, "type": "internal"},
    "search": {"label": "🔍 جستجو", "active": true, "type": "internal"},
    "channel": {"label": "📢 کانال ما", "url": "https://t.me/CarPrice_Channel", "active": true, "type": "link"},
    "support": {"label": "📞 پشتیبانی", "active": true, "type": "internal"}
};

const TelegramMock: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [botState, setBotState] = useState<BotState>(BotState.IDLE);
  const [estimateData, setEstimateData] = useState<EstimateData>({});
  const [showMenu, setShowMenu] = useState(false);
  
  // Admin State
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Configs
  const [sponsorConfig, setSponsorConfig] = useState<{name?: string, url?: string}>({});
  const [supportConfig, setSupportConfig] = useState<{mode: "text" | "link", value: string}>({mode: "text", value: "لطفا پیام خود را بنویسید..."});
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toLocaleString('fa-IR'));
  const [backupInterval, setBackupInterval] = useState<number>(0);
  
  // Menu Config State (Dynamic)
  const [menuConfig, setMenuConfig] = useState(DEFAULT_MENU_CONFIG);
  const [carDatabase, setCarDatabase] = useState<CarDatabase>(CAR_DB);
  const [backupData, setBackupData] = useState<any>(null);
  
  const [tempAdminData, setTempAdminData] = useState<any>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      addBotMessage(getWelcomeMessage(), getMainMenuButtons());
    }
  }, [isAdminMode, menuConfig, supportConfig]); // Re-render menu if config changes

  const getWelcomeMessage = () => {
      const today = new Date().toLocaleDateString('fa-IR');
      return `👋 سلام! به جامع‌ترین ربات قیمت خودرو و موبایل خوش آمدید.\n📅 امروز: ${today}\n\nمنوی اصلی:`;
  }

  const getMainMenuButtons = (): InlineButton[][] => {
      const buttons: InlineButton[][] = [];
      const c = menuConfig;

      // Row 1: Web Apps (Cars)
      const row1 = [];
      if (c["calc"].active) row1.push({ text: c["calc"].label, webAppUrl: c["calc"].url });
      if (c["market"].active) row1.push({ text: c["market"].label, webAppUrl: c["market"].url });
      if (row1.length > 0) buttons.push(row1);

      // Row 2: Car Internal
      const row2 = [];
      if (c["prices"].active) row2.push({ text: c["prices"].label, callbackData: "menu_prices" });
      if (c["estimate"].active) row2.push({ text: c["estimate"].label, callbackData: "menu_estimate" });
      if (row2.length > 0) buttons.push(row2);

      // Row 3: Mobile Section (New)
      const row3 = [];
      if (c["mobile_webapp"]?.active) row3.push({ text: c["mobile_webapp"].label, webAppUrl: c["mobile_webapp"].url });
      if (c["mobile_list"]?.active) row3.push({ text: c["mobile_list"].label, callbackData: "menu_mobile_list" });
      if (row3.length > 0) buttons.push(row3);

      // Row 4: Utilities
      const row4 = [];
      if (c["search"].active) row4.push({ text: c["search"].label, callbackData: "menu_search" });
      
      if (c["support"].active) {
          // Check support config
          if (supportConfig.mode === "link") {
              row4.push({ text: c["support"].label, url: supportConfig.value });
          } else {
              row4.push({ text: c["support"].label, callbackData: "menu_support" });
          }
      }
      if (row4.length > 0) buttons.push(row4);

      // MAGIC: Automatically add Admin Button if user is Admin
      if (isAdminMode) {
          buttons.push([{ text: "👑 پنل مدیریت", callbackData: "admin_home" }]);
      }

      return buttons;
  }

  const addBotMessage = (text: string, buttons: InlineButton[][] = [], isFile: boolean = false) => {
    let finalButtons = [...buttons];

    // Footer Buttons Logic
    if ((finalButtons.length > 0 || text.includes("منوی اصلی")) && !text.includes("پنل مدیریت")) {
        const footerRow: InlineButton[] = [];
        
        // Channel Logic (Dynamic)
        if (menuConfig["channel"] && menuConfig["channel"].active) {
             footerRow.push({ text: menuConfig["channel"].label, url: menuConfig["channel"].url });
        }

        if (sponsorConfig.name && sponsorConfig.url) {
            footerRow.push({ text: `⭐ ${sponsorConfig.name}`, url: sponsorConfig.url });
        }
        
        if (footerRow.length > 0) {
            finalButtons.push(footerRow);
        }
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: text,
      sender: 'bot',
      timestamp: new Date(),
      buttons: finalButtons
    }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    }]);
  };

  const handleCallback = (btn: InlineButton) => {
    // Handle Web Apps (Mini Apps)
    if (btn.webAppUrl) {
        // Simulate opening Web App
        const confirmed = window.confirm(`📱 شبیه‌ساز Mini App\n\nآیا می‌خواهید سایت زیر را در پنل وب‌اپ باز کنید؟\n\n${btn.webAppUrl}`);
        if (confirmed) {
            window.open(btn.webAppUrl, '_blank', 'width=400,height=600');
        }
        return;
    }

    // Handle External Links
    if (btn.url) {
        window.open(btn.url, '_blank');
        return;
    }

    if (!btn.callbackData) return;
    const callbackData = btn.callbackData;
    const btnText = btn.text;

    // Handle internal links marked as callback for simulation logic (legacy)
    if (callbackData === 'link_sponsor') {
        window.open(sponsorConfig.url || '#', '_blank');
        return;
    }

    addUserMessage(btnText);

    if (callbackData === 'main_menu') {
      setBotState(BotState.IDLE);
      addBotMessage(getWelcomeMessage(), getMainMenuButtons());
      return;
    }

    // --- Support Flow ---
    if (callbackData === 'menu_support') {
        addBotMessage(`📞 **اطلاعات پشتیبانی:**\n\n${supportConfig.value}`, [[{ text: "🔙 بازگشت", callbackData: "main_menu" }]]);
        return;
    }

    // --- MOBILE FLOW (NEW) ---
    if (callbackData === "menu_mobile_list") {
        setBotState(BotState.BROWSING_MOBILE_BRANDS);
        const buttons = Object.keys(MOBILE_DB).map(brand => [{ text: brand, callbackData: `mob_brand_${brand}` }]);
        buttons.push([{ text: "🔙 بازگشت", callbackData: "main_menu" }]);
        addBotMessage("📱 برند موبایل را انتخاب کنید:", buttons);
        return;
    }

    if (callbackData.startsWith("mob_brand_")) {
        const brandName = callbackData.replace("mob_brand_", "");
        if (MOBILE_DB[brandName]) {
            setBotState(BotState.BROWSING_MOBILE_MODELS);
            const buttons = MOBILE_DB[brandName].models.map(m => [{ text: m.name, callbackData: `mob_model_${brandName}_${m.name}` }]);
            buttons.push([{ text: "🔙 بازگشت", callbackData: "menu_mobile_list" }]);
            addBotMessage(`مدل‌های ${brandName}:`, buttons);
        }
        return;
    }

    if (callbackData.startsWith("mob_model_")) {
        const parts = callbackData.split("_");
        const brandName = parts[2];
        const modelName = parts[3];
        const model = MOBILE_DB[brandName]?.models.find(m => m.name === modelName);

        if (model) {
            const text = `📱 **قیمت روز موبایل**\n` +
                         `🏷 مدل: ${model.name}\n` +
                         `💾 حافظه: ${model.storage || '-'}\n` +
                         `-------------------\n` +
                         `💰 **قیمت تقریبی:** ${model.price} میلیون تومان`;
            
            addBotMessage(text, [[{ text: "🔙 بازگشت", callbackData: `mob_brand_${brandName}` }]]);
        }
        return;
    }


    // --- ADMIN HOME ---
    if (callbackData === 'admin_home') {
        addBotMessage("🛠 **پنل مدیریت پیشرفته**\n\nگزینه مورد نظر را انتخاب کنید:", [
            [{ text: "⚙️ مدیریت دکمه‌ها و منو", callbackData: "admin_menus" }],
            [{ text: "📢 تنظیمات کانال من", callbackData: "admin_channel_settings" }],
            [{ text: "✨ آپدیت قیمت با هوش مصنوعی", callbackData: "admin_ai_update" }],
            [{ text: "📞 تنظیم پشتیبانی", callbackData: "admin_set_support" }],
            [{ text: "💾 مدیریت بکاپ و دیتابیس", callbackData: "admin_backup_menu" }],
            [{ text: "👥 مدیریت ادمین‌ها", callbackData: "admin_manage_admins" }],
            [{ text: "📂 آپدیت قیمت (اکسل)", callbackData: "admin_update_excel" }],
            [{ text: "➕ افزودن تکی خودرو", callbackData: "admin_add_car" }],
            [{ text: "⭐ تنظیم دکمه اسپانسر", callbackData: "admin_set_sponsor" }],
            [{ text: "📣 ارسال پیام همگانی", callbackData: "admin_broadcast" }],
            [{ text: "🔙 خروج از مدیریت", callbackData: "main_menu" }]
        ]);
        return;
    }

    // --- ADMIN CHANNEL SETTINGS ---
    if (callbackData === 'admin_channel_settings') {
        const c = menuConfig["channel"];
        const statusText = c.active ? "فعال ✅" : "غیرفعال ❌";
        addBotMessage(`📢 **تنظیمات کانال من**\n\nوضعیت فعلی: ${statusText}\nلینک فعلی: ${c.url}\n\nچه کاری می‌خواهید انجام دهید؟`, [
            [{ text: "👁️ تغییر وضعیت (روشن/خاموش)", callbackData: "menu_toggle_channel" }],
            [{ text: "🔗 تغییر لینک کانال", callbackData: "menu_set_url_channel" }],
            [{ text: "🔙 بازگشت", callbackData: "admin_home" }]
        ]);
        return;
    }

    // --- ADMIN AI UPDATE ---
    if (callbackData === 'admin_ai_update') {
        if (!process.env.API_KEY) {
            addBotMessage("⚠️ کلید API یافت نشد. لطفا در تنظیمات سیستم آن را وارد کنید.", [[{ text: "🔙 بازگشت", callbackData: "admin_home" }]]);
            return;
        }
        setBotState(BotState.ADMIN_AI_UPDATING);
        addBotMessage("✨ **آپدیت هوشمند قیمت‌ها**\n\nدر این بخش، ربات با استفاده از هوش مصنوعی Gemini قیمت‌های بازار را استخراج و دیتابیس را بروزرسانی می‌کند.\n\nآیا مطمئن هستید؟", [
            [{ text: "✅ بله، شروع آپدیت", callbackData: "admin_ai_update_start" }],
            [{ text: "🔙 انصراف", callbackData: "admin_home" }]
        ]);
        return;
    }

    if (callbackData === 'admin_ai_update_start') {
        addBotMessage("⏳ در حال تحلیل بازار و استخراج قیمت‌ها توسط هوش مصنوعی...\n(ممکن است چند ثانیه طول بکشد)");
        
        const runAiUpdate = async () => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const model = ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `You are an Iranian car market expert. 
                    Update the following car prices (in Millions of Tomans) to their CURRENT real-world market values in Iran.
                    Return ONLY a JSON object matching the structure provided, with updated marketPrice and factoryPrice values.
                    
                    Current Data: ${JSON.stringify(carDatabase)}
                    
                    Rules:
                    1. Keep the same structure.
                    2. Update marketPrice and factoryPrice based on current Feb 2026 trends in Iran.
                    3. Return ONLY the JSON object.`,
                });
                
                const response = await model;
                const text = response.text;
                const jsonMatch = text?.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const updatedDb = JSON.parse(jsonMatch[0]);
                    setCarDatabase(updatedDb);
                    setLastUpdate(new Date().toLocaleString('fa-IR'));
                    addBotMessage("✅ دیتابیس قیمت‌ها با موفقیت توسط هوش مصنوعی بروزرسانی شد!", [[{ text: "🔙 بازگشت", callbackData: "admin_home" }]]);
                } else {
                    throw new Error("Invalid AI response");
                }
            } catch (error) {
                console.error(error);
                addBotMessage("❌ خطا در ارتباط با هوش مصنوعی. لطفا دوباره تلاش کنید.", [[{ text: "🔙 بازگشت", callbackData: "admin_home" }]]);
            } finally {
                setBotState(BotState.IDLE);
            }
        };
        
        runAiUpdate();
        return;
    }

    // --- ADMIN SET SUPPORT ---
    if (callbackData === 'admin_set_support') {
        setTempAdminData({ mode: 'SET_SUPPORT' });
        addBotMessage("📞 **تنظیم دکمه پشتیبانی**\n\nلطفا یکی از موارد زیر را ارسال کنید:\n1. یک **لینک** (مثلا https://t.me/admin) -> دکمه به صورت لینک مستقیم باز می‌شود.\n2. یک **متن یا شماره** -> وقتی کاربر کلیک کند، این متن به او نمایش داده می‌شود.");
        return;
    }

    // --- ADMIN MENUS ---
    if (callbackData === "admin_menus") {
        const keyboard = Object.entries(menuConfig).map(([key, val]: any) => {
             const status = val.active ? "✅" : "❌";
             return [{ text: `${status} ${val.label}`, callbackData: `edit_menu_${key}` }];
        });
        keyboard.push([{ text: "🔙 بازگشت", callbackData: "admin_home" }]);
        addBotMessage("⚙️ **مدیریت منو**\n\nکدام دکمه را می‌خواهید ویرایش کنید؟", keyboard);
        return;
    }

    if (callbackData.startsWith("edit_menu_")) {
        const key = callbackData.replace("edit_menu_", "");
        
        // Special case for channel to use the dedicated settings UI
        if (key === "channel") {
            handleCallback({ text: "", callbackData: "admin_channel_settings" });
            return;
        }

        const c = menuConfig[key];
        const statusText = c.active ? "فعال ✅" : "غیرفعال ❌";
        
        let text = `🔧 ویرایش دکمه: **${c.label}**\nوضعیت فعلی: ${statusText}\n`;
        if (c.url) text += `لینک فعلی: ${c.url}`;

        const keyboard = [
            [{ text: "✏️ تغییر نام دکمه", callbackData: `menu_set_label_${key}` }],
            [{ text: "👁️ تغییر وضعیت (روشن/خاموش)", callbackData: `menu_toggle_${key}` }]
        ];
        if (c.url) {
            keyboard.push([{ text: "🔗 تغییر لینک", callbackData: `menu_set_url_${key}` }]);
        }
        keyboard.push([{ text: "🔙 بازگشت", callbackData: "admin_menus" }]);
        
        addBotMessage(text, keyboard);
        return;
    }

    if (callbackData.startsWith("menu_toggle_")) {
        const key = callbackData.replace("menu_toggle_", "");
        setMenuConfig((prev: any) => ({
            ...prev,
            [key]: { ...prev[key], active: !prev[key].active }
        }));
        const newStatus = !menuConfig[key].active ? "✅ فعال" : "❌ غیرفعال";
        setTimeout(() => {
             addBotMessage(`دکمه ${newStatus} شد. بازگشت به تنظیمات...`);
             setTimeout(() => handleCallback({ text: "", callbackData: `edit_menu_${key}` }), 500);
        }, 300);
        return;
    }

    if (callbackData.startsWith("menu_set_label_")) {
        const key = callbackData.replace("menu_set_label_", "");
        setTempAdminData({ mode: 'EDIT_MENU_LABEL', key: key });
        addBotMessage("✍️ نام جدید برای این دکمه را وارد کنید:");
        return;
    }

    if (callbackData.startsWith("menu_set_url_")) {
        const key = callbackData.replace("menu_set_url_", "");
        setTempAdminData({ mode: 'EDIT_MENU_URL', key: key });
        addBotMessage("🔗 لینک جدید را وارد کنید (باید با https شروع شود):");
        return;
    }

    if (callbackData === 'menu_toggle_channel') {
        setMenuConfig((prev: any) => ({
            ...prev,
            channel: { ...prev.channel, active: !prev.channel.active }
        }));
        addBotMessage(`✅ وضعیت کانال تغییر کرد.`, [[{ text: "🔙 بازگشت", callbackData: "admin_channel_settings" }]]);
        return;
    }

    if (callbackData === 'menu_set_url_channel') {
        setTempAdminData({ mode: 'EDIT_CHANNEL_URL' });
        addBotMessage("🔗 لینک جدید کانال را وارد کنید (مثلا https://t.me/yourchannel):");
        return;
    }


    // --- BACKUP MANAGEMENT ---
    if (callbackData === 'admin_backup_menu') {
        const status = backupInterval === 0 ? "❌ غیرفعال" : (backupInterval === 1 ? "✅ هر ساعت" : "✅ هر 24 ساعت");
        
        addBotMessage(`💾 **مدیریت بکاپ و دیتابیس**\n\nوضعیت بکاپ خودکار: ${status}\n\nیک گزینه انتخاب کنید:`, [
            [{ text: "📥 دریافت بکاپ آنی (همین الان)", callbackData: "backup_get_now" }],
            [{ text: "📤 ریستور بکاپ (بازگردانی)", callbackData: "backup_restore_menu" }],
            [{ text: "⏱ تنظیم بکاپ ساعتی (1h)", callbackData: "backup_set_1h" }],
            [{ text: "📅 تنظیم بکاپ روزانه (24h)", callbackData: "backup_set_24h" }],
            [{ text: "🚫 خاموش کردن بکاپ خودکار", callbackData: "backup_off" }],
            [{ text: "🔙 بازگشت", callbackData: "admin_home" }]
        ]);
        return;
    }
    
    if (callbackData === 'backup_get_now') {
        addBotMessage("⏳ در حال ایجاد فایل بکاپ...");
        // Save current state to "backup"
        setBackupData({
            carDatabase,
            menuConfig,
            supportConfig,
            sponsorConfig
        });
        
        setTimeout(() => {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "💾 bot_data.json\n(فایل دیتابیس کامل ذخیره شد)",
                sender: 'bot',
                timestamp: new Date(),
                buttons: []
            }]);
            setTimeout(() => {
                addBotMessage("✅ فایل بکاپ در حافظه شبیه‌ساز ذخیره شد.", [[{ text: "🔙 منوی بکاپ", callbackData: "admin_backup_menu" }]]);
            }, 500);
        }, 1000);
        return;
    }

    if (callbackData === 'backup_restore_menu') {
        if (!backupData) {
            addBotMessage("❌ هیچ بکاپی یافت نشد! ابتدا یک بکاپ بگیرید.", [[{ text: "🔙 بازگشت", callbackData: "admin_backup_menu" }]]);
            return;
        }
        addBotMessage("⚠️ **هشدار ریستور**\n\nبا بازگردانی بکاپ، تمام تنظیمات و قیمت‌های فعلی حذف شده و دیتای قبلی جایگزین می‌شود.\n\nآیا ادامه می‌دهید؟", [
            [{ text: "✅ بله، ریستور شود", callbackData: "backup_restore_confirm" }],
            [{ text: "🔙 انصراف", callbackData: "admin_backup_menu" }]
        ]);
        return;
    }

    if (callbackData === 'backup_restore_confirm') {
        addBotMessage("⏳ در حال بازگردانی اطلاعات...");
        setTimeout(() => {
            if (backupData) {
                setCarDatabase(backupData.carDatabase);
                setMenuConfig(backupData.menuConfig);
                setSupportConfig(backupData.supportConfig);
                setSponsorConfig(backupData.sponsorConfig);
                addBotMessage("✅ اطلاعات با موفقیت بازگردانی شد.", [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
            }
        }, 1000);
        return;
    }

    if (callbackData === 'backup_set_1h') {
        setBackupInterval(1);
        addBotMessage("✅ بکاپ خودکار روی **هر ۱ ساعت** تنظیم شد.", [[{ text: "🔙 منوی بکاپ", callbackData: "admin_backup_menu" }]]);
        return;
    }
    if (callbackData === 'backup_set_24h') {
        setBackupInterval(24);
        addBotMessage("✅ بکاپ خودکار روی **هر ۲۴ ساعت** تنظیم شد.", [[{ text: "🔙 منوی بکاپ", callbackData: "admin_backup_menu" }]]);
        return;
    }
    if (callbackData === 'backup_off') {
        setBackupInterval(0);
        addBotMessage("🚫 بکاپ خودکار **غیرفعال** شد.", [[{ text: "🔙 منوی بکاپ", callbackData: "admin_backup_menu" }]]);
        return;
    }

    // --- Price List Flow (INTERNAL) ---
    if (callbackData === 'menu_prices') {
      setBotState(BotState.BROWSING_BRANDS);
      const buttons = Object.keys(carDatabase).map(brand => [{ text: brand, callbackData: `brand_${brand}` }]);
      buttons.push([{ text: "🔙 بازگشت", callbackData: "main_menu" }]);
      addBotMessage("🏢 لطفا شرکت سازنده را انتخاب کنید:", buttons);
    } 
    else if (callbackData.startsWith('brand_')) {
      const brandName = callbackData.replace('brand_', '');
      const brand = carDatabase[brandName];
      
      if (botState === BotState.ESTIMATING_BRAND) {
        setEstimateData(prev => ({ ...prev, brand: brandName }));
        setBotState(BotState.ESTIMATING_MODEL);
        const buttons = brand.models.map(m => [{ text: m.name, callbackData: `model_${m.name}` }]);
        buttons.push([{ text: "🔙 انصراف", callbackData: "main_menu" }]);
        addBotMessage(`خودروی ${brandName} را انتخاب کنید:`, buttons);
      } 
      else {
        setBotState(BotState.BROWSING_MODELS);
        const buttons = brand.models.map(m => [{ text: m.name, callbackData: `model_${m.name}` }]);
        buttons.push([{ text: "🔙 بازگشت", callbackData: "menu_prices" }]);
        addBotMessage(`🚘 مدل‌های موجود برای ${brandName}:`, buttons);
      }
    }
    else if (callbackData.startsWith('model_')) {
      const modelName = callbackData.replace('model_', '');
      
      if (botState === BotState.BROWSING_MODELS) {
         let foundBrand = null;
         let foundModelData = null;
         for (const [bName, bData] of Object.entries(carDatabase) as [string, CarBrand][]) {
             const m = bData.models.find(m => m.name === modelName);
             if (m) { foundBrand = bName; foundModelData = m; break; }
         }

         if (foundModelData) {
           setBotState(BotState.BROWSING_VARIANTS);
           const buttons = foundModelData.variants.map((v, idx) => [
             { text: v.name, callbackData: `variant_${modelName}_${idx}` }
           ]);
           buttons.push([{ text: "🔙 بازگشت به مدل‌ها", callbackData: `brand_${foundBrand}` }]);
           addBotMessage(`لطفا تیپ خودروی ${modelName} را انتخاب کنید:`, buttons);
         }
      } 
      else if (botState === BotState.ESTIMATING_MODEL) {
        setEstimateData(prev => ({ ...prev, model: modelName }));
        setBotState(BotState.ESTIMATING_YEAR);
        const buttons = [];
        for (let i = 0; i < YEARS.length; i += 3) {
          const row = YEARS.slice(i, i + 3).map(y => ({ text: y.toString(), callbackData: `year_${y}` }));
          buttons.push(row);
        }
        addBotMessage("سال ساخت خودرو را انتخاب کنید:", buttons);
      }
    }
    else if (callbackData.startsWith('variant_')) {
      const parts = callbackData.split("_");
      const modelName = parts[1];
      const variantIdx = parseInt(parts[2]);

      let foundBrandName = "";
      let foundVariant = null;

      for (const [bName, bData] of Object.entries(carDatabase) as [string, CarBrand][]) {
          const m = bData.models.find(m => m.name === modelName);
          if (m && m.variants[variantIdx]) {
              foundBrandName = bName;
              foundVariant = m.variants[variantIdx];
              break;
          }
      }

      if (foundVariant) {
        const floorPrice = Math.floor(foundVariant.marketPrice * 0.985); 
        
        let priceText = `📊 **استعلام آنی قیمت**\n`;
        priceText += `🚘 ${foundVariant.name}\n`;
        priceText += `🕓 آخرین بروزرسانی: ${lastUpdate}\n`;
        priceText += `-------------------\n\n`;
        priceText += `📉 **کف قیمت بازار (لحظه‌ای):**\n💰 ${floorPrice.toLocaleString()} میلیون تومان\n`;
        priceText += `_(پایین‌ترین قیمت معامله شده)_\n\n`;
        priceText += `🏭 **قیمت مصوب کارخانه:**\n🏦 ${foundVariant.factoryPrice.toLocaleString()} میلیون تومان\n\n`;
        priceText += `📡 _منبع: دیتابیس داخلی ربات_`;
        
        addBotMessage(priceText, [[{ text: "🔙 بازگشت به تیپ‌ها", callbackData: `model_${modelName}` }]]);
      }
    }

    // --- Estimation Flow ---
    else if (callbackData === 'menu_estimate') {
      setBotState(BotState.ESTIMATING_BRAND);
      setEstimateData({});
      const buttons = Object.keys(carDatabase).map(brand => [{ text: brand, callbackData: `brand_${brand}` }]);
      buttons.push([{ text: "🔙 انصراف", callbackData: "main_menu" }]);
      addBotMessage("برای تخمین قیمت، ابتدا برند خودرو را انتخاب کنید:", buttons);
    }
    else if (callbackData.startsWith('year_')) {
      const year = parseInt(callbackData.replace('year_', ''));
      setEstimateData(prev => ({ ...prev, year }));
      setBotState(BotState.ESTIMATING_MILEAGE);
      addBotMessage("لطفا کارکرد خودرو (کیلومتر) را به صورت عدد وارد کنید:\nمثال: 45000");
    }
    else if (callbackData.startsWith('paint_')) {
        const paintIdx = parseInt(callbackData.replace('paint_', ''));
        const condition = PAINT_CONDITIONS[paintIdx];
        
        const { brand, model, year, mileage } = estimateData;
        
        // Find Zero Price (Mock)
        let zeroPrice = 800; 
        for (const b of Object.values(carDatabase) as CarBrand[]) {
           const m = b.models.find(mod => mod.name === model);
           if (m) { zeroPrice = m.variants[0].marketPrice; break; }
        }

        if (year && mileage !== undefined) {
             const currentYear = 1404; // Adjust based on dynamic date later
             const age = currentYear - year;
             
             // 1. Age Depreciation (Logic: Y1: 5%, Y2+: ~3-4%)
             let ageDrop = 0;
             if (age === 1) ageDrop = 0.05;
             else if (age > 1) ageDrop = 0.05 + ((age - 1) * 0.035);
             if (age > 10) ageDrop = 0.40; // Max drop for age roughly
             
             // 2. Mileage Depreciation
             const standardMileage = age * 20000;
             const diff = mileage - standardMileage;
             let mileageDrop = 0;
             
             if (diff > 0) {
                 mileageDrop = (diff / 10000) * 0.01; // Penalty
                 if (mileageDrop > 0.15) mileageDrop = 0.15; // Cap penalty
             } else {
                 mileageDrop = (diff / 10000) * 0.005; // Reward (negative drop)
                 if (mileageDrop < -0.05) mileageDrop = -0.05; // Cap reward
             }

             // 3. Paint Depreciation (User selection)
             const paintDrop = condition.drop;
             
             const totalDrop = ageDrop + mileageDrop + paintDrop;
             const calculatedPrice = zeroPrice * (1 - totalDrop);
             
             // Round to nearest 5 million
             const finalPrice = Math.round(calculatedPrice / 5) * 5;

             const result = `🎯 **کارشناسی قیمت هوشمند**\n\n` +
               `🚙 **${brand} ${model}**\n` +
               `💵 قیمت صفر روز: ${zeroPrice.toLocaleString()} م\n` +
               `-------------------------------\n` +
               `📅 سال: ${year} (افت مدل: ${Math.round(ageDrop*100)}%)\n` +
               `🛣 کارکرد: ${mileage.toLocaleString()} (تاثیر: ${Math.round(mileageDrop*100)}%)\n` +
               `🎨 بدنه: ${condition.label} (افت: ${Math.round(paintDrop*100)}%)\n` +
               `-------------------------------\n` +
               `📉 **قیمت کارشناسی شده:**\n` +
               `💰 **${finalPrice.toLocaleString()} میلیون تومان**\n\n` +
               `_توجه: این قیمت تخمینی بر اساس الگوریتم افت قیمت بازار و دیتابیس داخلی محاسبه شده است._`;
               
             // Add button to check online
             const buttons = [
                 [{ text: "🧮 محاسبه دقیق (آنلاین)", webAppUrl: "https://www.hamrah-mechanic.com/carprice/" }],
                 [{ text: "🏠 منوی اصلی", callbackData: "main_menu" }]
             ];

             addBotMessage(result, buttons);
             setBotState(BotState.IDLE);
        }
    }
    else if (callbackData === 'menu_search') {
      setBotState(BotState.SEARCHING);
      addBotMessage("نام خودروی مورد نظر خود را وارد کنید:");
    }

    // --- ADMIN MOCK HANDLERS ---
    else if (callbackData === 'admin_set_sponsor') {
       addBotMessage("✍️ نام **اسپانسر** را وارد کنید (مثلا: بیمه بازار):");
       setTempAdminData({ mode: 'SET_SPONSOR_NAME' });
    }
    else if (callbackData === 'admin_update_excel') {
        // Step 1: Simulate Bot Sending the Template
        addBotMessage("⏳ در حال ساخت فایل خروجی از دیتابیس فعلی...");
        
        setTimeout(() => {
            // Fake file message
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: "📂 prices_1403.xlsx\n(این فایل شامل تمام قیمت‌های فعلی است)",
                sender: 'bot',
                timestamp: new Date(),
                buttons: [] // No buttons on file usually
            }]);
            
            // Step 2: Ask for the upload
            setTimeout(() => {
                addBotMessage("✅ فایل بالا را دانلود و ویرایش کنید.\n\n📤 **حالا فایل ویرایش شده را همینجا ارسال (آپلود) کنید:**");
                setTempAdminData({ mode: 'UPLOAD_EXCEL' });
            }, 800);
        }, 1000);
    }
    else if (callbackData === 'admin_add_car') {
       addBotMessage("➕ افزودن خودرو جدید.\nابتدا نام کمپانی (برند) را وارد کنید:");
       setTempAdminData({ mode: 'ADD_BRAND' });
    }
    
    // --- ADMIN MANAGEMENT HANDLERS ---
    else if (callbackData === 'admin_manage_admins') {
       addBotMessage("👥 **مدیریت ادمین‌ها**\n\nلیست ادمین‌های فعلی:\n1. مدیر اصلی (شما)\n\nچه کاری می‌خواهید انجام دهید؟", [
           [{ text: "➕ افزودن ادمین جدید", callbackData: "admin_add_new_admin" }],
           [{ text: "📜 لیست کامل", callbackData: "admin_list_admins" }],
           [{ text: "🔙 بازگشت", callbackData: "admin_home" }]
       ]);
    }
    else if (callbackData === 'admin_add_new_admin') {
        setBotState(BotState.ADMIN_MANAGE_ADD);
        addBotMessage("🔢 لطفا **شناسه عددی (Numeric ID)** کاربر مورد نظر را وارد کنید:\n\n_(کاربر می‌تواند با ارسال /id شناسه خود را دریافت کند)_");
    }
    else if (callbackData === 'admin_list_admins') {
        addBotMessage("📜 **لیست ادمین‌ها:**\n\n1. 123456789 (Owner)\n2. 987654321 (Admin)", [[{ text: "🔙 بازگشت", callbackData: "admin_manage_admins" }]]);
    }

    // --- BROADCAST HANDLERS ---
    else if (callbackData === 'admin_broadcast') {
       setBotState(BotState.ADMIN_BROADCAST_TYPE);
       addBotMessage("📢 **نوع ارسال همگانی را انتخاب کنید:**", [
           [{ text: "👥 ارسال به همه (آنی)", callbackData: "bcast_all" }],
           [{ text: "🔥 کاربران فعال (۳۰ روز اخیر)", callbackData: "bcast_active" }],
           [{ text: "⏳ زمان‌بندی شده (آینده)", callbackData: "bcast_schedule" }],
           [{ text: "🔙 بازگشت", callbackData: "admin_home" }]
       ]);
    }
    else if (callbackData === 'bcast_all') {
        setBotState(BotState.ADMIN_BROADCAST_CONTENT);
        setTempAdminData({ mode: 'BCAST_SEND_ALL' });
        addBotMessage("✍️ **متن پیام** خود را بنویسید تا بلافاصله برای همه کاربران ارسال شود:");
    }
    else if (callbackData === 'bcast_active') {
        setBotState(BotState.ADMIN_BROADCAST_CONTENT);
        setTempAdminData({ mode: 'BCAST_SEND_ACTIVE' });
        addBotMessage("✍️ **متن پیام** خود را بنویسید (فقط برای کاربرانی که در ۳۰ روز اخیر تعامل داشته‌اند):");
    }
    else if (callbackData === 'bcast_schedule') {
        setBotState(BotState.ADMIN_BROADCAST_TIME);
        addBotMessage("🕒 **زمان ارسال** را با فرمت زیر وارد کنید:\n\nYYYY/MM/DD HH:MM\n\nمثال: 1403/12/29 18:30");
    }
  };

  const handleSend = (textOverride?: string) => {
    const txt = textOverride || input;
    if (!txt.trim()) return;
    
    if (!textOverride) setInput('');
    addUserMessage(txt);

    // --- ADMIN COMMANDS ---
    // KEEPING /admin only for simulator toggle for user convenience, but bot logic uses buttons
    if (txt === '/admin') {
        setIsAdminMode(!isAdminMode); // Toggle mode for simulator
        // Also simulate the bot response for the command
        if (!isAdminMode) {
             addBotMessage("🛠 **پنل مدیریت پیشرفته**\n\nگزینه مورد نظر را انتخاب کنید:", [
                [{ text: "⚙️ مدیریت دکمه‌ها و منو", callbackData: "admin_menus" }],
                [{ text: "📞 تنظیم پشتیبانی", callbackData: "admin_set_support" }],
                [{ text: "💾 مدیریت بکاپ و دیتابیس", callbackData: "admin_backup_menu" }],
                [{ text: "👥 مدیریت ادمین‌ها", callbackData: "admin_manage_admins" }],
                [{ text: "📂 آپدیت قیمت (اکسل)", callbackData: "admin_update_excel" }],
                [{ text: "➕ افزودن تکی خودرو", callbackData: "admin_add_car" }],
                [{ text: "⭐ تنظیم دکمه اسپانسر", callbackData: "admin_set_sponsor" }],
                [{ text: "📣 ارسال پیام همگانی", callbackData: "admin_broadcast" }],
                [{ text: "🔙 خروج از مدیریت", callbackData: "main_menu" }]
            ]);
        }
        return;
    }
    
    if (txt === '/start') {
        addBotMessage(getWelcomeMessage(), getMainMenuButtons());
        return;
    }

    if (txt === '/id') {
        addBotMessage(`🆔 شناسه کاربری شما: 123456789`);
        return;
    }

    // --- SUPPORT HANDLER ---
    if (botState === BotState.SUPPORT_MESSAGE) {
        setBotState(BotState.IDLE);
        addBotMessage("✅ پیام شما برای تیم پشتیبانی ارسال شد.\nبه زودی با شما تماس خواهیم گرفت.", [[{ text: "🏠 منوی اصلی", callbackData: "main_menu" }]]);
        return;
    }

    if (isAdminMode && tempAdminData.mode) {
        // SUPPORT SETTING
        if (tempAdminData.mode === 'SET_SUPPORT') {
            const mode = txt.startsWith("http") ? "link" : "text";
            // Auto format username
            let val = txt;
            if (txt.startsWith("@")) {
                 val = `https://t.me/${txt.replace("@", "")}`;
            }

            setSupportConfig({ mode: mode === "link" || val.startsWith("http") ? "link" : "text", value: val });
            setTempAdminData({});
            const typeMsg = (mode === "link" || val.startsWith("http")) ? "لینک مستقیم" : "متن";
            addBotMessage(`✅ پشتیبانی تنظیم شد به صورت **${typeMsg}**.\nمقدار: ${val}`, [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
            return;
        }

        // MENU EDITING
        if (tempAdminData.mode === 'EDIT_MENU_LABEL') {
            const key = tempAdminData.key;
            setMenuConfig((prev: any) => ({
                ...prev,
                [key]: { ...prev[key], label: txt }
            }));
            addBotMessage(`✅ نام دکمه تغییر کرد به: ${txt}`, [[{ text: "🔙 مدیریت منو", callbackData: "admin_menus" }]]);
            setTempAdminData({});
            return;
        }
        if (tempAdminData.mode === 'EDIT_MENU_URL') {
            const key = tempAdminData.key;
             if (!txt.startsWith("http")) {
                addBotMessage("❌ لینک نامعتبر است. با http یا https شروع کنید.");
                return;
            }
            setMenuConfig((prev: any) => ({
                ...prev,
                [key]: { ...prev[key], url: txt }
            }));
            addBotMessage(`✅ لینک دکمه تغییر کرد.`, [[{ text: "🔙 مدیریت منو", callbackData: "admin_menus" }]]);
            setTempAdminData({});
            return;
        }

        if (tempAdminData.mode === 'EDIT_CHANNEL_URL') {
            if (!txt.startsWith("http")) {
                addBotMessage("❌ لینک نامعتبر است. با http یا https شروع کنید.");
                return;
            }
            setMenuConfig((prev: any) => ({
                ...prev,
                channel: { ...prev.channel, url: txt }
            }));
            addBotMessage(`✅ لینک کانال تغییر کرد.`, [[{ text: "🔙 تنظیمات کانال", callbackData: "admin_channel_settings" }]]);
            setTempAdminData({});
            return;
        }

        if (tempAdminData.mode === 'UPLOAD_EXCEL') {
            setLastUpdate(new Date().toLocaleString('fa-IR'));
            addBotMessage(`✅ فایل دریافت شد!\n🔄 دیتابیس قیمت‌ها با موفقیت بروزرسانی شد.\n🕒 زمان ثبت: ${new Date().toLocaleTimeString('fa-IR')}`, [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
            setTempAdminData({});
            return;
        }

        // Add Car Manual Flow (Simulated)
        if (tempAdminData.mode === 'ADD_BRAND') {
            setTempAdminData({ mode: 'ADD_MODEL', brand: txt });
            addBotMessage("نام مدل را وارد کنید:");
            return;
        }
        if (tempAdminData.mode === 'ADD_MODEL') {
            setTempAdminData({ ...tempAdminData, mode: 'ADD_VARIANT', model: txt });
            addBotMessage("نام تیپ (Variant) را وارد کنید:");
            return;
        }
        if (tempAdminData.mode === 'ADD_VARIANT') {
             setTempAdminData({ ...tempAdminData, mode: 'ADD_PRICE', variant: txt });
             addBotMessage("قیمت بازار (میلیون تومان) را وارد کنید:");
             return;
        }
        if (tempAdminData.mode === 'ADD_PRICE') {
             addBotMessage(`✅ خودروی جدید با موفقیت اضافه شد!`, [[{ text: "🔙 پنل مدیریت", callbackData: "admin_home" }]]);
             setTempAdminData({});
             return;
        }

        // Sponsor Logic
        if (tempAdminData.mode === 'SET_SPONSOR_NAME') {
            setTempAdminData({ mode: 'SET_SPONSOR_URL', name: txt });
            addBotMessage(`✅ نام اسپانسر: "${txt}"\n\nحالا **لینک اسپانسر** را وارد کنید:`);
            return;
        }
        if (tempAdminData.mode === 'SET_SPONSOR_URL') {
            setSponsorConfig({ name: tempAdminData.name, url: txt });
            setTempAdminData({});
            addBotMessage(`✅ اسپانسر تنظیم شد!`, [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
            return;
        }
    }

    // --- ADMIN ADD USER ---
    if (botState === BotState.ADMIN_MANAGE_ADD) {
        if (!isNaN(Number(txt))) {
            addBotMessage(`✅ کاربر با شناسه **${txt}** به لیست ادمین‌ها اضافه شد.`, [[{ text: "🔙 مدیریت ادمین‌ها", callbackData: "admin_manage_admins" }]]);
            setBotState(BotState.IDLE);
        } else {
            addBotMessage("❌ خطا: شناسه باید فقط شامل عدد باشد.");
        }
        return;
    }
    
    // --- BROADCAST INPUTS ---
    if (botState === BotState.ADMIN_BROADCAST_CONTENT) {
        if (tempAdminData.mode === 'BCAST_SEND_ALL') {
            addBotMessage("✅ پیام شما در صف ارسال برای **همه کاربران** قرار گرفت.", [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
        } else if (tempAdminData.mode === 'BCAST_SEND_ACTIVE') {
            addBotMessage("✅ پیام شما برای **کاربران فعال** ارسال شد.", [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
        } else if (tempAdminData.mode === 'BCAST_SCHEDULE_MSG') {
            const time = tempAdminData.time;
            addBotMessage(`✅ پیام شما برای ارسال در تاریخ **${time}** زمان‌بندی شد.`, [[{ text: "🔙 منوی مدیریت", callbackData: "admin_home" }]]);
        }
        setBotState(BotState.IDLE);
        setTempAdminData({});
        return;
    }

    if (botState === BotState.ADMIN_BROADCAST_TIME) {
        if (txt.includes('/') && txt.includes(':')) {
             setTempAdminData({ mode: 'BCAST_SCHEDULE_MSG', time: txt });
             setBotState(BotState.ADMIN_BROADCAST_CONTENT);
             addBotMessage(`🕒 زمان ثبت شد: ${txt}\n\n✍️ حالا **متن پیام** را بنویسید:`);
        } else {
             addBotMessage("❌ فرمت نامعتبر است.\nلطفا طبق الگو وارد کنید: 1403/12/29 18:30");
        }
        return;
    }

    // -----------------------

    if (botState === BotState.ESTIMATING_MILEAGE) {
      const num = Number(txt.replace(/,/g, ''));
      if (!isNaN(num)) {
        setEstimateData(prev => ({ ...prev, mileage: num }));
        setBotState(BotState.ESTIMATING_PAINT);
        
        const buttons: InlineButton[][] = [];
        for(let i=0; i<PAINT_CONDITIONS.length; i+=2) {
            const row = [{ text: PAINT_CONDITIONS[i].label, callbackData: `paint_${i}` }];
            if (i+1 < PAINT_CONDITIONS.length) {
                row.push({ text: PAINT_CONDITIONS[i+1].label, callbackData: `paint_${i+1}` });
            }
            buttons.push(row);
        }
        addBotMessage("وضعیت رنگ و بدنه خودرو را انتخاب کنید:", buttons);
      } else {
        addBotMessage("⚠️ لطفا فقط عدد وارد کنید (مثال: 50000).");
      }
    } else if (botState === BotState.SEARCHING) {
       // Search logic...
       addBotMessage(`❌ نتیجه‌ای برای "${txt}" یافت نشد. (شبیه‌ساز)`, [[{ text: "🏠 منوی اصلی", callbackData: "main_menu" }]]);
    } else {
      addBotMessage("لطفا از گزینه‌های موجود انتخاب کنید.");
    }
  };

  const handleRestart = () => {
      setMessages([]);
      setBotState(BotState.IDLE);
      setTimeout(() => {
         addBotMessage(getWelcomeMessage(), getMainMenuButtons());
      }, 100);
  }

  return (
    <div className="flex flex-col h-full bg-[#87aebf] rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-800 relative">
        {/* Phone Header */}
        <div className="bg-[#517da2] text-white p-3 flex items-center justify-between shadow-md z-10">
             <div className="flex items-center gap-2">
                 <ArrowLeft size={20} />
                 <div className="w-8 h-8 bg-blue-300 rounded-full flex items-center justify-center text-sm font-bold">Bot</div>
                 <div>
                     <div className="font-bold text-sm">CarPriceBot</div>
                     <div className="text-xs text-blue-100">bot</div>
                 </div>
             </div>
             <div className="flex gap-2">
                 <button 
                    onClick={() => {
                        setIsAdminMode(!isAdminMode);
                        // Force menu refresh message when toggling
                        setMessages(prev => [...prev, {
                            id: Date.now().toString(),
                            text: isAdminMode ? "🔒 حالت کاربر عادی" : "🔓 حالت ادمین فعال شد (دکمه مدیریت اضافه شد)",
                            sender: 'bot',
                            timestamp: new Date(),
                            buttons: []
                        }]);
                        setTimeout(handleRestart, 1000);
                    }} 
                    title={isAdminMode ? "Switch to User" : "Switch to Admin"} 
                    className={`${isAdminMode ? "text-red-300" : "text-yellow-300"} hover:scale-110 transition-transform`}
                 >
                    <ShieldAlert size={18} />
                 </button>
                 <button onClick={handleRestart} title="Restart Bot"><RefreshCw size={18} /></button>
             </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#e5ddd5] bg-[url('https://cdn.pixabay.com/photo/2016/06/02/02/33/triangles-1430105_960_720.png')] bg-cover">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${msg.sender === 'user' ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                        {/* File Simulation */}
                        {msg.text.includes("prices_1403.xlsx") || msg.text.includes("bot_data.json") ? (
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500 p-3 rounded-lg text-white">
                                    {msg.text.includes("json") ? <Database size={24} /> : <FileSpreadsheet size={24} />}
                                </div>
                                <div>
                                    <div className="font-bold text-blue-600">{msg.text.split('\n')[0].replace("💾 ", "").replace("📂 ", "")}</div>
                                    <div className="text-xs text-gray-500">{msg.text.includes("json") ? "Database File" : "Excel Spreadsheet"}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                        )}
                        
                        <div className={`text-[10px] text-right mt-1 ${msg.sender === 'user' ? 'text-green-800' : 'text-gray-400'}`}>
                            {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    {/* Inline Buttons */}
                    {msg.sender === 'bot' && msg.buttons && (
                        <div className="mt-2 grid gap-1 w-[85%]">
                            {msg.buttons.map((row, rIdx) => (
                                <div key={rIdx} className="flex gap-1">
                                    {row.map((btn, bIdx) => (
                                        <button 
                                            key={bIdx}
                                            onClick={() => handleCallback(btn)}
                                            className={`flex-1 text-xs py-2 px-1 rounded transition-colors font-medium border border-white/20 shadow-sm flex items-center justify-center gap-1 ${
                                                btn.url 
                                                ? 'bg-gradient-to-r from-blue-100 to-white text-blue-700 border-blue-300 font-bold' 
                                                : btn.webAppUrl 
                                                ? 'bg-gradient-to-r from-orange-100 to-yellow-50 text-orange-800 border-orange-300 font-bold'
                                                : 'bg-[#ffffff90] backdrop-blur-sm hover:bg-[#ffffff] text-gray-800'
                                            }`}
                                        >
                                            {btn.webAppUrl && <Globe size={12} />}
                                            {btn.text}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white p-2 flex gap-2 items-center relative">
             {/* MENU POPUP */}
             {showMenu && (
                 <div className="absolute bottom-full left-2 mb-2 bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl w-64 overflow-hidden z-50">
                     <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 font-bold border-b">دستورات ربات</div>
                     <button onClick={() => { handleSend('/start'); setShowMenu(false); }} className="w-full text-right px-4 py-3 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 flex justify-between items-center group">
                        <span className="font-mono text-blue-600 font-bold">/start</span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-500">منوی اصلی</span>
                     </button>
                     <button onClick={() => { handleSend('/id'); setShowMenu(false); }} className="w-full text-right px-4 py-3 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 flex justify-between items-center group">
                        <span className="font-mono text-blue-600 font-bold">/id</span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-500">شناسه عددی</span>
                     </button>
                     <button onClick={() => { handleSend('/admin'); setShowMenu(false); }} className="w-full text-right px-4 py-3 hover:bg-blue-50 text-sm text-gray-700 flex justify-between items-center group">
                        <span className="font-mono text-blue-600 font-bold">/admin</span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-500">پنل مدیریت</span>
                     </button>
                 </div>
             )}

             <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 rounded-full transition-colors ${showMenu ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
             >
                 <Menu size={24} />
             </button>

             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="پیام خود را بنویسید..."
                className="flex-1 bg-white outline-none text-sm text-gray-700"
             />
             <button onClick={() => handleSend()} className="text-[#517da2] hover:text-blue-600">
                 <Send size={24} />
             </button>
        </div>
    </div>
  );
};

export default TelegramMock;