#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager - Final Version
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
REPO_URL="https://github.com/ebaz7/iramcarbot" 
DATA_FILE="bot_data.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# --- Helper Functions ---

function pause() {
    read -p "Press [Enter] key to continue..."
}

function check_root() {
    if [ "$EUID" -ne 0 ]; then 
        echo -e "${YELLOW}⚠️  Requesting sudo permissions...${NC}"
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
        echo -e "${GREEN}🔄 Updating code from GitHub...${NC}"
        cd "$INSTALL_DIR"
        git reset --hard
        git pull
    else
        echo -e "${GREEN}⬇️  Cloning repository...${NC}"
        rm -rf "$INSTALL_DIR"
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    if [ ! -d "venv" ]; then
        echo -e "${GREEN}🐍 Creating Virtual Environment...${NC}"
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    # Install AI and Excel requirements
    pip install python-telegram-bot pandas openpyxl jdatetime google-generativeai
}

function configure_bot() {
    cd "$INSTALL_DIR"
    echo -e "\n${BLUE}⚙️  Bot Configuration ${NC}"
    
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter Telegram Bot Token: " BOT_TOKEN
        read -p "Enter Admin Numeric ID: " ADMIN_ID
        read -p "Enter Gemini API Key (Optional): " GEMINI_KEY
        
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
        sed -i "s/GEMINI_API_KEY = ''/GEMINI_API_KEY = '$GEMINI_KEY'/g" bot.py
        echo -e "${GREEN}✅ Configuration Saved.${NC}"
    fi

    # Security Setup
    if [ ! -f "$DATA_FILE" ]; then
        echo -e "\n${YELLOW}🔐 PANEL SECURITY SETUP${NC}"
        read -p "Set Admin Username: " P_USER
        read -s -p "Set Admin Password: " P_PASS
        echo ""
        python3 -c "
import json
d = {'panel_user': '$P_USER', 'panel_pass': '$P_PASS', 'menu_config': {}}
with open('$DATA_FILE', 'w') as f: json.dump(d, f, indent=4)
"
    fi
}

function setup_service() {
    echo -e "${BLUE}🤖 Setting up System Service...${NC}"
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"

    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot
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
    echo -e "${GREEN}✅ Bot is now running!${NC}"
}

function do_restore() {
    echo -e "${BLUE}📥 Restore Database${NC}"
    read -p "Full path to backup file: " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found.${NC}"
        pause; return
    fi
    
    sudo systemctl stop $SERVICE_NAME
    cp "$BACKUP_PATH" "$INSTALL_DIR/bot_data.json"
    
    # Fix permissions
    CURRENT_USER=$(whoami)
    sudo chown $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR/bot_data.json"
    sudo chmod 644 "$INSTALL_DIR/bot_data.json"
    
    sudo systemctl start $SERVICE_NAME
    echo -e "${GREEN}✅ Restore Successful.${NC}"
    pause
}

function do_backup() {
    BACKUP_DIR="$HOME/carbot_backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    DEST="$BACKUP_DIR/backup_$TIMESTAMP.json"
    
    if [ -f "$INSTALL_DIR/bot_data.json" ]; then
        cp "$INSTALL_DIR/bot_data.json" "$DEST"
        echo -e "${GREEN}✅ Backup saved to: $DEST${NC}"
    else
        echo -e "${RED}No database found.${NC}"
    fi
    pause
}

# --- Main Menu Loop ---
while true; do
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}      🚗 Iran Car Bot Manager      ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "1) Install / Reinstall"
    echo -e "2) Update Bot (Git Pull)"
    echo -e "3) View Logs"
    echo -e "4) Restart Bot"
    echo -e "5) Backup Data"
    echo -e "6) Restore Data"
    echo -e "9) Uninstall"
    echo -e "0) Exit"
    echo -e "${BLUE}========================================${NC}"
    read -p "Select: " choice

    case $choice in
        1) install_dependencies && setup_environment && configure_bot && setup_service ;;
        2) cd "$INSTALL_DIR" && git pull && sudo systemctl restart $SERVICE_NAME && echo "Updated." && pause ;;
        3) journalctl -u $SERVICE_NAME -n 50 -f ;;
        4) sudo systemctl restart $SERVICE_NAME && echo "Restarted." && pause ;;
        5) do_backup ;;
        6) do_restore ;;
        9) 
            read -p "Delete everything? (y/n): " c
            if [[ "$c" == "y" ]]; then
                sudo systemctl stop $SERVICE_NAME
                sudo systemctl disable $SERVICE_NAME
                rm -rf "$INSTALL_DIR"
                echo "Deleted."; pause
            fi
            ;;
        0) exit 0 ;;
        *) echo "Invalid choice."; pause ;;
    esac
done
