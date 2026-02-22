# state_manager.py
user_states = {}

STATE_IDLE = "IDLE"
STATE_ESTIMATE_BRAND = "EST_BRAND"
STATE_ESTIMATE_MODEL = "EST_MODEL"
STATE_ESTIMATE_YEAR = "EST_YEAR"
STATE_ESTIMATE_MILEAGE = "EST_MILEAGE"
STATE_ESTIMATE_PAINT = "EST_PAINT"
STATE_SEARCH = "SEARCH"

# Admin States
STATE_ADMIN_ADD_ADMIN = "ADM_ADD_ADMIN"
STATE_ADMIN_SPONSOR_NAME = "ADM_SPONSOR_NAME"
STATE_ADMIN_SPONSOR_LINK = "ADM_SPONSOR_LINK"
STATE_ADMIN_BROADCAST = "ADM_BCAST"
STATE_ADMIN_EDIT_MENU_LABEL = "ADM_EDIT_LABEL"
STATE_ADMIN_EDIT_MENU_URL = "ADM_EDIT_URL"
STATE_ADMIN_SET_SUPPORT = "ADM_SET_SUPPORT"
STATE_ADMIN_SET_CHANNEL_URL = "ADM_SET_CHANNEL_URL"
STATE_ADMIN_FJ_ID = "ADM_FJ_ID"
STATE_ADMIN_FJ_LINK = "ADM_FJ_LINK"
STATE_ADMIN_UPLOAD_EXCEL_CARS = "ADM_UP_EXCEL_CARS"
STATE_ADMIN_UPLOAD_EXCEL_MOBILE = "ADM_UP_EXCEL_MOBILE"

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
