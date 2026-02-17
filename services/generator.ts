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
    sudo apt-get install -y python3 python3-pip python3-venv git
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
    
    echo "2. Restarting Service..."
    check_root
    sudo systemctl restart \$SERVICE_NAME
    
    echo -e "\${GREEN}✅ Update Complete.\${NC}"
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
    echo -e "7) \${RED}Uninstall Completely\${NC}"
    echo -e "8) Exit"
    echo -e "\${BLUE}========================================\${NC}"
    read -p "Select an option [1-8]: " choice

    case \$choice in
        1) do_install ;;
        2) do_update ;;
        3) do_logs ;;
        4) do_status ;;
        5) do_restart ;;
        6) do_stop ;;
        7) do_uninstall ;;
        8) exit 0 ;;
        *) echo -e "\${RED}Invalid option.\${NC}"; pause ;;
    esac
done
`;
};

// --- Python Code Generator ---
export const generatePythonCode = (): string => {
  const pythonCarDb = JSON.stringify(CAR_DB, null, 4)
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .replace(/null/g, 'None');

  return `import logging
import json
import os
import random
import jdatetime
import pandas as pd
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ConversationHandler

# Configuration
TOKEN = 'REPLACE_ME_TOKEN'
OWNER_ID = 0  # REPLACE_ME_ADMIN_ID
DATA_FILE = 'bot_data.json'
EXCEL_FILE = 'prices.xlsx'
CHANNEL_URL = 'https://t.me/CarPrice_Channel' 

# Logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# States
(SELECT_BRAND, SELECT_MODEL, SELECT_VARIANT, 
 EST_BRAND, EST_MODEL, EST_YEAR, EST_MILEAGE, EST_PAINT,
 ADMIN_MENU, DOWNLOAD_TEMPLATE, UPLOAD_EXCEL, ADD_BRAND, ADD_MODEL, ADD_VARIANT, ADD_PRICE, 
 SET_SPONSOR_NAME, SET_SPONSOR_URL, 
 BROADCAST_MENU, BROADCAST_GET_TIME, BROADCAST_GET_CONTENT, 
 MANAGE_ADMINS, ADD_NEW_ADMIN, 
 SUPPORT_GET_MSG,
 BACKUP_MENU, SET_BACKUP_INTERVAL, RESTORE_BACKUP) = range(26)

# --- DEPRECIATION CONSTANTS ---
PAINT_CONDITIONS = [
  {"label": "بدون رنگ", "drop": 0},
  {"label": "خط و خش جزئی", "drop": 0.02},
  {"label": "یک لکه رنگ", "drop": 0.04},
  {"label": "دو لکه رنگ", "drop": 0.07},
  {"label": "یک درب/گلگیر تعویض", "drop": 0.05},
  {"label": "دور رنگ", "drop": 0.25},
  {"label": "سقف و ستون", "drop": 0.40},
  {"label": "تمام رنگ", "drop": 0.35},
  {"label": "تعویض اتاق", "drop": 0.30}
]

# --- DEFAULT DATA (INJECTED) ---
DEFAULT_CARS = ${pythonCarDb}

# --- Data Management ---
def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not data.get('cars'):
                    data['cars'] = DEFAULT_CARS
                return data
        except: pass
    return {
        "cars": DEFAULT_CARS, 
        "sponsor": {}, 
        "users": {}, 
        "last_update": "پیش‌فرض", 
        "admins": [],
        "backup_interval": 0 # hours, 0 means off
    }

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_db():
    return load_data().get("cars", {})

def get_last_update():
    return load_data().get("last_update", "نامشخص")

def is_admin(user_id):
    if str(user_id) == str(OWNER_ID):
        return True
    data = load_data()
    return user_id in data.get("admins", [])

def add_admin(new_admin_id):
    data = load_data()
    if "admins" not in data: data["admins"] = []
    if new_admin_id not in data["admins"] and str(new_admin_id) != str(OWNER_ID):
        data["admins"].append(new_admin_id)
        save_data(data)
        return True
    return False

