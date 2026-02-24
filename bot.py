
import logging
import json
import os
import datetime
import shutil
import re
import jdatetime
import pandas as pd
import requests
import google.generativeai as genai
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# Configuration
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
GEMINI_API_KEY = ''
DEEPSEEK_API_KEY = ''
OPENAI_API_KEY = ''
DATA_FILE = 'bot_data.json'

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

# Load Database
CAR_DB = {} 
MOBILE_DB = {}
# ... (Insert DB Logic if using full generator) ...
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
# User States
STATE_IDLE = "IDLE"
STATE_ESTIMATE_BRAND = "EST_BRAND"
STATE_ESTIMATE_MODEL = "EST_MODEL"
STATE_ESTIMATE_YEAR = "EST_YEAR"
STATE_ESTIMATE_MILEAGE = "EST_MILEAGE"
STATE_ESTIMATE_PAINT = "EST_PAINT"
# Admin States
STATE_ADMIN_ADD_ADMIN = "ADM_ADD_ADMIN"
STATE_ADMIN_SPONSOR_NAME = "ADM_SPONSOR_NAME"
STATE_ADMIN_SPONSOR_LINK = "ADM_SPONSOR_LINK"
STATE_ADMIN_BROADCAST = "ADM_BCAST"
STATE_ADMIN_EDIT_MENU_LABEL = "ADM_EDIT_LABEL"
STATE_ADMIN_EDIT_MENU_URL = "ADM_EDIT_URL"
STATE_ADMIN_SET_SUPPORT = "ADM_SET_SUPPORT"
STATE_ADMIN_SET_CHANNEL_URL = "ADM_SET_CHANNEL_URL"
STATE_ADMIN_WAIT_EXCEL = "ADM_WAIT_EXCEL"
STATE_SEARCH = "SEARCH"

# --- Data Management ---
def load_data():
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
        except json.JSONDecodeError:
            # Handle corrupted file
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            corrupt_filename = f"{DATA_FILE}.corrupt.{timestamp}"
            try:
                shutil.copy(DATA_FILE, corrupt_filename)
                logger.error(f"❌ Data file corrupted! Renamed to {corrupt_filename} and creating new DB.")
            except: pass
            return default_data
        except Exception as e:
            logger.error(f"❌ Error loading data: {e}")
            return default_data
            
    return default_data

def save_data(data):
    try:
        # Write to temp file first to prevent corruption during write
        temp_file = f"{DATA_FILE}.tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        shutil.move(temp_file, DATA_FILE)
    except Exception as e:
        logger.error(f"❌ Error saving data: {e}")

def save_car_db():
    try:
        with open('car_db.json', 'w', encoding='utf-8') as f:
            json.dump(CAR_DB, f, ensure_ascii=False, indent=4)
        logger.info("Car database saved successfully.")
    except Exception as e:
        logger.error(f"Error saving car database: {e}")

def load_car_db():
    global CAR_DB
    try:
        if os.path.exists('car_db.json'):
            with open('car_db.json', 'r', encoding='utf-8') as f:
                CAR_DB = json.load(f)
    except Exception as e:
        logger.error(f"Error loading car database: {e}")


def register_user(user_id):
    d = load_data()
    if user_id not in d.get("users", []):
        if "users" not in d: d["users"] = []
        d["users"].append(user_id)
        save_data(d)

