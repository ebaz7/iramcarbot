#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager - SECURE EDITION
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
        echo -e "${YELLOW}⚠️  Requesting sudo permissions... (Please enter password if asked)${NC}"
        sudo -v
    fi
}

# --- Installation Steps ---

function install_dependencies() {
    echo -e "${BLUE}📦 Step 1: Installing Dependencies...${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
    echo -e "${BLUE}📂 Step 2: Setting up Files...${NC}"
    
    # Clean install logic
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}Cleaning old directory...${NC}"
        sudo systemctl stop $SERVICE_NAME 2>/dev/null
        # Safety backup
        if [ -f "$INSTALL_DIR/$DATA_FILE" ]; then
            cp "$INSTALL_DIR/$DATA_FILE" "$HOME/bot_data_safety_backup.json"
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

    if [ ! -f "bot.py" ]; then
        echo -e "${RED}❌ Error: bot.py missing. Check repo URL.${NC}"
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

function configure_bot_and_security() {
    echo -e "\n${BLUE}⚙️  Step 3: Configuration & Security (MANDATORY)${NC}"
    echo "------------------------------------------------"
    
    # 1. Bot Token
    CUR_TOKEN=$(grep "TOKEN =" bot.py | awk -F"'" '{print $2}')
    if [[ "$CUR_TOKEN" == "REPLACE_ME_TOKEN" ]]; then
        echo -e "${YELLOW}👉 Telegram Config:${NC}"
        read -p "Enter Bot Token: " BOT_TOKEN
        read -p "Enter Admin ID: " ADMIN_ID
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
    fi

    # 2. SECURITY CREDENTIALS (THE REQUESTED FEATURE)
    echo -e "\n${YELLOW}🔐 SECURE PANEL SETUP${NC}"
    echo "You MUST set a Username and Password. This will be locked into the backup file."
    echo "If you move this backup to another server, you will need this password to restore it."
    echo ""
    
    while true; do
        read -p "Set Panel Username: " P_USER
        read -s -p "Set Panel Password: " P_PASS
        echo ""
        read -s -p "Confirm Password:   " P_PASS2
        echo ""
        
        if [ "$P_PASS" == "$P_PASS2" ] && [ ! -z "$P_PASS" ]; then
            # Ensure JSON file exists
            if [ ! -f "$DATA_FILE" ]; then echo "{}" > "$DATA_FILE"; fi
            
            # Inject credentials into JSON using Python
            python3 -c "import json; 
try:
    with open('$DATA_FILE', 'r') as f: d = json.load(f)
except: d = {}
d['panel_user'] = '$P_USER'
d['panel_pass'] = '$P_PASS'
with open('$DATA_FILE', 'w') as f: json.dump(d, f, indent=4)"
            
            echo -e "${GREEN}✅ Security Credentials injected into Database!${NC}"
            break
        else
            echo -e "${RED}❌ Passwords do not match. Try again.${NC}"
        fi
    done
}

function setup_service_final() {
    echo -e "\n${BLUE}🤖 Step 4: Finalizing...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"

    # Fix Permissions (CRITICAL FOR RESTORE)
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"
    sudo chmod -R 755 "$INSTALL_DIR"

    sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Car Bot Service
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
    
    echo -e "${GREEN}✅ Service Started!${NC}"
}

function create_shortcut() {
    cp "$0" "$INSTALL_DIR/manager.sh"
    chmod +x "$INSTALL_DIR/manager.sh"
    sudo ln -sf "$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
}

# --- Restore Logic (STRICT SECURITY) ---

function do_restore() {
    echo -e "${BLUE}📥 Secure Restore${NC}"
    echo "------------------------------------------------"
    
    read -p "Enter full path to backup file (e.g. /root/backup.json): " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found!${NC}"
        pause; return
    fi
    
    echo -e "${YELLOW}🔐 This backup is protected. Enter credentials to unlock:${NC}"
    read -p "Backup Username: " IN_USER
    read -s -p "Backup Password: " IN_PASS
    echo ""
    
    # Verify Credentials using Python
    # This reads the backup file, checks panel_user/panel_pass vs input
    RESULT=$(python3 -c "
import json
try:
    with open('$BACKUP_PATH', 'r') as f:
        data = json.load(f)
        real_user = data.get('panel_user', '')
        real_pass = data.get('panel_pass', '')
        if real_user == '$IN_USER' and real_pass == '$IN_PASS':
            print('PASS')
        else:
            print('FAIL')
except:
    print('ERROR')
")

    if [ "$RESULT" == "PASS" ]; then
        echo -e "${GREEN}✅ Password Correct! Restoring...${NC}"
        
        # Stop service
        sudo systemctl stop $SERVICE_NAME
        
        # Copy file
        cp "$BACKUP_PATH" "$INSTALL_DIR/$DATA_FILE"
        
        # FIX PERMISSIONS (This fixes the 'bot not working' issue)
        CURRENT_USER=$(whoami)
        sudo chown $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR/$DATA_FILE"
        sudo chmod 644 "$INSTALL_DIR/$DATA_FILE"
        
        # Start service
        sudo systemctl start $SERVICE_NAME
        
        echo -e "${GREEN}🎉 Restore Successful. Bot restarted.${NC}"
    else
        echo -e "${RED}❌ ACCESS DENIED: Wrong Username or Password.${NC}"
        echo "Restore aborted."
    fi
    pause
}

function manual_backup() {
    # Extract Admin ID
    ADMIN_ID=$(python3 -c "import re; print(re.search(r\"OWNER_ID = (\d+)\", open('$INSTALL_DIR/bot.py').read()).group(1))" 2>/dev/null)
    BOT_TOKEN=$(python3 -c "import re; print(re.search(r\"TOKEN = '(.*)'\", open('$INSTALL_DIR/bot.py').read()).group(1))" 2>/dev/null)
    
    echo "Sending backup to Admin ID: $ADMIN_ID"
    curl -s -F chat_id="$ADMIN_ID" -F document=@"$INSTALL_DIR/$DATA_FILE" -F caption="💾 Manual Backup (Secure)" "https://api.telegram.org/bot$BOT_TOKEN/sendDocument" > /dev/null
    echo -e "${GREEN}✅ Sent.${NC}"
    pause
}

# --- Main Logic ---

function do_install() {
    install_dependencies
    setup_environment
    configure_bot_and_security
    setup_service_final
    create_shortcut
    echo -e "\n${GREEN}🎉 Installation Complete!${NC}"
    pause
}

# --- Menu Loop ---

while true; do
    clear
    echo -e "${BLUE}=== 🚗 Iran Car Bot Manager (Secure) ===${NC}"
    echo "1) Install / Re-install (Sets User/Pass)"
    echo "2) Restore Backup (Requires Password)"
    echo "3) Manual Backup to Telegram"
    echo "4) Restart Bot"
    echo "5) View Logs"
    echo "0) Exit"
    read -p "Select: " opt
    
    case $opt in
        1) do_install ;;
        2) do_restore ;;
        3) manual_backup ;;
        4) sudo systemctl restart $SERVICE_NAME; echo "Done."; pause ;;
        5) journalctl -u $SERVICE_NAME -n 50 -f ;;
        0) exit 0 ;;
    esac
done