def get_all_admins():
    data = load_data()
    admins = data.get("admins", [])
    if OWNER_ID != 0:
        admins.append(OWNER_ID)
    return list(set(admins))

def log_user(user_id):
    data = load_data()
    uid_str = str(user_id)
    if 'users' not in data or isinstance(data['users'], list):
        old_list = data.get('users', [])
        data['users'] = {str(u): str(datetime.now()) for u in old_list}
    data['users'][uid_str] = str(datetime.now())
    save_data(data)

# --- Helper: Footer ---
def attach_footer(keyboard):
    data = load_data()
    sponsor = data.get("sponsor", {})
    footer_row = [InlineKeyboardButton("📢 کانال ما", url=CHANNEL_URL)]
    if sponsor.get("name") and sponsor.get("url"):
        footer_row.append(InlineKeyboardButton(f"⭐ {sponsor['name']}", url=sponsor['url']))
    keyboard.append(footer_row)
    return keyboard

# --- Auto Backup Logic ---
async def send_auto_backup(context: ContextTypes.DEFAULT_TYPE):
    if os.path.exists(DATA_FILE):
        try:
            await context.bot.send_document(
                chat_id=OWNER_ID,
                document=open(DATA_FILE, 'rb'),
                caption="💾 **بکاپ خودکار دیتابیس**"
            )
        except Exception as e:
            logging.error(f"Backup failed: {e}")

# --- Admin Handlers ---
async def admin_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = update.effective_user.id
    
    if not is_admin(user_id):
        if query: await query.answer("⛔ شما دسترسی ادمین ندارید.", show_alert=True)
        else: await update.message.reply_text("⛔ شما دسترسی ادمین ندارید.")
        return ConversationHandler.END
    
    if query: await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("👥 مدیریت ادمین‌ها", callback_data='adm_manage_admins')],
        [InlineKeyboardButton("📂 آپدیت قیمت (اکسل)", callback_data='adm_excel')],
        [InlineKeyboardButton("➕ افزودن تکی خودرو", callback_data='adm_add_single')],
        [InlineKeyboardButton("⭐ تنظیم اسپانسر", callback_data='adm_sponsor')],
        [InlineKeyboardButton("📣 ارسال همگانی پیشرفته", callback_data='adm_broadcast')],
        [InlineKeyboardButton("💾 مدیریت بکاپ (Backup)", callback_data='adm_backup')],
        [InlineKeyboardButton("🔙 خروج", callback_data='main_menu')]
    ]
    
    text = "🛠 **پنل مدیریت**\\nگزینه مورد نظر را انتخاب کنید:"
    if query:
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    else:
        await update.message.reply_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        
    return ADMIN_MENU

