import { CAR_DB } from '../constants';

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

# Colors
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

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
    # CRITICAL FIX: Ensure we are in HOME before potentially deleting the current directory
    cd "$HOME" || exit 1

    echo -e "\${BLUE}📂 Setting up Directory: \$INSTALL_DIR \${NC}"
    
    # Logic to fix "bot.py not found" error:
    # If directory exists but .git is missing, it's corrupt/empty. Remove it.
    if [ -d "\$INSTALL_DIR" ] && [ ! -d "\$INSTALL_DIR/.git" ]; then
        echo -e "\${YELLOW}⚠️  Found corrupt or empty directory. Cleaning up...\${NC}"
        rm -rf "\$INSTALL_DIR"
    fi

    # Clone or Pull
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

    # Verify download
    if [ ! -f "bot.py" ]; then
        echo -e "\${RED}❌ Critical Error: bot.py still not found after cloning! \${NC}"
        echo "Please check your GitHub repository content."
        echo "Repo URL: \$REPO_URL"
        pause
        return 1
    fi

    # Virtual Env
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
    
    echo -e "\n\${BLUE}⚙️  Bot Configuration \${NC}"
    echo "------------------------------------------------"
    
    # Check if already configured to avoid re-typing
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter your Telegram Bot Token: " BOT_TOKEN
        read -p "Enter your Numeric Admin ID (from @userinfobot): " ADMIN_ID
        
        # Replace in bot.py using sed
        sed -i "s/REPLACE_ME_TOKEN/\$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = \$ADMIN_ID/g" bot.py
        
        echo -e "\${GREEN}✅ Configuration saved.\${NC}"
    else
        echo -e "\${GREEN}✅ Bot is already configured.\${NC}"
        read -p "Do you want to re-configure keys? (y/n): " RECONF
        if [[ "\$RECONF" == "y" ]]; then
             read -p "Enter NEW Telegram Bot Token: " BOT_TOKEN
             read -p "Enter NEW Numeric Admin ID: " ADMIN_ID
             
             # Reset file first (simple trick: we can't easily undo sed, so we rely on git reset)
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

    # Create Service File
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
    # Create a global command 'carbot' that runs this script
    echo -e "\${BLUE}🔗 Creating global command 'carbot'...\${NC}"
    
    # We copy THIS script to the install dir as 'manager.sh'
    cp "\$0" "\$INSTALL_DIR/manager.sh"
    chmod +x "\$INSTALL_DIR/manager.sh"
    
    sudo ln -sf "\$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    
    echo -e "\${GREEN}✅ Done! You can now type 'carbot' anywhere to open this menu.\${NC}"
}

# --- Backup/Restore Functions ---

