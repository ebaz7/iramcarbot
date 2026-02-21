
import logging
import json
import os
import datetime
import shutil
import re
import pandas as pd
import google.generativeai as genai
from openai import OpenAI
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# --- Configuration ---
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
GEMINI_API_KEY = ''
DEEPSEEK_API_KEY = ''
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

# --- Database ---
CAR_DB = {
    "ایران خودرو": {
        "پژو ۲۰۷": {"۱۴۰۳": "۹۸۰,۰۰۰,۰۰۰", "۱۴۰۲": "۹۲۰,۰۰۰,۰۰۰"},
        "دنا پلاس توربو": {"۱۴۰۳": "۱,۱۰۰,۰۰۰,۰۰۰", "۱۴۰۲": "۱,۰۲۰,۰۰۰,۰۰۰"}
    },
    "سایپا": {
        "کوییک GXR-L": {"۱۴۰۳": "۴۵۰,۰۰۰,۰۰۰", "۱۴۰۲": "۴۲۰,۰۰۰,۰۰۰"},
        "شاهین G": {"۱۴۰۳": "۸۲۰,۰۰۰,۰۰۰", "۱۴۰۲": "۷۶۰,۰۰۰,۰۰۰"}
    }
}

MOBILE_DB = {
    "Apple": {
        "iPhone 13 CH": "۴۸,۵۰۰,۰۰۰",
        "iPhone 11": "۲۹,۰۰۰,۰۰۰"
    },
    "Samsung": {
        "Galaxy S24 Ultra": "۷۲,۰۰۰,۰۰۰",
        "Galaxy A55": "۲۱,۵۰۰,۰۰۰"
    }
}

YEARS = [1404, 1403, 1402, 1401, 1400, 1399, 1398, 1397, 1396, 1395]

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

user_states = {}
# States
STATE_IDLE = "IDLE"
STATE_ADMIN_ADD_CAR_BRAND = "ADM_ADD_CAR_BRAND"
STATE_ADMIN_ADD_CAR_MODEL = "ADM_ADD_CAR_MODEL"
STATE_ADMIN_ADD_CAR_YEAR = "ADM_ADD_CAR_YEAR"
STATE_ADMIN_ADD_CAR_PRICE = "ADM_ADD_CAR_PRICE"
STATE_ADMIN_SET_CHANNEL_URL = "ADM_SET_CHANNEL_URL"
STATE_ADMIN_EXCEL_UPLOAD = "ADM_EXCEL_UPLOAD"
STATE_ADMIN_AI_PROMPT = "ADM_AI_PROMPT"

# --- Data Persistence ---
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"users": [], "admins": [OWNER_ID], "menu_config": DEFAULT_CONFIG, "car_db": CAR_DB, "mobile_db": MOBILE_DB}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# --- Helpers ---
def is_admin(user_id):
    d = load_data()
    return user_id == OWNER_ID or user_id in d.get("admins", [])

def get_main_menu(user_id):
    d = load_data()
    config = d.get("menu_config", DEFAULT_CONFIG)
    keyboard = []
    
    # Row 1
    row1 = []
    if config["calc"]["active"]: row1.append(InlineKeyboardButton(config["calc"]["label"], web_app=WebAppInfo(url=config["calc"]["url"])))
    if config["market"]["active"]: row1.append(InlineKeyboardButton(config["market"]["label"], web_app=WebAppInfo(url=config["market"]["url"])))
    if row1: keyboard.append(row1)
    
    # Row 2
    row2 = []
    if config["prices"]["active"]: row2.append(InlineKeyboardButton(config["prices"]["label"], callback_data="view_prices"))
    if config["estimate"]["active"]: row2.append(InlineKeyboardButton(config["estimate"]["label"], callback_data="start_estimate"))
    if row2: keyboard.append(row2)

    # Row 3
    row3 = []
    if config["mobile_webapp"]["active"]: row3.append(InlineKeyboardButton(config["mobile_webapp"]["label"], web_app=WebAppInfo(url=config["mobile_webapp"]["url"])))
    if config["mobile_list"]["active"]: row3.append(InlineKeyboardButton(config["mobile_list"]["label"], callback_data="view_mobile_list"))
    if row3: keyboard.append(row3)

    if config["channel"]["active"]:
        keyboard.append([InlineKeyboardButton(config["channel"]["label"], url=config["channel"]["url"])])

    if is_admin(user_id):
        keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
        
    return InlineKeyboardMarkup(keyboard)

# --- AI Logic ---
async def run_ai_update(provider, prompt_type="cars"):
    d = load_data()
    target_db = d["car_db"] if prompt_type == "cars" else d["mobile_db"]
    
    system_prompt = f"You are an Iranian market expert. Update the following JSON data with current Feb 2026 prices in Tomans. If prompt_type is 'mobile', generate a comprehensive list of top 20 popular phones in Iran. Return ONLY raw JSON."
    
    try:
        if provider == "gemini":
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(f"{system_prompt}\nData: {json.dumps(target_db)}")
            text = response.text
        else:
            client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps(target_db)}]
            )
            text = response.choices[0].message.content

        # Clean JSON
        text = re.sub(r'```json|```', '', text).strip()
        new_data = json.loads(text)
        
        if prompt_type == "cars": d["car_db"] = new_data
        else: d["mobile_db"] = new_data
        
        save_data(d)
        return True, "بروزرسانی با موفقیت انجام شد."
    except Exception as e:
        return False, str(e)