async def adm_menu_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    choice = query.data
    
    if choice == 'adm_manage_admins':
        keyboard = [
            [InlineKeyboardButton("➕ افزودن ادمین", callback_data='add_admin')],
            [InlineKeyboardButton("📜 لیست ادمین‌ها", callback_data='list_admins')],
            [InlineKeyboardButton("🔙 بازگشت", callback_data='admin_home')]
        ]
        await query.edit_message_text("👥 بخش مدیریت دسترسی‌ها:", reply_markup=InlineKeyboardMarkup(keyboard))
        return MANAGE_ADMINS
        
    elif choice == 'adm_excel':
        # (Existing Excel Logic)
        data = load_data()
        rows = []
        cars = data.get("cars", {})
        for brand, b_data in cars.items():
            for model in b_data['models']:
                for variant in model['variants']:
                    rows.append({
                        "Brand": brand,
                        "Model": model['name'],
                        "Variant": variant['name'],
                        "MarketPrice": variant['marketPrice'],
                        "FactoryPrice": variant['factoryPrice']
                    })
        if not rows:
             rows.append({"Brand": "Example Brand", "Model": "Model X", "Variant": "Automatic", "MarketPrice": 1000, "FactoryPrice": 500})
        df = pd.DataFrame(rows)
        df.to_excel(EXCEL_FILE, index=False)
        await query.message.reply_document(
            document=open(EXCEL_FILE, 'rb'), 
            caption="📂 **فایل قیمت‌های فعلی**\\n\\n1. دانلود و ویرایش کنید.\\n2. **فایل ویرایش شده را همینجا ارسال کنید.**"
        )
        return UPLOAD_EXCEL

    elif choice == 'adm_backup':
        data = load_data()
        interval = data.get("backup_interval", 0)
        status = f"✅ فعال (هر {interval} ساعت)" if interval > 0 else "❌ غیرفعال"
        
        keyboard = [
            [InlineKeyboardButton("📥 دریافت بکاپ آنی", callback_data='get_backup_now')],
            [InlineKeyboardButton("⏱ تنظیم بکاپ خودکار", callback_data='set_backup_auto')],
            [InlineKeyboardButton("📤 بازگردانی بکاپ (Restore)", callback_data='restore_backup')],
            [InlineKeyboardButton("🔙 بازگشت", callback_data='admin_home')]
        ]
        await query.edit_message_text(f"💾 **مدیریت بکاپ و دیتابیس**\\n\\nوضعیت بکاپ خودکار: {status}", reply_markup=InlineKeyboardMarkup(keyboard))
        return BACKUP_MENU

    elif choice == 'adm_add_single':
        await query.edit_message_text("نام کمپانی (برند) را وارد کنید:")
        return ADD_BRAND
    elif choice == 'adm_sponsor':
        await query.edit_message_text("نام اسپانسر را وارد کنید:")
        return SET_SPONSOR_NAME
    elif choice == 'adm_broadcast':
        keyboard = [
            [InlineKeyboardButton("👥 ارسال به همه", callback_data='bcast_all')],
            [InlineKeyboardButton("🔥 کاربران فعال (۳۰ روز اخیر)", callback_data='bcast_active')],
            [InlineKeyboardButton("⏳ زمان‌بندی شده", callback_data='bcast_schedule')],
            [InlineKeyboardButton("🔙 بازگشت", callback_data='admin_home')]
        ]
        await query.edit_message_text("📢 **نوع ارسال را انتخاب کنید:**", reply_markup=InlineKeyboardMarkup(keyboard))
        return BROADCAST_MENU
    elif choice == 'main_menu':
        await start(update, context)
        return ConversationHandler.END
    elif choice == 'admin_home':
        await admin_start(update, context)
        return ADMIN_MENU

# --- Backup Handler Logic ---
async def backup_menu_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    choice = query.data

    if choice == 'get_backup_now':
        if os.path.exists(DATA_FILE):
             await query.message.reply_document(document=open(DATA_FILE, 'rb'), caption="💾 فایل دیتابیس (bot_data.json)")
        else:
             await query.edit_message_text("❌ فایلی وجود ندارد.")
        return BACKUP_MENU
    
    elif choice == 'set_backup_auto':
        await query.edit_message_text("⏱ لطفا فاصله زمانی بکاپ خودکار را **به ساعت** وارد کنید:\\n(برای غیرفعال کردن عدد 0 را بفرستید)\\n\\nمثال: 12 (یعنی هر ۱۲ ساعت)")
        return SET_BACKUP_INTERVAL

    elif choice == 'restore_backup':
        await query.edit_message_text("📤 لطفا فایل **bot_data.json** خود را ارسال کنید تا جایگزین دیتابیس فعلی شود.\\n\\n⚠️ هشدار: تمام اطلاعات فعلی پاک خواهد شد.")
        return RESTORE_BACKUP
    
    elif choice == 'admin_home':
        await admin_start(update, context)
        return ADMIN_MENU