function send_backup_to_telegram() {
    echo -e "\${BLUE}📤 Sending Backup to Telegram...\${NC}"
    
    if [ ! -f "\$INSTALL_DIR/bot.py" ]; then
         echo -e "\${RED}❌ bot.py not found. Cannot read credentials.\${NC}"
         pause
         return
    fi

    # Extract Token (assumes TOKEN = '...')
    BOT_TOKEN=\$(grep "TOKEN =" "\$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
    
    # Extract Admin ID (assumes OWNER_ID = 123... # comment)
    # logic: grep line -> remove 'OWNER_ID =' -> remove spaces -> remove comments after #
    ADMIN_ID=\$(grep "OWNER_ID =" "\$INSTALL_DIR/bot.py" | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    
    if [[ -z "\$BOT_TOKEN" || -z "\$ADMIN_ID" || "\$BOT_TOKEN" == "REPLACE_ME_TOKEN" ]]; then
        echo -e "\${RED}❌ Bot credentials not found or not configured properly.\${NC}"
        pause
        return
    fi

    DATA_FILE="\$INSTALL_DIR/bot_data.json"
    if [ ! -f "\$DATA_FILE" ]; then
        echo -e "\${RED}❌ Data file (bot_data.json) not found.\${NC}"
        pause
        return
    fi

    CAPTION="💾 Manual Backup from Server Panel - \$(date)"

    # Send using curl
    response=\$(curl -s -F chat_id="\$ADMIN_ID" -F document=@"\$DATA_FILE" -F caption="\$CAPTION" "https://api.telegram.org/bot\$BOT_TOKEN/sendDocument")
    
    if [[ "\$response" == *"\\"ok\\":true"* ]]; then
        echo -e "\${GREEN}✅ Backup sent to Telegram (Admin ID: \$ADMIN_ID) successfully!\${NC}"
    else
        echo -e "\${RED}❌ Failed to send backup.\${NC}"
        echo "Response: \$response"
        echo "Debug: Token starts with \${BOT_TOKEN:0:5}..."
    fi
    pause
}

function do_backup() {
    while true; do
        clear
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "\${GREEN}      💾 Backup Management      \${NC}"
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "1) \${GREEN}Local Backup\${NC} (Save to \$HOME/carbot_backups)"
        echo -e "2) \${YELLOW}Send to Telegram\${NC} (Send file to Admin)"
        echo -e "0) Back to Main Menu"
        echo -e "\${BLUE}========================================\${NC}"
        read -p "Select an option: " subchoice

        case \$subchoice in
            1)
                echo -e "\${BLUE}💾 Backing up locally...\${NC}"
                if [ ! -f "\$INSTALL_DIR/bot_data.json" ]; then
                    echo -e "\${RED}❌ No database found (bot_data.json is missing).\${NC}"
                    pause
                else
                    BACKUP_DIR="\$HOME/carbot_backups"
                    mkdir -p "\$BACKUP_DIR"
                    TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
                    DEST="\$BACKUP_DIR/backup_\$TIMESTAMP.json"
                    cp "\$INSTALL_DIR/bot_data.json" "\$DEST"
                    echo -e "\${GREEN}✅ Backup created: \$DEST\${NC}"
                    echo -e "(You can download this via SFTP)"
                    pause
                fi
                ;;
            2)
                send_backup_to_telegram
                ;;
            0)
                return
                ;;
            *)
                echo -e "\${RED}Invalid option.\${NC}"
                pause
                ;;
        esac
    done
}

function do_restore() {
    echo -e "\${BLUE}📥 Restore Data (Import)\${NC}"
    echo -e "\${YELLOW}⚠️  This will OVERWRITE the current database!\${NC}"
    echo "To restore, please upload your 'bot_data.json' or backup file to this server first."
    echo ""
    read -p "Enter the full path to your backup file (e.g. /root/my_backup.json): " BACKUP_PATH
    
    if [ ! -f "\$BACKUP_PATH" ]; then
        echo -e "\${RED}❌ File not found at \$BACKUP_PATH\${NC}"
        pause
        return
    fi
    
    read -p "Are you sure you want to restore? (y/n): " confirm
    if [[ "\$confirm" == "y" ]]; then
        echo "Stopping bot..."
        check_root
        sudo systemctl stop \$SERVICE_NAME
        
        echo "Restoring..."
        cp "\$BACKUP_PATH" "\$INSTALL_DIR/bot_data.json"
        
        echo "Starting bot..."
        sudo systemctl start \$SERVICE_NAME
        
        echo -e "\${GREEN}✅ Restore Complete. Bot is running with new data.\${NC}"
    else
        echo "Cancelled."
    fi
    pause
}

# --- Menu Functions ---

function do_install() {
    echo -e "\${BLUE}🚀 Starting Installation / Re-Installation...\${NC}"
    install_dependencies
    setup_environment
    if [ $? -eq 0 ]; then
        configure_bot
        setup_service
        create_shortcut
        echo -e "\n\${GREEN}🎉 Installation Complete! Bot is running. \${NC}"
    else
        echo -e "\n\${RED}❌ Installation Failed. \${NC}"
    fi
    pause
}