# --- Handlers ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await update.message.reply_text("خوش آمدید! یکی از گزینه‌ها را انتخاب کنید:", reply_markup=get_main_menu(user_id))

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    await query.answer()

    if data == "admin_home" and is_admin(user_id):
        keyboard = [
            [InlineKeyboardButton("📢 تنظیمات کانال", callback_data="admin_channel_settings")],
            [InlineKeyboardButton("✨ آپدیت هوشمند (AI)", callback_data="admin_ai_menu")],
            [InlineKeyboardButton("📂 آپدیت قیمت (اکسل)", callback_data="admin_excel_menu")],
            [InlineKeyboardButton("➕ افزودن دستی خودرو", callback_data="admin_add_car_start")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")]
        ]
        await query.edit_message_text("🛠 **پنل مدیریت**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

    elif data == "admin_channel_settings" and is_admin(user_id):
        d = load_data()
        c = d["menu_config"]["channel"]
        status = "✅ فعال" if c["active"] else "❌ غیرفعال"
        text = f"📢 **تنظیمات کانال**\nوضعیت: {status}\nلینک: {c['url']}"
        keyboard = [
            [InlineKeyboardButton("👁️ تغییر وضعیت", callback_data="toggle_channel")],
            [InlineKeyboardButton("🔗 تغییر لینک", callback_data="set_channel_url")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

    elif data == "toggle_channel" and is_admin(user_id):
        d = load_data()
        d["menu_config"]["channel"]["active"] = not d["menu_config"]["channel"]["active"]
        save_data(d)
        query.data = "admin_channel_settings"
        await handle_callback(update, context)

    elif data == "set_channel_url" and is_admin(user_id):
        user_states[user_id] = {"state": STATE_ADMIN_SET_CHANNEL_URL}
        await query.message.reply_text("لینک جدید کانال را بفرستید:")

    elif data == "admin_ai_menu" and is_admin(user_id):
        keyboard = [
            [InlineKeyboardButton("🤖 Gemini - خودرو", callback_data="ai_run_gemini_cars")],
            [InlineKeyboardButton("🤖 Gemini - موبایل", callback_data="ai_run_gemini_mobile")],
            [InlineKeyboardButton("🧠 DeepSeek - خودرو", callback_data="ai_run_deepseek_cars")],
            [InlineKeyboardButton("🧠 DeepSeek - موبایل", callback_data="ai_run_deepseek_mobile")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text("✨ **انتخاب هوش مصنوعی و هدف**", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data.startswith("ai_run_") and is_admin(user_id):
        parts = data.split("_")
        provider = parts[2]
        target = parts[3]
        await query.edit_message_text(f"⏳ در حال پردازش توسط {provider}... لطفا صبر کنید.")
        success, msg = await run_ai_update(provider, target)
        await query.message.reply_text("✅" if success else "❌" + f" {msg}")

    elif data == "admin_add_car_start" and is_admin(user_id):
        user_states[user_id] = {"state": STATE_ADMIN_ADD_CAR_BRAND}
        await query.message.reply_text("نام برند را وارد کنید (مثلا: ایران خودرو):")

    elif data == "main_menu":
        await query.edit_message_text("منوی اصلی:", reply_markup=get_main_menu(user_id))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = user_states.get(user_id, {"state": STATE_IDLE})

    if state_info["state"] == STATE_ADMIN_SET_CHANNEL_URL:
        d = load_data()
        d["menu_config"]["channel"]["url"] = text
        save_data(d)
        await update.message.reply_text("✅ لینک کانال آپدیت شد.")
        user_states[user_id] = {"state": STATE_IDLE}

    elif state_info["state"] == STATE_ADMIN_ADD_CAR_BRAND:
        user_states[user_id] = {"state": STATE_ADMIN_ADD_CAR_MODEL, "brand": text}
        await update.message.reply_text(f"برند: {text}\nحالا نام مدل را وارد کنید:")

    elif state_info["state"] == STATE_ADMIN_ADD_CAR_MODEL:
        user_states[user_id].update({"state": STATE_ADMIN_ADD_CAR_YEAR, "model": text})
        await update.message.reply_text(f"مدل: {text}\nحالا سال ساخت را وارد کنید:")

    elif state_info["state"] == STATE_ADMIN_ADD_CAR_YEAR:
        user_states[user_id].update({"state": STATE_ADMIN_ADD_CAR_PRICE, "year": text})
        await update.message.reply_text(f"سال: {text}\nحالا قیمت را وارد کنید (به تومان):")

    elif state_info["state"] == STATE_ADMIN_ADD_CAR_PRICE:
        brand = state_info["brand"]
        model = state_info["model"]
        year = state_info["year"]
        d = load_data()
        if brand not in d["car_db"]: d["car_db"][brand] = {}
        if model not in d["car_db"][brand]: d["car_db"][brand][model] = {}
        d["car_db"][brand][model][year] = text
        save_data(d)
        await update.message.reply_text(f"✅ خودرو با موفقیت اضافه شد:\n{brand} - {model} ({year}) -> {text}")
        user_states[user_id] = {"state": STATE_IDLE}

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("Bot is running...")
    app.run_polling()
