#!/bin/bash

# ==========================================
# 🚗 Iran Car & Mobile Bot Manager (Full)
# ==========================================

INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
REPO_URL="https://github.com/ebaz7/iramcarbot" 
DATA_FILE="bot_data.json"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

function pause() {
    read -p "Press [Enter] key to continue..."
}

function check_root() {
    if [ "$EUID" -ne 0 ]; then 
        sudo -v
    fi
}

function install_dependencies() {
    echo -e "${BLUE}📦 Installing System Dependencies...${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
    cd "$HOME" || exit 1
    if [ -d "$INSTALL_DIR/.git" ]; then
        cd "$INSTALL_DIR"
        git reset --hard
        git pull
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime google-generativeai openai
}

function configure_bot() {
    cd "$INSTALL_DIR"
    echo -e "\n${BLUE}⚙️  Bot Configuration ${NC}"
    
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter Telegram Bot Token: " BOT_TOKEN
        read -p "Enter Admin Numeric ID: " ADMIN_ID
        read -p "Enter Gemini API Key (Optional): " GEMINI_KEY
        read -p "Enter DeepSeek API Key (Optional): " DEEPSEEK_KEY
        
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
        sed -i "s/GEMINI_API_KEY = ''/GEMINI_API_KEY = '$GEMINI_KEY'/g" bot.py
        sed -i "s/DEEPSEEK_API_KEY = ''/DEEPSEEK_API_KEY = '$DEEPSEEK_KEY'/g" bot.py
        echo -e "${GREEN}✅ Configuration Saved.${NC}"
    fi

    # Security Setup
    echo -e "\n${YELLOW}🔐 PANEL SECURITY SETUP${NC}"
    read -p "Set Panel Username: " P_USER
    read -s -p "Set Panel Password: " P_PASS
    echo ""
    python3 -c "
import json, os
try:
    with open('$DATA_FILE', 'r') as f: d = json.load(f)
except: d = {}
d['panel_user'] = '$P_USER'
d['panel_pass'] = '$P_PASS'
with open('$DATA_FILE', 'w') as f: json.dump(d, f, indent=4)
"
}

function setup_service() {
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"
    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car & Mobile Bot
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$PYTHON_EXEC bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL
    sudo systemctl daemon-reload
    sudo systemctl enable $SERVICE_NAME
    sudo systemctl restart $SERVICE_NAME
}

function do_restore() {
    read -p "Full path to backup file: " BACKUP_PATH
    if [ ! -f "$BACKUP_PATH" ]; then echo "File not found."; return; fi
    sudo systemctl stop $SERVICE_NAME
    cp "$BACKUP_PATH" "$INSTALL_DIR/bot_data.json"
    CURRENT_USER=$(whoami)
    sudo chown $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR/bot_data.json"
    sudo chmod 644 "$INSTALL_DIR/bot_data.json"
    sudo systemctl start $SERVICE_NAME
    echo "Restore Complete."
}

while true; do
    clear
    echo -e "1) Install / Reinstall"
    echo -e "2) Update Bot"
    echo -e "7) Backup Data"
    echo -e "8) Restore Data"
    echo -e "0) Exit"
    read -p "Select: " choice
    case $choice in
        1) install_dependencies; setup_environment; configure_bot; setup_service; pause ;;
        2) cd "$INSTALL_DIR"; git pull; sudo systemctl restart $SERVICE_NAME; pause ;;
        7) # Backup logic
           TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
           cp "$INSTALL_DIR/bot_data.json" "$HOME/backup_$TIMESTAMP.json"
           echo "Backup saved to $HOME/backup_$TIMESTAMP.json"; pause ;;
        8) do_restore; pause ;;
        0) exit 0 ;;
    esac
done
