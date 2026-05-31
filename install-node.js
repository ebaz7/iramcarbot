import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function run() {
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('\x1b[32m%s\x1b[0m', '      🚗 Iran Car Bot - Node.js Easy Installer     ');
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('This helper will bootstrap, configure, and install the bot using Node.js.\n');

  try {
    // 1. Check Git
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      console.log('\x1b[31m%s\x1b[0m', '❌ Git is not installed! Please install Git first to proceed.');
      rl.close();
      return;
    }

    // 2. Setup directory
    const repoUrl = 'https://github.com/ebaz7/iramcarbot.git';
    const currentDirName = path.basename(process.cwd());

    let targetDir = process.cwd();
    if (currentDirName !== 'iramcarbot' && !fs.existsSync(path.join(process.cwd(), 'package.json'))) {
      const answer = await question('Empty workspace detected. Do you want to clone the repo into a new directory "iran-car-bot"? (y/n): ');
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        targetDir = path.join(process.cwd(), 'iran-car-bot');
        console.log(`\n⏳ Cloning repository into ${targetDir}...`);
        execSync(`git clone ${repoUrl} "${targetDir}"`, { stdio: 'inherit' });
        process.chdir(targetDir);
      } else {
        console.log('\x1b[33m%s\x1b[0m', '⚠️ Setup canceled. Running installer inside the current folder...');
      }
    }

    // 3. Configuration Ask
    console.log('\n⚙️ Configuring Credentials...');
    const telegramToken = await question('Enter Telegram Bot Token (Optional, press Enter to skip): ');
    const baleToken = await question('Enter Bale Bot Token (Optional, press Enter to skip): ');
    const geminiKey = await question('Enter Gemini API Key (Optional, press Enter to skip): ');
    const deepseekKey = await question('Enter DeepSeek API Key (Optional, press Enter to skip): ');
    const openaiKey = await question('Enter OpenAI API Key (Optional, press Enter to skip): ');

    // 4. Create .env
    const envContent = `PORT=3000
TELEGRAM_TOKEN=${telegramToken}
BALE_TOKEN=${baleToken}
GEMINI_API_KEY=${geminiKey}
DEEPSEEK_API_KEY=${deepseekKey}
OPENAI_API_KEY=${openaiKey}
`;
    fs.writeFileSync('.env', envContent, 'utf8');
    console.log('\x1b[32m%s\x1b[0m', '✅ .env file created successfully.');

    // 5. Create settings.json
    const settingsContent = {
      priority: "AI",
      aiSource: "GEMINI",
      updateInterval: 24,
      lastUpdated: null,
      geminiApiKey: geminiKey,
      deepseekApiKey: deepseekKey,
      openaiApiKey: openaiKey,
      telegramToken: telegramToken,
      baleToken: baleToken,
      excelData: null,
      aiData: null
    };
    fs.writeFileSync('settings.json', JSON.stringify(settingsContent, null, 2), 'utf8');
    console.log('\x1b[32m%s\x1b[0m', '✅ settings.json file updated successfully.');

    // 6. Install npm packages
    console.log('\n⏳ Installing Node.js packages (NPM)... This might take a dynamic minute.');
    execSync('npm install', { stdio: 'inherit' });

    // 7. Compiling Vite Build
    console.log('\n⏳ Building Web Dashboard client-side production files...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('\x1b[32m%s\x1b[0m', '\n==================================================');
    console.log('\x1b[32m%s\x1b[0m', '🎉 Installation Completed Successfully! 🎉');
    console.log('\x1b[32m%s\x1b[0m', '==================================================');
    console.log(`📁 Project Directory: ${process.cwd()}`);
    console.log('💻 To start the Fullstack server (Web settings UI & Bots running together), run:');
    console.log('\x1b[33m%s\x1b[0m', '   npm start');
    console.log('==================================================\n');

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ An error occurred during installation:', error);
  } finally {
    rl.close();
  }
}

run();
