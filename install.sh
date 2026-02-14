#!/bin/bash

# ==========================================
#      Telegram Bot Manager - CarPrice
# ==========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_URL="https://github.com/ebaz7/iramcarbot.git"
DIR="/opt/telegram-car-bot"
SERVICE_NAME="carbot.service"
DATA_FILE="bot_data.json"
CONFIG_FILE="config.env"

# Ensure we are running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash install.sh)${NC}"
    exit
fi

function show_logo() {
    clear
    echo -e "${CYAN}"
    echo "  ____            ____       _     "
    echo " / ___|__ _ _ __ | __ )  ___| |_   "
    echo "| |   / _\` | '__||  _ \ / _ \ __|  "
    echo "| |__| (_| | |   | |_) | (_) | |_   "
    echo " \____\__,_|_|   |____/ \___/ \__|  "
    echo "                                    "
    echo -e "${NC}"
    echo -e "${BLUE}Telegram Bot Manager V2.0${NC}"
    echo -e "-----------------------------------"
}

function install_dependencies() {
    echo -e "${BLUE}[INFO] Installing system dependencies...${NC}"
    apt-get update -y > /dev/null 2>&1
    apt-get install -y python3 python3-pip python3-venv zip unzip git > /dev/null 2>&1
    echo -e "${GREEN}✓ Dependencies installed.${NC}"
}

function install_bot() {
    show_logo
    echo -e "${GREEN}>>> INSTALLATION WIZARD <<<${NC}"
    
    # Credentials
    read -p "Enter Telegram Bot Token: " BOT_TOKEN
    read -p "Enter Main Admin (Owner) Numeric ID: " ADMIN_ID
    
    # Create Directory
    if [ ! -d "$DIR" ]; then
        mkdir -p "$DIR"
    fi
    
    # Git Clone / Pull
    if [ -d "$DIR/.git" ]; then
        echo -e "${BLUE}[INFO] Updating repository...${NC}"
        cd "$DIR"
        git pull
    else
        echo -e "${BLUE}[INFO] Cloning repository...${NC}"
        # Clone into a temp dir and move or directly if empty
        if [ -z "$(ls -A $DIR)" ]; then
           git clone "$REPO_URL" "$DIR"
        else
           echo -e "${YELLOW}Directory not empty. Backing up...${NC}"
           mv "$DIR" "$DIR.bak_$(date +%s)"
           git clone "$REPO_URL" "$DIR"
        fi
        cd "$DIR"
    fi

    # Virtual Env
    if [ ! -d "venv" ]; then
        echo -e "${BLUE}[INFO] Creating Python virtual environment...${NC}"
        python3 -m venv venv
    fi
    
    echo -e "${BLUE}[INFO] Installing Python libraries...${NC}"
    source venv/bin/activate
    pip install -q python-telegram-bot jdatetime pandas openpyxl
    
    # Replace Tokens in bot.py (if placeholder exists)
    if [ -f "bot.py" ]; then
        if [ ! -z "$BOT_TOKEN" ]; then
            sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        fi
        if [ ! -z "$ADMIN_ID" ]; then
            sed -i "s/REPLACE_ME_ADMIN_ID/$ADMIN_ID/g" bot.py
        fi
    else
        echo -e "${RED}[ERROR] bot.py not found in the cloned repository!${NC}"
        echo -e "${YELLOW}Please ensure you uploaded bot.py to GitHub.${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi

    # Service
    echo -e "${BLUE}[INFO] Creating Systemd Service...${NC}"
    cat <<EOF > /etc/systemd/system/$SERVICE_NAME
[Unit]
Description=Telegram Car Price Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DIR
ExecStart=$DIR/venv/bin/python $DIR/bot.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl restart $SERVICE_NAME

    echo -e "\n${GREEN}====================================${NC}"
    echo -e "${GREEN}   ✅ INSTALLATION COMPLETE!       ${NC}"
    echo -e "${GREEN}====================================${NC}"
    echo -e "Bot is running. Use 'systemctl status $SERVICE_NAME' to check."
    read -p "Press Enter to continue..."
}

function menu() {
    while true; do
        show_logo
        echo "1) Install / Reinstall Bot"
        echo "2) Update Bot (git pull)"
        echo "3) Restart Service"
        echo "4) Uninstall"
        echo "0) Exit"
        echo ""
        read -p "Select option: " choice
        
        case $choice in
            1) install_dependencies; install_bot ;;
            2) 
               cd "$DIR"
               git pull
               systemctl restart $SERVICE_NAME
               echo -e "${GREEN}Updated.${NC}"
               sleep 2
               ;;
            3)
               systemctl restart $SERVICE_NAME
               echo -e "${GREEN}Service Restarted.${NC}"
               sleep 2
               ;;
            4)
               systemctl stop $SERVICE_NAME
               systemctl disable $SERVICE_NAME
               rm /etc/systemd/system/$SERVICE_NAME
               rm -rf "$DIR"
               echo -e "${RED}Uninstalled.${NC}"
               sleep 2
               ;;
            0) exit 0 ;;
            *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
        esac
    done
}

# If arguments are passed, we could handle them, otherwise show menu
menu