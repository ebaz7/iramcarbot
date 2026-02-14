import React, { useState, useEffect, useRef } from 'react';
import { BotState, ChatMessage, InlineButton, EstimateData } from '../types';
import { CAR_DB, YEARS, PAINT_CONDITIONS } from '../constants';
import { Send, Menu, ArrowLeft, RefreshCw, ShieldAlert, Users, Megaphone, Star, Upload, FileSpreadsheet, Download, Clock, Filter, Phone, UserPlus } from 'lucide-react';

const TelegramMock: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [botState, setBotState] = useState<BotState>(BotState.IDLE);
  const [estimateData, setEstimateData] = useState<EstimateData>({});
  
  // Admin State
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Configs
  const [channelUrl, setChannelUrl] = useState("https://t.me/CarPrice_Channel");
  const [sponsorConfig, setSponsorConfig] = useState<{name?: string, url?: string}>({});
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toLocaleString('fa-IR'));
  
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
  }, []);

  const getWelcomeMessage = () => {
      const today = new Date().toLocaleDateString('fa-IR');
      return `👋 سلام! به جامع‌ترین ربات قیمت خودرو ایران خوش آمدید.\n📅 امروز: ${today}\n\nمنوی اصلی:`;
  }

  const getMainMenuButtons = (): InlineButton[][] => {
      return [
        [{ text: "📋 لیست قیمت روز (کارخانه/بازار)", callbackData: "menu_new" }],
        [{ text: "💰 تخمین قیمت کارکرده", callbackData: "menu_estimate" }],
        [{ text: "🔍 جستجو", callbackData: "menu_search" }, { text: "📞 پشتیبانی", callbackData: "menu_support" }]
      ];
  }

  const addBotMessage = (text: string, buttons: InlineButton[][] = [], isFile: boolean = false) => {
    let finalButtons = [...buttons];

    // Footer Buttons Logic
    if ((finalButtons.length > 0 || text.includes("منوی اصلی")) && !isAdminMode) {
        const footerRow: InlineButton[] = [];
        footerRow.push({ text: "📢 کانال ما", callbackData: "link_channel" });
        if (sponsorConfig.name && sponsorConfig.url) {
            footerRow.push({ text: `⭐ ${sponsorConfig.name}`, callbackData: "link_sponsor" });
        }
        finalButtons.push(footerRow);
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

  const handleCallback = (callbackData: string, btnText: string) => {
    // Handle Links
    if (callbackData === 'link_channel') {
        window.open(channelUrl, '_blank');
        return;
    }
    if (callbackData === 'link_sponsor') {
        window.open(sponsorConfig.url || '#', '_blank');
        return;
    }

    addUserMessage(btnText);

    if (callbackData === 'main_menu') {
      setBotState(BotState.IDLE);
      setIsAdminMode(false);
      addBotMessage(getWelcomeMessage(), getMainMenuButtons());
      return;
    }

    // --- Support Flow ---
    if (callbackData === 'menu_support') {
        setBotState(BotState.SUPPORT_MESSAGE);
        addBotMessage("📞 **تماس با پشتیبانی**\n\nلطفا پیام، انتقاد یا پیشنهاد خود را بنویسید. ما در سریع‌ترین زمان ممکن پاسخ خواهیم داد.", [[{ text: "🔙 بازگشت", callbackData: "main_menu" }]]);
        return;
    }

    // --- Price List Flow ---
    if (callbackData === 'menu_new') {
      setBotState(BotState.BROWSING_BRANDS);
      const buttons = Object.keys(CAR_DB).map(brand => [{ text: brand, callbackData: `brand_${brand}` }]);
      buttons.push([{ text: "🔙 بازگشت", callbackData: "main_menu" }]);
      addBotMessage("🏢 لطفا شرکت سازنده را انتخاب کنید:", buttons);
    } 
    else if (callbackData.startsWith('brand_')) {
      const brandName = callbackData.replace('brand_', '');
      const brand = CAR_DB[brandName];
      
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
        buttons.push([{ text: "🔙 بازگشت", callbackData: "menu_new" }]);
        addBotMessage(`🚘 مدل‌های موجود برای ${brandName}:`, buttons);
      }
    }
    else if (callbackData.startsWith('model_')) {
      const modelName = callbackData.replace('model_', '');
      
      if (botState === BotState.BROWSING_MODELS) {
         let foundBrand = null;
         let foundModelData = null;
         for (const [bName, bData] of Object.entries(CAR_DB)) {
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
      const parts = callbackData.split('_');
      const modelName = parts[1];
      const variantIdx = parseInt(parts[2]);

      let foundBrandName = "";
      let foundVariant = null;

      for (const [bName, bData] of Object.entries(CAR_DB)) {
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
        priceText += `📡 _منابع: پایش لحظه‌ای دیوار، باما و همراه مکانیک_`;
        
        addBotMessage(priceText, [[{ text: "🔙 بازگشت به تیپ‌ها", callbackData: `model_${modelName}` }]]);
      }
    }

    // --- Estimation Flow ---
    else if (callbackData === 'menu_estimate') {
      setBotState(BotState.ESTIMATING_BRAND);
      setEstimateData({});
      const buttons = Object.keys(CAR_DB).map(brand => [{ text: brand, callbackData: `brand_${brand}` }]);
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
        for (const b of Object.values(CAR_DB)) {
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
               `_توجه: این قیمت تخمینی بر اساس الگوریتم افت قیمت بازار ایران محاسبه شده است._`;
               
             addBotMessage(result, [[{ text: "🏠 بازگشت به خانه", callbackData: "main_menu" }]]);
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
           [{ text: "🔙 بازگشت", callbackData: "/admin" }]
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
           [{ text: "🔙 بازگشت", callbackData: "/admin" }]
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

  const handleSend = () => {
    if (!input.trim()) return;
    const txt = input;
    setInput('');
    addUserMessage(txt);

    // --- ADMIN COMMANDS ---
    if (txt === '/admin') {
        setIsAdminMode(true);
        addBotMessage("🛠 **پنل مدیریت پیشرفته**", [
            [{ text: "👥 مدیریت ادمین‌ها", callbackData: "admin_manage_admins" }],
            [{ text: "📂 آپدیت قیمت (اکسل)", callbackData: "admin_update_excel" }],
            [{ text: "➕ افزودن تکی خودرو", callbackData: "admin_add_car" }],
            [{ text: "⭐ تنظیم دکمه اسپانسر", callbackData: "admin_set_sponsor" }],
            [{ text: "📣 ارسال پیام همگانی", callbackData: "admin_broadcast" }],
            [{ text: "🔙 خروج از مدیریت", callbackData: "main_menu" }]
        ]);
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
        if (tempAdminData.mode === 'UPLOAD_EXCEL') {
            setLastUpdate(new Date().toLocaleString('fa-IR'));
            addBotMessage(`✅ فایل دریافت شد!\n🔄 دیتابیس قیمت‌ها با موفقیت بروزرسانی شد.\n🕒 زمان ثبت: ${new Date().toLocaleTimeString('fa-IR')}`, [[{ text: "🔙 منوی مدیریت", callbackData: "/admin" }]]);
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
             addBotMessage(`✅ خودروی جدید با موفقیت اضافه شد!`, [[{ text: "🔙 پنل مدیریت", callbackData: "/admin" }]]);
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
            addBotMessage(`✅ اسپانسر تنظیم شد!`, [[{ text: "🔙 منوی مدیریت", callbackData: "/admin" }]]);
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
            addBotMessage("✅ پیام شما در صف ارسال برای **همه کاربران** قرار گرفت.", [[{ text: "🔙 منوی مدیریت", callbackData: "/admin" }]]);
        } else if (tempAdminData.mode === 'BCAST_SEND_ACTIVE') {
            addBotMessage("✅ پیام شما برای **کاربران فعال** ارسال شد.", [[{ text: "🔙 منوی مدیریت", callbackData: "/admin" }]]);
        } else if (tempAdminData.mode === 'BCAST_SCHEDULE_MSG') {
            const time = tempAdminData.time;
            addBotMessage(`✅ پیام شما برای ارسال در تاریخ **${time}** زمان‌بندی شد.`, [[{ text: "🔙 منوی مدیریت", callbackData: "/admin" }]]);
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
                 <button onClick={() => {setInput('/admin'); handleSend();}} title="Simulate Admin" className="text-yellow-300"><ShieldAlert size={18} /></button>
                 <button onClick={handleRestart} title="Restart Bot"><RefreshCw size={18} /></button>
             </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-[#e5ddd5] bg-[url('https://cdn.pixabay.com/photo/2016/06/02/02/33/triangles-1430105_960_720.png')] bg-cover">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${msg.sender === 'user' ? 'bg-[#dcf8c6] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>
                        {/* File Simulation */}
                        {msg.text.includes("prices_1403.xlsx") ? (
                            <div className="flex items-center gap-3">
                                <div className="bg-green-500 p-3 rounded-lg text-white">
                                    <FileSpreadsheet size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-blue-600">prices_1403.xlsx</div>
                                    <div className="text-xs text-gray-500">14.5 KB Excel Spreadsheet</div>
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
                                            onClick={() => handleCallback(btn.callbackData, btn.text)}
                                            className={`flex-1 text-xs py-2 px-1 rounded transition-colors font-medium border border-white/20 shadow-sm ${
                                                btn.callbackData.startsWith('link_') 
                                                ? 'bg-gradient-to-r from-blue-100 to-white text-blue-700 border-blue-300 font-bold' 
                                                : 'bg-[#ffffff90] backdrop-blur-sm hover:bg-[#ffffff] text-gray-800'
                                            }`}
                                        >
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
        <div className="bg-white p-2 flex gap-2 items-center">
             <Menu className="text-gray-400" />
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="پیام خود را بنویسید..."
                className="flex-1 bg-white outline-none text-sm text-gray-700"
             />
             <button onClick={handleSend} className="text-[#517da2] hover:text-blue-600">
                 <Send size={24} />
             </button>
        </div>
    </div>
  );
};

export default TelegramMock;