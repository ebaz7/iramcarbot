
import logging
import json
import os
import datetime
import shutil
import re
import google.generativeai as genai
import jdatetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, BotCommand, MenuButtonCommands
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters

from database_manager import db
from admin_panel import get_admin_main_menu, ROLE_FULL, ROLE_EDITOR, ROLE_SUPPORT
from excel_handler import process_excel_update
from state_manager import (
    get_state, set_state, update_data, reset_state,
    STATE_IDLE, STATE_ESTIMATE_BRAND, STATE_ESTIMATE_MODEL, STATE_ESTIMATE_YEAR,
    STATE_ESTIMATE_MILEAGE, STATE_ESTIMATE_PAINT, STATE_SEARCH,
    STATE_ADMIN_ADD_ADMIN, STATE_ADMIN_SPONSOR_NAME, STATE_ADMIN_SPONSOR_LINK,
    STATE_ADMIN_BROADCAST, STATE_ADMIN_EDIT_MENU_LABEL, STATE_ADMIN_EDIT_MENU_URL,
    STATE_ADMIN_SET_SUPPORT, STATE_ADMIN_SET_CHANNEL_URL,
    STATE_ADMIN_FJ_ID, STATE_ADMIN_FJ_LINK,
    STATE_ADMIN_UPLOAD_EXCEL_CARS, STATE_ADMIN_UPLOAD_EXCEL_MOBILE
)

# Configuration
# These will be replaced by install.sh
TOKEN = 'REPLACE_ME_TOKEN' 
OWNER_ID = 0
GEMINI_API_KEY = ''

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

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

