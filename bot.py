import logging
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
 SEND_USER_ID, SEND_USER_MSG) = range(25)

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

# --- DEFAULT DATA ---
DEFAULT_CARS = {
    "ایران خودرو": {
        "name": "ایران خودرو",
        "models": [
            {
                "name": "پژو 207",
                "variants": [
                    {"name": "207 دنده‌ای هیدرولیک (TU5)", "marketPrice": 830, "factoryPrice": 470},
                    {"name": "207 دنده‌ای ارتقا یافته (فول)", "marketPrice": 890, "factoryPrice": 510},
                    {"name": "207 اتوماتیک سقف شیشه ای", "marketPrice": 1180, "factoryPrice": 610},
                    {"name": "207 اتوماتیک TU5P", "marketPrice": 1100, "factoryPrice": 590}
                ]
            },
            {
                "name": "دنا",
                "variants": [
                    {"name": "دنا پلاس 6 دنده دستی", "marketPrice": 1080, "factoryPrice": 560},
                    {"name": "دنا پلاس توربو اتوماتیک آپشنال", "marketPrice": 1320, "factoryPrice": 700},
                    {"name": "دنا پلاس جوانان", "marketPrice": 1420, "factoryPrice": 750}
                ]
            },
            {
                "name": "تارا",
                "variants": [
                    {"name": "تارا دستی V1 پلاس", "marketPrice": 950, "factoryPrice": 590},
                    {"name": "تارا اتوماتیک V4 LX", "marketPrice": 1350, "factoryPrice": 690}
                ]
            },
            {
                "name": "هایما",
                "variants": [
                    {"name": "هایما S7 پلاس", "marketPrice": 1900, "factoryPrice": 1190},
                    {"name": "هایما S5 جدید", "marketPrice": 1550, "factoryPrice": 1050},
                    {"name": "هایما 8S", "marketPrice": 2100, "factoryPrice": 1370},
                    {"name": "هایما 7X", "marketPrice": 1950, "factoryPrice": 1480}
                ]
            }
        ]
    },
    "سایپا": {
        "name": "سایپا",
        "models": [
            {
                "name": "شاهین",
                "variants": [
                    {"name": "شاهین G (دنده‌ای)", "marketPrice": 810, "factoryPrice": 440},
                    {"name": "شاهین GL (بدون سانروف)", "marketPrice": 780, "factoryPrice": 420},
                    {"name": "شاهین اتوماتیک CVT", "marketPrice": 960, "factoryPrice": 650}
                ]
            },
            {
                "name": "کوییک",
                "variants": [
                    {"name": "کوییک GXR-L (رینگ آلومینیومی)", "marketPrice": 495, "factoryPrice": 390},
                    {"name": "کوییک GX-L", "marketPrice": 475, "factoryPrice": 370},
                    {"name": "کوییک اتوماتیک", "marketPrice": 600, "factoryPrice": 340}
                ]
            },
            {
                "name": "اطلس",
                "variants": [
                    {"name": "اطلس G", "marketPrice": 650, "factoryPrice": 415}
                ]
            },
            {
                "name": "سهند",
                "variants": [
                    {"name": "سهند S", "marketPrice": 580, "factoryPrice": 440}
                ]
            }
        ]
    },
    "مدیران خودرو": {
        "name": "مدیران خودرو",
        "models": [
            {
                "name": "X22 / X33",
                "variants": [
                    {"name": "X22 Pro دنده‌ای", "marketPrice": 1020, "factoryPrice": 710},
                    {"name": "X33 Cross اتوماتیک", "marketPrice": 1400, "factoryPrice": 1050}
                ]
            },
            {
                "name": "آریزو",
                "variants": [
                    {"name": "آریزو 5 اسپورت FL", "marketPrice": 1500, "factoryPrice": 1100},
                    {"name": "آریزو 6 پرو", "marketPrice": 1700, "factoryPrice": 1250},
                    {"name": "آریزو 8 اکسلنت", "marketPrice": 3000, "factoryPrice": 2200}
                ]
            },
            {
                "name": "تیگو",
                "variants": [
                    {"name": "تیگو 7 پرو پرمیوم", "marketPrice": 2200, "factoryPrice": 1550},
                    {"name": "تیگو 8 پرو مکس IE", "marketPrice": 3250, "factoryPrice": 2690},
                    {"name": "تیگو 8 پرو e+ (هیبرید)", "marketPrice": 3400, "factoryPrice": 2800}
                ]
            },
            {
                "name": "فونیکس",
                "variants": [
                    {"name": "فونیکس FX پرمیوم", "marketPrice": 2550, "factoryPrice": 1750}
                ]
            }
        ]
    },
    "کرمان موتور": {
        "name": "کرمان موتور",
        "models": [
            {
                "name": "JAC",
                "variants": [
                    {"name": "جک J4 آپشنال", "marketPrice": 960, "factoryPrice": 790},
                    {"name": "جک S3 اتوماتیک", "marketPrice": 1350, "factoryPrice": 930}
                ]
            },
            {
                "name": "KMC",
                "variants": [
                    {"name": "KMC T8", "marketPrice": 1780, "factoryPrice": 1350},
                    {"name": "KMC T9", "marketPrice": 2500, "factoryPrice": 1950},
                    {"name": "KMC J7", "marketPrice": 1850, "factoryPrice": 1380},
                    {"name": "KMC X5", "marketPrice": 1950, "factoryPrice": 1400},
                    {"name": "KMC A5", "marketPrice": 1800, "factoryPrice": 1300}
                ]
            }
        ]
    },
    "بهمن موتور": {
        "name": "بهمن موتور",
        "models": [
            {
                "name": "فیدلیتی",
                "variants": [
                    {"name": "فیدلیتی پرایم 5 نفره", "marketPrice": 2000, "factoryPrice": 1350},
                    {"name": "فیدلیتی پرایم 7 نفره", "marketPrice": 2100, "factoryPrice": 1360},
                    {"name": "فیدلیتی پرستیژ 7 نفره", "marketPrice": 2850, "factoryPrice": 1720}
                ]
            },
            {
                "name": "دیگنیتی",
                "variants": [
                    {"name": "دیگنیتی پرایم", "marketPrice": 2150, "factoryPrice": 1500},
                    {"name": "دیگنیتی پرستیژ", "marketPrice": 2700, "factoryPrice": 1750}
                ]
            },
            {
                "name": "ریسپکت",
                "variants": [
                    {"name": "ریسپکت 2", "marketPrice": 1600, "factoryPrice": 1150}
                ]
            }
        ]
    },
    "آرین پارس": {
        "name": "آرین پارس موتور",
        "models": [
            {
                "name": "لاماری",
                "variants": [
                    {"name": "لاماری ایما", "marketPrice": 2100, "factoryPrice": 1430},
                    {"name": "لاماری ایما HEV (هیبرید)", "marketPrice": 2600, "factoryPrice": 1800}
                ]
            }
        ]
    },
    "فردا موتورز": {
        "name": "فردا موتورز",
        "models": [
            {
                "name": "FMC",
                "variants": [
                    {"name": "FMC SX5", "marketPrice": 1320, "factoryPrice": 980},
                    {"name": "FMC T5", "marketPrice": 1700, "factoryPrice": 1300}
                ]
            },
            {
                "name": "Suba",
                "variants": [
                    {"name": "سوبا M4", "marketPrice": 2250, "factoryPrice": 1850}
                ]
            }
        ]
    }
}

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
        "admins": []
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

def get_jalali_date():
    return jdatetime.date.today().strftime("%Y/%m/%d")

# --- Helper: Footer ---
def attach_footer(keyboard):
    data = load_data()
    sponsor = data.get("sponsor", {})
    footer_row = [InlineKeyboardButton("📢 کانال ما", url=CHANNEL_URL)]
    if sponsor.get("name") and sponsor.get("url"):
        footer_row.append(InlineKeyboardButton(f"⭐ {sponsor['name']}", url=sponsor['url']))
    keyboard.append(footer_row)
    return keyboard

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

# --- Admin Management Logic ---
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

# --- Broadcast Logic ---
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

# --- Support System ---
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

# --- Standard Handlers ---
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

# --- Estimator Handlers ---
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

# --- Browsing Handlers ---
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

# --- Main ---
def main():
    builder = ApplicationBuilder().token(TOKEN)
    
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
