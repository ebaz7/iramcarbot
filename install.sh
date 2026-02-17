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
    sudo apt-get install -y python3 python3-pip python3-venv git curl
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

# --- Backup/Restore Functions ---

function send_backup_to_telegram() {
    echo -e "${BLUE}📤 Sending Backup to Telegram...${NC}"
    
    if [ ! -f "$INSTALL_DIR/bot.py" ]; then
         echo -e "${RED}❌ bot.py not found. Cannot read credentials.${NC}"
         pause
         return
    fi

    # Extract Token (assumes TOKEN = '...')
    BOT_TOKEN=$(grep "TOKEN =" "$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
    
    # Extract Admin ID (assumes OWNER_ID = 123... # comment)
    # logic: grep line -> remove 'OWNER_ID =' -> remove spaces -> remove comments after #
    ADMIN_ID=$(grep "OWNER_ID =" "$INSTALL_DIR/bot.py" | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    
    if [[ -z "$BOT_TOKEN" || -z "$ADMIN_ID" || "$BOT_TOKEN" == "REPLACE_ME_TOKEN" ]]; then
        echo -e "${RED}❌ Bot credentials not found or not configured properly.${NC}"
        pause
        return
    fi

    DATA_FILE="$INSTALL_DIR/bot_data.json"
    if [ ! -f "$DATA_FILE" ]; then
        echo -e "${RED}❌ Data file (bot_data.json) not found.${NC}"
        pause
        return
    fi

    CAPTION="💾 Manual Backup from Server Panel - $(date)"

    # Send using curl
    response=$(curl -s -F chat_id="$ADMIN_ID" -F document=@"$DATA_FILE" -F caption="$CAPTION" "https://api.telegram.org/bot$BOT_TOKEN/sendDocument")
    
    if [[ "$response" == *"\"ok\":true"* ]]; then
        echo -e "${GREEN}✅ Backup sent to Telegram (Admin ID: $ADMIN_ID) successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to send backup.${NC}"
        echo "Response: $response"
        echo "Debug: Token starts with ${BOT_TOKEN:0:5}..."
    fi
    pause
}

function configure_auto_backup() {
    while true; do
        clear
        echo -e "${BLUE}========================================${NC}"
        echo -e "${YELLOW}      ⏱ Auto-Backup Configuration      ${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e "1) Set ${GREEN}Hourly${NC} (Every 1 Hour)"
        echo -e "2) Set ${GREEN}Daily${NC} (Every 24 Hours)"
        echo -e "3) ${RED}Disable${NC} Auto-Backup"
        echo -e "0) Back"
        echo -e "${BLUE}========================================${NC}"
        read -p "Select interval: " interval_choice
        
        DATA_FILE="$INSTALL_DIR/bot_data.json"
        
        # Ensure bot_data.json exists
        if [ ! -f "$DATA_FILE" ]; then
            echo "{}" > "$DATA_FILE"
        fi

        case $interval_choice in
            1)
                # Use python to edit json safely
                python3 -c "import json; d=json.load(open('$DATA_FILE')); d['backup_interval']=1; json.dump(d, open('$DATA_FILE','w'))"
                echo -e "${GREEN}✅ Set to Hourly. Restarting bot...${NC}"
                sudo systemctl restart $SERVICE_NAME
                pause
                return
                ;;
            2)
                python3 -c "import json; d=json.load(open('$DATA_FILE')); d['backup_interval']=24; json.dump(d, open('$DATA_FILE','w'))"
                echo -e "${GREEN}✅ Set to Daily. Restarting bot...${NC}"
                sudo systemctl restart $SERVICE_NAME
                pause
                return
                ;;
            3)
                python3 -c "import json; d=json.load(open('$DATA_FILE')); d['backup_interval']=0; json.dump(d, open('$DATA_FILE','w'))"
                echo -e "${YELLOW}🚫 Auto-Backup Disabled. Restarting bot...${NC}"
                sudo systemctl restart $SERVICE_NAME
                pause
                return
                ;;
            0)
                return
                ;;
            *)
                echo "Invalid option."
                pause
                ;;
        esac
    done
}