async def set_backup_interval_exec(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if not text.isdigit():
        await update.message.reply_text("❌ لطفا عدد وارد کنید.")
        return SET_BACKUP_INTERVAL
    
    hours = int(text)
    data = load_data()
    data['backup_interval'] = hours
    save_data(data)
    
    # Update Job Queue
    current_jobs = context.job_queue.get_jobs_by_name('auto_backup')
    for job in current_jobs: job.schedule_removal()
    
    if hours > 0:
        context.job_queue.run_repeating(send_auto_backup, interval=hours*3600, first=10, name='auto_backup')
        await update.message.reply_text(f"✅ بکاپ خودکار روی هر {hours} ساعت تنظیم شد.")
    else:
        await update.message.reply_text("✅ بکاپ خودکار غیرفعال شد.")
        
    return BACKUP_MENU

async def restore_backup_exec(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.document:
        await update.message.reply_text("❌ لطفا فایل ارسال کنید.")
        return RESTORE_BACKUP
        
    f_name = update.message.document.file_name
    if not f_name.endswith('.json'):
        await update.message.reply_text("❌ فرمت فایل باید .json باشد.")
        return RESTORE_BACKUP
        
    new_file = await update.message.document.get_file()
    await new_file.download_to_drive(DATA_FILE)
    
    # Reload data to ensure validity
    try:
        data = load_data()
        await update.message.reply_text("✅ بکاپ با موفقیت بازگردانی شد! ربات با اطلاعات جدید کار می‌کند.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='admin_home')]]))
        
        # Reschedule backup if needed
        interval = data.get("backup_interval", 0)
        current_jobs = context.job_queue.get_jobs_by_name('auto_backup')
        for job in current_jobs: job.schedule_removal()
        if interval > 0:
            context.job_queue.run_repeating(send_auto_backup, interval=interval*3600, first=10, name='auto_backup')
            
    except:
        await update.message.reply_text("❌ فایل خراب است یا ساختار معتبری ندارد.")
        
    return ConversationHandler.END

# --- Admin Management Logic (Existing) ---
async def manage_admins_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    choice = query.data
    
    if choice == 'add_admin':
        await query.edit_message_text("🔢 لطفا **شناسه عددی (Numeric ID)** کاربر جدید را ارسال کنید:\\n\\n(کاربر می‌تواند با ارسال دستور /id شناسه خود را دریافت کند)")
        return ADD_NEW_ADMIN
    
    elif choice == 'list_admins':
        data = load_data()
        admins = data.get("admins", [])
        msg = f"👑 **Owner:** {OWNER_ID}\\n\\n👮 **Admins:**\\n"
        if not admins:
            msg += "هیچ ادمین دیگری تعریف نشده است."
        else:
            for a in admins:
                msg += f"- {a}\\n"
        
        keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data='admin_home')]]
        await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return ADMIN_MENU
        
    elif choice == 'admin_home':
        await admin_start(update, context)
        return ADMIN_MENU

async def add_new_admin_exec(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if not text.isdigit():
        await update.message.reply_text("❌ خطا: شناسه باید عدد باشد.")
        return ADD_NEW_ADMIN
    
    new_id = int(text)
    if add_admin(new_id):
        await update.message.reply_text(f"✅ کاربر {new_id} به لیست ادمین‌ها اضافه شد.", 
                                        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='admin_home')]]))
    else:
        await update.message.reply_text("⚠️ این کاربر قبلا اضافه شده است.",
                                        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='admin_home')]]))
    return ADMIN_MENU

# --- Broadcast Logic (Existing) ---
async def adm_broadcast_menu_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    choice = query.data
    
    if choice == 'admin_home':
        return await admin_start(update, context)

    context.user_data['bcast_type'] = choice
    if choice == 'bcast_schedule':
        await query.edit_message_text("🕒 **زمان ارسال** را وارد کنید:\\nفرمت: YYYY/MM/DD HH:MM")
        return BROADCAST_GET_TIME
    
    await query.edit_message_text("✍️ **متن پیام** خود را بنویسید:")
    return BROADCAST_GET_CONTENT

async def adm_broadcast_get_time(update: Update, context: ContextTypes.DEFAULT_TYPE):
    time_str = update.message.text
    context.user_data['bcast_time_str'] = time_str
    await update.message.reply_text(f"✅ زمان ثبت شد: {time_str}\\n\\n✍️ حالا **متن پیام** را بنویسید:")
    return BROADCAST_GET_CONTENT