function do_update() {
    echo -e "\${BLUE}🔄 Updating Bot...\${NC}"
    
    if [ ! -d "\$INSTALL_DIR" ]; then
        echo -e "\${RED}Bot is not installed yet. Please Install first.\${NC}"
        pause
        return
    fi
    
    cd "\$INSTALL_DIR"
    
    echo "1. Pulling from Git..."
    git pull
    
    echo "2. Updating Menu Script..."
    # SELF-UPDATE LOGIC:
    # If the repo contains 'install.sh', we overwrite the current 'manager.sh'
    # so the new menu options (Backup, Restore, Uninstall) appear immediately.
    if [ -f "install.sh" ]; then
        cp "install.sh" "manager.sh"
        chmod +x "manager.sh"
        echo -e "\${GREEN}✅ Menu script updated successfully.\${NC}"
    else
        echo -e "\${YELLOW}⚠️  install.sh not found in repo. Menu options might not update.\${NC}"
    fi
    
    echo "3. Restarting Service..."
    check_root
    sudo systemctl restart \$SERVICE_NAME
    
    echo -e "\${GREEN}✅ Update Complete.\${NC}"
    echo -e "\${YELLOW}ℹ️  NOTE: If you don't see new options, Exit (0) and run 'carbot' again.\${NC}"
    pause
}

function do_uninstall() {
    echo -e "\${RED}🗑️  WARNING: This will completely remove the bot and all data! \${NC}"
    read -p "Are you sure? (y/n): " confirm
    if [[ "\$confirm" != "y" ]]; then
        echo "Cancelled."
        pause
        return
    fi
    
    echo -e "\${BLUE}🛑 Stopping service...\${NC}"
    check_root
    sudo systemctl stop \$SERVICE_NAME
    sudo systemctl disable \$SERVICE_NAME
    sudo rm /etc/systemd/system/\$SERVICE_NAME.service
    sudo systemctl daemon-reload
    
    echo -e "\${BLUE}📂 Removing files...\${NC}"
    rm -rf "\$INSTALL_DIR"
    sudo rm /usr/local/bin/carbot
    
    echo -e "\${GREEN}✅ Uninstall Complete. Clean slate! \${NC}"
    pause
}

function do_logs() {
    echo -e "\${YELLOW}📜 Showing last 50 lines of logs (Press Ctrl+C to exit logs)...\${NC}"
    journalctl -u \$SERVICE_NAME -n 50 -f
}

function do_status() {
    sudo systemctl status \$SERVICE_NAME
    pause
}

function do_restart() {
    sudo systemctl restart \$SERVICE_NAME
    echo "Bot restarted."
    pause
}

function do_stop() {
    sudo systemctl stop \$SERVICE_NAME
    echo "Bot stopped."
    pause
}

# --- Main Menu Loop ---

while true; do
    clear
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "\${GREEN}      🚗 Iran Car Bot Manager 🚗      \${NC}"
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "1) \${GREEN}Install / Reinstall\${NC} (Fixes errors)"
    echo -e "2) \${YELLOW}Update Bot\${NC} (Git Pull & Restart)"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) \${BLUE}💾 Backup Data\${NC} (Export)"
    echo -e "8) \${BLUE}📥 Restore Data\${NC} (Import)"
    echo -e "9) \${RED}Uninstall Completely\${NC}"
    echo -e "0) Exit"
    echo -e "\${BLUE}========================================\${NC}"
    read -p "Select an option [0-9]: " choice

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
        *) echo -e "\${RED}Invalid option.\${NC}"; pause ;;
    esac
done
`;
};

// --- Python Bot Code Generator ---
export const generatePythonCode = (): string => {
  const dbJson = JSON.stringify(CAR_DB);

  return `
import logging
import json
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# ==========================================
# 🚗 Iran Car Bot - Python Backend
# ==========================================

# Configuration
TOKEN = 'REPLACE_ME_TOKEN'  # Will be replaced by bash script or manually
OWNER_ID = 0                # Will be replaced by bash script or manually

