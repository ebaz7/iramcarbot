import { spawn } from 'child_process';
import path from 'path';

let botProcess: import('child_process').ChildProcess | null = null;

export function startBot() {
  if (botProcess) {
    console.log('Stopping existing Multi-Bot Manager process...');
    botProcess.kill();
  }

  console.log('Starting Multi-Bot Manager...');
  botProcess = spawn('node', ['run_bots.js'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  botProcess.on('close', (code) => {
    console.log(`Multi-Bot Manager exited with code ${code}`);
  });
}

export function stopBot() {
  if (botProcess) {
    botProcess.kill();
    botProcess = null;
    console.log('Multi-Bot Manager stopped.');
  }
}
