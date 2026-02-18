#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager - SECURE
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
# This will be replaced by the user's specific URL if they copy from web app, 
# otherwise default to a placeholder that needs changing or general repo.
# Since this file is static in the project, we put a placeholder or generic.
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

function install_dependencies() {
    echo -e "${BLUE}📦 Installing System Dependencies...${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
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
        git reset --hard
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
    
    # 1. Telegram Token Setup
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter Telegram Bot Token: " BOT_TOKEN
        read -p "Enter Admin Numeric ID: " ADMIN_ID
        
        # Replace in bot.py using sed
        sed -i "s/REPLACE_ME_TOKEN/$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = $ADMIN_ID/g" bot.py
    else
        echo -e "${GREEN}Telegram Token already configured.${NC}"
    fi

    # 2. SECURITY SETUP (MANDATORY)
    echo -e "\n${YELLOW}🔐 PANEL SECURITY SETUP (REQUIRED)${NC}"
    echo "You MUST set a Username and Password. This will be required to RESTORE backups later."
    echo "------------------------------------------------"
    
    while true; do
        read -p "Set Panel Username: " P_USER
        read -s -p "Set Panel Password: " P_PASS
        echo ""
        read -s -p "Confirm Password:   " P_PASS2
        echo ""
        
        if [ "$P_PASS" == "$P_PASS2" ] && [ ! -z "$P_PASS" ]; then
            # Inject into JSON safely using Python
            # We create/update bot_data.json immediately with credentials
            python3 -c "
import json, os
data = {}
if os.path.exists('$DATA_FILE'):
    try:
        with open('$DATA_FILE', 'r') as f: data = json.load(f)
    except: pass

data['panel_user'] = '$P_USER'
data['panel_pass'] = '$P_PASS'

with open('$DATA_FILE', 'w') as f:
    json.dump(data, f, indent=4)
"
            echo -e "${GREEN}✅ Security credentials saved to database.${NC}"
            break
        else
            echo -e "${RED}❌ Passwords do not match. Try again.${NC}"
        fi
    done
    
    echo "------------------------------------------------"
}

function setup_service() {
    echo -e "${BLUE}🤖 Setting up Systemd Service...${NC}"
    
    SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
    CURRENT_USER=$(whoami)
    PYTHON_EXEC="$INSTALL_DIR/venv/bin/python"
    
    # FIX: Ensure user owns the directory before starting service
    sudo chown -R $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR"

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
    echo -e "${BLUE}🔗 Creating global command 'carbot'...${NC}"
    cp "$0" "$INSTALL_DIR/manager.sh"
    chmod +x "$INSTALL_DIR/manager.sh"
    sudo ln -sf "$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    echo -e "${GREEN}✅ Done! You can now type 'carbot' anywhere to open this menu.${NC}"
}

# --- Restore Function (SECURE) ---

