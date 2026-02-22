from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database_manager import db
from state_manager import (
    set_state, update_data,
    STATE_ADMIN_EDIT_MENU_LABEL, STATE_ADMIN_EDIT_MENU_URL,
    STATE_ADMIN_ADD_ADMIN, STATE_ADMIN_SPONSOR_NAME,
    STATE_ADMIN_BROADCAST, STATE_ADMIN_SET_SUPPORT,
    STATE_ADMIN_FJ_ID, STATE_ADMIN_FJ_LINK,
    STATE_ADMIN_SET_ECONOMY_VAL, STATE_ADMIN_RESTORE_USER, STATE_ADMIN_RESTORE_PASS
)

# Admin Roles
ROLE_FULL = "full"
ROLE_EDITOR = "editor"
ROLE_SUPPORT = "support"

async def get_admin_main_menu(user_id, owner_id):
    role = db.get_admin_role(user_id, owner_id)
    keyboard = []
    
    if role == ROLE_FULL:
        keyboard.append([InlineKeyboardButton("⚙️ مدیریت منو و مینی‌اپ", callback_data="admin_menus")])
        keyboard.append([InlineKeyboardButton("📢 تنظیمات کانال و جوین اجباری", callback_data="admin_channel_settings")])
        keyboard.append([InlineKeyboardButton("✨ تنظیمات هوش مصنوعی", callback_data="admin_ai_settings")])
        keyboard.append([InlineKeyboardButton("💰 مدیریت طلا و ارز", callback_data="admin_economy_menu")])
        keyboard.append([InlineKeyboardButton("📂 آپدیت قیمت (اکسل)", callback_data="admin_update_excel")])
        keyboard.append([InlineKeyboardButton("📞 تنظیم پشتیبانی", callback_data="admin_set_support")])
        keyboard.append([InlineKeyboardButton("👥 مدیریت ادمین‌ها", callback_data="admin_manage_admins")])
        keyboard.append([InlineKeyboardButton("💾 بکاپ و بازیابی", callback_data="admin_backup_menu")])
        keyboard.append([InlineKeyboardButton("⭐ تنظیم اسپانسر", callback_data="admin_set_sponsor")])
        keyboard.append([InlineKeyboardButton("📣 پیام همگانی", callback_data="admin_broadcast")])
    elif role == ROLE_EDITOR:
        keyboard.append([InlineKeyboardButton("📂 آپدیت قیمت (اکسل)", callback_data="admin_update_excel")])
        keyboard.append([InlineKeyboardButton("✨ آپدیت قیمت (AI)", callback_data="admin_ai_update_start")])
    elif role == ROLE_SUPPORT:
        keyboard.append([InlineKeyboardButton("📞 تنظیم پشتیبانی", callback_data="admin_set_support")])
        keyboard.append([InlineKeyboardButton("📜 مشاهده لاگ‌ها", callback_data="admin_view_logs")])

    keyboard.append([InlineKeyboardButton("🔙 خروج", callback_data="main_menu")])
    return InlineKeyboardMarkup(keyboard)

