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

function send_backup_to_telegram() {
    echo -e "\${BLUE}📤 Sending Backup to Telegram...\${NC}"
    
    if [ ! -f "\$INSTALL_DIR/bot.py" ]; then
         echo -e "\${RED}❌ bot.py not found.\${NC}"
         pause
         return
    fi

    BOT_TOKEN=\$(grep "TOKEN =" "\$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
    ADMIN_ID=\$(grep "OWNER_ID =" "\$INSTALL_DIR/bot.py" | sed 's/OWNER_ID =//' | sed 's/ //g' | cut -d '#' -f 1)
    
    if [[ -z "\$BOT_TOKEN" || -z "\$ADMIN_ID" || "\$BOT_TOKEN" == "REPLACE_ME_TOKEN" ]]; then
        echo -e "\${RED}❌ Bot credentials not configured.\${NC}"
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
    response=\$(curl -s -F chat_id="\$ADMIN_ID" -F document=@"\$DATA_FILE" -F caption="\$CAPTION" "https://api.telegram.org/bot\$BOT_TOKEN/sendDocument")
    
    if [[ "\$response" == *"\\"ok\\":true"* ]]; then
        echo -e "\${GREEN}✅ Backup sent to Telegram!\${NC}"
    else
        echo -e "\${RED}❌ Failed to send backup.\${NC}"
        echo "Response: \$response"
    fi
    pause
}

function configure_auto_backup() {
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
        
        # Ensure bot_data.json exists
        if [ ! -f "\$DATA_FILE" ]; then
            echo "{}" > "\$DATA_FILE"
        fi

        case \$interval_choice in
            1)
                # Use python to edit json safely
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=1; json.dump(d, open('\$DATA_FILE','w'))"
                echo -e "\${GREEN}✅ Set to Hourly. Restarting bot...\${NC}"
                sudo systemctl restart \$SERVICE_NAME
                pause
                return
                ;;
            2)
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=24; json.dump(d, open('\$DATA_FILE','w'))"
                echo -e "\${GREEN}✅ Set to Daily. Restarting bot...\${NC}"
                sudo systemctl restart \$SERVICE_NAME
                pause
                return
                ;;
            3)
                python3 -c "import json; d=json.load(open('\$DATA_FILE')); d['backup_interval']=0; json.dump(d, open('\$DATA_FILE','w'))"
                echo -e "\${YELLOW}🚫 Auto-Backup Disabled. Restarting bot...\${NC}"
                sudo systemctl restart \$SERVICE_NAME
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
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "\${GREEN}      💾 Backup Management      \${NC}"
        echo -e "\${BLUE}========================================\${NC}"
        echo -e "1) \${GREEN}Local Backup\${NC} (Save to \$HOME/carbot_backups)"
        echo -e "2) \${YELLOW}Send to Telegram\${NC} (Send file to Admin)"
        echo -e "3) \${BLUE}Auto-Backup Settings\${NC} (Hourly/Daily)"
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
                else
                     echo -e "\${RED}No data file found.\${NC}"
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
                echo -e "\${RED}Invalid option.\${NC}"
                pause
                ;;
        esac
    done
}

function do_restore() {
    echo -e "\${BLUE}📥 Restore Data (Import)\${NC}"
    echo -e "\${YELLOW}⚠️  This will OVERWRITE the current database!\${NC}"
    read -p "Enter path to backup file: " BACKUP_PATH
    
    if [ ! -f "\$BACKUP_PATH" ]; then
        echo -e "\${RED}❌ File not found.\${NC}"
        pause
        return
    fi
    
    read -p "Are you sure? (y/n): " confirm
    if [[ "\$confirm" == "y" ]]; then
        sudo systemctl stop \$SERVICE_NAME
        cp "\$BACKUP_PATH" "\$INSTALL_DIR/bot_data.json"
        sudo systemctl start \$SERVICE_NAME
        echo -e "\${GREEN}✅ Restored successfully.\${NC}"
    fi
    pause
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
    echo -e "\${BLUE}🔄 Updating Bot...\${NC}"
    if [ ! -d "\$INSTALL_DIR" ]; then
        echo -e "\${RED}Not installed.\${NC}"
        pause; return
    fi
    
    cd "\$INSTALL_DIR"
    git pull
    
    if [ -f "install.sh" ]; then
        cp "install.sh" "manager.sh"
        chmod +x "manager.sh"
        echo -e "\${GREEN}✅ Menu script updated.\${NC}"
    fi
    
    sudo systemctl restart \$SERVICE_NAME
    echo -e "\${GREEN}✅ Updated & Restarted.\${NC}"
    pause
}

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