function do_restore() {
    echo -e "${BLUE}📥 SECURE RESTORE ${NC}"
    echo -e "${YELLOW}⚠️  This will overwrite current data!${NC}"
    
    # 1. Get File Path
    read -p "Enter full path to backup file: " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found.${NC}"
        pause; return
    fi
    
    # 2. Security Check (Read credentials FROM THE BACKUP FILE)
    echo -e "\n${YELLOW}🔐 Enter credentials for the BACKUP file:${NC}"
    read -p "Backup Username: " IN_USER
    read -s -p "Backup Password: " IN_PASS
    echo ""
    
    # Verify using Python to read the JSON file safely
    VERIFY=$(python3 -c "
import json, sys
try:
    with open('$BACKUP_PATH', 'r') as f:
        d = json.load(f)
        if d.get('panel_user') == '$IN_USER' and d.get('panel_pass') == '$IN_PASS':
            print('OK')
        else:
            print('WRONG_PASS')
except:
    print('CORRUPT')
")

    if [ "$VERIFY" == "WRONG_PASS" ]; then
        echo -e "${RED}❌ ACCESS DENIED: Incorrect Username or Password for this backup.${NC}"
        echo "Restore aborted."
        pause; return
    elif [ "$VERIFY" == "CORRUPT" ]; then
        echo -e "${RED}❌ Error: Backup file is corrupt or invalid JSON.${NC}"
        pause; return
    fi

    # 3. Perform Restore
    echo -e "${GREEN}✅ Credentials Verified. Restoring...${NC}"
    
    sudo systemctl stop $SERVICE_NAME
    
    cp "$BACKUP_PATH" "$INSTALL_DIR/$DATA_FILE"
    
    # 4. FIX PERMISSIONS (Crucial Fix)
    CURRENT_USER=$(whoami)
    echo "Fixing permissions for $CURRENT_USER..."
    sudo chown $CURRENT_USER:$CURRENT_USER "$INSTALL_DIR/$DATA_FILE"
    sudo chmod 644 "$INSTALL_DIR/$DATA_FILE"
    
    sudo systemctl start $SERVICE_NAME
    
    echo -e "${GREEN}✅ Restore Complete & Service Restarted.${NC}"
    pause
}


# --- Backup Function ---

function do_backup() {
    BACKUP_DIR="$HOME/carbot_backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    DEST="$BACKUP_DIR/backup_$TIMESTAMP.json"
    
    if [ -f "$INSTALL_DIR/bot_data.json" ]; then
        cp "$INSTALL_DIR/bot_data.json" "$DEST"
        echo -e "${GREEN}✅ Local Backup created at: $DEST${NC}"
        
        # Telegram Send Option
        read -p "Send to Telegram Admin? (y/n): " snd
        if [[ "$snd" == "y" ]]; then
            # Extract info
            BOT_TOKEN=$(grep "TOKEN =" "$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
            ADMIN_ID=$(grep "OWNER_ID =" "$INSTALL_DIR/bot.py" | awk -F'=' '{print $2}' | tr -d ' ')
            curl -s -F chat_id="$ADMIN_ID" -F document=@"$DEST" -F caption="💾 Manual Backup" "https://api.telegram.org/bot$BOT_TOKEN/sendDocument" > /dev/null
            echo -e "${GREEN}Sent.${NC}"
        fi
    else
        echo -e "${RED}No database found.${NC}"
    fi
    pause
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
    if [ ! -d "$INSTALL_DIR" ]; then echo "Not installed."; pause; return; fi
    cd "$INSTALL_DIR"
    git reset --hard
    git pull
    sudo systemctl restart $SERVICE_NAME
    echo "Updated."; pause
}

function do_logs() { journalctl -u $SERVICE_NAME -n 50 -f; }
function do_restart() { sudo systemctl restart $SERVICE_NAME; echo "Done."; pause; }
function do_stop() { sudo systemctl stop $SERVICE_NAME; echo "Done."; pause; }

# --- Main Menu Loop ---

while true; do
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}      🚗 Iran Car Bot Manager      ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "1) ${GREEN}Install / Reinstall${NC} (Set User/Pass)"
    echo -e "2) Update Bot Code"
    echo -e "3) View Logs"
    echo -e "4) Restart Service"
    echo -e "5) Stop Service"
    echo -e "6) Backup Data"
    echo -e "7) ${BLUE}Auto-Backup Settings${NC}"
    echo -e "8) ${YELLOW}Restore Backup${NC} (Requires Pass)"
    echo -e "0) Exit"
    echo -e "${BLUE}========================================${NC}"
    read -p "Select: " choice

    case $choice in
        1) do_install ;;
        2) do_update ;;
        3) do_logs ;;
        4) do_restart ;;
        5) do_stop ;;
        6) do_backup ;;
        7) echo "Feature in bot settings."; pause ;;
        8) do_restore ;;
        0) exit 0 ;;
        *) echo "Invalid."; pause ;;
    esac
done