# Load Database
# In a real app, this might come from a file or DB. Here we inject the JSON structure.
CAR_DB_JSON = '''${dbJson}'''
CAR_DB = json.loads(CAR_DB_JSON)

# Constants
YEARS = [1404, 1403, 1402, 1401, 1400, 1399, 1398, 1397, 1396, 1395, 1394, 1393, 1392, 1391, 1390]
PAINT_CONDITIONS = [
  {"label": "بدون رنگ (سالم)", "drop": 0},
  {"label": "لیسه گیری / خط و خش جزئی", "drop": 0.02},
  {"label": "یک لکه رنگ (گلگیر/درب)", "drop": 0.04},
  {"label": "دو لکه رنگ", "drop": 0.07},
  {"label": "یک درب/گلگیر تعویض", "drop": 0.05},
  {"label": "دور رنگ", "drop": 0.25},
  {"label": "سقف و ستون رنگ", "drop": 0.40},
  {"label": "تمام رنگ", "drop": 0.35},
  {"label": "تعویض اتاق (قانونی)", "drop": 0.30}
]

# Logging Setup
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# State dictionary to track user progress (In-memory)
# { user_id: { "state": "STATE_NAME", "data": {} } }
user_states = {}

# State Constants
STATE_IDLE = "IDLE"
STATE_ESTIMATE_BRAND = "EST_BRAND"
STATE_ESTIMATE_MODEL = "EST_MODEL"
STATE_ESTIMATE_YEAR = "EST_YEAR"
STATE_ESTIMATE_MILEAGE = "EST_MILEAGE"
STATE_ESTIMATE_PAINT = "EST_PAINT"

# --- Helper Functions ---

def get_state(user_id):
    if user_id not in user_states:
        user_states[user_id] = {"state": STATE_IDLE, "data": {}}
    return user_states[user_id]

def set_state(user_id, state):
    if user_id not in user_states:
        user_states[user_id] = {"state": state, "data": {}}
    else:
        user_states[user_id]["state"] = state

def update_data(user_id, key, value):
    if user_id in user_states:
        user_states[user_id]["data"][key] = value

def reset_state(user_id):
    user_states[user_id] = {"state": STATE_IDLE, "data": {}}

# --- Keyboards ---

def get_main_menu(user_id):
    keyboard = [
        [
            InlineKeyboardButton("🧮 ماشین‌حساب (سایت)", web_app=WebAppInfo(url="https://www.hamrah-mechanic.com/carprice/")),
            InlineKeyboardButton("🌐 قیمت بازار (سایت)", web_app=WebAppInfo(url="https://www.iranjib.ir/showgroup/45/"))
        ],
        [
            InlineKeyboardButton("📋 لیست قیمت (ربات)", callback_data="menu_prices"),
            InlineKeyboardButton("💰 تخمین قیمت (ربات)", callback_data="menu_estimate")
        ],
        [
            InlineKeyboardButton("🔍 جستجو", callback_data="menu_search"),
            InlineKeyboardButton("📞 پشتیبانی", callback_data="menu_support")
        ]
    ]
    if str(user_id) == str(OWNER_ID):
        keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
    
    keyboard.append([InlineKeyboardButton("📢 کانال ما", url="https://t.me/CarPrice_Channel")])
    return InlineKeyboardMarkup(keyboard)

