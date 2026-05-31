import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

console.log("🚀 Starting Multi-Bot Manager (Telegram & Bale)...");

try {
    execSync('python3 -c "import jdatetime"', { stdio: 'ignore' });
} catch {
    try {
        execSync('python -c "import jdatetime"', { stdio: 'ignore' });
    } catch {
        console.log("⚠️ Make sure you have installed python dependencies: pip install -r requirements.txt");
    }
}

const bots = {};

function startBot(botName, scriptPath) {
    if (bots[botName]) {
        console.log(`[Manager] Stopping ${botName} for restart...`);
        bots[botName].process.kill('SIGINT');
    }

    console.log(`[Manager] Starting ${botName}...`);
    
    // We assume python is in the PATH. Use python or python3 depending on the environment.
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const botProcess = spawn(pythonCmd, [scriptPath], {
        cwd: __dirname,
        stdio: 'pipe'
    });

    bots[botName] = { process: botProcess, running: true };

    botProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            console.log(`[${botName} - INFO]: ${output}`);
        }
    });

    botProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        if (error) {
            console.error(`[${botName} - ERROR]: ${error}`);
        }
    });

    botProcess.on('close', (code) => {
        bots[botName].running = false;
        console.log(`🔴 [${botName}] Process exited with code ${code}. Restarting in 30 seconds... (If it ends immediately, you might need to run pip install -r requirements.txt)`);
        // Only auto-restart if it wasn't killed by us for a reload
        setTimeout(() => startBot(botName, scriptPath), 30000);
    });
}

// Start both bots
startBot('Telegram-Bot', 'bot.py');
startBot('Bale-Bot', 'bot_bale.py');

// Watch for settings changes
if (fs.existsSync(SETTINGS_FILE)) {
    fs.watch(SETTINGS_FILE, (eventType, filename) => {
        if (eventType === 'change') {
            console.log("🔄 settings.json changed! Restarting bots...");
            // Debounce restart
            if (!global.restartTimeout) {
                global.restartTimeout = setTimeout(() => {
                    startBot('Telegram-Bot', 'bot.py');
                    startBot('Bale-Bot', 'bot_bale.py');
                    global.restartTimeout = null;
                }, 2000);
            }
        }
    });
}

// Keep the Node.js process running
process.on('SIGINT', () => {
    console.log("🛑 Stopping Multi-Bot Manager...");
    if (bots['Telegram-Bot']?.process) bots['Telegram-Bot'].process.kill('SIGINT');
    if (bots['Bale-Bot']?.process) bots['Bale-Bot'].process.kill('SIGINT');
    process.exit(0);
});
