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
DATA_FILE="bot_data.json"

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
        echo -e "\${YELLOW}Cleaning up corrupt directory...\${NC}"
        rm -rf "\$INSTALL_DIR"
    fi

    if [ -d "\$INSTALL_DIR/.git" ]; then
        echo -e "\${GREEN}🔄 Pulling latest changes...\${NC}"
        cd "\$INSTALL_DIR"
        git reset --hard
        git pull
    else
        echo -e "\${GREEN}⬇️  Cloning repository...\${NC}"
        git clone "\$REPO_URL" "\$INSTALL_DIR"
        
        if [ ! -d "\$INSTALL_DIR" ]; then
             echo -e "\${RED}❌ Error: Git clone failed.\${NC}"
             pause
             return 1
        fi
        
        cd "\$INSTALL_DIR"
    fi

    if [ ! -f "bot.py" ]; then
        echo -e "\${RED}❌ Error: bot.py not found.\${NC}"
        pause
        return 1
    fi

    if [ ! -d "venv" ]; then
        echo -e "\${GREEN}🐍 Creating Virtual Environment...\${NC}"
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install python-telegram-bot pandas openpyxl jdatetime
}

function configure_bot() {
    cd "\$INSTALL_DIR"
    
    echo -e "\\n\${BLUE}⚙️  Bot Configuration \${NC}"
    echo "------------------------------------------------"
    
    # 1. Telegram Token
    if grep -q "REPLACE_ME_TOKEN" bot.py; then
        read -p "Enter Telegram Bot Token: " BOT_TOKEN
        read -p "Enter Admin Numeric ID: " ADMIN_ID
        
        sed -i "s/REPLACE_ME_TOKEN/\$BOT_TOKEN/g" bot.py
        sed -i "s/OWNER_ID = 0/OWNER_ID = \$ADMIN_ID/g" bot.py
        echo -e "\${GREEN}✅ Telegram Token Saved.\${NC}"
    else
        echo -e "\${GREEN}Telegram Token already configured.\${NC}"
    fi

    # 2. SECURITY SETUP (MANDATORY REQUESTED)
    echo -e "\\n\${YELLOW}🔐 PANEL SECURITY SETUP\${NC}"
    echo "Set a Username and Password. This is required for RESTORING backups securely."
    
    while true; do
        read -p "Set Panel Username: " P_USER
        read -s -p "Set Panel Password: " P_PASS
        echo ""
        read -s -p "Confirm Password:   " P_PASS2
        echo ""
        
        if [ "\$P_PASS" == "\$P_PASS2" ] && [ ! -z "\$P_PASS" ]; then
            # Inject securely into JSON
            python3 -c "
import json, os
try:
    with open('\$DATA_FILE', 'r') as f: d = json.load(f)
except: d = {}
d['panel_user'] = '$P_USER'
d['panel_pass'] = '$P_PASS'
with open('\$DATA_FILE', 'w') as f: json.dump(d, f, indent=4)
"
            echo -e "\${GREEN}✅ Security Credentials Saved!\${NC}"
            break
        else
            echo -e "\${RED}❌ Passwords do not match. Try again.\${NC}"
        fi
    done
    echo "------------------------------------------------"
}

function setup_service() {
    echo -e "\${BLUE}🤖 Setting up Service...\${NC}"
    
    SERVICE_FILE="/etc/systemd/system/\$SERVICE_NAME.service"
    CURRENT_USER=\$(whoami)
    PYTHON_EXEC="\$INSTALL_DIR/venv/bin/python"

    # Fix ownership
    sudo chown -R \$CURRENT_USER:\$CURRENT_USER "\$INSTALL_DIR"

    sudo bash -c "cat > \$SERVICE_FILE" <<EOL
[Unit]
Description=Iran Car Price Bot
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
    cp "\$0" "\$INSTALL_DIR/manager.sh"
    chmod +x "\$INSTALL_DIR/manager.sh"
    sudo ln -sf "\$INSTALL_DIR/manager.sh" /usr/local/bin/carbot
    echo -e "\${GREEN}🔗 Shortcut 'carbot' created.\${NC}"
}

