import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'Car_Price_Bot_Multi',
  description: 'Multi-messenger bot for Telegram and Bale (Python Bots managed via Node.js)',
  script: path.join(__dirname, 'run_bots.js'),
  env: [{
    name: "NODE_ENV",
    value: "production" 
  }]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('✅ Service installed successfully on Windows Server.');
  console.log('🚀 Starting the service...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('⚠️ This service is already installed.');
  console.log('🔄 Attempting to restart ...');
  svc.restart();
});

svc.on('start', function() {
  console.log('✅ Service is now running in the background.');
});

// Install the script as a service
console.log('⏳ Installing Windows Service...');
svc.install();