function do_logs() {
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
    echo -e "1) \${GREEN}Install / Reinstall\${NC}"
    echo -e "2) \${YELLOW}Update Bot\${NC}"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) \${BLUE}💾 Backup Data\${NC}"
    echo -e "8) \${BLUE}📥 Restore Data\${NC}"
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

// --- Python Bot Code Generator ---
export const generatePythonCode = (): string => {
  const dbJson = JSON.stringify(CAR_DB);

  return `
import logging
import json
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# Configuration
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
DATA_FILE = 'bot_data.json'

# Load Database
CAR_DB_JSON = '''${dbJson}'''
CAR_DB = json.loads(CAR_DB_JSON)
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

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

user_states = {}
STATE_IDLE = "IDLE"
STATE_ESTIMATE_BRAND = "EST_BRAND"
STATE_ESTIMATE_MODEL = "EST_MODEL"
STATE_ESTIMATE_YEAR = "EST_YEAR"
STATE_ESTIMATE_MILEAGE = "EST_MILEAGE"
STATE_ESTIMATE_PAINT = "EST_PAINT"

# --- Backup Logic ---
def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        except: pass
    return {"backup_interval": 0}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

async def send_auto_backup(context: ContextTypes.DEFAULT_TYPE):
    if os.path.exists(DATA_FILE) and OWNER_ID != 0:
        try:
            await context.bot.send_document(
                chat_id=OWNER_ID,
                document=open(DATA_FILE, 'rb'),
                caption="💾 Auto-Backup"
            )
        except Exception as e:
            logger.error(f"Backup failed: {e}")

# --- Helper Functions ---
def get_state(user_id):
    if user_id not in user_states: user_states[user_id] = {"state": STATE_IDLE, "data": {}}
    return user_states[user_id]
def set_state(user_id, state):
    if user_id not in user_states: user_states[user_id] = {"state": state, "data": {}}
    else: user_states[user_id]["state"] = state
def update_data(user_id, key, value):
    if user_id in user_states: user_states[user_id]["data"][key] = value
def reset_state(user_id):
    user_states[user_id] = {"state": STATE_IDLE, "data": {}}

# --- Keyboards ---
def get_main_menu(user_id):
    keyboard = [
        [InlineKeyboardButton("🧮 ماشین‌حساب (سایت)", web_app=WebAppInfo(url="https://www.hamrah-mechanic.com/carprice/")), InlineKeyboardButton("🌐 قیمت بازار (سایت)", web_app=WebAppInfo(url="https://www.iranjib.ir/showgroup/45/"))],
        [InlineKeyboardButton("📋 لیست قیمت (ربات)", callback_data="menu_prices"), InlineKeyboardButton("💰 تخمین قیمت (ربات)", callback_data="menu_estimate")],
        [InlineKeyboardButton("🔍 جستجو", callback_data="menu_search"), InlineKeyboardButton("📞 پشتیبانی", callback_data="menu_support")]
    ]
    if str(user_id) == str(OWNER_ID): keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
    keyboard.append([InlineKeyboardButton("📢 کانال ما", url="https://t.me/CarPrice_Channel")])
    return InlineKeyboardMarkup(keyboard)

# --- Handlers ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    reset_state(user_id)
    await update.message.reply_text(f"👋 سلام! منوی اصلی:", reply_markup=get_main_menu(user_id))

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    await query.answer()
    
    if data == "main_menu":
        reset_state(user_id)
        await query.edit_message_text(text="منوی اصلی:", reply_markup=get_main_menu(user_id))
        return
    
    # --- ADMIN HOME ---
    if data == "admin_home" and str(user_id) == str(OWNER_ID):
        keyboard = [
            [InlineKeyboardButton("💾 مدیریت بکاپ و دیتابیس", callback_data="admin_backup_menu")],
            [InlineKeyboardButton("🔙 خروج", callback_data="main_menu")]
        ]
        await query.edit_message_text("🛠 پنل مدیریت:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # --- BACKUP MENU ---
    if data == "admin_backup_menu" and str(user_id) == str(OWNER_ID):
        d = load_data()
        interval = d.get("backup_interval", 0)
        status = "❌ خاموش" if interval == 0 else (f"✅ هر {interval} ساعت")
        
        keyboard = [
            [InlineKeyboardButton("📥 دریافت بکاپ (همین الان)", callback_data="backup_get_now")],
            [InlineKeyboardButton("⏱ تنظیم ساعتی (1h)", callback_data="backup_set_1h"), InlineKeyboardButton("📅 تنظیم روزانه (24h)", callback_data="backup_set_24h")],
            [InlineKeyboardButton("🚫 خاموش کردن بکاپ", callback_data="backup_off")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(f"💾 **مدیریت بکاپ**\\n\\nوضعیت فعلی: {status}", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "backup_get_now":
        if os.path.exists(DATA_FILE):
             await context.bot.send_document(chat_id=user_id, document=open(DATA_FILE, 'rb'), caption="💾 Manual Backup")
        else:
             await query.message.reply_text("❌ فایلی وجود ندارد.")
        return

    if data.startswith("backup_set_") or data == "backup_off":
        new_interval = 0
        if data == "backup_set_1h": new_interval = 1
        elif data == "backup_set_24h": new_interval = 24
        
        d = load_data()
        d['backup_interval'] = new_interval
        save_data(d)
        
        # Reschedule Jobs
        current_jobs = context.job_queue.get_jobs_by_name('auto_backup')
        for job in current_jobs: job.schedule_removal()
        
        if new_interval > 0:
            context.job_queue.run_repeating(send_auto_backup, interval=new_interval*3600, first=10, name='auto_backup')
            await query.edit_message_text(f"✅ بکاپ خودکار روی هر {new_interval} ساعت تنظیم شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data="admin_backup_menu")]]))
        else:
            await query.edit_message_text("🚫 بکاپ خودکار غیرفعال شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data="admin_backup_menu")]]))
        return

    # --- STANDARD FLOW ---

    if data == "menu_prices":
        keyboard = []
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 شرکت سازنده:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        current_state = get_state(user_id)["state"]
        if current_state == STATE_ESTIMATE_BRAND:
            update_data(user_id, "brand", brand_name)
            set_state(user_id, STATE_ESTIMATE_MODEL)
            keyboard = []
            if brand_name in CAR_DB:
                for model in CAR_DB[brand_name]["models"]: keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
            await query.edit_message_text(f"خودروی {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
            return
        
        if brand_name in CAR_DB:
            keyboard = []
            for model in CAR_DB[brand_name]["models"]: keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
            await query.edit_message_text(f"مدل‌های {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("model_"):
        model_name = data.replace("model_", "")
        current_state = get_state(user_id)["state"]
        if current_state == STATE_ESTIMATE_MODEL:
            update_data(user_id, "model", model_name)
            set_state(user_id, STATE_ESTIMATE_YEAR)
            keyboard = []
            row = []
            for i, year in enumerate(YEARS):
                row.append(InlineKeyboardButton(str(year), callback_data=f"year_{year}"))
                if (i + 1) % 3 == 0: keyboard.append(row); row = []
            if row: keyboard.append(row)
            await query.edit_message_text("سال ساخت:", reply_markup=InlineKeyboardMarkup(keyboard))
            return

        found_model, brand_name = None, ""
        for b_name, b_data in CAR_DB.items():
            for m in b_data["models"]:
                if m["name"] == model_name: found_model = m; brand_name = b_name; break
        
        if found_model:
            keyboard = []
            for idx, variant in enumerate(found_model["variants"]):
                keyboard.append([InlineKeyboardButton(variant["name"], callback_data=f"variant_{model_name}_{idx}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f"brand_{brand_name}")])
            await query.edit_message_text(f"تیپ خودرو {model_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("variant_"):
        parts = data.split("_")
        model_name, idx = parts[1], int(parts[2])
        found_variant = None
        for b_data in CAR_DB.values():
            for m in b_data["models"]:
                if m["name"] == model_name and idx < len(m["variants"]): found_variant = m["variants"][idx]; break
        
        if found_variant:
            floor = int(found_variant["marketPrice"] * 0.985)
            text = (f"📊 **استعلام قیمت**\\n🚘 {found_variant['name']}\\n-------------------\\n📉 **کف قیمت بازار:**\\n💰 {floor:,} م ت\\n🏭 **کارخانه:**\\n🏦 {found_variant['factoryPrice']:,} م ت")
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"model_{model_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_estimate":
        set_state(user_id, STATE_ESTIMATE_BRAND)
        keyboard = []
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
        await query.edit_message_text("برند را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("year_"):
        year = int(data.replace("year_", ""))
        update_data(user_id, "year", year)
        set_state(user_id, STATE_ESTIMATE_MILEAGE)
        await query.edit_message_text("کارکرد (کیلومتر) را وارد کنید (فقط عدد):")
        return

    if data.startswith("paint_"):
        paint_idx = int(data.replace("paint_", ""))
        condition = PAINT_CONDITIONS[paint_idx]
        user_data = get_state(user_id)["data"]
        brand, model, year, mileage = user_data.get("brand"), user_data.get("model"), user_data.get("year"), user_data.get("mileage")
        
        zero_price = 800
        for b in CAR_DB.values():
            for m in b["models"]:
                if m["name"] == model: zero_price = m["variants"][0]["marketPrice"]; break
        
        age = 1404 - year
        age_drop = 0.05 if age == 1 else (0.05 + ((age - 1) * 0.035) if age > 1 else 0)
        if age > 10: age_drop = 0.40
        
        diff = mileage - (age * 20000)
        mileage_drop = (diff / 10000) * 0.01 if diff > 0 else (diff / 10000) * 0.005
        mileage_drop = max(min(mileage_drop, 0.15), -0.05)
            
        total_drop = age_drop + mileage_drop + condition["drop"]
        final_price = round((zero_price * (1 - total_drop)) / 5) * 5
        
        result = (f"🎯 **کارشناسی قیمت**\\n🚙 **{brand} {model}**\\n-----------------\\n📅 سال: {year} | 🛣 کارکرد: {mileage:,}\\n🎨 بدنه: {condition['label']}\\n-----------------\\n💰 **قیمت تقریبی: {final_price:,} میلیون تومان**")
        keyboard = [[InlineKeyboardButton("🏠 منوی اصلی", callback_data="main_menu")]]
        await query.edit_message_text(result, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        reset_state(user_id)
        return

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = get_state(user_id)
    
    if text == "/id":
        await update.message.reply_text(f"🆔 {user_id}")
        return

    if state_info["state"] == STATE_ESTIMATE_MILEAGE:
        try:
            mileage = int(text.replace(",", ""))
            update_data(user_id, "mileage", mileage)
            set_state(user_id, STATE_ESTIMATE_PAINT)
            keyboard = []
            for i in range(0, len(PAINT_CONDITIONS), 2):
                row = [InlineKeyboardButton(PAINT_CONDITIONS[i]["label"], callback_data=f"paint_{i}")]
                if i + 1 < len(PAINT_CONDITIONS): row.append(InlineKeyboardButton(PAINT_CONDITIONS[i+1]["label"], callback_data=f"paint_{i+1}"))
                keyboard.append(row)
            await update.message.reply_text("وضعیت بدنه:", reply_markup=InlineKeyboardMarkup(keyboard))
        except: await update.message.reply_text("⚠️ فقط عدد وارد کنید.")
        return

# --- Startup Logic ---
async def post_init(application):
    # Auto-Backup Setup
    data = load_data()
    interval = data.get("backup_interval", 0)
    if interval > 0:
        application.job_queue.run_repeating(send_auto_backup, interval=interval*3600, first=60, name='auto_backup')
    
    # Force Menu Refresh
    try:
        await application.bot.delete_my_commands()
        await application.bot.set_my_commands([
            BotCommand("start", "🏠 منوی اصلی"),
            BotCommand("id", "🆔 دریافت شناسه عددی"),
            BotCommand("admin", "👑 پنل مدیریت (مخصوص ادمین)")
        ])
        # Explicitly set the menu button to commands
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
        logger.info("Bot commands updated successfully.")
    except Exception as e:
        logger.error(f"Failed to set commands: {e}")

if __name__ == '__main__':
    if TOKEN == 'REPLACE_ME_TOKEN': print("⚠️ Configure token in bot.py")
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    print("Bot is running...")
    app.run_polling()
  `;
};