async def scheduled_broadcast_job(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    message_text = job.data.get('text')
    data = load_data()
    users = data.get('users', {})
    for uid in users.keys():
        try:
            await context.bot.send_message(chat_id=int(uid), text=f"🔔 {message_text}", parse_mode='Markdown')
        except: pass

async def adm_broadcast_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg_text = update.message.text
    bcast_type = context.user_data.get('bcast_type')
    data = load_data()
    users_dict = data.get('users', {})
    targets = []

    if bcast_type == 'bcast_all':
        targets = list(users_dict.keys())
    elif bcast_type == 'bcast_active':
        now = datetime.now()
        for uid, last_active_str in users_dict.items():
            try:
                last_active = datetime.fromisoformat(last_active_str)
                if (now - last_active).days <= 30:
                    targets.append(uid)
            except: targets.append(uid)
                
    elif bcast_type == 'bcast_schedule':
        context.job_queue.run_once(scheduled_broadcast_job, 60, data={'text': msg_text})
        await update.message.reply_text(f"✅ پیام زمان‌بندی شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='main_menu')]]))
        return ConversationHandler.END

    count = 0
    for uid in targets:
        try:
            await context.bot.send_message(chat_id=int(uid), text=f"📢 {msg_text}", parse_mode='Markdown')
            count += 1
        except: pass
        
    await update.message.reply_text(f"✅ ارسال شد به {count} نفر.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='main_menu')]]))
    return ConversationHandler.END

# --- Support System (Existing) ---
async def start_support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("📞 **تماس با پشتیبانی**\\n\\nلطفا پیام، انتقاد یا سوال خود را بنویسید.\\nما آن را بررسی خواهیم کرد.", 
                                  reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='main_menu')]]))
    return SUPPORT_GET_MSG

async def handle_support_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_msg = update.message.text
    user = update.effective_user
    
    admins = get_all_admins()
    admin_text = f"📩 **پیام جدید پشتیبانی**\\n👤 کاربر: {user.first_name} (ID: {user.id})\\n\\n📝 متن:\\n{user_msg}"
    
    for admin_id in admins:
        try:
            await context.bot.send_message(chat_id=int(admin_id), text=admin_text)
        except: pass
        
    await update.message.reply_text("✅ پیام شما دریافت شد. با تشکر!", 
                                    reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("خانه", callback_data='main_menu')]]))
    return ConversationHandler.END

# --- Standard Handlers (Existing) ---
async def adm_handle_excel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.document: return UPLOAD_EXCEL
    file = await update.message.document.get_file()
    await file.download_to_drive(EXCEL_FILE)
    try:
        df = pd.read_excel(EXCEL_FILE)
        new_db = {}
        for _, row in df.iterrows():
            brand = str(row['Brand']).strip()
            model = str(row['Model']).strip()
            variant = str(row['Variant']).strip()
            m_price = int(row['MarketPrice'])
            f_price = int(row['FactoryPrice'])
            if brand not in new_db: new_db[brand] = {"name": brand, "models": []}
            model_obj = next((m for m in new_db[brand]['models'] if m['name'] == model), None)
            if not model_obj:
                model_obj = {"name": model, "variants": []}
                new_db[brand]['models'].append(model_obj)
            model_obj['variants'].append({"name": variant, "marketPrice": m_price, "factoryPrice": f_price})
        data = load_data()
        data['cars'] = new_db
        data['last_update'] = jdatetime.datetime.now().strftime("%Y/%m/%d %H:%M")
        save_data(data)
        await update.message.reply_text("✅ دیتابیس آپدیت شد!", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data='main_menu')]]))
    except: await update.message.reply_text("خطا در فایل.")
    return ConversationHandler.END
    
async def add_car_brand(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_brand'] = update.message.text
    await update.message.reply_text("مدل:")
    return ADD_MODEL
async def add_car_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_model'] = update.message.text
    await update.message.reply_text("تیپ:")
    return ADD_VARIANT
async def add_car_variant(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['new_variant'] = update.message.text
    await update.message.reply_text("قیمت:")
    return ADD_PRICE
async def add_car_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("✅ ثبت شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازشت", callback_data='main_menu')]]))
    return ConversationHandler.END

