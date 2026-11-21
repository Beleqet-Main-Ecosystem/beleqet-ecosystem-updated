"""Settings from .env, logging, and the conversation states."""
import logging
import os
from dotenv import load_dotenv

load_dotenv()
# --- CONFIGURATION WITH YOUR FILE IDs ---
CONFIG = {
    'telegram_token': os.getenv("BOT_TOKEN"),
    'wp_api_url': os.getenv("WORDPRESS_API_URL"),
    'webhook_url': os.getenv("BOT_WEBHOOK_URL"),
    'mini_app_url': (os.getenv("MINI_APP_URL") or "https://beleqetjobs.com").rstrip('/'),
    'candidate_promo_photo_id': os.getenv("CANDIDATE_PROMO_PHOTO_ID"),
    'employer_promo_photo_id': os.getenv("EMPLOYER_PROMO_PHOTO_ID"),
    'admin_ids': [int(x.strip()) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()],
    'challenge_mini_app_url': (os.getenv("CHALLENGE_MINI_APP_URL") or "https://beleqetjobs.com/challenge").rstrip('/'),
}

# --- More verbose logging setup ---
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
# Suppress noisy logs from httpx, used by python-telegram-bot
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("jobs-bot")

LANGUAGE, ROLE, NAME, PHONE, EMAIL, TG_USERNAME, PASSWORD, CHANGE_LANGUAGE, TRADE_LICENSE, JOB_TITLE, COMPANY_NAME = range(11)
BROADCAST_MESSAGE, BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM = range(11, 15)
# New states go after the old ones: conversations saved in data/persistence.pickle keep their numbers.
CONTACT_NAME, EMAIL_CODE, NEW_EMAIL = range(15, 18)
# Job seekers: where they live. "I already have an account": email, then the emailed code.
GENDER, COUNTRY, COUNTRY_TYPED, CITY, LINK_EMAIL, LINK_CODE = range(18, 24)

MIN_PASSWORD_LENGTH = 8
# Everything a registration collects; cleared when a new registration picks its role.
REGISTRATION_KEYS = ('name', 'contact_name', 'company_name', 'phone', 'email', 'password', 'job_title',
                     'gender', 'country', 'city', 'tg_username', 'link_email')
EMAIL_PATTERN = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