# --- Keyboards ---
def get_main_menu(user_id):
    d = db.load_data()
    c = d.get("menu_config")
    sup_conf = d.get("support_config", {"mode": "text", "value": "..."})
    
    keyboard = []
    
    # Row 1: Web Apps (Mini Apps)
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

    if db.is_admin(user_id, OWNER_ID): 
        keyboard.append([InlineKeyboardButton("👑 پنل مدیریت", callback_data="admin_home")])
    
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
    db.register_user(user_id)
    reset_state(user_id)
    
    # Force Join Check
    d = db.load_data()
    fj = d.get("settings", {}).get("force_join", {})
    if fj.get("active") and fj.get("channel_id"):
        try:
            member = await context.bot.get_chat_member(chat_id=fj["channel_id"], user_id=user_id)
            if member.status in ['left', 'kicked']:
                keyboard = [[InlineKeyboardButton("📢 عضویت در کانال", url=fj["invite_link"])],
                            [InlineKeyboardButton("✅ عضو شدم", callback_data="main_menu")]]
                await update.message.reply_text("❌ برای استفاده از ربات باید در کانال ما عضو شوید:", reply_markup=InlineKeyboardMarkup(keyboard))
                return
        except: pass

    await update.message.reply_text(f"👋 سلام! به ربات قیمت خودرو و موبایل خوش آمدید.\n📅 امروز: {jdatetime.date.today()}", reply_markup=get_main_menu(user_id))

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    await query.answer()
    
    if data == "main_menu":
        reset_state(user_id)
        await query.edit_message_text(text="منوی اصلی:", reply_markup=get_main_menu(user_id))
        return
    
    if data.startswith("admin_") or data.startswith("menu_toggle_") or data.startswith("menu_set_") or data.startswith("backup_"):
        if db.is_admin(user_id, OWNER_ID):
            from admin_panel import handle_admin_callback
            await handle_admin_callback(update, context, OWNER_ID)
            
            # Additional logic for admin states that need to be in bot.py
            if data == "admin_update_excel":
                keyboard = [
                    [InlineKeyboardButton("🚗 آپدیت قیمت خودرو", callback_data="admin_up_excel_cars")],
                    [InlineKeyboardButton("📱 آپدیت قیمت موبایل", callback_data="admin_up_excel_mobile")],
                    [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
                ]
                await query.edit_message_text("📂 لطفا نوع فایل اکسل را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
            
            elif data == "admin_up_excel_cars":
                set_state(user_id, STATE_ADMIN_UPLOAD_EXCEL_CARS)
                await query.message.reply_text("📤 لطفا فایل اکسل قیمت خودرو را ارسال کنید.")
            
            elif data == "admin_up_excel_mobile":
                set_state(user_id, STATE_ADMIN_UPLOAD_EXCEL_MOBILE)
                await query.message.reply_text("📤 لطفا فایل اکسل قیمت موبایل را ارسال کنید.")
        return

    # --- USER FLOWS ---
    if data == "menu_prices":
        d = db.load_data()
        car_db = d.get("car_db", {})
        keyboard = []
        for brand in car_db.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("🏢 شرکت سازنده:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("brand_"):
        brand_name = data.replace("brand_", "")
        d = db.load_data()
        car_db = d.get("car_db", {})
        
        current_state = get_state(user_id)["state"]
        if current_state == STATE_ESTIMATE_BRAND:
            update_data(user_id, "brand", brand_name)
            set_state(user_id, STATE_ESTIMATE_MODEL)
            keyboard = []
            if brand_name in car_db:
                for model in car_db[brand_name]["models"]: keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 انصراف", callback_data="main_menu")])
            await query.edit_message_text(f"خودروی {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
            return
        
        if brand_name in car_db:
            keyboard = []
            for model in car_db[brand_name]["models"]: keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"model_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_prices")])
            await query.edit_message_text(f"مدل‌های {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("model_"):
        model_name = data.replace("model_", "")
        d = db.load_data()
        car_db = d.get("car_db", {})
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
        for b_name, b_data in car_db.items():
            for m in b_data["models"]:
                if m["name"] == model_name: 
                    found_model = m
                    brand_name = b_name
                    break
            if found_model: break
        
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
        d = db.load_data()
        car_db = d.get("car_db", {})
        found_variant = None
        for b_data in car_db.values():
            for m in b_data["models"]:
                if m["name"] == model_name and idx < len(m["variants"]): 
                    found_variant = m["variants"][idx]
                    break
            if found_variant: break
        
        if found_variant:
            # Hybrid Logic: If MarketPrice is 0, try AI if enabled
            m_price = found_variant['marketPrice']
            if m_price == 0 and d['settings']['ai_source'] != 'none' and not d['settings']['ai_kill_switch']:
                # Fallback to AI (Simplified for demo)
                m_price = found_variant['factoryPrice'] * 1.1 
            
            floor = int(m_price * 0.985)
            text = (f"📊 **استعلام قیمت**\n🚘 {found_variant['name']}\n-------------------\n📉 **کف قیمت بازار:**\n💰 {floor:,} م ت\n🏭 **کارخانه:**\n🏦 {found_variant['factoryPrice']:,} م ت")
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"model_{model_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_estimate":
        set_state(user_id, STATE_ESTIMATE_BRAND)
        d = db.load_data()
        car_db = d.get("car_db", {})
        keyboard = []
        for brand in car_db.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"brand_{brand}")])
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
        brand = user_data.get("brand")
        model = user_data.get("model")
        year = user_data.get("year")
        mileage = user_data.get("mileage")
        
        if not all([brand, model, year, mileage is not None]):
            await query.message.reply_text("❌ خطا در بازیابی اطلاعات. لطفا دوباره تلاش کنید.")
            reset_state(user_id)
            return
        
        d = db.load_data()
        car_db = d.get("car_db", {})
        zero_price = 800
        for b in car_db.values():
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
        
        result = (f"🎯 **کارشناسی قیمت**\n🚙 **{brand} {model}**\n-----------------\n📅 سال: {year} | 🛣 کارکرد: {mileage:,}\n🎨 بدنه: {condition['label']}\n-----------------\n💰 **قیمت تقریبی: {final_price:,} میلیون تومان**")
        keyboard = [[InlineKeyboardButton("🏠 منوی اصلی", callback_data="main_menu")]]
        await query.edit_message_text(result, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        reset_state(user_id)
        return

    if data == "menu_mobile_list":
        d = db.load_data()
        mobile_db = d.get("mobile_db", {})
        keyboard = []
        for brand in mobile_db.keys(): keyboard.append([InlineKeyboardButton(brand, callback_data=f"mob_brand_{brand}")])
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="main_menu")])
        await query.edit_message_text("📱 برند موبایل را انتخاب کنید:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("mob_brand_"):
        brand_name = data.replace("mob_brand_", "")
        d = db.load_data()
        mobile_db = d.get("mobile_db", {})
        if brand_name in mobile_db:
            keyboard = []
            for model in mobile_db[brand_name]["models"]:
                keyboard.append([InlineKeyboardButton(model["name"], callback_data=f"mob_model_{brand_name}_{model['name']}")])
            keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="menu_mobile_list")])
            await query.edit_message_text(f"مدل‌های {brand_name}:", reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("mob_model_"):
        parts = data.split("_")
        brand_name = parts[2]
        model_name = parts[3]
        d = db.load_data()
        mobile_db = d.get("mobile_db", {})
        
        found_model = None
        if brand_name in mobile_db:
            for m in mobile_db[brand_name]["models"]:
                if m["name"] == model_name: found_model = m; break
        
        if found_model:
            text = (f"📱 **قیمت روز موبایل**\n"
                    f"🏷 مدل: {found_model['name']}\n"
                    f"💾 حافظه: {found_model.get('storage', '-')}\n"
                    f"-------------------\n"
                    f"💰 **قیمت تقریبی:** {found_model['price']} میلیون تومان")
            keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"mob_brand_{brand_name}")]]
            await query.edit_message_text(text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data == "menu_search":
        set_state(user_id, STATE_SEARCH)
        await query.message.reply_text("🔍 نام خودرو یا موبایل مورد نظر را وارد کنید:")
        return

    if data == "menu_support":
        d = db.load_data()
        sup_conf = d.get("support_config", {"mode": "text", "value": "..."})
        text_val = sup_conf["value"]
        await query.message.reply_text(f"📞 **اطلاعات پشتیبانی:**\n\n{text_val}", parse_mode='Markdown')
        return

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    state_info = get_state(user_id)
    
    if text == "/admin" and db.is_admin(user_id, OWNER_ID):
        await update.message.reply_text("🛠 **پنل مدیریت**", reply_markup=await get_admin_main_menu(user_id, OWNER_ID), parse_mode='Markdown')
        return

    # --- ADMIN: SET SUPPORT ---
    if state_info["state"] == STATE_ADMIN_SET_SUPPORT:
        d = db.load_data()
        mode = "link" if text.startswith("http") else "text"
        if text.startswith("@"):
            text = f"https://t.me/{text.replace('@', '')}"
            mode = "link"
        d["support_config"] = {"mode": mode, "value": text}
        db.save_data(d)
        type_msg = "لینک" if mode == "link" else "متن"
        await update.message.reply_text(f"✅ پشتیبانی تنظیم شد به صورت **{type_msg}**.\nمقدار: {text}", parse_mode='Markdown')
        reset_state(user_id)
        return

    # --- ADMIN: EDIT MENU INPUTS ---
    if state_info["state"] == STATE_ADMIN_EDIT_MENU_LABEL:
        key = state_info["data"].get("edit_key")
        d = db.load_data()
        d["menu_config"][key]["label"] = text
        db.save_data(d)
        await update.message.reply_text(f"✅ نام دکمه تغییر کرد به: {text}")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_EDIT_MENU_URL:
        key = state_info["data"].get("edit_key")
        if not text.startswith("http"):
            await update.message.reply_text("❌ لینک نامعتبر است. با http یا https شروع کنید.")
            return
        d = db.load_data()
        d["menu_config"][key]["url"] = text
        db.save_data(d)
        await update.message.reply_text(f"✅ لینک دکمه آپدیت شد.")
        reset_state(user_id)
        return

    # --- ADMIN INPUTS ---
    if state_info["state"] == STATE_ADMIN_SET_CHANNEL_URL:
        d = db.load_data()
        d["menu_config"]["channel"]["url"] = text
        db.save_data(d)
        await update.message.reply_text("✅ لینک کانال بروزرسانی شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_FJ_ID:
        d = db.load_data()
        d["settings"]["force_join"]["channel_id"] = text
        db.save_data(d)
        await update.message.reply_text(f"✅ ID کانال تنظیم شد: {text}")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_FJ_LINK:
        d = db.load_data()
        d["settings"]["force_join"]["invite_link"] = text
        db.save_data(d)
        await update.message.reply_text(f"✅ لینک دعوت تنظیم شد: {text}")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_ADD_ADMIN:
        try:
            new_admin_id = int(text)
            d = db.load_data()
            if new_admin_id not in d["admins"]: d["admins"].append(new_admin_id)
            db.save_data(d)
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
        d = db.load_data()
        d["sponsor"] = {"name": name, "url": text}
        db.save_data(d)
        await update.message.reply_text("✅ اسپانسر تنظیم شد.")
        reset_state(user_id)
        return

    if state_info["state"] == STATE_ADMIN_BROADCAST:
        d = db.load_data()
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

    # --- SEARCH HANDLER ---
    if state_info["state"] == STATE_SEARCH:
        # Simple search logic
        d = db.load_data()
        results = []
        # Search in cars
        for brand, b_data in d.get("car_db", {}).items():
            if text.lower() in brand.lower(): results.append(f"🚗 {brand}")
            for model in b_data["models"]:
                if text.lower() in model["name"].lower(): results.append(f"🚗 {brand} {model['name']}")
        # Search in mobile
        for brand, b_data in d.get("mobile_db", {}).items():
            if text.lower() in brand.lower(): results.append(f"📱 {brand}")
            for model in b_data["models"]:
                if text.lower() in model["name"].lower(): results.append(f"📱 {brand} {model['name']}")
        
        if results:
            await update.message.reply_text("🔍 نتایج جستجو:\n" + "\n".join(results[:10]))
        else:
            await update.message.reply_text("❌ موردی یافت نشد.")
        reset_state(user_id)
        return

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    state_info = get_state(user_id)
    
    if not db.is_admin(user_id, OWNER_ID): return

    if state_info["state"] in [STATE_ADMIN_UPLOAD_EXCEL_CARS, STATE_ADMIN_UPLOAD_EXCEL_MOBILE]:
        niche = 'cars' if state_info["state"] == STATE_ADMIN_UPLOAD_EXCEL_CARS else 'mobile'
        file = await context.bot.get_file(update.message.document.file_id)
        file_bytes = await file.download_as_bytearray()
        
        success, msg = await process_excel_update(file_bytes, niche)
        await update.message.reply_text(msg)
        reset_state(user_id)

async def post_init(application):
    # Fix Commands & Persistent Menu
    try:
        await application.bot.set_my_commands([
            BotCommand("start", "🏠 منوی اصلی"),
            BotCommand("admin", "👑 پنل مدیریت"),
            BotCommand("search", "🔍 جستجوی سریع")
        ])
        # Set Menu Button to show commands
        await application.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    except Exception as e:
        logger.error(f"Post-init error: {e}")

if __name__ == '__main__':
    import sys
    if TOKEN == 'REPLACE_ME_TOKEN' or not TOKEN: 
        print("❌ ERROR: Bot Token is not configured!")
        print("Please run 'bash install.sh' or edit bot.py manually.")
        sys.exit(1)
    
    app = ApplicationBuilder().token(TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    
    print("Bot is running...")
    app.run_polling()