async def handle_admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE, owner_id):
    query = update.callback_query
    user_id = query.from_user.id
    data = query.data
    role = db.get_admin_role(user_id, owner_id)
    
    if not role:
        await query.answer("❌ شما دسترسی ادمین ندارید.")
        return

    if data == "admin_home":
        await query.edit_message_text("🛠 **پنل مدیریت**", reply_markup=await get_admin_main_menu(user_id, owner_id), parse_mode='Markdown')
        return

    if data == "admin_ai_settings" and role == ROLE_FULL:
        d = db.load_data()
        s = d['settings']
        source = s.get('ai_source', 'gemini')
        kill = "🛑 متوقف شده" if s.get('ai_kill_switch') else "✅ فعال"
        priority = "📊 اکسل" if s.get('excel_priority') else "✨ هوش مصنوعی"
        
        text = (f"✨ **تنظیمات هوش مصنوعی**\n\n"
                f"منبع فعلی: {source}\n"
                f"وضعیت کلی: {kill}\n"
                f"اولویت داده: {priority}")
        
        keyboard = [
            [InlineKeyboardButton("🔄 تغییر منبع (Gemini/DeepSeek)", callback_data="admin_ai_toggle_source")],
            [InlineKeyboardButton("⚡ سوئیچ توقف اضطراری (Kill-Switch)", callback_data="admin_ai_toggle_kill")],
            [InlineKeyboardButton("⚖️ تغییر اولویت (اکسل/AI)", callback_data="admin_ai_toggle_priority")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_ai_toggle_kill" and role == ROLE_FULL:
        d = db.load_data()
        d['settings']['ai_kill_switch'] = not d['settings']['ai_kill_switch']
        db.save_data(d)
        await query.answer("وضعیت سوئیچ تغییر کرد")
        query.data = "admin_ai_settings"
        await handle_admin_callback(update, context, owner_id)
        return

    if data == "admin_menus" and role == ROLE_FULL:
        d = db.load_data()
        c = d['menu_config']
        text = "🛠 **مدیریت منو و مینی‌اپ**\n\nوضعیت دکمه‌ها را تغییر دهید یا نام آن‌ها را ویرایش کنید:"
        keyboard = []
        for key, val in c.items():
            status = "✅" if val['active'] else "❌"
            keyboard.append([
                InlineKeyboardButton(f"{status} {val['label']}", callback_data=f"menu_toggle_{key}"),
                InlineKeyboardButton("✏️ نام", callback_data=f"menu_set_label_{key}")
            ])
            if val.get('type') == 'webapp' or val.get('type') == 'link':
                keyboard.append([InlineKeyboardButton(f"🔗 ویرایش لینک {val['label']}", callback_data=f"menu_set_url_{key}")])
        
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")])
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("menu_toggle_") and role == ROLE_FULL:
        key = data.replace("menu_toggle_", "")
        d = db.load_data()
        if key in d['menu_config']:
            d['menu_config'][key]['active'] = not d['menu_config'][key]['active']
            db.save_data(d)
            await query.answer("وضعیت تغییر کرد")
            query.data = "admin_menus"
            await handle_admin_callback(update, context, owner_id)
        return

    if data.startswith("menu_set_label_") and role == ROLE_FULL:
        key = data.replace("menu_set_label_", "")
        set_state(user_id, STATE_ADMIN_EDIT_MENU_LABEL)
        update_data(user_id, "edit_key", key)
        await query.message.reply_text(f"📝 نام جدید برای دکمه را وارد کنید:")
        await query.answer()
        return

    if data.startswith("menu_set_url_") and role == ROLE_FULL:
        key = data.replace("menu_set_url_", "")
        set_state(user_id, STATE_ADMIN_EDIT_MENU_URL)
        update_data(user_id, "edit_key", key)
        await query.message.reply_text(f"🔗 لینک جدید (URL) را وارد کنید:")
        await query.answer()
        return

    if data == "admin_channel_settings" and role == ROLE_FULL:
        d = db.load_data()
        fj = d['settings'].get('force_join', {})
        status = "✅ فعال" if fj.get('active') else "❌ غیرفعال"
        text = (f"📢 **تنظیمات کانال و جوین اجباری**\n\n"
                f"وضعیت فعلی: {status}\n"
                f"ID کانال: `{fj.get('channel_id', 'تنظیم نشده')}`\n"
                f"لینک جوین: {fj.get('invite_link', 'تنظیم نشده')}")
        
        keyboard = [
            [InlineKeyboardButton("🔄 تغییر وضعیت جوین اجباری", callback_data="admin_fj_toggle")],
            [InlineKeyboardButton("🆔 تنظیم ID کانال", callback_data="admin_fj_set_id")],
            [InlineKeyboardButton("🔗 تنظیم لینک دعوت", callback_data="admin_fj_set_link")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_manage_admins" and role == ROLE_FULL:
        d = db.load_data()
        admins = d.get('admins', [])
        text = f"👥 **مدیریت ادمین‌ها**\n\nتعداد ادمین‌ها: {len(admins)}\nلیست IDها: {', '.join(map(str, admins))}"
        keyboard = [
            [InlineKeyboardButton("➕ افزودن ادمین جدید", callback_data="admin_add_new")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_add_new" and role == ROLE_FULL:
        set_state(user_id, STATE_ADMIN_ADD_ADMIN)
        await query.message.reply_text("🆔 شناسه عددی (Numeric ID) ادمین جدید را بفرستید:")
        await query.answer()
        return

    if data == "admin_set_sponsor" and role == ROLE_FULL:
        set_state(user_id, STATE_ADMIN_SPONSOR_NAME)
        await query.message.reply_text("📝 نام اسپانسر را وارد کنید:")
        await query.answer()
        return

    if data == "admin_broadcast" and role == ROLE_FULL:
        set_state(user_id, STATE_ADMIN_BROADCAST)
        await query.message.reply_text("📣 متن پیام همگانی خود را بفرستید:")
        await query.answer()
        return

    if data == "admin_fj_toggle" and role == ROLE_FULL:
        d = db.load_data()
        d['settings']['force_join']['active'] = not d['settings']['force_join']['active']
        db.save_data(d)
        await query.answer("وضعیت تغییر کرد")
        query.data = "admin_channel_settings"
        await handle_admin_callback(update, context, owner_id)
        return

    if data == "admin_fj_set_id" and role == ROLE_FULL:
        set_state(user_id, STATE_ADMIN_FJ_ID)
        await query.message.reply_text("🆔 شناسه عددی کانال (مثلا -100123456) را بفرستید:")
        await query.answer()
        return

    if data == "admin_backup_menu" and role == ROLE_FULL:
        text = "💾 **مدیریت بکاپ و بازیابی**\n\nمی‌توانید همین حالا بکاپ بگیرید یا دیتابیس را بازیابی کنید:"
        keyboard = [
            [InlineKeyboardButton("📤 دریافت بکاپ آنی (JSON)", callback_data="admin_backup_now")],
            [InlineKeyboardButton("📥 بازیابی دیتابیس (Restore)", callback_data="admin_restore_start")],
            [InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data == "admin_backup_now" and role == ROLE_FULL:
        import shutil
        from database_manager import DATA_FILE
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}.json"
        shutil.copy2(DATA_FILE, backup_name)
        with open(backup_name, 'rb') as f:
            await context.bot.send_document(chat_id=user_id, document=f, caption=f"✅ بکاپ کامل دیتابیس\n📅 {timestamp}")
        os.remove(backup_name)
        await query.answer("بکاپ ارسال شد")
        return

    if data == "admin_restore_start" and role == ROLE_FULL:
        set_state(user_id, STATE_ADMIN_RESTORE_USER)
        await query.message.reply_text("🔐 نام کاربری امنیتی (Security Username) را وارد کنید:")
        await query.answer()
        return

    if data == "admin_economy_menu" and role == ROLE_FULL:
        d = db.load_data()
        e = d.get('economy_db', {})
        text = "💰 **مدیریت قیمت طلا و ارز**\n\nمقادیر فعلی را ویرایش کنید:"
        keyboard = []
        # Gold
        gold = e.get('gold', {})
        keyboard.append([InlineKeyboardButton(f"🌕 طلا 18 عیار: {gold.get('18k', 0):,}", callback_data="eco_set_gold_18k")])
        keyboard.append([InlineKeyboardButton(f"🪙 سکه امامی: {gold.get('coin_emami', 0):,}", callback_data="eco_set_gold_coin_emami")])
        # Currency
        curr = e.get('currency', {})
        keyboard.append([InlineKeyboardButton(f"💵 دلار: {curr.get('usd', 0):,}", callback_data="eco_set_curr_usd")])
        keyboard.append([InlineKeyboardButton(f"💶 یورو: {curr.get('eur', 0):,}", callback_data="eco_set_curr_eur")])
        
        keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data="admin_home")])
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    if data.startswith("eco_set_") and role == ROLE_FULL:
        key = data.replace("eco_set_", "")
        set_state(user_id, STATE_ADMIN_SET_ECONOMY_VAL)
        update_data(user_id, "eco_key", key)
        await query.message.reply_text(f"🔢 مقدار جدید برای {key} را وارد کنید (فقط عدد):")
        await query.answer()
        return

    if data == "admin_ai_toggle_source" and role == ROLE_FULL:
        d = db.load_data()
        current = d['settings'].get('ai_source', 'gemini')
        d['settings']['ai_source'] = 'deepseek' if current == 'gemini' else 'gemini'
        db.save_data(d)
        await query.answer(f"منبع به {d['settings']['ai_source']} تغییر کرد")
        query.data = "admin_ai_settings"
        await handle_admin_callback(update, context, owner_id)
        return

    if data == "admin_set_support" and (role == ROLE_FULL or role == ROLE_SUPPORT):
        set_state(user_id, STATE_ADMIN_SET_SUPPORT)
        await query.message.reply_text("📞 اطلاعات پشتیبانی را بفرستید (متن یا آیدی تلگرام با @ یا لینک):")
        await query.answer()
        return
