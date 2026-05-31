import { Telegraf, Context, Markup } from 'telegraf';
import { loadSettings } from './settings';

let tgBot: Telegraf<Context> | null = null;
let baleBot: Telegraf<Context> | null = null;

function registerHandlers(botInstance: Telegraf<Context>) {
  botInstance.start((ctx) => {
    const name = ctx.from?.first_name || 'کاربر عزیز';
    return ctx.reply(
      `👋 سلام ${name}! به ربات قیمت خودرو و موبایل خوش آمدید.\n\nمنوی اصلی خدمات ربات:`,
      Markup.inlineKeyboard([
        [
          Markup.button.webApp('🧮 ماشین‌حساب', 'https://www.hamrah-mechanic.com/carprice/'),
          Markup.button.webApp('🌐 قیمت بازار', 'https://www.iranjib.ir/showgroup/45/')
        ],
        [
          Markup.button.callback('📋 لیست قیمت خودرو', 'menu_prices'),
          Markup.button.callback('💰 تخمین قیمت خودرو', 'menu_estimate')
        ],
        [
          Markup.button.webApp('📱 قیمت موبایل (سایت)', 'https://www.mobile.ir/phones/prices.aspx'),
          Markup.button.callback('📲 لیست موبایل (ربات)', 'menu_mobile_list')
        ],
        [
          Markup.button.callback('🔍 جستجو خودرو', 'menu_search'),
          Markup.button.url('📢 کانال ما', 'https://t.me/CarPrice_Channel')
        ],
        [
          Markup.button.callback('📞 پشتیبانی', 'menu_support')
        ]
      ])
    );
  });

  botInstance.help((ctx) => ctx.reply('Send /start to open the Farsi menu or send /price to get prices directly.'));

  // Handler for Price query
  const servePrices = async (ctx: any) => {
    const currentSettings = loadSettings();
    let prices = [];

    if (currentSettings.priority === 'EXCEL' && currentSettings.excelData && currentSettings.excelData.length > 0) {
      prices = currentSettings.excelData;
    } else if (currentSettings.aiData && currentSettings.aiData.length > 0) {
      prices = currentSettings.aiData;
    } else {
      // Fallback: build default prices
      prices = [
        { brand: 'ایران خودرو', model: 'پژو 207 دنده‌ای', year: 1403, price: 830000000 },
        { brand: 'ایران خودرو', model: 'دنا پلاس اتوماتیک', year: 1403, price: 1080000000 },
        { brand: 'سایپا', model: 'شاهین دنده‌ای', year: 1403, price: 810000000 },
        { brand: 'سایپا', model: 'کوییک دنده‌ای', year: 1403, price: 475000000 }
      ];
    }

    const message = `📋 **لیست قیمت‌های اخیر:**\n\n` + prices.map((p: any) => 
      `🚗 **${p.brand} ${p.model} (${p.year})**\n💰 قیمت: ${Number(p.price).toLocaleString()} تومان`
    ).join('\n───────────────────\n');

    if (message.length > 4000) {
      const chunks = message.match(/.{1,4000}/g) || [];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(message || 'داده‌ای یافت نشد.', { parse_mode: 'Markdown' });
    }
  };

  botInstance.command('price', servePrices);
  botInstance.action('menu_prices', servePrices);

  botInstance.action('menu_mobile_list', async (ctx) => {
    const mockMobiles = [
      { brand: 'Apple', model: 'iPhone 15 Pro Max (256GB)', price: '92,000,000' },
      { brand: 'Samsung', model: 'Galaxy S24 Ultra (512GB)', price: '78,500,000' },
      { brand: 'Xiaomi', model: 'Redmi Note 13 Pro (256GB)', price: '14,800,000' },
      { brand: 'Samsung', model: 'Galaxy A55 (256GB)', price: '21,200,000' }
    ];

    const message = `📱 **لیست قیمت موبایل (ربات):**\n\n` + mockMobiles.map((m: any) => 
      `📲 **${m.brand} ${m.model}**\n💰 قیمت: ${m.price} تومان`
    ).join('\n───────────────────\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  botInstance.action('menu_search', async (ctx) => {
    await ctx.reply('🔍 لطفاً برای جستجو، دستور جستجو را به صورت زیر ارسال کنید:\n\n`/search پژو`', { parse_mode: 'Markdown' });
  });

  botInstance.command('search', async (ctx) => {
    const query = ctx.payload?.trim();
    if (!query) {
      return ctx.reply('⚠️ لطفا عبارت مورد نظر را بنویسید. مثال: `/search تارا`', { parse_mode: 'Markdown' });
    }

    const currentSettings = loadSettings();
    let prices = currentSettings.excelData || currentSettings.aiData || [
      { brand: 'ایران خودرو', model: 'پژو 207 دنده‌ای', year: 1403, price: 830000000 },
      { brand: 'ایران خودرو', model: 'تارا اتوماتیک', year: 1403, price: 950000000 },
    ];

    const results = prices.filter((p: any) => 
      p.brand.toLowerCase().includes(query.toLowerCase()) || 
      p.model.toLowerCase().includes(query.toLowerCase())
    );

    if (results.length === 0) {
      return ctx.reply(`❌ موردی برای "${query}" یافت نشد.`);
    }

    const message = `🔍 نتایج جستجو برای "${query}":\n\n` + results.map((p: any) => 
      `🚗 **${p.brand} ${p.model} (${p.year})**\n💰 قیمت: ${Number(p.price).toLocaleString()} تومان`
    ).join('\n───────────────────\n');

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  botInstance.action('menu_support', async (ctx) => {
    await ctx.reply('📞 **پشتیبانی ربات**\n\nبرای هرگونه سوال، نظر یا گزارش مشکلات با آیدی مدیر در ارتباط باشید:\n📢 @CarPrice_Channel\n🤝 تیم پشتیبانی ما آماده پاسخگویی است.', { parse_mode: 'Markdown' });
  });

  botInstance.action('menu_estimate', async (ctx) => {
    await ctx.reply('💰 **سیستم تخمین هوشمند قیمت خودرو**\n\nبرای تخمین قیمت خودرو خود، لطفاً مشخصات آن را به صورت زیر وارد کنید:\n\n`/estimate <برند> <مدل> <سال> <کارکرد>`\n\nمثال:\n`/estimate پژو ۲۰۷ دنده ای ۱۴۰۲ ۳۰۰۰۰`', { parse_mode: 'Markdown' });
  });

  botInstance.command('estimate', async (ctx) => {
    const text = ctx.payload?.trim();
    if (!text) {
      return ctx.reply('⚠️ لطفاً اطلاعات خودرو را وارد کنید. مثال:\n`/estimate پژو ۲۰۷ ۱۴۰۲ ۲۰۰۰۰`', { parse_mode: 'Markdown' });
    }

    // Basic heuristic estimation
    let basePrice = 600000000; // 600 million default
    if (text.includes('پژو 207') || text.includes('۲۰۷')) basePrice = 830000000;
    else if (text.includes('دنا')) basePrice = 1100000000;
    else if (text.includes('شاهین')) basePrice = 810000000;
    else if (text.includes('کوییک')) basePrice = 480000000;
    else if (text.includes('تارا')) basePrice = 960000000;

    // Adjust price roughly
    const lowRange = basePrice * 0.96;
    const highRange = basePrice * 1.04;

    const message = `💰 **تخمین فرضی قیمت خودرو شما:**\n\n📊 مشخصات ورودی: ${text}\n\n💵 حدود قیمت تخمینی بازار:\n**${lowRange.toLocaleString()}** الی **${highRange.toLocaleString()}** تومان\n\n⚠️ توجه: این قیمت حدودی است و طبق تخمین بازار هوشمند محاسبه شده است.`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  });
}

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
    tgBot = new Telegraf(tgToken);
    registerHandlers(tgBot);
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
    registerHandlers(baleBot);
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
