import { CAR_DB, MOBILE_DB, YEARS, PAINT_CONDITIONS } from '../constants';

// --- Bash Script Generator ---
export const generateBashScript = (repoUrl: string): string => {
  return `#!/bin/bash

# ==========================================
# 🚗 Iran Car Bot Manager
# ==========================================

# Configuration
INSTALL_DIR="$HOME/carbot"
SERVICE_NAME="carbot"
REPO_URL="${repoUrl}"
SECRET_FILE="$INSTALL_DIR/.manager_secret"

# Colors
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

# --- Security Functions ---

function setup_credentials() {
    echo -e "\\n\${YELLOW}🔐 Security Setup (Required)\${NC}"
    echo "Please set a Username and Password for this Bot Manager Panel."
    echo "You will need these credentials to access the menu and restore backups."
    echo ""
    
    read -p "Enter New Username: " NEW_USER
    read -s -p "Enter New Password: " PASS1
    echo ""
    read -s -p "Confirm Password: " PASS2
    echo ""
    
    if [ "\$PASS1" == "\$PASS2" ] && [ ! -z "\$PASS1" ] && [ ! -z "\$NEW_USER" ]; then
        echo "PANEL_USER=\"\$NEW_USER\"" > "\$SECRET_FILE"
        echo "PANEL_PASS=\"\$PASS1\"" >> "\$SECRET_FILE"
        chmod 600 "\$SECRET_FILE"
        echo -e "\${GREEN}✅ Credentials saved successfully.\${NC}"
    else
        echo -e "\${RED}❌ Passwords do not match or fields are empty. Try again.\${NC}"
        setup_credentials
    fi
}

function check_auth() {
    # If not installed yet, skip auth
    if [ ! -f "\$SECRET_FILE" ]; then
        return
    fi

    echo -e "\${BLUE}🔒 Locked. Please login to continue.\${NC}"
    read -p "Username: " INPUT_USER
    read -s -p "Password: " INPUT_PASS
    echo ""
    
    source "\$SECRET_FILE"
    
    if [ "\$INPUT_USER" != "\$PANEL_USER" ] || [ "\$INPUT_PASS" != "\$PANEL_PASS" ]; then
        echo -e "\${RED}❌ Access Denied.\${NC}"
        exit 1
    fi
    echo -e "\${GREEN}🔓 Access Granted.\${NC}"
    sleep 0.5
}

# --- Helper Functions ---

function pause() {
    read -p "Press [Enter] key to continue..."
}

function check_root() {
    if [ "$EUID" -ne 0 ]; then 
        echo -e "\${YELLOW}⚠️  Requesting sudo permissions... (Please enter password if asked)\${NC}"
        sudo -v
    fi
}

function install_dependencies() {
    echo -e "\${BLUE}📦 Installing System Dependencies...\${NC}"
    check_root
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv git curl
}

function setup_environment() {
    cd "$HOME" || exit 1

    echo -e "\${BLUE}📂 Setting up Directory: \$INSTALL_DIR \${NC}"
    
    if [ -d "\$INSTALL_DIR" ] && [ ! -d "\$INSTALL_DIR/.git" ]; then
        echo -e "\${YELLOW}⚠️  Found corrupt or empty directory. Cleaning up...\${NC}"
        rm -rf "\$INSTALL_DIR"
    fi

    if [ -d "\$INSTALL_DIR/.git" ]; then
        echo -e "\${GREEN}🔄 Repository exists. Pulling latest changes...\${NC}"
        cd "\$INSTALL_DIR"
        git pull
    else
        echo -e "\${GREEN}⬇️  Cloning repository from \$REPO_URL...\${NC}"
        git clone "\$REPO_URL" "\$INSTALL_DIR"
        
        if [ ! -d "\$INSTALL_DIR" ]; then
             echo -e "\${RED}❌ Error: Git clone failed. Directory not created.\${NC}"
             pause
             return 1
        fi
        
        cd "\$INSTALL_DIR"
    fi

    if [ ! -f "bot.py" ]; then
        echo -e "\${RED}❌ Critical Error: bot.py still not found after cloning! \${NC}"
        pause
        return 1
    fi

    if [ ! -d "venv" ]; then
        echo -e "\${GREEN}🐍 Creating Python Virtual Environment...\${NC}"
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    
    echo -e "\${GREEN}📚 Installing Python Libraries...\${NC}"
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime
}

function configure_bot() {
    cd "\$INSTALL_DIR"
    
    # Setup Credentials if missing
    if [ ! -f "\$SECRET_FILE" ]; then
        setup_credentials
    fi
    
    echo -e "\n\${BLUE}⚙️  Bot Configuration \${NC}"
    echo "------------------------------------------------"
    
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter your Telegram Bot Token: " BOT_TOKEN
        read -p "Enter your Numeric Admin ID (from @userinfobot): " ADMIN_ID
        
        sed -i "s/REPLACE_ME_TOKEN/\$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = \$ADMIN_ID/g" bot.py
        
        echo -e "\${GREEN}✅ Configuration saved.\${NC}"
    else
        echo -e "\${GREEN}✅ Bot is already configured.\${NC}"
        read -p "Do you want to re-configure keys? (y/n): " RECONF
        if [[ "\$RECONF" == "y" ]]; then
             read -p "Enter NEW Telegram Bot Token: " BOT_TOKEN
             read -p "Enter NEW Numeric Admin ID: " ADMIN_ID
             
             git checkout bot.py
             sed -i "s/REPLACE_ME_TOKEN/\$BOT_TOKEN/g" bot.py
             sed -i "s/OWNER_ID = 0/OWNER_ID = \$ADMIN_ID/g" bot.py
             echo -e "\${GREEN}✅ Configuration updated.\${NC}"
        fi
    fi
    echo "------------------------------------------------"
}

function setup_service() {
    echo -e "\${BLUE}🤖 Setting up Systemd Service...\${NC}"
    
    SERVICE_FILE="/etc/systemd/system/\$SERVICE_NAME.service"
    CURRENT_USER=\$(whoami)
    PYTHON_EXEC="\$INSTALL_DIR/venv/bin/python"

    sudo bash -c "cat > \$SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot Manager
After=network.target

[Service]
User=\$CURRENT_USER
WorkingDirectory=\$INSTALL_DIR
ExecStart=\$PYTHON_EXEC bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL

    sudo systemctl daemon-reload
    sudo systemctl enable \$SERVICE_NAME
    sudo systemctl restart \$SERVICE_NAME
    
    echo -e "\${GREEN}✅ Service started! \${NC}"
}

function create_shortcut() {
    echo -e "\${BLUE}🔗 Creating global command 'carbot'...\${NC}"
    cp "\$0" "\$INSTALL_DIR/manager.sh"
    chmod +x "\$INSTALL_DIR/manager.sh"
    sudo ln -sf "\$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    echo -e "\${GREEN}✅ Done! You can now type 'carbot' anywhere to open this menu.\${NC}"
}

# --- Backup/Restore Functions ---

function do_restore() {
    echo -e "\${BLUE}📥 Restore Data (Import)\${NC}"
    echo -e "\${YELLOW}⚠️  This will OVERWRITE the current database!\${NC}"
    
    # 1. Ask for file
    read -p "Enter full path to backup file: " BACKUP_PATH
    if [ ! -f "\$BACKUP_PATH" ]; then
        echo -e "\${RED}❌ File not found.\${NC}"
        pause
        return
    fi
    
    # 2. Validate JSON (Prevents crash)
    echo "Checking file validity..."
    if ! python3 -m json.tool "\$BACKUP_PATH" > /dev/null 2>&1; then
        echo -e "\${RED}❌ Error: The file is corrupted or not valid JSON.\${NC}"
        echo "Restore cancelled to protect the bot."
        pause
        return
    fi

    # 3. Security Check (Double Confirm)
    echo -e "\\n\${YELLOW}🔒 Security Check Required for Restore\${NC}"
    read -p "Confirm Username: " INPUT_USER
    read -s -p "Confirm Password: " INPUT_PASS
    echo ""

    if [ -f "\$SECRET_FILE" ]; then
        source "\$SECRET_FILE"
    fi

    if [ "\$INPUT_USER" != "\$PANEL_USER" ] || [ "\$INPUT_PASS" != "\$PANEL_PASS" ]; then
        echo -e "\${RED}❌ Authentication Failed! Restore cancelled.\${NC}"
        pause
        return
    fi
    
    # 4. Execute
    read -p "Credentials accepted. Are you sure? (y/n): " confirm
    if [[ "\$confirm" == "y" ]]; then
        echo "Stopping bot..."
        sudo systemctl stop \$SERVICE_NAME
        
        echo "Restoring..."
        cp "\$BACKUP_PATH" "\$INSTALL_DIR/bot_data.json"
        
        # 5. FIX PERMISSIONS (Critical for crash prevention)
        echo "Fixing file permissions..."
        CURRENT_USER=\$(whoami)
        sudo chown \$CURRENT_USER:\$CURRENT_USER "\$INSTALL_DIR/bot_data.json"
        
        echo "Starting bot..."
        sudo systemctl start \$SERVICE_NAME
        
        echo -e "\${GREEN}✅ Restored successfully.\${NC}"
    fi
    pause
}

function send_backup_to_telegram() {
    # ... existing backup code ...
    if [ ! -f "\$INSTALL_DIR/bot.py" ]; then
         echo -e "\${RED}❌ bot.py not found.\${NC}"
         pause
         return
    fi
    BOT_TOKEN=\$(grep "TOKEN =" "\$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
    ADMIN_ID=\$(grep "OWNER_ID =" "\$INSTALL_DIR/bot.py" | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    
    DATA_FILE="\$INSTALL_DIR/bot_data.json"
    if [ ! -f "\$DATA_FILE" ]; then
        echo -e "\${RED}❌ Data file (bot_data.json) not found.\${NC}"
        pause
        return
    fi

    CAPTION="💾 Manual Backup from Server Panel - \$(date)"
    response=\$(curl -s -F chat_id="\$ADMIN_ID" -F document=@"\$DATA_FILE" -F caption="\$CAPTION" "https://api.telegram.org/bot\$BOT_TOKEN/sendDocument")
    
    if [[ "\$response" == *"\\"ok\\":true"* ]]; then
        echo -e "\${GREEN}✅ Backup sent to Telegram!\${NC}"
    else
        echo -e "\${RED}❌ Failed to send backup.\${NC}"
    fi
    pause
}

function configure_auto_backup() {
    # ... existing auto backup ...
    while true; do
        clear
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "\${YELLOW}      ⏱ Auto-Backup Configuration      \${NC}"
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "1) Set \${GREEN}Hourly\${NC} (Every 1 Hour)"
        echo -e "2) Set \${GREEN}Daily\${NC} (Every 24 Hours)"
        echo -e "3) \${RED}Disable\${NC} Auto-Backup"
        echo -e "0) Back"
        echo -e "\${BLUE}========================================\${NC}"
        read -p "Select interval: " interval_choice
        
        DATA_FILE="\$INSTALL_DIR/bot_data.json"
        if [ ! -f "\$DATA_FILE" ]; then echo "{}" > "\$DATA_FILE"; fi

        case \$interval_choice in
            1)
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=1; json.dump(d, open('\$DATA_FILE','w'))"
                sudo systemctl restart \$SERVICE_NAME
                echo -e "\${GREEN}✅ Set to Hourly.\${NC}"; pause; return ;;
            2)
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=24; json.dump(d, open('\$DATA_FILE','w'))"
                sudo systemctl restart \$SERVICE_NAME
                echo -e "\${GREEN}✅ Set to Daily.\${NC}"; pause; return ;;
            3)
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=0; json.dump(d, open('\$DATA_FILE','w'))"
                sudo systemctl restart \$SERVICE_NAME
                echo -e "\${YELLOW}🚫 Disabled.\${NC}"; pause; return ;;
            0) return ;;
            *) echo "Invalid option."; pause ;;
        esac
    done
}

function do_backup() {
    while true; do
        clear
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "\${GREEN}      💾 Backup Management      \${NC}"
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "1) \${GREEN}Local Backup\${NC} (Save to \$HOME/carbot_backups)"
        echo -e "2) \${YELLOW}Send to Telegram\${NC} (Send file to Admin)"
        echo -e "3) \${BLUE}Auto-Backup Settings\${NC}"
        echo -e "0) Back to Main Menu"
        echo -e "\${BLUE}========================================\${NC}"
        read -p "Select an option: " subchoice

        case \$subchoice in
            1)
                BACKUP_DIR="\$HOME/carbot_backups"
                mkdir -p "\$BACKUP_DIR"
                TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
                DEST="\$BACKUP_DIR/backup_\$TIMESTAMP.json"
                if [ -f "\$INSTALL_DIR/bot_data.json" ]; then
                    cp "\$INSTALL_DIR/bot_data.json" "\$DEST"
                    echo -e "\${GREEN}✅ Backup created: \$DEST\${NC}"
                else echo -e "\${RED}No data file found.\${NC}"; fi
                pause ;;
            2) send_backup_to_telegram ;;
            3) configure_auto_backup ;;
            0) return ;;
            *) echo -e "\${RED}Invalid option.\${NC}"; pause ;;
        esac
    done
}

# --- Menu Functions ---

function do_install() {
    echo -e "\${BLUE}🚀 Starting Installation...\${NC}"
    install_dependencies
    setup_environment
    if [ $? -eq 0 ]; then
        configure_bot
        setup_service
        create_shortcut
        echo -e "\n\${GREEN}🎉 Complete! \${NC}"
    else
        echo -e "\n\${RED}❌ Failed. \${NC}"
    fi
    pause
}

function do_update() {
    # ... update logic ...
    if [ ! -d "\$INSTALL_DIR" ]; then
        echo -e "\${RED}Bot is not installed yet.\${NC}"; pause; return
    fi
    cd "\$INSTALL_DIR"
    OLD_TOKEN=\$(grep "TOKEN =" bot.py | cut -d "'" -f 2)
    OLD_ID=\$(grep "OWNER_ID =" bot.py | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    git reset --hard; git pull
    if [ ! -z "\$OLD_TOKEN" ]; then
         sed -i "s/REPLACE_ME_TOKEN/\$OLD_TOKEN/g" bot.py
         sed -i "s/OWNER_ID = 0/OWNER_ID = \$OLD_ID/g" bot.py
    fi
    if [ -f "install.sh" ]; then cp "install.sh" "manager.sh"; chmod +x "manager.sh"; fi
    sudo systemctl restart \$SERVICE_NAME
    echo -e "\${GREEN}✅ Update Complete.\${NC}"
    pause
}

function do_logs() { journalctl -u \$SERVICE_NAME -n 50 -f; }
function do_status() { sudo systemctl status \$SERVICE_NAME; pause; }
function do_restart() { sudo systemctl restart \$SERVICE_NAME; echo "Restarted."; pause; }
function do_stop() { sudo systemctl stop \$SERVICE_NAME; echo "Stopped."; pause; }
function do_uninstall() {
    read -p "Delete everything? (y/n): " confirm
    if [[ "\$confirm" == "y" ]]; then
        sudo systemctl stop \$SERVICE_NAME
        sudo systemctl disable \$SERVICE_NAME
        sudo rm /etc/systemd/system/\$SERVICE_NAME.service
        sudo systemctl daemon-reload
        rm -rf "\$INSTALL_DIR"
        sudo rm /usr/local/bin/carbot
        echo -e "\${GREEN}✅ Uninstalled.\${NC}"
    fi
    pause
}

# --- Main Entry Point ---

# Check auth before showing menu
check_auth

while true; do
    clear
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "\${GREEN}      🚗 Iran Car Bot Manager 🚗      \${NC}"
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "1) \${GREEN}Install / Reinstall\${NC}"
    echo -e "2) \${YELLOW}Update Bot\${NC}"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) \${BLUE}💾 Backup Data\${NC}"
    echo -e "8) \${BLUE}📥 Restore Data\${NC} (Safe Restore)"
    echo -e "9) \${RED}Uninstall\${NC}"
    echo -e "0) Exit"
    echo -e "\${BLUE}========================================\${NC}"
    read -p "Select: " choice

    case \$choice in
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
        *) echo "Invalid."; pause ;;
    esac
done
`;
};

