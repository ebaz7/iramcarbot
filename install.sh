#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager - FIXED & SECURE
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
REPO_URL="https://github.com/ebaz7/iramcarbot"
SECRET_FILE="$INSTALL_DIR/.manager_secret"

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

# --- Installation Steps ---

function install_dependencies() {
    echo -e "${BLUE}📦 Step 1: Installing System Dependencies...${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
    echo -e "${BLUE}📂 Step 2: Setting up Directory...${NC}"
    
    # Force clean install to ensure new code is used
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Cleaning old directory to ensure update...${NC}"
        sudo systemctl stop $SERVICE_NAME 2>/dev/null
        # Backup data if exists
        if [ -f "$INSTALL_DIR/bot_data.json" ]; then
            cp "$INSTALL_DIR/bot_data.json" "$HOME/bot_data_auto_backup.json"
            echo "Saved safety backup to $HOME/bot_data_auto_backup.json"
        fi
    fi

    # Clone
    if [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
        git reset --hard
        git pull
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Verify bot.py
    if [ ! -f "bot.py" ]; then
        echo -e "${RED}❌ Error: bot.py not found! Check repo URL.${NC}"
        exit 1
    fi

    # Venv
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime
}

function configure_security_forced() {
    echo -e "\n${BLUE}🔐 Step 3: SECURITY SETUP (Required)${NC}"
    echo "------------------------------------------------"
    
    # Always ask for credentials to ensure they are set
    echo -e "${YELLOW}You MUST set a Username and Password for the Panel/Restore functions.${NC}"
    
    while true; do
        read -p "Choose a Panel Username: " P_USER
        read -s -p "Choose a Panel Password: " P_PASS
        echo ""
        read -s -p "Confirm Password:        " P_PASS2
        echo ""
        
        if [ "$P_PASS" == "$P_PASS2" ] && [ ! -z "$P_PASS" ]; then
            # 1. Save locally
            echo "PANEL_USER=\"$P_USER\"" > "$SECRET_FILE"
            echo "PANEL_PASS=\"$P_PASS\"" >> "$SECRET_FILE"
            chmod 600 "$SECRET_FILE"
            
            # 2. Update/Create bot_data.json
            if [ ! -f "bot_data.json" ]; then echo "{}" > bot_data.json; fi
            
            # Inject into JSON safely
            python3 -c "import json; 
try:
    with open('bot_data.json', 'r') as f: d = json.load(f)
except: d = {}
d['panel_user'] = '$P_USER'
d['panel_pass'] = '$P_PASS'
with open('bot_data.json', 'w') as f: json.dump(d, f)"
            
            echo -e "${GREEN}✅ Credentials Saved!${NC}"
            
            # Ask for Bot Token if missing
            CUR_TOKEN=$(grep "TOKEN =" bot.py | awk -F"'" '{print $2}')
            if [[ "$CUR_TOKEN" == "REPLACE_ME_TOKEN" ]]; then
                echo -e "\n${YELLOW}👉 Telegram Bot Token Setup:${NC}"
                read -p "Enter Bot Token: " BOT_TOKEN
                read -p "Enter Admin Numeric ID: " ADMIN_ID
                sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
                sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
            fi
            
            break
        else
            echo -e "${RED}❌ Passwords do not match.${NC}"
        fi
    done
}

function setup_service_and_perms() {
    echo -e "\n${BLUE}🤖 Step 4: Finalizing & Permissions...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"

    # Fix Permissions (Crucial for Restore to work)
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"
    sudo chmod -R 755 "$INSTALL_DIR"

    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot
After=network.target

[Service]
User=$CURRENT_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$PYTHON_EXEC bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

    sudo systemctl daemon-reload
    sudo systemctl enable $SERVICE_NAME
    sudo systemctl restart $SERVICE_NAME
    
    echo -e "${GREEN}✅ Service Running!${NC}"
}

function create_shortcut() {
    cp "$0" "$INSTALL_DIR/manager.sh"
    chmod +x "$INSTALL_DIR/manager.sh"
    sudo ln -sf "$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    echo -e "${GREEN}🔗 Shortcut 'carbot' created.${NC}"
}

# --- Restore Function (THE FIX) ---

function do_restore() {
    echo -e "${BLUE}📥 Restore Database (Safe Mode)${NC}"
    echo "------------------------------------------------"
    
    read -p "Path to backup file: " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found.${NC}"
        pause; return
    fi
    
    # 1. Ask for Password (Security)
    echo -e "${YELLOW}🔐 Enter Backup Credentials:${NC}"
    read -p "Username: " INPUT_USER
    read -s -p "Password: " INPUT_PASS
    echo ""
    
    # 2. Verify JSON & Password via Python
    VERIFY=$(python3 -c "
import json, sys
try:
    with open('$BACKUP_PATH', 'r') as f:
        d = json.load(f)
        if d.get('panel_user') == '$INPUT_USER' and d.get('panel_pass') == '$INPUT_PASS':
            print('OK')
        else:
            print('BAD_PASS')
except:
    print('BAD_FILE')
")

    if [ "$VERIFY" == "BAD_PASS" ]; then
        echo -e "${RED}❌ Incorrect Username or Password for this backup.${NC}"; pause; return
    elif [ "$VERIFY" == "BAD_FILE" ]; then
        echo -e "${RED}❌ Invalid or Corrupt JSON file.${NC}"; pause; return
    fi

    # 3. Perform Restore with Permission Fixes
    echo -e "${GREEN}✅ Password Accepted. Restoring...${NC}"
    
    echo "Stopping bot..."
    sudo systemctl stop $SERVICE_NAME
    
    # COPY
    cp "$BACKUP_PATH" "$INSTALL_DIR/bot_data.json"
    
    # FIX PERMISSIONS (CRITICAL STEP)
    CURRENT_USER=$(whoami)
    echo "Fixing permissions for user: $CURRENT_USER"
    sudo chown $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR/bot_data.json"
    sudo chmod 644 "$INSTALL_DIR/bot_data.json"
    
    echo "Starting bot..."
    sudo systemctl start $SERVICE_NAME
    
    # Check if alive
    sleep 2
    IS_ACTIVE=$(systemctl is-active $SERVICE_NAME)
    if [ "$IS_ACTIVE" == "active" ]; then
        echo -e "${GREEN}🎉 Restore Successful! Bot is online.${NC}"
    else
        echo -e "${RED}❌ Bot failed to start. Showing logs:${NC}"
        journalctl -u $SERVICE_NAME -n 10 --no-pager
    fi
    pause
}

function manual_backup() {
    # Extract ID
    ADMIN_ID=$(python3 -c "import re; print(re.search(r\"OWNER_ID = (\d+)\", open('$INSTALL_DIR/bot.py').read()).group(1))" 2>/dev/null)
    BOT_TOKEN=$(python3 -c "import re; print(re.search(r\"TOKEN = '(.*)'\", open('$INSTALL_DIR/bot.py').read()).group(1))" 2>/dev/null)
    
    if [ -z "$ADMIN_ID" ]; then echo "Admin ID not found in bot.py"; pause; return; fi
    
    curl -s -F chat_id="$ADMIN_ID" -F document=@"$INSTALL_DIR/bot_data.json" -F caption="💾 Manual Backup" "https://api.telegram.org/bot$BOT_TOKEN/sendDocument" > /dev/null
    echo -e "${GREEN}✅ Sent to Telegram.${NC}"
    pause
}

function do_install() {
    install_dependencies
    setup_environment
    configure_security_forced
    setup_service_and_perms
    create_shortcut
    echo -e "\n${GREEN}🎉 INSTALLED SUCCESSFULLY.${NC}"
    pause
}

# --- Menu ---
while true; do
    clear
    echo -e "${BLUE}=== 🚗 Manager (Fixed Version) ===${NC}"
    echo "1) Install / Re-Install (RUN THIS FIRST)"
    echo "2) Restore Backup (Fixes Crash)"
    echo "3) Manual Backup to Telegram"
    echo "4) Restart Bot"
    echo "5) View Logs"
    echo "0) Exit"
    read -p "Option: " opt
    case $opt in
        1) do_install ;;
        2) do_restore ;;
        3) manual_backup ;;
        4) sudo systemctl restart $SERVICE_NAME; echo "Done."; pause ;;
        5) journalctl -u $SERVICE_NAME -n 50 -f ;;
        0) exit 0 ;;
    esac
done