def is_admin(user_id):
    d = load_data()
    return str(user_id) == str(OWNER_ID) or user_id in d.get("admins", [])

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
    
    # Row 1: Web Apps
    row1 = []
    if c["calc"]["active"]: row1.append(InlineKeyboardButton(c["calc"]["label"], web_app=WebAppInfo(url=c["calc"]["url"])))
    if c["market"]["active"]: row1.append(InlineKeyboardButton(c["market"]["label"], web_app=WebAppInfo(url=c["market"]["url"])))
    if row1: keyboard.append(row1)

    # Row 2: Car Internal
    row2 = []
    if c["prices"]["active"]: row2.append(InlineKeyboardButton(c["prices"]["label"], callback_data="menu_prices"))
    if c["estimate"]["active"]: row2.append(InlineKeyboardButton(c["estimate"]["label"], callback_data="menu_estimate"))
    if row2: keyboard.append(row2)

    # Row 3: Mobile
    row3 = []
    if c.get("mobile_webapp", {}).get("active"): row3.append(InlineKeyboardButton(c["mobile_webapp"]["label"], web_app=WebAppInfo(url=c["mobile_webapp"]["url"])))
    if c.get("mobile_list", {}).get("active"): row3.append(InlineKeyboardButton(c["mobile_list"]["label"], callback_data="menu_mobile_list"))
    if row3: keyboard.append(row3)

    # Row 4: Utilities + Support
    row4 = []
    if c["search"]["active"]: row4.append(InlineKeyboardButton(c["search"]["label"], callback_data="menu_search"))
    
    if c["support"]["active"]:
        if sup_conf["mode"] == "link":
             row4.append(InlineKeyboardButton(c["support"]["label"], url=sup_conf["value"]))
        else:
             row4.append(InlineKeyboardButton(c["support"]["label"], callback_data="menu_support"))
    
    if row4: keyboard.append(row4)

    # Admin Button
    if is_admin(user_id):
        keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])

    
    # Footer: Channel & Sponsor
    footer = []
    # Channel Config Check
    if c.get("channel", {}).get("active"):
        footer.append(InlineKeyboardButton(c["channel"]["label"], url=c["channel"]["url"]))
    
    # Sponsor Config Check
    sponsor = d.get("sponsor", {})
    if sponsor.get("name") and sponsor.get("url"):
        footer.append(InlineKeyboardButton(f"⭐ {sponsor['name']}", url=sponsor['url']))
        
    if footer: keyboard.append(footer)
    
    return InlineKeyboardMarkup(keyboard)

