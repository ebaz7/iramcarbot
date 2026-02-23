import cron, { ScheduledTask } from 'node-cron';
import { generatePriceList } from './ai';
import { loadSettings, updateSettings } from './settings';

let currentJob: ScheduledTask | null = null;

export function startScheduler() {
  const settings = loadSettings();
  const interval = settings.updateInterval || 24; // Default to 24 hours

  if (currentJob) {
    currentJob.stop();
  }

  // Cron pattern: Run every X hours
  const cronPattern = `0 */${interval} * * *`;

  currentJob = cron.schedule(cronPattern, async () => {
    console.log('Running scheduled price update...');
    try {
      const prices = await generatePriceList();
      updateSettings({ aiData: prices, lastUpdated: new Date().toISOString() });
      console.log('Price update successful.');
    } catch (error) {
      console.error('Scheduled update failed:', error);
    }
  });

  console.log(`Scheduler started with interval: ${interval} hours.`);
}

export function stopScheduler() {
  if (currentJob) {
    currentJob.stop();
    currentJob = null;
    console.log('Scheduler stopped.');
  }
}

export function restartScheduler() {
  stopScheduler();
  startScheduler();
}
