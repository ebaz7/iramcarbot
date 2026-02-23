import { Telegraf, Context } from 'telegraf';
import { loadSettings } from './settings';
import { generatePriceList } from './ai';

let bot: Telegraf<Context> | null = null;

export function startBot() {
  const settings = loadSettings();
  const token = settings.telegramToken || process.env.TELEGRAM_TOKEN;

  if (!token) {
    console.warn('Telegram Bot Token is missing. Bot will not start.');
    return;
  }

  if (bot) {
    bot.stop('Restarting');
  }

  bot = new Telegraf(token);

  bot.start((ctx) => ctx.reply('Welcome to the Price Bot! Use /price to get the latest prices.'));
  bot.help((ctx) => ctx.reply('Send /price to see the list.'));

  bot.command('price', async (ctx) => {
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

  bot.launch().then(() => {
    console.log('Telegram Bot started successfully.');
  }).catch((err) => {
    console.error('Failed to start Telegram Bot:', err);
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
}

export function stopBot() {
  if (bot) {
    bot.stop();
    bot = null;
    console.log('Telegram Bot stopped.');
  }
}
