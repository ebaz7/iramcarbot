import json
import os
import datetime
import shutil
import logging

logger = logging.getLogger(__name__)

DATA_FILE = 'bot_data.json'

DEFAULT_CONFIG = {
    "calc": {"label": "🧮 ماشین‌حساب", "url": "https://www.hamrah-mechanic.com/carprice/", "active": True, "type": "webapp"},
    "market": {"label": "🌐 قیمت بازار", "url": "https://www.iranjib.ir/showgroup/45/", "active": True, "type": "webapp"},
    "prices": {"label": "📋 لیست قیمت خودرو", "active": True, "type": "internal"},
    "estimate": {"label": "💰 تخمین قیمت خودرو", "active": True, "type": "internal"},
    "mobile_webapp": {"label": "📱 قیمت موبایل (سایت)", "url": "https://www.mobile.ir/phones/prices.aspx", "active": True, "type": "webapp"},
    "mobile_list": {"label": "📲 لیست موبایل (ربات)", "active": True, "type": "internal"},
    "economy": {"label": "💰 طلا، سکه و ارز", "active": True, "type": "internal"},
    "search": {"label": "🔍 جستجوی هوشمند", "active": True, "type": "internal"},
    "channel": {"label": "📢 کانال ما", "url": "https://t.me/CarPrice_Channel", "active": True, "type": "link"},
    "support": {"label": "📞 پشتیبانی", "active": True, "type": "dynamic"}
}

class DatabaseManager:
    def __init__(self):
        self.data_file = DATA_FILE
        self.default_data = {
            "backup_interval": 0, 
            "users": [], 
            "admins": [], 
            "roles": {}, # user_id -> role ("full", "editor", "support")
            "sponsor": {}, 
            "menu_config": DEFAULT_CONFIG, 
            "support_config": {"mode": "text", "value": "پیام خود را ارسال کنید..."},
            "panel_user": "",
            "panel_pass": "",
            "settings": {
                "ai_source": "gemini", # gemini, deepseek, hybrid
                "ai_kill_switch": False,
                "excel_priority": True,
                "force_join": {"active": False, "channel_id": "", "invite_link": ""}
            },
            "car_db": {},
            "mobile_db": {},
            "economy_db": {
                "gold": {"18k": 0, "24k": 0, "coin_emami": 0, "coin_bahar": 0},
                "currency": {"usd": 0, "eur": 0, "gbp": 0, "aed": 0}
            }
        }

    def load_data(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                    if "menu_config" not in d: d["menu_config"] = DEFAULT_CONFIG
                    for k, v in DEFAULT_CONFIG.items():
                        if k not in d["menu_config"]: d["menu_config"][k] = v
                    if "settings" not in d: d["settings"] = self.default_data["settings"]
                    if "roles" not in d: d["roles"] = {}
                    if "car_db" not in d: d["car_db"] = {}
                    if "mobile_db" not in d: d["mobile_db"] = {}
                    if "economy_db" not in d: d["economy_db"] = self.default_data["economy_db"]
                    return d
            except json.JSONDecodeError:
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                corrupt_filename = f"{self.data_file}.corrupt.{timestamp}"
                try:
                    shutil.copy(self.data_file, corrupt_filename)
                    logger.error(f"❌ Data file corrupted! Renamed to {corrupt_filename} and creating new DB.")
                except: pass
                return self.default_data
            except Exception as e:
                logger.error(f"❌ Error loading data: {e}")
                return self.default_data
        return self.default_data

    def save_data(self, data):
        try:
            temp_file = f"{self.data_file}.tmp"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            shutil.move(temp_file, self.data_file)
        except Exception as e:
            logger.error(f"❌ Error saving data: {e}")

    def register_user(self, user_id):
        d = self.load_data()
        if user_id not in d.get("users", []):
            if "users" not in d: d["users"] = []
            d["users"].append(user_id)
            self.save_data(d)

    def get_admin_role(self, user_id, owner_id):
        if str(user_id) == str(owner_id):
            return "full"
        d = self.load_data()
        if user_id in d.get("admins", []):
            return d.get("roles", {}).get(str(user_id), "editor") # Default to editor if no role is set
        return None

    def is_admin(self, user_id, owner_id):
        return self.get_admin_role(user_id, owner_id) is not None

    def has_permission(self, user_id, owner_id, required_roles):
        role = self.get_admin_role(user_id, owner_id)
        if role == "full": return True
        return role in required_roles

    def add_admin(self, user_id, role):
        d = self.load_data()
        if 'admins' not in d: d['admins'] = []
        if 'roles' not in d: d['roles'] = {}
        if user_id not in d['admins']:
            d['admins'].append(user_id)
        d['roles'][str(user_id)] = role
        self.save_data(d)

    def remove_admin(self, user_id):
        d = self.load_data()
        if user_id in d.get('admins', []):
            d['admins'].remove(user_id)
            if str(user_id) in d.get('roles', {}):
                del d['roles'][str(user_id)]
            self.save_data(d)

    def get_all_admins(self):
        d = self.load_data()
        return d.get('admins', [])

db = DatabaseManager()
