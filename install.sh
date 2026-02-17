#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Iran Car Bot Installation...${NC}"

# 1. Update System
echo -e "${GREEN}📦 Updating system packages...${NC}"
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv git

# 2. Setup Directory
echo -e "${GREEN}📂 Setting up directory...${NC}"
mkdir -p ~/carbot
cd ~/carbot

# 3. Download Files
echo -e "${GREEN}⬇️  Downloading bot files from GitHub...${NC}"
if [ -d ".git" ]; then
    echo "Repo exists, pulling changes..."
    git pull
else
    # Clone the repo provided by the user (Assumes you are in the repo)
    echo "Using current directory or manual clone expected."
fi

# Check if bot.py exists
if [ ! -f "bot.py" ]; then
    echo -e "${RED}❌ Error: bot.py not found in the repository!${NC}"
    echo "Please upload 'bot.py' and 'install.sh' to your GitHub repository first."
    exit 1
fi

# 4. Setup Python Environment
echo -e "${GREEN}🐍 Setting up virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# 5. Install Dependencies
echo -e "${GREEN}📚 Installing libraries...${NC}"
pip install --upgrade pip
pip install python-telegram-bot pandas openpyxl jdatetime

# 6. Configure Bot (Crucial Step for Admin Access)
echo -e "${BLUE}⚙️  Configuration${NC}"
echo "------------------------------------------------"
read -p "Enter your Telegram Bot Token: " BOT_TOKEN
read -p "Enter your Numeric Admin ID (from @userinfobot): " ADMIN_ID
echo "------------------------------------------------"

# Replace credentials in bot.py
# 1. Set Token
sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py

# 2. Set Owner ID (This grants full Admin access)
# Replaces 'OWNER_ID = 0' with 'OWNER_ID = 123456789'
sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py

echo -e "${GREEN}✅ Admin ID set to $ADMIN_ID. You now have full ownership permissions.${NC}"

# 7. Setup Systemd Service (Auto-Restart)
echo -e "${GREEN}🤖 Creating background service...${NC}"
SERVICE_FILE="/etc/systemd/system/carbot.service"
CURRENT_USER=$(whoami)
WORKING_DIR=$(pwd)
PYTHON_EXEC="$WORKING_DIR/venv/bin/python"

sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$WORKING_DIR
ExecStart=$PYTHON_EXEC bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL

# 8. Start Service
sudo systemctl daemon-reload
sudo systemctl enable carbot
sudo systemctl restart carbot

echo -e "${GREEN}✅ Installation Successful!${NC}"
echo -e "The bot is now running in the background."
echo -e "Check status: ${BLUE}sudo systemctl status carbot${NC}"
echo -e "To view logs: ${BLUE}journalctl -u carbot -f${NC}"
