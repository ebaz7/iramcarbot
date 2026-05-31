#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot - Node.js Full-Stack Installer
# ==========================================

INSTALL_DIR="$HOME/carbot-node"
SERVICE_NAME="carbot-node"
REPO_URL="https://github.com/ebaz7/iramcarbot"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear
echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}      🚗 Iran Car Bot - Node.js Full-Stack      ${NC}"
echo -e "${BLUE}==================================================${NC}"
echo -e "This script will download, install, build, and run"
echo -e "the entire Node.js Full-Stack App (Web Panel + Bot)"
echo -e "on your Linux (Ubuntu) server."
echo -e "${BLUE}==================================================${NC}"
echo ""

# --- Helper Functions ---
function pause() {
    read -p "Press [Enter] key to continue..."
}

function check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Requesting sudo permissions for system package installations...${NC}"
        sudo -v
    fi
}

# 1. System Dependencies & Node.js Setup
echo -e "${BLUE}🚀 Step 1: Installing System Dependencies & Node.js...${NC}"
check_root
sudo apt-get update
sudo apt-get install -y git curl build-essential

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing Node.js v20 LTS from NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js is already installed (${NODE_VERSION})${NC}"
fi

# 2. Get the Source Code
echo -e "\n${BLUE}🚀 Step 2: Preparing project directory...${NC}"
if [ -f "server.ts" ] && [ -f "package.json" ]; then
    # Running from inside the cloned repository
    INSTALL_DIR="$(pwd)"
    echo -e "${GREEN}Detected running inside the project folder: ${INSTALL_DIR}${NC}"
else
    # Clone repository
    echo -e "${YELLOW}Cloning repository to: ${INSTALL_DIR}...${NC}"
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Directory already exists. Updating copy...${NC}"
        cd "$INSTALL_DIR" || exit 1
        git reset --hard
        git pull
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR" || exit 1
    fi
fi

# 3. NPM Install
echo -e "\n${BLUE}🚀 Step 3: Installing Node.js dependencies...${NC}"
npm install

# 4. Bootstrap Configurations
echo -e "\n${BLUE}🚀 Step 4: Configuring credentials...${NC}"
ENV_FILE=".env"

# Ask users for key configs
read -p "Enter Telegram Bot Token (leave empty to configure later): " TELEGRAM_TOKEN
read -p "Enter Bale Bot Token (leave empty to configure later): " BALE_TOKEN
read -p "Enter Gemini API Key (Optional): " GEMINI_API_KEY
read -p "Enter DeepSeek API Key (Optional): " DEEPSEEK_API_KEY
read -p "Enter OpenAI API Key (Optional): " OPENAI_API_KEY

# Set up process environment
cat > "$ENV_FILE" <<EOL
PORT=3000
TELEGRAM_TOKEN=$TELEGRAM_TOKEN
BALE_TOKEN=$BALE_TOKEN
GEMINI_API_KEY=$GEMINI_API_KEY
DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY
OPENAI_API_KEY=$OPENAI_API_KEY
EOL

echo -e "${GREEN}✅ Configuration saved to .env file.${NC}"

# Seed settings.json so UI displays them
SETTINGS_FILE="settings.json"
cat > "$SETTINGS_FILE" <<EOL
{
  "priority": "AI",
  "aiSource": "GEMINI",
  "updateInterval": 24,
  "lastUpdated": null,
  "geminiApiKey": "$GEMINI_API_KEY",
  "deepseekApiKey": "$DEEPSEEK_API_KEY",
  "openaiApiKey": "$OPENAI_API_KEY",
  "telegramToken": "$TELEGRAM_TOKEN",
  "baleToken": "$BALE_TOKEN",
  "excelData": null,
  "aiData": null
}
EOL
echo -e "${GREEN}✅ Bootstrap settings successfully loaded into settings.json.${NC}"

# 5. Build React app Client-side assets
echo -e "\n${BLUE}🚀 Step 5: Compiling Vite and React production build...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed! Please inspect logs.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ React frontend build compiled successfully!${NC}"

# 6. Setup Systemd Service
echo -e "\n${BLUE}🚀 Step 6: Setting up system service to run forever...${NC}"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
CURRENT_USER=$(whoami)
NODE_EXEC=$(which node)

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Fullstack Bot (Web & Telegram/Bale Bot)
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_EXEC npx cross-env NODE_ENV=production npx tsx server.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo -e "\n${GREEN}🎉 Installation Successfully Completed! 🎉${NC}"
echo -e "--------------------------------------------------"
echo -e "💻 Web Control Panel URL: ${BLUE}http://YOUR_SERVER_IP:3000${NC}"
echo -e "🤖 Bots Started: Telegram and/or Bale (using polling)"
echo -e "⚙️ System Service: ${YELLOW}$SERVICE_NAME${NC}"
echo -e "--------------------------------------------------"
echo -e "To view live logs, run:"
echo -e "  ${YELLOW}sudo journalctl -u $SERVICE_NAME -f -n 50${NC}"
echo -e "To restart the service, run:"
echo -e "  ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}"
echo -e "To stop the service, run:"
echo -e "  ${YELLOW}sudo systemctl stop $SERVICE_NAME${NC}"
echo -e "--------------------------------------------------"
echo ""
