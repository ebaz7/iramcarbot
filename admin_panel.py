from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database_manager import db

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

    if data == "admin_ai_toggle_priority" and role == ROLE_FULL:
        d = db.load_data()
        d['settings']['excel_priority'] = not d['settings']['excel_priority']
        db.save_data(d)
        await query.answer("اولویت تغییر کرد")
        query.data = "admin_ai_settings"
        await handle_admin_callback(update, context, owner_id)
        return