# --- Handlers ---

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    reset_state(user_id)
    await update.message.reply_text(
        f"👋 سلام! به جامع‌ترین ربات قیمت خودرو ایران خوش آمدید.\\n\\nمنوی اصلی:",
        reply_markup=get_main_menu(user_id)
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    
    await query.answer()
    
    # Navigation
    if data == "main_menu":
        reset_state(user_id)
        await query.edit_message_text(
            text="منوی اصلی:",
            reply_markup=get_main_menu(user_id)
        )
        return

    # Price List Flow
    if data == "menu_prices":
        keyboard = []
        for brand in CAR_DB.keys():
            keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 لطفا شرکت سازنده را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        
        # Check if we are in estimation mode
        current_state = get_state(user_id)["state"]
        if current_state == STATE_ESTIMATE_BRAND:
            update_data(user_id, "brand", brand_name)
            set_state(user_id, STATE_ESTIMATE_MODEL)
            
            # Show models for estimation
            keyboard = []
            if brand_name in CAR_DB:
                for model in CAR_DB[brand_name]["models"]:
                    keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
            await query.edit_message_text(f"خودروی {brand_name} را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
            return
        
        # Browsing mode
        if brand_name in CAR_DB:
            keyboard = []
            for model in CAR_DB[brand_name]["models"]:
                keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
            await query.edit_message_text(f"🚘 مدل‌های موجود برای {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("model_"):
        model_name = data.replace("model_", "")
        
        # Check estimation mode
        current_state = get_state(user_id)["state"]
        if current_state == STATE_ESTIMATE_MODEL:
            update_data(user_id, "model", model_name)
            set_state(user_id, STATE_ESTIMATE_YEAR)
            
            # Show years
            keyboard = []
            row = []
            for i, year in enumerate(YEARS):
                row.append(InlineKeyboardButton(str(year), callback_data=f"year_{year}"))
                if (i + 1) % 3 == 0:
                    keyboard.append(row)
                    row = []
            if row: keyboard.append(row)
            
            await query.edit_message_text("سال ساخت خودرو را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
            return

        # Browsing mode - Find model
        found_model = None
        brand_name = ""
        for b_name, b_data in CAR_DB.items():
            for m in b_data["models"]:
                if m["name"] == model_name:
                    found_model = m
                    brand_name = b_name
                    break
        
        if found_model:
            keyboard = []
            for idx, variant in enumerate(found_model["variants"]):
                keyboard.append([InlineKeyboardButton(variant["name"], callback_data=f"variant_{model_name}_{idx}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f"brand_{brand_name}")])
            await query.edit_message_text(f"لطفا تیپ خودروی {model_name} را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("variant_"):
        parts = data.split("_")
        model_name = parts[1]
        idx = int(parts[2])
        
        found_variant = None
        for b_data in CAR_DB.values():
            for m in b_data["models"]:
                if m["name"] == model_name:
                    if idx < len(m["variants"]):
                        found_variant = m["variants"][idx]
                        break
        
        if found_variant:
            market_price = found_variant["marketPrice"]
            factory_price = found_variant["factoryPrice"]
            floor_price = int(market_price * 0.985)
            
            text = (
                f"📊 **استعلام آنی قیمت**\\n"
                f"🚘 {found_variant['name']}\\n"
                f"-------------------\\n\\n"
                f"📉 **کف قیمت بازار (لحظه‌ای):**\\n💰 {floor_price:,} میلیون تومان\\n"
                f"_(پایین‌ترین قیمت معامله شده)_\\n\\n"
                f"🏭 **قیمت مصوب کارخانه:**\\n🏦 {factory_price:,} میلیون تومان\\n\\n"
                f"📡 _منبع: دیتابیس داخلی ربات_"
            )
            keyboard = [[InlineKeyboardButton("🔙 بازگشت به تیپ‌ها", callback_data=f"model_{model_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # Estimation Flow
    if data == "menu_estimate":
        set_state(user_id, STATE_ESTIMATE_BRAND)
        keyboard = []
        for brand in CAR_DB.keys():
            keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
        await query.edit_message_text("برای تخمین قیمت، ابتدا برند خودرو را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("year_"):
        year = int(data.replace("year_", ""))
        update_data(user_id, "year", year)
        set_state(user_id, STATE_ESTIMATE_MILEAGE)
        await query.edit_message_text("لطفا کارکرد خودرو (کیلومتر) را به صورت عدد وارد کنید:\\nمثال: 45000")
        return

    if data.startswith("paint_"):
        paint_idx = int(data.replace("paint_", ""))
        condition = PAINT_CONDITIONS[paint_idx]
        
        # Calculate
        user_data = get_state(user_id)["data"]
        brand = user_data.get("brand")
        model = user_data.get("model")
        year = user_data.get("year")
        mileage = user_data.get("mileage")
        
        # Find Zero Price
        zero_price = 800 # default
        for b in CAR_DB.values():
            for m in b["models"]:
                if m["name"] == model:
                    zero_price = m["variants"][0]["marketPrice"]
                    break
        
        # Logic
        current_year = 1404
        age = current_year - year
        
        age_drop = 0.0
        if age == 1: age_drop = 0.05
        elif age > 1: age_drop = 0.05 + ((age - 1) * 0.035)
        if age > 10: age_drop = 0.40
        
        standard_mileage = age * 20000
        diff = mileage - standard_mileage
        mileage_drop = 0.0
        
        if diff > 0:
            mileage_drop = (diff / 10000) * 0.01
            if mileage_drop > 0.15: mileage_drop = 0.15
        else:
            mileage_drop = (diff / 10000) * 0.005
            if mileage_drop < -0.05: mileage_drop = -0.05
            
        paint_drop = condition["drop"]
        total_drop = age_drop + mileage_drop + paint_drop
        calculated_price = zero_price * (1 - total_drop)
        final_price = round(calculated_price / 5) * 5
        
        result = (
           f"🎯 **کارشناسی قیمت هوشمند**\\n\\n"
           f"🚙 **{brand} {model}**\\n"
           f"💵 قیمت صفر روز: {zero_price:,} م\\n"
           f"-------------------------------\\n"
           f"📅 سال: {year} (افت مدل: {int(age_drop*100)}%)\\n"
           f"🛣 کارکرد: {mileage:,} (تاثیر: {int(mileage_drop*100)}%)\\n"
           f"🎨 بدنه: {condition['label']} (افت: {int(paint_drop*100)}%)\\n"
           f"-------------------------------\\n"
           f"📉 **قیمت کارشناسی شده:**\\n"
           f"💰 **{final_price:,} میلیون تومان**\\n\\n"
           f"_توجه: این قیمت تخمینی است._"
        )
        
        keyboard = [
            [InlineKeyboardButton("🏠 منوی اصلی", callback_data="main_menu")]
        ]
        
        await query.edit_message_text(result, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        reset_state(user_id)
        return

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = get_state(user_id)
    
    if text == "/id":
        await update.message.reply_text(f"🆔 شناسه کاربری شما: {user_id}")
        return

    if state_info["state"] == STATE_ESTIMATE_MILEAGE:
        try:
            mileage = int(text.replace(",", ""))
            update_data(user_id, "mileage", mileage)
            set_state(user_id, STATE_ESTIMATE_PAINT)
            
            # Show Paint Options
            keyboard = []
            for i in range(0, len(PAINT_CONDITIONS), 2):
                row = []
                row.append(InlineKeyboardButton(PAINT_CONDITIONS[i]["label"], callback_data=f"paint_{i}"))
                if i + 1 < len(PAINT_CONDITIONS):
                    row.append(InlineKeyboardButton(PAINT_CONDITIONS[i+1]["label"], callback_data=f"paint_{i+1}"))
                keyboard.append(row)
            
            await update.message.reply_text("وضعیت رنگ و بدنه خودرو را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
            
        except ValueError:
            await update.message.reply_text("⚠️ لطفا فقط عدد وارد کنید (مثال: 50000).")
        return

    # If no specific state, echo or ignore
    # await update.message.reply_text("لطفا از منو استفاده کنید.")

if __name__ == '__main__':
    if TOKEN == 'REPLACE_ME_TOKEN':
        print("⚠️ Please configure the bot token in bot.py")
        
    app = ApplicationBuilder().token(TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    
    print("Bot is running...")
    app.run_polling()
  `;
};