# --- Estimator Handlers (Existing) ---
async def start_estimate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    cars_db = get_db()
    keyboard = [[InlineKeyboardButton(b, callback_data=f'est_brand_{b}')] for b in cars_db.keys()]
    keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data='main_menu')])
    await query.edit_message_text("برند:", reply_markup=InlineKeyboardMarkup(keyboard))
    return EST_BRAND

async def est_select_brand(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    brand = query.data.replace('est_brand_', '')
    context.user_data['est_brand'] = brand
    cars_db = get_db()
    models = [m['name'] for m in cars_db[brand]['models']]
    keyboard = [[InlineKeyboardButton(m, callback_data=f'est_model_{m}')] for m in models]
    await query.edit_message_text(f"مدل {brand}:", reply_markup=InlineKeyboardMarkup(keyboard))
    return EST_MODEL
async def est_select_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data['est_model'] = query.data.replace('est_model_', '')
    keyboard = []
    years = list(range(1390, 1405)); years.reverse()
    for i in range(0, len(years), 3):
        row = [InlineKeyboardButton(str(y), callback_data=f'est_year_{y}') for y in years[i:i+3]]
        keyboard.append(row)
    await query.edit_message_text("سال:", reply_markup=InlineKeyboardMarkup(keyboard))
    return EST_YEAR
async def est_select_year(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data['est_year'] = int(query.data.replace('est_year_', ''))
    await query.edit_message_text("کارکرد:")
    return EST_MILEAGE
async def est_get_mileage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['est_mileage'] = int(update.message.text)
    keyboard = []
    for i, p in enumerate(PAINT_CONDITIONS): keyboard.append([InlineKeyboardButton(p['label'], callback_data=f'est_paint_{i}')])
    await update.message.reply_text("وضعیت بدنه:", reply_markup=InlineKeyboardMarkup(keyboard))
    return EST_PAINT
async def est_calculate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = context.user_data
    brand = data.get('est_brand')
    model = data.get('est_model')
    year = data.get('est_year')
    mileage = data.get('est_mileage')
    paint_idx = int(query.data.replace('est_paint_', ''))
    paint = PAINT_CONDITIONS[paint_idx]
    
    cars_db = get_db()
    base_price = 0
    try:
        models = cars_db[brand]['models']
        for m in models:
            if m['name'] == model:
                base_price = m['variants'][0]['marketPrice']
                break
    except: base_price = 800
    
    current_year = 1404
    age = current_year - year
    age_drop = 0.05 if age == 1 else (0.05 + ((age-1)*0.035)) if age > 1 else 0
    if age_drop > 0.40: age_drop = 0.40
    
    std_mileage = age * 20000
    diff = mileage - std_mileage
    mileage_drop = (diff/10000)*0.01 if diff > 0 else (diff/10000)*0.005
    if mileage_drop > 0.15: mileage_drop = 0.15
    if mileage_drop < -0.05: mileage_drop = -0.05
    
    paint_drop = paint['drop']
    
    total_drop = age_drop + mileage_drop + paint_drop
    final_price = base_price * (1 - total_drop)
    final_price = round(final_price / 5) * 5
    
    msg = f"🎯 **نتیجه تخمین قیمت**\\n\\n"
    msg += f"🚙 **{brand} {model}**\\n"
    msg += f"📅 سال: {year} | 🛣 کارکرد: {mileage:,}\\n"
    msg += f"🎨 بدنه: {paint['label']}\\n"
    msg += f"-------------------------\\n"
    msg += f"💰 **قیمت تقریبی: {final_price:,} میلیون تومان**"
    
    keyboard = [
        [InlineKeyboardButton("🧮 محاسبه دقیق (آنلاین)", web_app=WebAppInfo(url="https://www.hamrah-mechanic.com/carprice/"))],
        [InlineKeyboardButton("🏠 منوی اصلی", callback_data='main_menu')]
    ]
    
    await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return ConversationHandler.END

# --- Start & User Commands ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    log_user(user.id)
    
    keyboard = [
        [
            InlineKeyboardButton("🧮 ماشین حساب حرفه‌ای", web_app=WebAppInfo(url="https://www.hamrah-mechanic.com/carprice/")),
            InlineKeyboardButton("📋 قیمت روز بازار", web_app=WebAppInfo(url="https://www.iranjib.ir/showgroup/45/%D9%82%DB%8C%D9%85%D8%AA-%D8%AE%D9%88%D8%AF%D8%B1%D9%88-%D8%AA%D9%88%D9%84%DB%8C%D8%AF-%D8%AF%D8%A7%D8%AE%D9%84/"))
        ],
        [
            InlineKeyboardButton("📋 لیست قیمت (ربات)", callback_data='menu_prices'),
            InlineKeyboardButton("💰 تخمین قیمت (ربات)", callback_data='menu_estimate')
        ],
        [
            InlineKeyboardButton("🔍 جستجو", callback_data='menu_search'),
            InlineKeyboardButton("📞 پشتیبانی", callback_data='menu_support')
        ]
    ]
    
    # MAGIC: Automatically add Admin Button if user is Admin
    if is_admin(user.id):
        keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data='admin_home')])

    keyboard = attach_footer(keyboard)
    msg = "👋 منوی اصلی:"
    
    if update.callback_query:
        await update.callback_query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard))
    else:
        await update.message.reply_text(msg, reply_markup=InlineKeyboardMarkup(keyboard))
    return ConversationHandler.END