// --- Python Bot Generator ---
export const generatePythonCode = (): string => {
  return `import logging
import json
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler

# ==========================================
# 🚗 Iran Car Bot - Python Source
# ==========================================

# CONFIGURATION
TOKEN = 'REPLACE_ME_TOKEN'  # Will be replaced by manager
OWNER_ID = 0                # Will be replaced by manager

# DATA
CAR_DB = ${JSON.stringify(CAR_DB, null, 4)}
MOBILE_DB = ${JSON.stringify(MOBILE_DB, null, 4)}
YEARS = ${JSON.stringify(YEARS)}
PAINT_CONDITIONS = ${JSON.stringify(PAINT_CONDITIONS, null, 4)}

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    buttons = [
        [
            InlineKeyboardButton("🧮 ماشین‌حساب", web_app=WebAppInfo(url="https://www.hamrah-mechanic.com/carprice/")),
            InlineKeyboardButton("🌐 قیمت بازار", web_app=WebAppInfo(url="https://www.iranjib.ir/showgroup/45/"))
        ],
        [
            InlineKeyboardButton("📋 لیست قیمت", callback_data="menu_prices"),
            InlineKeyboardButton("💰 تخمین قیمت", callback_data="menu_estimate")
        ],
        [
             InlineKeyboardButton("📱 موبایل (سایت)", web_app=WebAppInfo(url="https://www.mobile.ir/phones/prices.aspx")),
             InlineKeyboardButton("📲 موبایل (لیست)", callback_data="menu_mobile_list")
        ],
        [
            InlineKeyboardButton("🔍 جستجو", callback_data="menu_search"),
            InlineKeyboardButton("📞 پشتیبانی", callback_data="menu_support")
        ]
    ]
    
    if user.id == OWNER_ID:
        buttons.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])

    buttons.append([InlineKeyboardButton("📢 کانال ما", url="https://t.me/CarPrice_Channel")])

    await update.message.reply_text(
        f"👋 سلام {user.first_name}! به ربات قیمت خودرو و موبایل خوش آمدید.",
        reply_markup=InlineKeyboardMarkup(buttons)
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "main_menu":
        await start(update, context)
        return

    if data == "menu_prices":
        keyboard = []
        for brand in CAR_DB.keys():
            keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 لطفا شرکت سازنده را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return
    
    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        if brand_name in CAR_DB:
            models = CAR_DB[brand_name]["models"]
            keyboard = []
            for m in models:
                keyboard.append([InlineKeyboardButton(m["name"], callback_data=f"model_{m['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
            await query.edit_message_text(f"🚘 مدل‌های موجود برای {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # Basic placeholder for other features
    if data == "admin_home":
        if update.effective_user.id != OWNER_ID:
            return
        keyboard = [
            [InlineKeyboardButton("مدیریت منو", callback_data="admin_menus")],
            [InlineKeyboardButton("بکاپ گیری", callback_data="admin_backup")],
            [InlineKeyboardButton("🔙 خروج", callback_data="main_menu")]
        ]
        await query.edit_message_text("🛠 پنل مدیریت:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    await query.edit_message_text(f"✅ دستور دریافت شد: {data}\\n(سایر بخش‌ها در این نسخه آزمایشی پیاده‌سازی نشده‌اند)")

if __name__ == '__main__':
    application = ApplicationBuilder().token(TOKEN).build()
    
    application.add_handler(CommandHandler('start', start))
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    print("Bot is running...")
    application.run_polling()
`;
};
