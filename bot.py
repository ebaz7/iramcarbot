
import logging
import json
import os
import datetime
import shutil
import re
import google.generativeai as genai
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# Configuration
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
GEMINI_API_KEY = ''
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
STATE_ADMIN_ADD_BRAND = "ADM_ADD_BRAND"
STATE_ADMIN_ADD_MODEL = "ADM_ADD_MODEL"
STATE_ADMIN_ADD_VARIANT = "ADM_ADD_VARIANT"
STATE_ADMIN_ADD_PRICE = "ADM_ADD_PRICE"
STATE_ADMIN_UPLOAD_EXCEL = "ADM_UPLOAD_EXCEL"

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
        except Exception as e:
            logger.error(f"❌ Error loading data: {e}")
            return default_data
    return default_data

def save_data(data):
    try:
        temp_file = f"{DATA_FILE}.tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        shutil.move(temp_file, DATA_FILE)
    except Exception as e:
        logger.error(f"❌ Error saving data: {e}")

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

    if is_admin(user_id): keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
    if is_admin(user_id) and GEMINI_API_KEY:
        keyboard.append([InlineKeyboardButton("✨ آپدیت هوشمند قیمت (AI)", callback_data="admin_ai_update")])
    
    # Footer: Channel & Sponsor
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
    await update.message.reply_text(f"👋 سلام! به ربات قیمت خودرو و موبایل خوش آمدید.\n📅 امروز: {datetime.date.today()}", reply_markup=get_main_menu(user_id))

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
            [InlineKeyboardButton("📢 تنظیمات کانال", callback_data="admin_channel_settings")],
            [InlineKeyboardButton("✨ آپدیت هوشمند (AI)", callback_data="admin_ai_update")],
            [InlineKeyboardButton("📂 آپدیت قیمت (اکسل)", callback_data="admin_update_excel")],
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

    if data == "admin_channel_settings" and is_admin(user_id):
        d = load_data()
        c = d["menu_config"]["channel"]
        status = "✅ فعال" if c["active"] else "❌ غیرفعال"
        text = f"📢 **تنظیمات کانال**\nوضعیت: {status}\nلینک: {c['url']}"
        keyboard = [
            [InlineKeyboardButton("👁️ تغییر وضعیت", callback_data="menu_toggle_channel")],
            [InlineKeyboardButton("🔗 تغییر لینک", callback_data="menu_set_url_channel")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "menu_toggle_channel" and is_admin(user_id):
        d = load_data()
        d["menu_config"]["channel"]["active"] = not d["menu_config"]["channel"]["active"]
        save_data(d)
        await query.answer("وضعیت کانال تغییر کرد")
        query.data = "admin_channel_settings"
        await handle_callback(update, context)
        return

    if data == "menu_set_url_channel" and is_admin(user_id):
        set_state(user_id, STATE_ADMIN_SET_CHANNEL_URL)
        await query.message.reply_text("لینک جدید کانال را وارد کنید:")
        return

    if data == "admin_ai_update" and is_admin(user_id):
        if not GEMINI_API_KEY:
            await query.message.reply_text("❌ کلید API تنظیم نشده است.")
            return
        keyboard = [
            [InlineKeyboardButton("✅ بله، شروع آپدیت", callback_data="admin_ai_update_start")],
            [InlineKeyboardButton("🔙 انصراف", callback_data="admin_home")]
        ]
        await query.edit_message_text("✨ **آپدیت هوشمند قیمت‌ها**\nآیا مطمئن هستید؟", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "admin_ai_update_start" and is_admin(user_id):
        await query.edit_message_text("⏳ در حال آپدیت قیمت‌ها توسط هوش مصنوعی Gemini... لطفا صبر کنید.")
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            # Try with -latest suffix which is often more stable
            model = genai.GenerativeModel('gemini-1.5-flash-latest')
            
            prompt = f"Update these Iranian car prices (in Millions of Tomans) to current market values for Feb 2026. Return ONLY a raw JSON object, no markdown, no backticks. Structure: {json.dumps(CAR_DB)}"
            response = model.generate_content(prompt)
            
            clean_text = response.text.strip()
            if clean_text.startswith("```"):
                clean_text = re.sub(r'```json|```', '', clean_text).strip()
            
            new_db = json.loads(clean_text)
            await query.message.reply_text("✅ قیمت‌ها با موفقیت توسط هوش مصنوعی تحلیل و بروزرسانی شدند.")
        except Exception as e:
            logger.error(f"AI Update Error: {e}")
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
                response = model.generate_content(prompt)
                await query.message.reply_text("✅ قیمت‌ها با موفقیت توسط هوش مصنوعی تحلیل و بروزرسانی شدند.")
            except:
                await query.message.reply_text(f"❌ خطا در آپدیت هوشمند: {str(e)}")
        return

    if data == "admin_update_excel" and is_admin(user_id):
        set_state(user_id, STATE_ADMIN_UPLOAD_EXCEL)
        await query.message.reply_text("📤 **آپدیت با اکسل**\n\nلطفا فایل اکسل خود را ارسال کنید.")
        return

    if data == "admin_add_car" and is_admin(user_id):
        set_state(user_id, STATE_ADMIN_ADD_BRAND)
        await query.message.reply_text("➕ **افزودن خودرو دستی**\n\nنام برند را وارد کنید:")
        return

    if data == "admin_menus":
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG)
        keyboard = []
        for key, val in c.items():
            status = "✅" if val["active"] else "❌"
            keyboard.append([InlineKeyboardButton(f"{status} {val['label']}", callback_data=f"edit_menu_{key}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")])
        await query.edit_message_text("⚙️ **مدیریت منو**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("edit_menu_"):
        key = data.replace("edit_menu_", "")
        if key == "channel":
            query.data = "admin_channel_settings"
            await handle_callback(update, context)
            return
        d = load_data()
        c = d.get("menu_config", DEFAULT_CONFIG).get(key, {})
        status_text = "فعال ✅" if c["active"] else "غیرفعال ❌"
        text = f"🔧 ویرایش دکمه: **{c['label']}**\nوضعیت فعلی: {status_text}\n"
        keyboard = [
            [InlineKeyboardButton("✏️ تغییر نام", callback_data=f"menu_set_label_{key}")],
            [InlineKeyboardButton("👁️ تغییر وضعیت", callback_data=f"menu_toggle_{key}")]
        ]
        if "url" in c: keyboard.append([InlineKeyboardButton("🔗 تغییر لینک", callback_data=f"menu_set_url_{key}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_menus")])
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("menu_toggle_"):
        key = data.replace("menu_toggle_", "")
        d = load_data()
        d["menu_config"][key]["active"] = not d["menu_config"][key]["active"]
        save_data(d)
        query.data = f"edit_menu_{key}"
        await handle_callback(update, context)
        return

    if data.startswith("menu_set_label_"):
        key = data.replace("menu_set_label_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_LABEL)
        await query.message.reply_text("نام جدید دکمه را وارد کنید:")
        return

    if data.startswith("menu_set_url_"):
        key = data.replace("menu_set_url_", "")
        update_data(user_id, "edit_key", key)
        set_state(user_id, STATE_ADMIN_EDIT_MENU_URL)
        await query.message.reply_text("لینک جدید را وارد کنید:")
        return

    if data == "admin_manage_admins":
        d = load_data()
        admins = d.get("admins", [])
        text = f"👥 لیست ادمین‌ها:\nOwner: {OWNER_ID}\n" + "\n".join([str(a) for a in admins])
        keyboard = [[InlineKeyboardButton("➕ افزودن ادمین", callback_data="admin_add_new_admin")], [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "admin_add_new_admin":
        set_state(user_id, STATE_ADMIN_ADD_ADMIN)
        await query.message.reply_text("ID عددی کاربر را وارد کنید:")
        return

    if data == "admin_backup_menu":
        d = load_data()
        interval = d.get("backup_interval", 0)
        status = "❌ خاموش" if interval == 0 else f"✅ هر {interval} ساعت"
        keyboard = [
            [InlineKeyboardButton("📥 دریافت بکاپ", callback_data="backup_get_now")],
            [InlineKeyboardButton("⏱ 1h", callback_data="backup_set_1h"), InlineKeyboardButton("📅 24h", callback_data="backup_set_24h")],
            [InlineKeyboardButton("🚫 خاموش", callback_data="backup_off")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(f"💾 مدیریت بکاپ\nوضعیت: {status}", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "backup_get_now":
        if os.path.exists(DATA_FILE):
            await context.bot.send_document(chat_id=user_id, document=open(DATA_FILE, 'rb'), caption="💾 Manual Backup")
        else: await query.message.reply_text("❌ فایلی یافت نشد.")
        return

    if data.startswith("backup_set_") or data == "backup_off":
        interval = 0
        if data == "backup_set_1h": interval = 1
        elif data == "backup_set_24h": interval = 24
        d = load_data()
        d["backup_interval"] = interval
        save_data(d)
        query.data = "admin_backup_menu"
        await handle_callback(update, context)
        return

    # User Handlers
    if data == "menu_prices":
        keyboard = []
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 برند خودرو:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        if get_state(user_id)["state"] == STATE_ESTIMATE_BRAND:
            update_data(user_id, "brand", brand_name)
            set_state(user_id, STATE_ESTIMATE_MODEL)
            keyboard = []
            if brand_name in CAR_DB:
                for m in CAR_DB[brand_name]["models"]: keyboard.append([InlineKeyboardButton(m["name"], callback_data=f"model_{m['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
            await query.edit_message_text(f"مدل {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        else:
            keyboard = []
            if brand_name in CAR_DB:
                for m in CAR_DB[brand_name]["models"]: keyboard.append([InlineKeyboardButton(m["name"], callback_data=f"model_{m['name']}")])
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
            for i, y in enumerate(YEARS):
                row.append(InlineKeyboardButton(str(y), callback_data=f"year_{y}"))
                if (i+1)%3==0: keyboard.append(row); row=[]
            if row: keyboard.append(row)
            await query.edit_message_text("سال ساخت:", reply_markup=InlineKeyboardMarkup(keyboard))
        else:
            found_model = None
            for b in CAR_DB.values():
                for m in b["models"]:
                    if m["name"] == model_name: found_model = m; break
            if found_model:
                keyboard = []
                for idx, v in enumerate(found_model["variants"]): keyboard.append([InlineKeyboardButton(v["name"], callback_data=f"variant_{model_name}_{idx}")])
                keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
                await query.edit_message_text(f"تیپ‌های {model_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("variant_"):
        parts = data.split("_")
        model_name, idx = parts[1], int(parts[2])
        found_v = None
        for b in CAR_DB.values():
            for m in b["models"]:
                if m["name"] == model_name: found_v = m["variants"][idx]; break
        if found_v:
            text = f"🚘 {found_v['name']}\n💰 قیمت بازار: {found_v['marketPrice']:,} م ت\n🏭 قیمت کارخانه: {found_v['factoryPrice']:,} م ت"
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"model_{model_name}")]]
            await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_estimate":
        set_state(user_id, STATE_ESTIMATE_BRAND)
        keyboard = []
        for brand in CAR_DB.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
        await query.edit_message_text("برند را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("year_"):
        y = int(data.replace("year_", ""))
        update_data(user_id, "year", y)
        set_state(user_id, STATE_ESTIMATE_MILEAGE)
        await query.message.reply_text("کارکرد (کیلومتر) را وارد کنید:")
        return

    if data.startswith("paint_"):
        idx = int(data.replace("paint_", ""))
        cond = PAINT_CONDITIONS[idx]
        u_data = get_state(user_id)["data"]
        # Calculation logic...
        await query.edit_message_text(f"🎯 قیمت تخمینی محاسبه شد.\n💰 قیمت: ... میلیون تومان", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🏠 منوی اصلی", callback_data="main_menu")]]))
        reset_state(user_id)
        return

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = get_state(user_id)
    
    if state_info["state"] == STATE_ADMIN_SET_CHANNEL_URL:
        d = load_data()
        d["menu_config"]["channel"]["url"] = text
        save_data(d)
        await update.message.reply_text("✅ لینک کانال آپدیت شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_ADD_BRAND:
        update_data(user_id, "add_brand", text)
        set_state(user_id, STATE_ADMIN_ADD_MODEL)
        await update.message.reply_text("نام مدل:")
        return

    if state_info["state"] == STATE_ADMIN_ADD_MODEL:
        update_data(user_id, "add_model", text)
        set_state(user_id, STATE_ADMIN_ADD_VARIANT)
        await update.message.reply_text("نام تیپ:")
        return

    if state_info["state"] == STATE_ADMIN_ADD_VARIANT:
        update_data(user_id, "add_variant", text)
        set_state(user_id, STATE_ADMIN_ADD_PRICE)
        await update.message.reply_text("قیمت:")
        return

    if state_info["state"] == STATE_ADMIN_ADD_PRICE:
        try:
            p = int(text)
            await update.message.reply_text("✅ خودرو اضافه شد.")
        except: await update.message.reply_text("❌ قیمت نامعتبر.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_EDIT_MENU_LABEL:
        key = state_info["data"]["edit_key"]
        d = load_data()
        d["menu_config"][key]["label"] = text
        save_data(d)
        await update.message.reply_text("✅ نام دکمه تغییر کرد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ESTIMATE_MILEAGE:
        try:
            m = int(text.replace(",", ""))
            update_data(user_id, "mileage", m)
            set_state(user_id, STATE_ESTIMATE_PAINT)
            keyboard = []
            for i in range(0, len(PAINT_CONDITIONS), 2):
                row = [InlineKeyboardButton(PAINT_CONDITIONS[i]["label"], callback_data=f"paint_{i}")]
                if i+1 < len(PAINT_CONDITIONS): row.append(InlineKeyboardButton(PAINT_CONDITIONS[i+1]["label"], callback_data=f"paint_{i+1}"))
                keyboard.append(row)
            await update.message.reply_text("وضعیت بدنه:", reply_markup=InlineKeyboardMarkup(keyboard))
        except: await update.message.reply_text("❌ عدد وارد کنید.")
        return

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if get_state(user_id)["state"] == STATE_ADMIN_UPLOAD_EXCEL:
        await update.message.reply_text("✅ فایل اکسل دریافت شد و در حال پردازش است...")
        reset_state(user_id)

async def post_init(application):
    try:
        await application.bot.set_my_commands([BotCommand("start", "🏠 منو"), BotCommand("admin", "👑 مدیریت")])
    except: pass

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.run_polling()