async def get_my_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"🆔 شناسه شما: {update.effective_user.id}")

# --- Browsing Handlers (Existing) ---
async def show_brands(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    cars_db = get_db()
    if not cars_db:
         await query.edit_message_text("❌ دیتابیس خالی است. لطفا با ادمین تماس بگیرید.")
         return
         
    keyboard = []
    brands = list(cars_db.keys())
    for i in range(0, len(brands), 2):
        row = [InlineKeyboardButton(brands[i], callback_data=f'brand_{brands[i]}')]
        if i+1 < len(brands): row.append(InlineKeyboardButton(brands[i+1], callback_data=f'brand_{brands[i+1]}'))
        keyboard.append(row)
    keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data='main_menu')])
    await query.edit_message_text("🏢 برند مورد نظر را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))

async def show_models(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    brand = query.data.replace('brand_', '')
    cars_db = get_db()
    
    if brand not in cars_db:
        await query.answer("خطا در یافتن اطلاعات", show_alert=True)
        return

    models = [m['name'] for m in cars_db[brand]['models']]
    keyboard = [[InlineKeyboardButton(m, callback_data=f'model_{brand}_{m}')] for m in models]
    keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data='menu_prices')])
    await query.edit_message_text(f"🚘 مدل‌های {brand}:", reply_markup=InlineKeyboardMarkup(keyboard))

async def show_variants(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _, brand, model = query.data.split('_', 2)
    cars_db = get_db()
    variants = []
    for m in cars_db[brand]['models']:
        if m['name'] == model: variants = m['variants']; break
    keyboard = [[InlineKeyboardButton(v['name'], callback_data=f'variant_{brand}_{model}_{idx}')] for idx, v in enumerate(variants)]
    keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f'brand_{brand}')])
    await query.edit_message_text(f"تیپ {model}:", reply_markup=InlineKeyboardMarkup(keyboard))

async def show_final_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    parts = query.data.split('_')
    brand, model, idx = parts[1], parts[2], int(parts[3])
    cars_db = get_db()
    variant = None
    for m in cars_db[brand]['models']:
        if m['name'] == model: variant = m['variants'][idx]; break
    if variant:
        text = f"📊 **{variant['name']}**\\n\\n"
        text += f"💰 **قیمت بازار:** {variant['marketPrice']} میلیون تومان\\n"
        text += f"🏭 **قیمت کارخانه:** {variant['factoryPrice']} میلیون تومان\\n\\n"
        text += f"📅 بروزرسانی: {get_last_update()}"
        
        keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f'model_{brand}_{model}')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

# --- Startup Logic (Job Queue) ---
async def post_init(application):
    # Check for auto-backup setting on startup
    data = load_data()
    interval = data.get("backup_interval", 0)
    if interval > 0:
        application.job_queue.run_repeating(send_auto_backup, interval=interval*3600, first=10, name='auto_backup')

