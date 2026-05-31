import { Telegraf, Context } from 'telegraf';
import { loadSettings } from './settings';

let tgBot: Telegraf<Context> | null = null;
let baleBot: Telegraf<Context> | null = null;

function registerHandlers(botInstance: Telegraf<Context>) {
  botInstance.start((ctx) => ctx.reply('Welcome to the Price Bot! Use /price to get the latest prices.'));
  botInstance.help((ctx) => ctx.reply('Send /price to see the list.'));

  botInstance.command('price', async (ctx) => {
    const currentSettings = loadSettings();
    let prices = [];

    if (currentSettings.priority === 'EXCEL' && currentSettings.excelData && currentSettings.excelData.length > 0) {
      prices = currentSettings.excelData;
      ctx.reply('Using Excel Data (Priority: Excel)');
    } else if (currentSettings.aiData && currentSettings.aiData.length > 0) {
      prices = currentSettings.aiData;
      ctx.reply('Using AI Data (Priority: AI)');
    } else {
      ctx.reply('No price data available. Please update via the admin panel or wait for the next scheduled update.');
      return;
    }

    // Format prices for Telegram
    const message = prices.map((p: any) => 
      `🚗 ${p.brand} ${p.model} (${p.year})\n💰 Price: ${p.price.toLocaleString()} ${p.currency || 'Toman'}`
    ).join('\n\n');

    // Split message if too long (Telegram limit is 4096 chars)
    if (message.length > 4000) {
      const chunks = message.match(/.{1,4000}/g) || [];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(message || 'No prices found.');
    }
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