def get_ai_control_menu(user_id):
    d = load_data()
    conf = d.get("ai_config", {})
    source = conf.get("source", "gemini")
    priority = conf.get("priority", "excel")
    schedule = conf.get("schedule", 0)

    keyboard = [
        [InlineKeyboardButton("⚙️ منبع دیتا (Source)", callback_data="noop")],
        [
            InlineKeyboardButton(("✅ " if source == 'gemini' else '') + "Gemini", callback_data="ai_set_source_gemini"),
            InlineKeyboardButton(("✅ " if source == 'deepseek' else '') + "DeepSeek", callback_data="ai_set_source_deepseek"),
            InlineKeyboardButton(("✅ " if source == 'openai' else '') + "ChatGPT", callback_data="ai_set_source_openai")
        ],
        [InlineKeyboardButton(("✅ " if source == 'hybrid' else '') + "Hybrid (ترکیبی)", callback_data="ai_set_source_hybrid")],
        [InlineKeyboardButton("⚖️ اولویت (Priority)", callback_data="noop")],
        [
            InlineKeyboardButton(("✅ " if priority == 'excel' else '') + "اکسل", callback_data="ai_set_priority_excel"),
            InlineKeyboardButton(("✅ " if priority == 'ai' else '') + "هوش مصنوعی", callback_data="ai_set_priority_ai")
        ],
        [InlineKeyboardButton("⏰ زمانبندی آپدیت خودکار", callback_data="noop")],
        [
            InlineKeyboardButton(("✅ " if schedule == 1 else '') + "1h", callback_data="ai_set_schedule_1"),
            InlineKeyboardButton(("✅ " if schedule == 3 else '') + "3h", callback_data="ai_set_schedule_3"),
            InlineKeyboardButton(("✅ " if schedule == 6 else '') + "6h", callback_data="ai_set_schedule_6"),
            InlineKeyboardButton(("✅ " if schedule == 12 else '') + "12h", callback_data="ai_set_schedule_12"),
            InlineKeyboardButton(("✅ " if schedule == 24 else '') + "24h", callback_data="ai_set_schedule_24")
        ],
        [InlineKeyboardButton("🚫 خاموش کردن زمانبندی", callback_data="ai_set_schedule_0")],
        [InlineKeyboardButton("🔄 آپدیت قیمت‌ها (همین الان)", callback_data="ai_update_now")],
        [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
    ]
    return InlineKeyboardMarkup(keyboard)

async def send_auto_backup(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    if os.path.exists(DATA_FILE):
        await context.bot.send_document(chat_id=job.chat_id, document=open(DATA_FILE, 'rb'), caption=f"💾 Auto-Backup ({job.name})")


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
    
    # --- ADMIN HOME ---
    if data == "admin_home" and is_admin(user_id):
        keyboard = [
            [InlineKeyboardButton("⚙️ مدیریت منو", callback_data="admin_menus")],
            [InlineKeyboardButton("✨ مرکز کنترل AI", callback_data="admin_ai_control")],
            [InlineKeyboardButton("📂 مدیریت اکسل", callback_data="admin_excel_management")],
            [InlineKeyboardButton("➕ افزودن تکی خودرو", callback_data="admin_add_car")],
            [InlineKeyboardButton("📞 تنظیم پشتیبانی", callback_data="admin_set_support")],
            [InlineKeyboardButton("👥 ادمین‌ها", callback_data="admin_manage_admins")],
            [InlineKeyboardButton("💾 بکاپ", callback_data="admin_backup_menu")],
            [InlineKeyboardButton("⭐ اسپانسر", callback_data="admin_set_sponsor")],
            [InlineKeyboardButton("📣 پیام همگانی", callback_data="admin_broadcast")],
            [InlineKeyboardButton("🔙 خروج", callback_data="main_menu")]
        ]
        await query.edit_message_text("🛠 **پنل مدیریت**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_ai_control" and is_admin(user_id):
        await query.edit_message_text("✨ **مرکز کنترل هوش مصنوعی**", reply_markup=get_ai_control_menu(user_id), parse_mode='Markdown')
        return

    if data == "admin_excel_management" and is_admin(user_id):
        keyboard = [
            [InlineKeyboardButton("📥 دانلود فایل نمونه (Template)", callback_data="admin_download_template")],
            [InlineKeyboardButton("📤 آپلود فایل تکمیل شده", callback_data="admin_update_excel")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text("📊 **مدیریت دیتابیس اکسل**\n\nمی‌توانید فایل نمونه را دانلود کرده و پس از پر کردن، دوباره آپلود کنید.", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_download_template" and is_admin(user_id):
        try:
            # Create a multi-sheet Excel file or just one sheet with a 'type' column
            # Let's use one sheet with a 'type' column for simplicity, or two dataframes
            car_df = pd.DataFrame(columns=['type', 'brand', 'model', 'variant', 'factoryPrice', 'marketPrice'])
            car_df.loc[0] = ['car', 'ایران خودرو', 'پژو 207', 'دنده ای هیدرولیک', 450000000, 750000000]
            car_df.loc[1] = ['mobile', 'Samsung', 'Galaxy S24 Ultra', '256GB', 0, 75000000]
            
            template_path = "template.xlsx"
            car_df.to_excel(template_path, index=False)
            await context.bot.send_document(chat_id=user_id, document=open(template_path, 'rb'), caption="📝 فایل نمونه اکسل (خودرو و موبایل)\nستون type باید شامل car یا mobile باشد.\nلطفا طبق همین فرمت فایل را پر کرده و ارسال کنید.")
            os.remove(template_path)
        except Exception as e:
            await query.message.reply_text(f"❌ خطا در ساخت فایل: {e}")
        return

    if data == "admin_update_excel" and is_admin(user_id):
        set_state(user_id, STATE_ADMIN_WAIT_EXCEL)
        await query.message.reply_text("📂 لطفا فایل اکسل (xlsx) را با فرمت مشخص شده ارسال کنید.")
        return

    if data.startswith("ai_set_source_") and is_admin(user_id):
        source = data.replace("ai_set_source_", "")
        d = load_data()
        if "ai_config" not in d: d["ai_config"] = {}
        d["ai_config"]["source"] = source
        save_data(d)
        await query.edit_message_text("✨ **مرکز کنترل هوش مصنوعی**", reply_markup=get_ai_control_menu(user_id), parse_mode='Markdown')
        return

    if data.startswith("ai_set_priority_") and is_admin(user_id):
        priority = data.replace("ai_set_priority_", "")
        d = load_data()
        if "ai_config" not in d: d["ai_config"] = {}
        d["ai_config"]["priority"] = priority
        save_data(d)
        await query.edit_message_text("✨ **مرکز کنترل هوش مصنوعی**", reply_markup=get_ai_control_menu(user_id), parse_mode='Markdown')
        return

    if data.startswith("ai_set_schedule_") and is_admin(user_id):
        hours = int(data.replace("ai_set_schedule_", ""))
        d = load_data()
        if "ai_config" not in d: d["ai_config"] = {}
        d["ai_config"]["schedule"] = hours
        save_data(d)
        # Logic to restart the job queue would be needed here
        await query.edit_message_text("✨ **مرکز کنترل هوش مصنوعی**", reply_markup=get_ai_control_menu(user_id), parse_mode='Markdown')
        return

    # --- ADMIN: CHANNEL SETTINGS (REMOVED REDUNDANT) ---
    # Generic menu management handles this now.

    # --- ADMIN: SET SUPPORT ---
    if data == "admin_set_support":
        set_state(user_id, STATE_ADMIN_SET_SUPPORT)
        await query.message.reply_text(
            "📞 **تنظیم دکمه پشتیبانی**\\n\\n"
            "لطفا یکی از موارد زیر را ارسال کنید:\\n"
            "1. یک **لینک** (مثلا https://t.me/admin) -> دکمه به صورت لینک مستقیم باز می‌شود.\\n"
            "2. یک **متن یا شماره** -> وقتی کاربر کلیک کند، این متن به او نمایش داده می‌شود.",
            parse_mode='Markdown'
        )
        return

    # --- ADMIN: MENU MANAGEMENT ---
    if data == "admin_menus":
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG)
        keyboard = []
        for key, val in c.items():
            status = "✅" if val["active"] else "❌"
            keyboard.append([InlineKeyboardButton(f"{status} {val['label']}", callback_data=f"edit_menu_{key}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")])
        await query.edit_message_text("⚙️ **مدیریت منو**\\n\\nکدام دکمه را می‌خواهید ویرایش کنید؟", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("edit_menu_"):
        key = data.replace("edit_menu_", "")
            
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG).get(key, {})
        
        status_text = "فعال ✅" if c["active"] else "غیرفعال ❌"
        text = f"🔧 ویرایش دکمه: **{c['label']}**\\nوضعیت فعلی: {status_text}\\n"
        if "url" in c: text += f"لینک فعلی: {c['url']}"
        
        keyboard = [
            [InlineKeyboardButton("✏️ تغییر نام دکمه", callback_data=f"menu_set_label_{key}")],
            [InlineKeyboardButton("👁️ تغییر وضعیت (روشن/خاموش)", callback_data=f"menu_toggle_{key}")]
        ]
        if "url" in c:
            keyboard.append([InlineKeyboardButton("🔗 تغییر لینک", callback_data=f"menu_set_url_{key}")])
        
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_menus")])
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("menu_toggle_"):
        key = data.replace("menu_toggle_", "")
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["active"] = not d["menu_config"][key]["active"]
        save_data(d)
        new_status = "✅ فعال" if d["menu_config"][key]["active"] else "❌ غیرفعال"
        await query.answer(f"دکمه {new_status} شد", show_alert=True)
        # Refresh Logic
        query.data = f"edit_menu_{key}" 
        await handle_callback(update, context) 
        return

    if data.startswith("menu_set_label_"):
        key = data.replace("menu_set_label_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_LABEL)
        await query.message.reply_text(f"✍️ نام جدید برای این دکمه را وارد کنید:")
        return

    if data.startswith("menu_set_url_"):
        key = data.replace("menu_set_url_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_URL)
        await query.message.reply_text(f"🔗 لینک جدید را وارد کنید (باید با https شروع شود):")
        return

    # --- ADMIN: SPONSOR ---
    if data == "admin_set_sponsor":
        set_state(user_id, STATE_ADMIN_SPONSOR_NAME)
        await query.message.reply_text("✍️ نام اسپانسر را وارد کنید:")
        return

    # --- ADMIN: BROADCAST ---
    if data == "admin_broadcast":
        set_state(user_id, STATE_ADMIN_BROADCAST)
        await query.message.reply_text("✍️ متن پیام همگانی را بفرستید (برای همه کاربران ارسال می‌شود):")
        return

    # --- ADMIN: MANAGE ADMINS ---
    if data == "admin_manage_admins":
        d = load_data()
        admins = d.get("admins", [])
        text = f"👥 لیست ادمین‌ها:\\nOwner: {OWNER_ID}\\n" + "\\n".join([str(a) for a in admins])
        keyboard = [
            [InlineKeyboardButton("➕ افزودن ادمین جدید", callback_data="admin_add_new_admin")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "admin_add_new_admin":
        set_state(user_id, STATE_ADMIN_ADD_ADMIN)
        await query.message.reply_text("🔢 شناسه عددی (ID) کاربر را وارد کنید:")
        return

    # --- BACKUP MENU ---
    if data == "admin_backup_menu" and is_admin(user_id):
        d = load_data()
        interval = d.get("backup_interval", 0)
        status = "❌ خاموش" if interval == 0 else (f"✅ هر {interval} ساعت")
        keyboard = [
            [InlineKeyboardButton("📥 دریافت بکاپ (همین الان)", callback_data="backup_get_now")],
            [InlineKeyboardButton("⏱ تنظیم ساعتی (1h)", callback_data="backup_set_1h"), InlineKeyboardButton("📅 تنظیم روزانه (24h)", callback_data="backup_set_24h")],
            [InlineKeyboardButton("🚫 خاموش کردن بکاپ", callback_data="backup_off")],
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
        await query.edit_message_text(f"✅ تنظیم شد: {new_interval} ساعت", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("بازگشت", callback_data="admin_backup_menu")]]))
        return

    # --- USER: SUPPORT HANDLER ---
    if data == "menu_support":
        d = load_data()
        sup_conf = d.get("support_config", {"mode": "text", "value": "..."})
        text_val = sup_conf["value"]
        await query.message.reply_text(f"📞 **اطلاعات پشتیبانی:**\\n\\n{text_val}", parse_mode='Markdown')
        return

    # --- MOBILE FLOW (AI-Powered) ---
    if data == "menu_mobile_list":
        keyboard = [
            [InlineKeyboardButton("📲 لیست کامل (هوش مصنوعی)", callback_data="mobile_list_full")],
            [InlineKeyboardButton("📂 انتخاب برند (دیتابیس)", callback_data="mobile_list_categories")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")]
        ]
        await query.edit_message_text("📱 نحوه نمایش لیست موبایل را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "mobile_list_full":
        if not MOBILE_DB:
            await query.edit_message_text("⚠️ دیتابیس موبایل خالی است.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")]]))
            return

        lines = [f"📱 **لیست قیمت روز موبایل**\n📅 تاریخ: {jdatetime.date.today().strftime('%Y/%m/%d')}\n"]
        for brand, b_data in MOBILE_DB.items():
            lines.append(f"\n🏷 **{brand}**")
            lines.append("-------------------")
            for model in b_data.get("models", []):
                price = model['price']
                try: p_str = f"{int(float(str(price).replace(',', ''))):,} تومان"
                except: p_str = str(price)
                lines.append(f"🔹 {model['name']} ({model.get('storage', '-')}) ➔ {p_str}")
            lines.append("-------------------")

        # Split into messages of max 4000 chars
        full_text = "\n".join(lines)
        chunks = [full_text[i:i+4000] for i in range(0, len(full_text), 4000)]
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                await query.edit_message_text(chunk, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")]]))
            else:
                await context.bot.send_message(chat_id=user_id, text=chunk, parse_mode='Markdown')
        return

    if data == "mobile_list_categories":
        keyboard = []
        if not MOBILE_DB:
            await query.edit_message_text("⚠️ دیتابیس موبایل خالی است. لطفا از پنل مدیریت فایل اکسل آپلود کنید.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")]]))
            return
        for brand in MOBILE_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"mob_brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")])
        await query.edit_message_text("📱 برند موبایل را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
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
            text = (f"📱 **قیمت روز موبایل**\\n"
                    f"🏷 مدل: {found_model['name']}\\n"
                    f"💾 حافظه: {found_model.get('storage', '-')}\\n"
                    f"-------------------\\n"
                    f"💰 **قیمت تقریبی:** {found_model['price']} میلیون تومان")
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"mob_brand_{brand_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    # --- CAR PRICE LIST (AI-Powered) ---
    if data == "menu_prices":
        keyboard = [
            [InlineKeyboardButton("📋 لیست کامل (هوش مصنوعی)", callback_data="car_list_full")],
            [InlineKeyboardButton("🏢 انتخاب شرکت (دیتابیس)", callback_data="car_list_categories")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")]
        ]
        await query.edit_message_text("🚗 نحوه نمایش لیست قیمت خودرو را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "car_list_full":
        if not CAR_DB:
            await query.edit_message_text("⚠️ دیتابیس خودرو خالی است.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")]]))
            return

        lines = [f"🚗 **لیست قیمت روز خودرو**\n📅 تاریخ: {jdatetime.date.today().strftime('%Y/%m/%d')}\n"]
        for brand, b_data in CAR_DB.items():
            lines.append(f"\n🏢 **{brand}**")
            lines.append("-------------------")
            for model in b_data.get("models", []):
                for variant in model.get("variants", []):
                    m_price = variant['marketPrice']
                    try: p_str = f"{int(float(str(m_price).replace(',', ''))):,} تومان"
                    except: p_str = str(m_price)
                    lines.append(f"🔹 {model['name']} ({variant['name']}) ➔ {p_str}")
            lines.append("-------------------")

        full_text = "\n".join(lines)
        chunks = [full_text[i:i+4000] for i in range(0, len(full_text), 4000)]
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                await query.edit_message_text(chunk, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")]]))
            else:
                await context.bot.send_message(chat_id=user_id, text=chunk, parse_mode='Markdown')
        return

    if data == "car_list_categories":
        keyboard = []
        if not CAR_DB:
            await query.edit_message_text("⚠️ دیتابیس خودرو خالی است. لطفا از پنل مدیریت فایل اکسل آپلود کنید.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")]]))
            return
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
        await query.edit_message_text("🏢 شرکت سازنده را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
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
            m_price = found_variant.get('marketPrice', 0)
            f_price = found_variant.get('factoryPrice', 0)
            
            def format_p(p):
                try:
                    # Check if it's a number or can be converted to one
                    val = float(str(p).replace(',', ''))
                    return f"{int(val):,} تومان"
                except:
                    return str(p)
            
            m_text = format_p(m_price)
            f_text = format_p(f_price)
            
            diff_text = ""
            try:
                m_val = int(float(str(m_price).replace(',', '')))
                f_val = int(float(str(f_price).replace(',', '')))
                diff = m_val - f_val
                diff_text = f"\n\n⚖️ **اختلاف قیمت:**\n💰 {diff:,} تومان"
            except:
                pass

            text = (f"📊 **استعلام قیمت**\n\n"
                    f"🚘 {found_variant['name']}\n"
                    f"-------------------\n"
                    f"📉 **قیمت بازار:**\n"
                    f"💰 {m_text}\n\n"
                    f"🏭 **کارخانه:**\n"
                    f"🏦 {f_text}"
                    f"{diff_text}")
            
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"model_{model_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_search":
        set_state(user_id, STATE_SEARCH)
        await query.edit_message_text("🔍 نام خودرو یا برند مورد نظر را وارد کنید:", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")]]))
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

    if data == "ai_update_now" and is_admin(user_id):
        d = load_data()
        conf = d.get("ai_config", {})
        source = conf.get("source", "gemini")
        today = jdatetime.date.today().strftime('%Y/%m/%d')
        
        await query.edit_message_text(f"⏳ در حال بروزرسانی دیتابیس از طریق هوش مصنوعی...")
        try:
            if source == 'gemini' and GEMINI_API_KEY:
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel('gemini-3-flash-preview')
                
                # Fetching structured JSON for Cars
                car_prompt = (
                    f"ارائه لیست قیمت روز خودروهای صفر در ایران برای تاریخ {today}. "
                    "خروجی فقط و فقط به صورت یک JSON معتبر با ساختار زیر باشد:\n"
                    "{\"ایران خودرو\": {\"models\": [{\"name\": \"پژو 207\", \"variants\": [{\"name\": \"دنده ای\", \"factoryPrice\": 450000000, \"marketPrice\": 750000000}]}]}}\n"
                    "تمام برندهای اصلی (سایپا، مدیران خودرو، کرمان موتور و غیره) را شامل شود. قیمت‌ها به تومان و عدد باشند."
                )
                car_resp = model.generate_content(car_prompt)
                
                # Fetching structured JSON for Mobiles
                mob_prompt = (
                    f"ارائه لیست قیمت روز گوشی‌های موبایل در ایران برای تاریخ {today}. "
                    "خروجی فقط و فقط به صورت یک JSON معتبر با ساختار زیر باشد:\n"
                    "{\"Samsung\": {\"models\": [{\"name\": \"S24 Ultra\", \"storage\": \"256GB\", \"price\": 75000000}]}}\n"
                    "برندهای Apple, Samsung, Xiaomi را شامل شود. قیمت‌ها به تومان و عدد باشند."
                )
                mob_resp = model.generate_content(mob_prompt)
                
                def parse_json(text):
                    try:
                        # Clean markdown code blocks if present
                        clean_text = re.sub(r'```json\n?|\n?```', '', text).strip()
                        return json.loads(clean_text)
                    except: return None

                new_cars = parse_json(car_resp.text)
                new_mobs = parse_json(mob_resp.text)

                if new_cars:
                    global CAR_DB
                    CAR_DB.update(new_cars)
                    save_car_db()
                
                if new_mobs:
                    global MOBILE_DB
                    MOBILE_DB.update(new_mobs)
                    try:
                        with open('mobile_db.json', 'w', encoding='utf-8') as f:
                            json.dump(MOBILE_DB, f, ensure_ascii=False, indent=4)
                    except: pass

                # Also save a text version for the "Full List" cache
                if "cache" not in d: d["cache"] = {}
                d["cache"]["car_date"] = today
                d["cache"]["mobile_date"] = today
                save_data(d)
                
                await query.edit_message_text("✅ دیتابیس با موفقیت بروزرسانی شد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="admin_ai_control")]])) 
            else:
                await query.edit_message_text("⚠️ در حال حاضر فقط Gemini برای آپدیت دیتابیس پشتیبانی می‌شود.")
        except Exception as e:
            await query.edit_message_text(f"❌ خطا در بروزرسانی: {e}")
        return

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = get_state(user_id)
    
    if text == "/id":
        await update.message.reply_text(f"🆔 {user_id}")
        return

    # --- ADMIN: SET SUPPORT ---
    if state_info["state"] == STATE_ADMIN_SET_SUPPORT:
        d = load_data()
        mode = "link" if text.startswith("http") else "text"
        if text.startswith("@"):
            text = f"https://t.me/{text.replace('@', '')}"
            mode = "link"
        d["support_config"] = {"mode": mode, "value": text}
        save_data(d)
        type_msg = "لینک" if mode == "link" else "متن"
        await update.message.reply_text(f"✅ پشتیبانی تنظیم شد به صورت **{type_msg}**.\\nمقدار: {text}", parse_mode='Markdown')
        reset_state(user_id)
        return

    # --- ADMIN: EDIT MENU INPUTS ---
    if state_info["state"] == STATE_ADMIN_EDIT_MENU_LABEL:
        key = state_info["data"].get("edit_key")
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["label"] = text
        save_data(d)
        await update.message.reply_text(f"✅ نام دکمه تغییر کرد به: {text}")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_EDIT_MENU_URL:
        key = state_info["data"].get("edit_key")
        if not text.startswith("http"):
            await update.message.reply_text("❌ لینک نامعتبر است. با http یا https شروع کنید.")
            return
        d = load_data()
        if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
        d["menu_config"][key]["url"] = text
        save_data(d)
        await update.message.reply_text(f"✅ لینک دکمه آپدیت شد.")
        reset_state(user_id)
        return

    # --- ADMIN INPUTS ---
    if state_info["state"] == STATE_ADMIN_ADD_ADMIN:
        try:
            new_admin_id = int(text)
            d = load_data()
            if "admins" not in d: d["admins"] = []
            if new_admin_id not in d["admins"]: d["admins"].append(new_admin_id)
            save_data(d)
            await update.message.reply_text(f"✅ ادمین {new_admin_id} اضافه شد.")
        except: await update.message.reply_text("❌ خطا: فقط عدد وارد کنید.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_SPONSOR_NAME:
        update_data(user_id, "sponsor_name", text)
        set_state(user_id, STATE_ADMIN_SPONSOR_LINK)
        await update.message.reply_text("🔗 حالا لینک اسپانسر را وارد کنید:")
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
        await update.message.reply_text(f"✅ پیام به {count} نفر ارسال شد.")
        reset_state(user_id)
        return

    # --- SEARCH LOGIC ---
    if state_info["state"] == STATE_SEARCH:
        results = []
        search_query = text.lower()
        
        # Search in Cars
        for brand, b_data in CAR_DB.items():
            if search_query in brand.lower():
                results.append(f"🏢 **برند:** {brand}")
            for model in b_data["models"]:
                if search_query in model["name"].lower():
                    results.append(f"🚗 **مدل:** {model['name']} ({brand})")
                for variant in model["variants"]:
                    if search_query in variant["name"].lower():
                        p_val = variant['marketPrice']
                        try:
                            p_formatted = f"{int(float(str(p_val).replace(',', ''))):,} تومان"
                        except:
                            p_formatted = str(p_val)
                        results.append(f"🔹 **تیپ:** {variant['name']} ({model['name']}) -> {p_formatted}")
        
        # Search in Mobiles
        for brand, b_data in MOBILE_DB.items():
            if search_query in brand.lower():
                results.append(f"📱 **برند موبایل:** {brand}")
            for model in b_data.get("models", []):
                if search_query in model["name"].lower():
                    results.append(f"📲 **مدل موبایل:** {model['name']} ({brand}) -> {model['price']} میلیون تومان")

        if results:
            response_text = "🔍 **نتایج جستجو:**\n\n" + "\n".join(results[:15])
            if len(results) > 15: response_text += "\n\n... و موارد بیشتر"
        else:
            response_text = "❌ موردی یافت نشد. لطفا نام دقیق‌تری وارد کنید."
        
        await update.message.reply_text(response_text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")]]))
        reset_state(user_id)
        return

    # --- ESTIMATION INPUTS ---
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

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state_info = get_state(user_id)

    if is_admin(user_id) and state_info["state"] == STATE_ADMIN_WAIT_EXCEL:
        doc = update.message.document
        if not doc.file_name.endswith(('.xlsx', '.xls')):
            await update.message.reply_text("❌ فرمت فایل نامعتبر است. لطفا فایل اکسل (xlsx) ارسال کنید.")
            return

        try:
            file = await context.bot.get_file(doc.file_id)
            file_path = f"{doc.file_id}.xlsx"
            await file.download_to_drive(file_path)

            df = pd.read_excel(file_path)
            required_columns = ['brand', 'model', 'variant', 'factoryPrice', 'marketPrice']
            if not all(col in df.columns for col in required_columns):
                await update.message.reply_text(f"❌ فایل اکسل ناقص است. ستون‌های مورد نیاز: {required_columns}")
                os.remove(file_path)
                return

            global CAR_DB, MOBILE_DB
            CAR_DB = {}
            MOBILE_DB = {}
            
            for index, row in df.iterrows():
                row_type = str(row.get('type', 'car')).lower()
                brand = str(row['brand'])
                model_name = str(row['model'])
                variant_name = str(row.get('variant', ''))
                
                if row_type == 'car':
                    if brand not in CAR_DB:
                        CAR_DB[brand] = {"models": []}
                    
                    model_obj = next((m for m in CAR_DB[brand]["models"] if m["name"] == model_name), None)
                    if not model_obj:
                        model_obj = {"name": model_name, "variants": []}
                        CAR_DB[brand]["models"].append(model_obj)
                    
                    model_obj["variants"].append({
                        "name": variant_name,
                        "factoryPrice": row['factoryPrice'],
                        "marketPrice": row['marketPrice']
                    })
                elif row_type == 'mobile':
                    if brand not in MOBILE_DB:
                        MOBILE_DB[brand] = {"models": []}
                    
                    # For mobiles, we use 'price' instead of factory/market in the current DB structure
                    # But we can adapt or just use marketPrice as the main price
                    MOBILE_DB[brand]["models"].append({
                        "name": model_name,
                        "storage": variant_name,
                        "price": row['marketPrice']
                    })

            save_car_db()
            # Also need to save mobile db
            try:
                with open('mobile_db.json', 'w', encoding='utf-8') as f:
                    json.dump(MOBILE_DB, f, ensure_ascii=False, indent=4)
            except: pass
            
            await update.message.reply_text(f"✅ فایل اکسل با موفقیت پردازش شد. {len(df)} رکورد بروزرسانی شد.")
            os.remove(file_path)

        except Exception as e:
            logger.error(f"Excel Processing Error: {e}")
            await update.message.reply_text(f"❌ خطایی در پردازش فایل اکسل رخ داد: {e}")
        
        finally:
            reset_state(user_id)

async def post_init(application):
    # Auto-Backup
    data = load_data()
    interval = data.get("backup_interval", 0)
    if interval > 0:
        application.job_queue.run_repeating(send_auto_backup, interval=interval*3600, first=60, name='auto_backup')
    # Fix Commands
    try:
        await application.bot.set_my_commands([
            BotCommand("start", "🏠 منوی اصلی"),
            BotCommand("admin", "👑 پنل مدیریت"),
            BotCommand("fixmenu", "🔧 تعمیر دکمه منو")
        ])
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    except: pass

if __name__ == '__main__':
    load_car_db()
    # Load Mobile DB
    try:
        if os.path.exists('mobile_db.json'):
            with open('mobile_db.json', 'r', encoding='utf-8') as f:
                MOBILE_DB = json.load(f)
    except: pass
    if TOKEN == 'REPLACE_ME_TOKEN': print("⚠️ Configure token in bot.py")
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("fixmenu", fix_menu))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    print("Bot is running...")
    app.run_polling()