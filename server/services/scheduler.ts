import cron, { ScheduledTask } from 'node-cron';
import { loadDB } from '../db';
import { updatePricesFromAI } from './ai';

let currentJob: ScheduledTask | null = null;

export const startScheduler = () => {
  const db = loadDB();
  const interval = db.config.updateInterval;

  if (currentJob) {
    currentJob.stop();
  }

  if (interval > 0) {
    // Cron expression for every X hours
    const cronExp = `0 */${interval} * * *`;
    console.log(`Starting scheduler with interval: ${interval}h (Cron: ${cronExp})`);
    
    currentJob = cron.schedule(cronExp, async () => {
      console.log('Running scheduled update...');
      const db = loadDB();
      if (db.config.priority === 'AI') {
        await updatePricesFromAI();
      } else {
        console.log('Skipping AI update due to Excel priority.');
      }
    });
  } else {
    console.log('Scheduler stopped (interval = 0).');
  }
};

export const updateScheduler = (newInterval: number) => {
  const db = loadDB();
  db.config.updateInterval = newInterval;
  startScheduler();
};
