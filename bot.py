import logging
import json
import os
import random
import jdatetime
import pandas as pd
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ConversationHandler

# Configuration
TOKEN = 'REPLACE_ME_TOKEN'
OWNER_ID = 0  # REPLACE_ME_ADMIN_ID (Main Owner)
DATA_FILE = 'bot_data.json'
EXCEL_FILE = 'prices.xlsx'
CHANNEL_URL = 'https://t.me/CarPrice_Channel' 

# Logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s