function do_backup() {
    while true; do
        clear
        echo -e "${BLUE}========================================${NC}"
        echo -e "${GREEN}      💾 Backup Management      ${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e "1) ${GREEN}Local Backup${NC} (Save to $HOME/carbot_backups)"
        echo -e "2) ${YELLOW}Send to Telegram${NC} (Send file to Admin)"
        echo -e "3) ${BLUE}Auto-Backup Settings${NC} (Hourly/Daily)"
        echo -e "0) Back to Main Menu"
        echo -e "${BLUE}========================================${NC}"
        read -p "Select an option: " subchoice

        case $subchoice in
            1)
                BACKUP_DIR="$HOME/carbot_backups"
                mkdir -p "$BACKUP_DIR"
                TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
                DEST="$BACKUP_DIR/backup_$TIMESTAMP.json"
                
                # Check if data file exists
                if [ -f "$INSTALL_DIR/bot_data.json" ]; then
                    cp "$INSTALL_DIR/bot_data.json" "$DEST"
                    echo -e "${GREEN}✅ Backup created: $DEST${NC}"
                    echo -e "(You can download this via SFTP)"
                else
                     echo -e "${RED}❌ No database found (bot_data.json is missing).${NC}"
                fi
                pause
                ;;
            2)
                send_backup_to_telegram
                ;;
            3)
                configure_auto_backup
                ;;
            0)
                return
                ;;
            *)
                echo -e "${RED}Invalid option.${NC}"
                pause
                ;;
        esac
    done
}

function do_restore() {
    echo -e "${BLUE}📥 Restore Data (Import)${NC}"
    echo -e "${YELLOW}⚠️  This will OVERWRITE the current database!${NC}"
    echo "To restore, please upload your 'bot_data.json' or backup file to this server first."
    echo ""
    read -p "Enter the full path to your backup file (e.g. /root/my_backup.json): " BACKUP_PATH
    
    if [ ! -f "$BACKUP_PATH" ]; then
        echo -e "${RED}❌ File not found at $BACKUP_PATH${NC}"
        pause
        return
    fi
    
    read -p "Are you sure you want to restore? (y/n): " confirm
    if [[ "$confirm" == "y" ]]; then
        echo "Stopping bot..."
        check_root
        sudo systemctl stop $SERVICE_NAME
        
        echo "Restoring..."
        cp "$BACKUP_PATH" "$INSTALL_DIR/bot_data.json"
        
        echo "Starting bot..."
        sudo systemctl start $SERVICE_NAME
        
        echo -e "${GREEN}✅ Restore Complete. Bot is running with new data.${NC}"
    else
        echo "Cancelled."
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
    echo -e "${BLUE}🔄 Updating Bot...${NC}"
    
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "${RED}Bot is not installed yet. Please Install first.${NC}"
        pause
        return
    fi
    
    cd "$INSTALL_DIR"
    
    echo "1. Saving current configuration..."
    # Extract Token (handle spacing variations)
    OLD_TOKEN=$(grep "TOKEN =" bot.py | cut -d "'" -f 2)
    # Extract ID
    OLD_ID=$(grep "OWNER_ID =" bot.py | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    
    echo "2. Forcing Git Pull (Resetting changes)..."
    # IMPORTANT: Reset git to allow pull, then re-apply keys
    git reset --hard
    git pull
    
    if [ -z "$OLD_TOKEN" ] || [ -z "$OLD_ID" ]; then
         echo -e "${YELLOW}⚠️  Could not backup credentials. You might need to re-enter them.${NC}"
    else 
         echo "3. Restoring configuration..."
         sed -i "s/REPLACE_ME_TOKEN/$OLD_TOKEN/g" bot.py
         sed -i "s/OWNER_ID = 0/OWNER_ID = $OLD_ID/g" bot.py
    fi

    echo "4. Updating Menu Script..."
    if [ -f "install.sh" ]; then
        cp "install.sh" "manager.sh"
        chmod +x "manager.sh"
        echo -e "${GREEN}✅ Menu script updated successfully.${NC}"
    fi
    
    echo "5. Restarting Service..."
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
    echo -e "2) ${YELLOW}Update Bot${NC} (Force Git Pull & Restart)"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) ${BLUE}💾 Backup Data${NC} (Export)"
    echo -e "8) ${BLUE}📥 Restore Data${NC} (Import)"
    echo -e "9) ${RED}Uninstall Completely${NC}"
    echo -e "0) Exit"
    echo -e "${BLUE}========================================${NC}"
    read -p "Select an option [0-9]: " choice

    case $choice in
        1) do_install ;;
        2) do_update ;;
        3) do_logs ;;
        4) do_status ;;
        5) do_restart ;;
        6) do_stop ;;
        7) do_backup ;;
        8) do_restore ;;
        9) do_uninstall ;;
        0) exit 0 ;;
        *) echo -e "${RED}Invalid option.${NC}"; pause ;;
    esac
done