# --- Main ---
def main():
    builder = ApplicationBuilder().token(TOKEN).post_init(post_init)
    
    proxy_url = os.environ.get("PROXY_URL")
    if proxy_url and proxy_url.strip():
        print(f"Using Proxy: {proxy_url}")
        builder.proxy_url(proxy_url)
        builder.get_updates_request(read_timeout=30, connect_timeout=30)
    
    application = builder.build()
    
    admin_conv = ConversationHandler(
        entry_points=[CommandHandler('admin', admin_start), CallbackQueryHandler(admin_start, pattern='^admin_home$')],
        states={
            ADMIN_MENU: [CallbackQueryHandler(adm_menu_choice)],
            MANAGE_ADMINS: [CallbackQueryHandler(manage_admins_choice)],
            ADD_NEW_ADMIN: [MessageHandler(filters.TEXT, add_new_admin_exec)],
            UPLOAD_EXCEL: [MessageHandler(filters.Document.FileExtension("xlsx"), adm_handle_excel)],
            ADD_BRAND: [MessageHandler(filters.TEXT, add_car_brand)],
            ADD_MODEL: [MessageHandler(filters.TEXT, add_car_model)],
            ADD_VARIANT: [MessageHandler(filters.TEXT, add_car_variant)],
            ADD_PRICE: [MessageHandler(filters.TEXT, add_car_price)],
            SET_SPONSOR_NAME: [MessageHandler(filters.TEXT, lambda u,c: ConversationHandler.END)],
            BROADCAST_MENU: [CallbackQueryHandler(adm_broadcast_menu_choice)],
            BROADCAST_GET_TIME: [MessageHandler(filters.TEXT, adm_broadcast_get_time)],
            BROADCAST_GET_CONTENT: [MessageHandler(filters.TEXT, adm_broadcast_execute)],
            
            # Backup States
            BACKUP_MENU: [CallbackQueryHandler(backup_menu_choice)],
            SET_BACKUP_INTERVAL: [MessageHandler(filters.TEXT, set_backup_interval_exec)],
            RESTORE_BACKUP: [MessageHandler(filters.Document.FileExtension("json"), restore_backup_exec)],
        },
        fallbacks=[CommandHandler('start', start), CallbackQueryHandler(start, pattern='^main_menu$')]
    )
    
    support_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_support, pattern='^menu_support$')],
        states={
            SUPPORT_GET_MSG: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_support_message)]
        },
        fallbacks=[CommandHandler('start', start), CallbackQueryHandler(start, pattern='^main_menu$')]
    )

    est_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(start_estimate, pattern='^menu_estimate$')],
        states={
            EST_BRAND: [CallbackQueryHandler(est_select_brand, pattern='^est_brand_')],
            EST_MODEL: [CallbackQueryHandler(est_select_model, pattern='^est_model_')],
            EST_YEAR: [CallbackQueryHandler(est_select_year, pattern='^est_year_')],
            EST_MILEAGE: [MessageHandler(filters.TEXT, est_get_mileage)],
            EST_PAINT: [CallbackQueryHandler(est_calculate, pattern='^est_paint_')],
        },
        fallbacks=[CommandHandler('start', start), CallbackQueryHandler(start, pattern='^main_menu$')]
    )

    application.add_handler(admin_conv)
    application.add_handler(support_conv)
    application.add_handler(est_conv)
    
    application.add_handler(CommandHandler('start', start))
    application.add_handler(CommandHandler('id', get_my_id))
    
    application.add_handler(CallbackQueryHandler(show_brands, pattern='^menu_prices$'))
    application.add_handler(CallbackQueryHandler(start, pattern='^main_menu$'))
    application.add_handler(CallbackQueryHandler(show_models, pattern='^brand_'))
    application.add_handler(CallbackQueryHandler(show_models, pattern='^brand_'))
    application.add_handler(CallbackQueryHandler(show_variants, pattern='^model_'))
    application.add_handler(CallbackQueryHandler(show_final_price, pattern='^variant_'))
    
    print("Bot started...")
    application.run_polling()

if __name__ == '__main__':
    main()
`;
};