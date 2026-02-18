#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager (Classic)
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
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
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
    cd "$HOME" || exit 1

    echo -e "${BLUE}📂 Setting up Directory: $INSTALL_DIR ${NC}"
    
    # Fix corrupt directories
    if [ -d "$INSTALL_DIR" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
        echo -e "${YELLOW}Cleaning up empty directory...${NC}"
        rm -rf "$INSTALL_DIR"
    fi

    if [ -d "$INSTALL_DIR/.git" ]; then
        echo -e "${GREEN}🔄 Pulling latest changes...${NC}"
        cd "$INSTALL_DIR"
        git reset --hard
        git pull
    else
        echo -e "${GREEN}⬇️  Cloning repository...${NC}"
        git clone "$REPO_URL" "$INSTALL_DIR"
        if [ ! -d "$INSTALL_DIR" ]; then
             echo -e "${RED}❌ Error: Git clone failed.${NC}"
             pause; return 1
        fi
        cd "$INSTALL_DIR"
    fi

    if [ ! -f "bot.py" ]; then
        echo -e "${RED}❌ Error: bot.py not found.${NC}"
        pause; return 1
    fi

    if [ ! -d "venv" ]; then
        echo -e "${GREEN}🐍 Creating Virtual Environment...${NC}"
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime
}

function configure_bot() {
    cd "$INSTALL_DIR"
    echo -e "\n${BLUE}⚙️  Bot Configuration ${NC}"
    
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter Telegram Bot Token: " BOT_TOKEN
        read -p "Enter Admin Numeric ID: " ADMIN_ID
        
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
        echo -e "${GREEN}✅ Config saved.${NC}"
    else
        echo -e "${GREEN}✅ Already configured.${NC}"
    fi
}

function setup_service() {
    echo -e "${BLUE}🤖 Setting up Service...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"

    # Ensure ownership
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"

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
    echo -e "${GREEN}✅ Service started! ${NC}"
}

function create_shortcut() {
    cp "$0" "$INSTALL_DIR/manager.sh"
    chmod +x "$INSTALL_DIR/manager.sh"
    sudo ln -sf "$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    echo -e "${GREEN}🔗 Shortcut 'carbot' created.${NC}"
}

# --- Backup/Restore ---

function do_backup() {
    BACKUP_DIR="$HOME/carbot_backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    DEST="$BACKUP_DIR/backup_$TIMESTAMP.json"
    
    if [ -f "$INSTALL_DIR/bot_data.json" ]; then
        cp "$INSTALL_DIR/bot_data.json" "$DEST"
        echo -e "${GREEN}✅ Backup saved to: $DEST${NC}"
        
        # Telegram Send
        read -p "Send to Telegram? (y/n): " snd
        if [[ "$snd" == "y" ]]; then
            TOKEN=$(grep "TOKEN =" "$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
            ID=$(grep "OWNER_ID =" "$INSTALL_DIR/bot.py" | awk -F'=' '{print $2}' | tr -d ' ')
            curl -s -F chat_id="$ID" -F document=@"$DEST" -F caption="💾 Manual Backup" "https://api.telegram.org/bot$TOKEN/sendDocument" > /dev/null
            echo "Sent."
        fi
    else
        echo -e "${RED}No database found.${NC}"
    fi
    pause
}

function do_restore() {
    echo -e "${BLUE}📥 Restore Database${NC}"
    echo -e "${YELLOW}⚠️  Overwrites current data!${NC}"
    read -p "Full path to backup file: " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found.${NC}"
        pause; return
    fi
    
    read -p "Are you sure? (y/n): " confirm
    if [[ "$confirm" == "y" ]]; then
        echo "Stopping service..."
        sudo systemctl stop $SERVICE_NAME
        
        echo "Restoring file..."
        cp "$BACKUP_PATH" "$INSTALL_DIR/bot_data.json"
        
        # --- CRITICAL FIX FOR PERMISSIONS ---
        echo "Fixing permissions..."
        TARGET_USER=$(stat -c '%U' "$INSTALL_DIR")
        TARGET_GROUP=$(stat -c '%G' "$INSTALL_DIR")
        
        if [ ! -z "$TARGET_USER" ]; then
            sudo chown "$TARGET_USER:$TARGET_GROUP" "$INSTALL_DIR/bot_data.json"
        fi
        sudo chmod 644 "$INSTALL_DIR/bot_data.json"
        # ------------------------------------
        
        echo "Starting service..."
        sudo systemctl start $SERVICE_NAME
        echo -e "${GREEN}✅ Done.${NC}"
    fi
    pause
}

# --- Menu ---

function do_install() {
    install_dependencies
    setup_environment
    if [ $? -eq 0 ]; then
        configure_bot
        setup_service
        create_shortcut
        echo -e "\n${GREEN}🎉 Installed Successfully!${NC}"
    fi
    pause
}

function do_update() {
    if [ ! -d "$INSTALL_DIR" ]; then echo "Not installed."; pause; return; fi
    cd "$INSTALL_DIR"
    echo "Updating..."
    git reset --hard
    git pull
    sudo systemctl restart $SERVICE_NAME
    echo -e "${GREEN}✅ Updated.${NC}"; pause
}

function do_uninstall() {
    read -p "Delete everything? (y/n): " c
    if [[ "$c" == "y" ]]; then
        sudo systemctl stop $SERVICE_NAME
        sudo systemctl disable $SERVICE_NAME
        rm -rf "$INSTALL_DIR"
        sudo rm /usr/local/bin/carbot
        echo "Deleted."; pause
    fi
}

# --- Main Loop ---

while true; do
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}      🚗 Iran Car Bot Manager      ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "1) ${GREEN}Install / Reinstall${NC}"
    echo -e "2) ${YELLOW}Update Bot${NC}"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) ${BLUE}Backup Data${NC}"
    echo -e "8) ${BLUE}Restore Data${NC} (Fixed)"
    echo -e "9) ${RED}Uninstall${NC}"
    echo -e "0) Exit"
    echo -e "${BLUE}========================================${NC}"
    read -p "Select: " choice

    case $choice in
        1) do_install ;;
        2) do_update ;;
        3) journalctl -u $SERVICE_NAME -n 50 -f ;;
        4) sudo systemctl status $SERVICE_NAME; pause ;;
        5) sudo systemctl restart $SERVICE_NAME; echo "Done."; pause ;;
        6) sudo systemctl stop $SERVICE_NAME; echo "Done."; pause ;;
        7) do_backup ;;
        8) do_restore ;;
        9) do_uninstall ;;
        0) exit 0 ;;
        *) echo "Invalid."; pause ;;
    esac
done
