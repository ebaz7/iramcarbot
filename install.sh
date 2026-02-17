#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
# This will be replaced by the user's specific URL if they copy from web app, 
# otherwise default to a placeholder that needs changing or general repo.
# Since this file is static in the project, we put a placeholder or generic.
REPO_URL="https://github.com/ebaz7/iramcarbot" 

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
        echo -e "${YELLOW}⚠️  Requesting sudo permissions... (Please enter password if asked)${NC}"
        sudo -v
    fi
}

function install_dependencies() {
    echo -e "${BLUE}📦 Installing System Dependencies...${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git
}

function setup_environment() {
    # CRITICAL FIX: Ensure we are in HOME before potentially deleting the current directory
    cd "$HOME" || exit 1

    echo -e "${BLUE}📂 Setting up Directory: $INSTALL_DIR ${NC}"
    
    # Logic to fix "bot.py not found" error:
    # If directory exists but .git is missing, it's corrupt/empty. Remove it.
    if [ -d "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
        echo -e "${YELLOW}⚠️  Found corrupt or empty directory. Cleaning up...${NC}"
        rm -rf "$INSTALL_DIR"
    fi

    # Clone or Pull
    if [ -d "$INSTALL_DIR/.git" ]; then
        echo -e "${GREEN}🔄 Repository exists. Pulling latest changes...${NC}"
        cd "$INSTALL_DIR"
        git pull
    else
        echo -e "${GREEN}⬇️  Cloning repository from $REPO_URL...${NC}"
        git clone "$REPO_URL" "$INSTALL_DIR"
        
        if [ ! -d "$INSTALL_DIR" ]; then
             echo -e "${RED}❌ Error: Git clone failed. Directory not created.${NC}"
             pause
             return 1
        fi
        
        cd "$INSTALL_DIR"
    fi

    # Verify download
    if [ ! -f "bot.py" ]; then
        echo -e "${RED}❌ Critical Error: bot.py still not found after cloning! ${NC}"
        echo "Please check your GitHub repository content."
        echo "Repo URL: $REPO_URL"
        pause
        return 1
    fi

    # Virtual Env
    if [ ! -d "venv" ]; then
        echo -e "${GREEN}🐍 Creating Python Virtual Environment...${NC}"
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    
    echo -e "${GREEN}📚 Installing Python Libraries...${NC}"
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime
}

function configure_bot() {
    cd "$INSTALL_DIR"
    
    echo -e "\n${BLUE}⚙️  Bot Configuration ${NC}"
    echo "------------------------------------------------"
    
    # Check if already configured to avoid re-typing
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter your Telegram Bot Token: " BOT_TOKEN
        read -p "Enter your Numeric Admin ID (from @userinfobot): " ADMIN_ID
        
        # Replace in bot.py using sed
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
        
        echo -e "${GREEN}✅ Configuration saved.${NC}"
    else
        echo -e "${GREEN}✅ Bot is already configured.${NC}"
        read -p "Do you want to re-configure keys? (y/n): " RECONF
        if [[ "$RECONF" == "y" ]]; then
             read -p "Enter NEW Telegram Bot Token: " BOT_TOKEN
             read -p "Enter NEW Numeric Admin ID: " ADMIN_ID
             
             # Reset file first (simple trick: we can't easily undo sed, so we rely on git reset)
             git checkout bot.py
             sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
             sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
             echo -e "${GREEN}✅ Configuration updated.${NC}"
        fi
    fi
    echo "------------------------------------------------"
}

function setup_service() {
    echo -e "${BLUE}🤖 Setting up Systemd Service...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"

    # Create Service File
    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot Manager
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
    
    echo -e "${GREEN}✅ Service started! ${NC}"
}

function create_shortcut() {
    # Create a global command 'carbot' that runs this script
    echo -e "${BLUE}🔗 Creating global command 'carbot'...${NC}"
    
    # We copy THIS script to the install dir as 'manager.sh'
    cp "$0" "$INSTALL_DIR/manager.sh"
    chmod +x "$INSTALL_DIR/manager.sh"
    
    sudo ln -sf "$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    
    echo -e "${GREEN}✅ Done! You can now type 'carbot' anywhere to open this menu.${NC}"
}

# --- Menu Functions ---

function do_install() {
    echo -e "${BLUE}🚀 Starting Installation / Re-Installation...${NC}"
    install_dependencies
    setup_environment
    if [ $? -eq 0 ]; then
        configure_bot
        setup_service
        create_shortcut
        echo -e "\n${GREEN}🎉 Installation Complete! Bot is running. ${NC}"
    else
        echo -e "\n${RED}❌ Installation Failed. ${NC}"
    fi
    pause
}

function do_update() {
    echo -e "${BLUE}🔄 Updating Bot...${NC}"
    
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}Bot is not installed yet. Please Install first.${NC}"
        pause
        return
    fi
    
    cd "$INSTALL_DIR"
    
    echo "1. Pulling from Git..."
    git pull
    
    echo "2. Restarting Service..."
    check_root
    sudo systemctl restart $SERVICE_NAME
    
    echo -e "${GREEN}✅ Update Complete.${NC}"
    pause
}

function do_uninstall() {
    echo -e "${RED}🗑️  WARNING: This will completely remove the bot and all data! ${NC}"
    read -p "Are you sure? (y/n): " confirm
    if [[ "$confirm" != "y" ]]; then
        echo "Cancelled."
        pause
        return
    fi
    
    echo -e "${BLUE}🛑 Stopping service...${NC}"
    check_root
    sudo systemctl stop $SERVICE_NAME
    sudo systemctl disable $SERVICE_NAME
    sudo rm /etc/systemd/system/$SERVICE_NAME.service
    sudo systemctl daemon-reload
    
    echo -e "${BLUE}📂 Removing files...${NC}"
    rm -rf "$INSTALL_DIR"
    sudo rm /usr/local/bin/carbot
    
    echo -e "${GREEN}✅ Uninstall Complete. Clean slate! ${NC}"
    pause
}

function do_logs() {
    echo -e "${YELLOW}📜 Showing last 50 lines of logs (Press Ctrl+C to exit logs)...${NC}"
    journalctl -u $SERVICE_NAME -n 50 -f
}

function do_status() {
    sudo systemctl status $SERVICE_NAME
    pause
}

function do_restart() {
    sudo systemctl restart $SERVICE_NAME
    echo "Bot restarted."
    pause
}

function do_stop() {
    sudo systemctl stop $SERVICE_NAME
    echo "Bot stopped."
    pause
}

# --- Main Menu Loop ---

while true; do
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}      🚗 Iran Car Bot Manager 🚗      ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "1) ${GREEN}Install / Reinstall${NC} (Fixes errors)"
    echo -e "2) ${YELLOW}Update Bot${NC} (Git Pull & Restart)"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) ${RED}Uninstall Completely${NC}"
    echo -e "8) Exit"
    echo -e "${BLUE}========================================${NC}"
    read -p "Select an option [1-8]: " choice

    case $choice in
        1) do_install ;;
        2) do_update ;;
        3) do_logs ;;
        4) do_status ;;
        5) do_restart ;;
        6) do_stop ;;
        7) do_uninstall ;;
        8) exit 0 ;;
        *) echo -e "${RED}Invalid option.${NC}"; pause ;;
    esac
done