# --- Backup/Restore ---

function do_backup() {
    BACKUP_DIR="\$HOME/carbot_backups"
    mkdir -p "\$BACKUP_DIR"
    TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
    DEST="\$BACKUP_DIR/backup_\$TIMESTAMP.json"
    
    if [ -f "\$INSTALL_DIR/bot_data.json" ]; then
        cp "\$INSTALL_DIR/bot_data.json" "\$DEST"
        echo -e "\${GREEN}✅ Backup saved to: \$DEST\${NC}"
        
        # Telegram Send
        read -p "Send to Telegram? (y/n): " snd
        if [[ "\$snd" == "y" ]]; then
            TOKEN=\$(grep "TOKEN =" "\$INSTALL_DIR/bot.py" | cut -d "'" -f 2)
            ID=\$(grep "OWNER_ID =" "\$INSTALL_DIR/bot.py" | awk -F'=' '{print \$2}' | tr -d ' ')
            curl -s -F chat_id="\$ID" -F document=@"\$DEST" -F caption="💾 Manual Backup" "https://api.telegram.org/bot\$TOKEN/sendDocument" > /dev/null
            echo "Sent."
        fi
    else
        echo -e "\${RED}No database found.\${NC}"
    fi
    pause
}

function do_restore() {
    echo -e "\${BLUE}📥 Restore Database (Secure)\${NC}"
    echo -e "\${YELLOW}⚠️  Overwrites current data!\${NC}"
    read -p "Full path to backup file: " BACKUP_PATH
    
    if [ ! -f "\$BACKUP_PATH" ]; then
        echo -e "\${RED}❌ File not found.\${NC}"
        pause; return
    fi
    
    # SECURITY CHECK
    echo -e "\\n\${YELLOW}🔐 This backup is protected. Enter credentials:\${NC}"
    read -p "Backup Username: " IN_USER
    read -s -p "Backup Password: " IN_PASS
    echo ""

    VERIFY=\$(python3 -c "
import json
try:
    with open('\$BACKUP_PATH', 'r') as f:
        d = json.load(f)
        if d.get('panel_user') == '$IN_USER' and d.get('panel_pass') == '$IN_PASS':
            print('OK')
        else:
            print('FAIL')
except:
    print('ERR')
")
    
    if [ "\$VERIFY" != "OK" ]; then
        echo -e "\${RED}❌ ACCESS DENIED: Invalid Username or Password for this backup file.\${NC}"
        pause; return
    fi
    
    echo -e "\${GREEN}✅ Credentials Verified.\${NC}"
    
    echo "Stopping service..."
    sudo systemctl stop \$SERVICE_NAME
    
    echo "Restoring file..."
    cp "\$BACKUP_PATH" "\$INSTALL_DIR/bot_data.json"
    
    # --- CRITICAL FIX FOR PERMISSIONS ---
    echo "Fixing permissions..."
    CURRENT_USER=\$(whoami)
    sudo chown \$CURRENT_USER:\$CURRENT_USER "\$INSTALL_DIR/bot_data.json"
    sudo chmod 644 "\$INSTALL_DIR/bot_data.json"
    # ------------------------------------
    
    echo "Starting service..."
    sudo systemctl start \$SERVICE_NAME
    echo -e "\${GREEN}✅ Restore Complete.\${NC}"
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
        echo -e "\\n\${GREEN}🎉 Installation Complete!\${NC}"
    fi
    pause
}

function do_update() {
    if [ ! -d "\$INSTALL_DIR" ]; then echo "Not installed."; pause; return; fi
    cd "\$INSTALL_DIR"
    echo "Updating..."
    git reset --hard
    git pull
    sudo systemctl restart \$SERVICE_NAME
    echo -e "\${GREEN}✅ Updated.\${NC}"; pause
}

function do_uninstall() {
    read -p "Delete everything? (y/n): " c
    if [[ "\$c" == "y" ]]; then
        sudo systemctl stop \$SERVICE_NAME
        sudo systemctl disable \$SERVICE_NAME
        rm -rf "\$INSTALL_DIR"
        sudo rm /usr/local/bin/carbot
        echo "Deleted."; pause
    fi
}

# --- Main Loop ---

while true; do
    clear
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "\${GREEN}      🚗 Iran Car Bot Manager      \${NC}"
    echo -e "\${BLUE}========================================\${NC}"
    echo -e "1) \${GREEN}Install / Reinstall\${NC}"
    echo -e "2) \${YELLOW}Update Bot\${NC}"
    echo -e "3) View Logs"
    echo -e "4) Check Status"
    echo -e "5) Restart Bot"
    echo -e "6) Stop Bot"
    echo -e "7) \${BLUE}Backup Data\${NC}"
    echo -e "8) \${BLUE}Restore Data\${NC} (Secure)"
    echo -e "9) \${RED}Uninstall\${NC}"
    echo -e "0) Exit"
    echo -e "\${BLUE}========================================\${NC}"
    read -p "Select: " choice

    case \$choice in
        1) do_install ;;
        2) do_update ;;
        3) journalctl -u \$SERVICE_NAME -n 50 -f ;;
        4) sudo systemctl status \$SERVICE_NAME; pause ;;
        5) sudo systemctl restart \$SERVICE_NAME; echo "Done."; pause ;;
        6) sudo systemctl stop \$SERVICE_NAME; echo "Done."; pause ;;
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
  const carDbJson = JSON.stringify(CAR_DB, null, 4);
  const mobileDbJson = JSON.stringify(MOBILE_DB, null, 4);
  const paintConditionsJson = JSON.stringify(PAINT_CONDITIONS, null, 4);

  return `
import logging
import json
import os
import datetime
import shutil
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# Configuration
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
DATA_FILE = 'bot_data.json'

# --- SAFE LOAD ---
CAR_DB = json.loads('''${carDbJson}''')
MOBILE_DB = json.loads('''${mobileDbJson}''')
PAINT_CONDITIONS = json.loads('''${paintConditionsJson}''')
YEARS = ${JSON.stringify(YEARS)}

# Default Menu Configuration
DEFAULT_CONFIG = {
    "calc": {"label": "🧮 ماشین‌حساب", "url": "https://www.hamrah-mechanic.com/carprice/", "active": True, "type": "webapp"},
    "market": {"label": "🌐 قیمت بازار", "url": "https://www.iranjib.ir/showgroup/45/", "active": True, "type": "webapp"},
    "prices": {"label": "📋 لیست قیمت", "active": True, "type": "internal"},
    "estimate": {"label": "💰 تخمین قیمت", "active": True, "type": "internal"},
    "mobile_webapp": {"label": "📱 قیمت موبایل (سایت)", "url": "https://www.mobile.ir/phones/prices.aspx", "active": True, "type": "webapp"},
    "mobile_list": {"label": "📲 لیست موبایل (ربات)", "active": True, "type": "internal"},
    "search": {"label": "🔍 جستجو", "active": True, "type": "internal"},
    "channel": {"label": "📢 کانال ما", "url": "https://t.me/CarPrice_Channel", "active": True, "type": "link"},
    "support": {"label": "📞 پشتیبانی", "active": True, "type": "dynamic"}
}

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

user_states = {}
STATE_IDLE = "IDLE"
STATE_ESTIMATE_BRAND = "EST_BRAND"
STATE_ESTIMATE_MODEL = "EST_MODEL"
STATE_ESTIMATE_YEAR = "EST_YEAR"
STATE_ESTIMATE_MILEAGE = "EST_MILEAGE"
STATE_ESTIMATE_PAINT = "EST_PAINT"
STATE_ADMIN_ADD_ADMIN = "ADM_ADD_ADMIN"
STATE_ADMIN_SPONSOR_NAME = "ADM_SPONSOR_NAME"
STATE_ADMIN_SPONSOR_LINK = "ADM_SPONSOR_LINK"
STATE_ADMIN_BROADCAST = "ADM_BCAST"
STATE_ADMIN_EDIT_MENU_LABEL = "ADM_EDIT_LABEL"
STATE_ADMIN_EDIT_MENU_URL = "ADM_EDIT_URL"
STATE_ADMIN_SET_SUPPORT = "ADM_SET_SUPPORT"

# --- Data Management ---
def load_data():
    # Added panel_user and panel_pass to default schema
    default_data = {
        "backup_interval": 0, 
        "users": [], 
        "admins": [], 
        "sponsor": {}, 
        "menu_config": DEFAULT_CONFIG, 
        "support_config": {"mode": "text", "value": "پیام خود را ارسال کنید..."},
        "panel_user": "",
        "panel_pass": ""
    }
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                d = json.load(f)
                if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
                for k, v in DEFAULT_CONFIG.items():
                    if k not in d["menu_config"]: d["menu_config"][k] = v
                return d
        except Exception:
            return default_data
    return default_data

def save_data(data):
    try:
        temp_file = f"{DATA_FILE}.tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        shutil.move(temp_file, DATA_FILE)
    except: pass

def register_user(user_id):
    d = load_data()
    if user_id not in d.get("users", []):
        if "users" not in d: d["users"] = []
        d["users"].append(user_id)
        save_data(d)

def is_admin(user_id):
    d = load_data()
    return str(user_id) == str(OWNER_ID) or user_id in d.get("admins", [])

# --- Backup Logic ---
async def send_auto_backup(context: ContextTypes.DEFAULT_TYPE):
    if not os.path.exists(DATA_FILE): return
    try:
        d = load_data()
        admins = d.get("admins", [])
        targets = set(admins)
        try:
            if int(OWNER_ID) > 0: targets.add(int(OWNER_ID))
        except: pass
        
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        
        for uid in targets:
            try:
                with open(DATA_FILE, 'rb') as f:
                    await context.bot.send_document(
                        chat_id=uid, 
                        document=f,
                        caption=f"💾 Auto-Backup: {timestamp}",
                        filename="bot_data.json"
                    )
            except Exception as e:
                logger.error(f"Failed to send backup to {uid}: {e}")
    except Exception as e:
        logger.error(f"Auto backup error: {e}")

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
    d = load_data()
    c = d.get("menu_config", DEFAULT_CONFIG)
    sup_conf = d.get("support_config", {"mode": "text", "value": "..."})
    keyboard = []
    
    row1 = []
    if c["calc"]["active"]: row1.append(InlineKeyboardButton(c["calc"]["label"], web_app=WebAppInfo(url=c["calc"]["url"])))
    if c["market"]["active"]: row1.append(InlineKeyboardButton(c["market"]["label"], web_app=WebAppInfo(url=c["market"]["url"])))
    if row1: keyboard.append(row1)

    row2 = []
    if c["prices"]["active"]: row2.append(InlineKeyboardButton(c["prices"]["label"], callback_data="menu_prices"))
    if c["estimate"]["active"]: row2.append(InlineKeyboardButton(c["estimate"]["label"], callback_data="menu_estimate"))
    if row2: keyboard.append(row2)

    row3 = []
    if c.get("mobile_webapp", {}).get("active"): row3.append(InlineKeyboardButton(c["mobile_webapp"]["label"], web_app=WebAppInfo(url=c["mobile_webapp"]["url"])))
    if c.get("mobile_list", {}).get("active"): row3.append(InlineKeyboardButton(c["mobile_list"]["label"], callback_data="menu_mobile_list"))
    if row3: keyboard.append(row3)

    row4 = []
    if c["search"]["active"]: row4.append(InlineKeyboardButton(c["search"]["label"], callback_data="menu_search"))
    if c["support"]["active"]:
        if sup_conf["mode"] == "link":
             row4.append(InlineKeyboardButton(c["support"]["label"], url=sup_conf["value"]))
        else:
             row4.append(InlineKeyboardButton(c["support"]["label"], callback_data="menu_support"))
    if row4: keyboard.append(row4)

    if is_admin(user_id): keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
    
    footer = []
    if c.get("channel", {}).get("active"):
        footer.append(InlineKeyboardButton(c["channel"]["label"], url=c["channel"]["url"]))
    sponsor = d.get("sponsor", {})
    if sponsor.get("name") and sponsor.get("url"):
        footer.append(InlineKeyboardButton(f"⭐ {sponsor['name']}", url=sponsor['url']))
    if footer: keyboard.append(footer)
    
    return InlineKeyboardMarkup(keyboard)

# --- Handlers ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    register_user(user_id)
    reset_state(user_id)
    await update.message.reply_text(f"👋 سلام! به ربات قیمت خودرو و موبایل خوش آمدید.\\n📅 امروز: {datetime.date.today()}", reply_markup=get_main_menu(user_id))

async def fix_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    try:
        await context.bot.delete_my_commands()
        await context.bot.set_my_commands([
            BotCommand("start", "🏠 منوی اصلی"),
            BotCommand("admin", "👑 پنل مدیریت"),
            BotCommand("fixmenu", "🔧 تعمیر دکمه منو")
        ])
        await context.bot.set_chat_menu_button(chat_id=user_id, menu_button=MenuButtonCommands())
        await update.message.reply_text("✅ منو تعمیر شد.")
    except Exception as e:
        await update.message.reply_text(f"❌ خطا: {e}")

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    await query.answer()
    
    if data == "main_menu":
        reset_state(user_id)
        await query.edit_message_text(text="منوی اصلی:", reply_markup=get_main_menu(user_id))
        return
    
    if data == "admin_home" and is_admin(user_id):
        keyboard = [
            [InlineKeyboardButton("⚙️ مدیریت منو", callback_data="admin_menus")],
            [InlineKeyboardButton("📞 تنظیم پشتیبانی", callback_data="admin_set_support")],
            [InlineKeyboardButton("👥 ادمین‌ها", callback_data="admin_manage_admins")],
            [InlineKeyboardButton("💾 بکاپ", callback_data="admin_backup_menu")],
            [InlineKeyboardButton("⭐ اسپانسر", callback_data="admin_set_sponsor")],
            [InlineKeyboardButton("📣 پیام همگانی", callback_data="admin_broadcast")],
            [InlineKeyboardButton("🔙 خروج", callback_data="main_menu")]
        ]
        await query.edit_message_text("🛠 **پنل مدیریت**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_set_support":
        set_state(user_id, STATE_ADMIN_SET_SUPPORT)
        await query.message.reply_text("لینک یا متن پشتیبانی را وارد کنید:")
        return

    if data == "admin_menus":
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG)
        keyboard = []
        for key, val in c.items():
            status = "✅" if val["active"] else "❌"
            keyboard.append([InlineKeyboardButton(f"{status} {val['label']}", callback_data=f"edit_menu_{key}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")])
        await query.edit_message_text("⚙️ مدیریت منو:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("edit_menu_"):
        key = data.replace("edit_menu_", "")
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG).get(key, {})
        status_text = "فعال ✅" if c["active"] else "غیرفعال ❌"
        text = f"🔧 دکمه: **{c['label']}**\\nوضعیت: {status_text}\\n"
        if "url" in c: text += f"لینک: {c['url']}"
        keyboard = [[InlineKeyboardButton("✏️ تغییر نام", callback_data=f"menu_set_label_{key}")], [InlineKeyboardButton("👁️ تغییر وضعیت", callback_data=f"menu_toggle_{key}")]]
        if "url" in c: keyboard.append([InlineKeyboardButton("🔗 تغییر لینک", callback_data=f"menu_set_url_{key}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_menus")])
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("menu_toggle_"):
        key = data.replace("menu_toggle_", "")
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["active"] = not d["menu_config"][key]["active"]
        save_data(d)
        await query.answer(f"دکمه {'✅' if d['menu_config'][key]['active'] else '❌'} شد", show_alert=True)
        query.data = f"edit_menu_{key}" 
        await handle_callback(update, context) 
        return

    if data.startswith("menu_set_label_"):
        key = data.replace("menu_set_label_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_LABEL)
        await query.message.reply_text("نام جدید:")
        return

    if data.startswith("menu_set_url_"):
        key = data.replace("menu_set_url_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_URL)
        await query.message.reply_text("لینک جدید:")
        return

    if data == "admin_set_sponsor":
        set_state(user_id, STATE_ADMIN_SPONSOR_NAME)
        await query.message.reply_text("نام اسپانسر:")
        return

    if data == "admin_broadcast":
        set_state(user_id, STATE_ADMIN_BROADCAST)
        await query.message.reply_text("متن پیام همگانی:")
        return

    if data == "admin_manage_admins":
        d = load_data()
        admins = d.get("admins", [])
        text = f"👥 ادمین‌ها:\\nOwner: {OWNER_ID}\\n" + "\\n".join([str(a) for a in admins])
        keyboard = [[InlineKeyboardButton("➕ افزودن ادمین", callback_data="admin_add_new_admin")], [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "admin_add_new_admin":
        set_state(user_id, STATE_ADMIN_ADD_ADMIN)
        await query.message.reply_text("ID عددی کاربر:")
        return

    if data == "admin_backup_menu" and is_admin(user_id):
        d = load_data()
        interval = d.get("backup_interval", 0)
        status = "❌ خاموش" if interval == 0 else (f"✅ هر {interval} ساعت")
        keyboard = [
            [InlineKeyboardButton("📥 دریافت بکاپ", callback_data="backup_get_now")],
            [InlineKeyboardButton("⏱ تنظیم ساعتی", callback_data="backup_set_1h"), InlineKeyboardButton("📅 تنظیم روزانه", callback_data="backup_set_24h")],
            [InlineKeyboardButton("🚫 خاموش", callback_data="backup_off")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(f"💾 مدیریت بکاپ\\nوضعیت: {status}", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "backup_get_now":
        if os.path.exists(DATA_FILE):
             await context.bot.send_document(chat_id=user_id, document=open(DATA_FILE, 'rb'), caption="💾 Manual Backup")
        else: await query.message.reply_text("❌ فایلی وجود ندارد.")
        return

    if data.startswith("backup_set_") or data == "backup_off":
        new_interval = 0
        if data == "backup_set_1h": new_interval = 1
        elif data == "backup_set_24h": new_interval = 24
        d = load_data()
        d['backup_interval'] = new_interval
        save_data(d)
        await query.edit_message_text(f"✅ تنظیم شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data="admin_backup_menu")]]))
        return

    if data == "menu_support":
        d = load_data()
        sup_conf = d.get("support_config", {"mode": "text", "value": "..."})
        await query.message.reply_text(f"📞 {sup_conf['value']}")
        return

    if data == "menu_mobile_list":
        keyboard = []
        for brand in MOBILE_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"mob_brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("📱 برند موبایل:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("mob_brand_"):
        brand_name = data.replace("mob_brand_", "")
        if brand_name in MOBILE_DB:
            keyboard = []
            for model in MOBILE_DB[brand_name]["models"]:
                keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"mob_model_{brand_name}_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")])
            await query.edit_message_text(f"مدل‌های {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("mob_model_"):
        parts = data.split("_")
        brand_name = parts[2]
        model_name = parts[3]
        found_model = None
        if brand_name in MOBILE_DB:
            for m in MOBILE_DB[brand_name]["models"]:
                if m["name"] == model_name: found_model = m; break
        
        if found_model:
            text = (f"📱 **{found_model['name']}**\\n💾 {found_model.get('storage', '-')}\\n💰 {found_model['price']} میلیون تومان")
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"mob_brand_{brand_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_prices":
        keyboard = []
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 شرکت سازنده:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        if get_state(user_id)["state"] == STATE_ESTIMATE_BRAND:
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
        if get_state(user_id)["state"] == STATE_ESTIMATE_MODEL:
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
            text = (f"🚘 {found_variant['name']}\\n📉 بازار: {floor:,} م ت\\n🏭 کارخانه: {found_variant['factoryPrice']:,} م ت")
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
        await query.edit_message_text("کارکرد (کیلومتر) به عدد:")
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
        
        result = (f"🎯 **کارشناسی {brand} {model}**\\n📅 {year} | 🛣 {mileage:,}\\n🎨 {condition['label']}\\n💰 **تقریبی: {final_price:,} م ت**")
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

    if state_info["state"] == STATE_ADMIN_SET_SUPPORT:
        d = load_data()
        mode = "link" if text.startswith("http") else "text"
        if text.startswith("@"):
            text = f"https://t.me/{text.replace('@', '')}"
            mode = "link"
        d["support_config"] = {"mode": mode, "value": text}
        save_data(d)
        await update.message.reply_text(f"✅ پشتیبانی تنظیم شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_EDIT_MENU_LABEL:
        key = state_info["data"].get("edit_key")
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["label"] = text
        save_data(d)
        await update.message.reply_text(f"✅ انجام شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_EDIT_MENU_URL:
        key = state_info["data"].get("edit_key")
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["url"] = text
        save_data(d)
        await update.message.reply_text(f"✅ انجام شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_ADD_ADMIN:
        try:
            new_admin_id = int(text)
            d = load_data()
            if "admins" not in d: d["admins"] = []
            if new_admin_id not in d["admins"]: d["admins"].append(new_admin_id)
            save_data(d)
            await update.message.reply_text(f"✅ ادمین اضافه شد.")
        except: await update.message.reply_text("❌ خطا: عدد وارد کنید.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_SPONSOR_NAME:
        update_data(user_id, "sponsor_name", text)
        set_state(user_id, STATE_ADMIN_SPONSOR_LINK)
        await update.message.reply_text("لینک اسپانسر:")
        return

    if state_info["state"] == STATE_ADMIN_SPONSOR_LINK:
        name = state_info["data"].get("sponsor_name")
        d = load_data()
        d["sponsor"] = {"name": name, "url": text}
        save_data(d)
        await update.message.reply_text("✅ اسپانسر تنظیم شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_BROADCAST:
        d = load_data()
        users = d.get("users", [])
        count = 0
        for uid in users:
            try:
                await context.bot.send_message(chat_id=uid, text=text)
                count += 1
            except: pass
        await update.message.reply_text(f"✅ ارسال به {count} نفر.")
        reset_state(user_id)
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

async def post_init(application):
    # Auto-Backup
    data = load_data()
    interval = data.get("backup_interval", 0)
    if interval > 0:
        application.job_queue.run_repeating(send_auto_backup, interval=interval*3600, first=60, name='auto_backup')
    try:
        await application.bot.set_my_commands([
            BotCommand("start", "🏠 منوی اصلی"),
            BotCommand("admin", "👑 پنل مدیریت"),
            BotCommand("fixmenu", "🔧 تعمیر دکمه منو")
        ])
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    except: pass

if __name__ == '__main__':
    if TOKEN == 'REPLACE_ME_TOKEN': print("⚠️ Configure token in bot.py")
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("fixmenu", fix_menu))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    print("Bot is running...")
    app.run_polling()
  `;
};