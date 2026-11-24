"""Helpers the handlers share: roles, keyboards, the API account lookup, sending with a rate limit."""
import aiohttp
import asyncio
import re
import telegram
from collections import defaultdict
from functools import lru_cache
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, Update
from telegram.ext import Application, ContextTypes, ConversationHandler

from config import CONFIG, MIN_PASSWORD_LENGTH, logger
from texts import COUNTRY_NAMES, MENU_ALIASES, TRANSLATIONS

ROLE_BACKEND = {
    'employer': 'wp_job_board_pro_employer',
    'candidate': 'wp_job_board_pro_candidate'
}

def normalize_role(role: str) -> str:
    if not isinstance(role, str) or not role:
        return 'Unknown'
    role_clean = role.strip().lower()
    if role_clean in ('employer', 'wp_job_board_pro_employer'):
        return 'Employer'
    if role_clean in ('candidate', 'wp_job_board_pro_candidate'):
        return 'Candidate'
    return 'Unknown'


def password_ok(text: str) -> bool:
    """The website's rule: at least 8 characters. A shorter one was once kept silently and unusable."""
    return isinstance(text, str) and len(text) >= MIN_PASSWORD_LENGTH


def six_digit_code(text: str):
    """The emailed code from what the person typed ("123 456" works too), or None."""
    digits = re.sub(r'\s', '', text or '')
    return digits if re.fullmatch(r'\d{6}', digits) else None


def menu_key_for(text: str):
    """(menu key, language) when the text is one of the menu buttons, in either language."""
    if text in MENU_ALIASES:
        return MENU_ALIASES[text], 'en'
    for l_code, l_data in TRANSLATIONS.items():
        for key, value in l_data.get('menu', {}).items():
            if value == text:
                return key, l_code
    return None


def registration_payload(user_data: dict, telegram_user) -> dict:
    """
    What the API keeps from a registration: everything the person typed, plus the Telegram
    username Telegram itself reports (not typed, so it can't be someone else's).
    """
    role_input = user_data.get('role_input', '')
    return {
        'telegram_id': str(telegram_user.id),
        'name': user_data.get('name'),
        # The employer's own name; the company name goes to their company profile.
        'contact_name': user_data.get('contact_name', '') if role_input == 'employer' else '',
        'email': user_data.get('email') if role_input == 'employer' else None,
        'password': user_data.get('password') if role_input == 'employer' else None,
        'username': f"tg_{telegram_user.id}",
        'role': ROLE_BACKEND.get(role_input, user_data.get('role', 'candidate')),
        'language': user_data.get('language', 'en'),
        'phone': user_data.get('phone', ''),
        'tg_username': getattr(telegram_user, 'username', None) or '',
        'job_title': user_data.get('job_title', ''),
        'company_name': user_data.get('company_name', ''),
        'gender': user_data.get('gender'),
        'country': user_data.get('country'),
        'city': user_data.get('city'),
    }

def country_from_text(text: str):
    """ISO code for a typed country name or code ("Kenya", "ke", "ኬንያ"), or None."""
    cleaned = re.sub(r'\s+', ' ', (text or '').strip()).lower()
    if re.fullmatch(r'[a-z]{2}', cleaned):
        return cleaned.upper()
    return COUNTRY_NAMES.get(cleaned)


def own_phone(message, telegram_user):
    """The number from a shared contact, only when it's the person's own (Telegram-verified)."""
    contact = getattr(message, 'contact', None)
    if not contact or not contact.phone_number:
        return None
    if contact.user_id and telegram_user and contact.user_id != telegram_user.id:
        return None
    number = re.sub(r'[\s-]', '', contact.phone_number)
    return number if number.startswith('+') else '+' + number


def role_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Employer" if lang == 'en' else "ቀጣሪ", callback_data='employer'),
         InlineKeyboardButton("Job Seeker" if lang == 'en' else "ሥራ ፈላጊ", callback_data='candidate')],
        [InlineKeyboardButton(t['role_existing'], callback_data='existing')],
    ])


def full_telegram_name(telegram_user) -> str:
    parts = [getattr(telegram_user, 'first_name', None), getattr(telegram_user, 'last_name', None)]
    return ' '.join(p.strip() for p in parts if p and p.strip())


# The buttons open the Mini App's own screens (the website's /tg pages, made for Telegram).
MINI_APP = f"{CONFIG['mini_app_url']}/tg"

MENU_URLS = {
    'candidate': {
        'dashboard': MINI_APP,
        'my_profile': f"{MINI_APP}/profile",
        'my_applications': f"{MINI_APP}/applications",
        'job_list': MINI_APP,
    },
    'employer': {
        'post_job': f"{MINI_APP}/post-job",
        'dashboard': f"{MINI_APP}/employer",
        'my_profile': f"{MINI_APP}/profile",
        'my_jobs': f"{MINI_APP}/employer",
        'applicants': f"{MINI_APP}/employer",
    }
}

class BotContext:
    def __init__(self):
        self.session: aiohttp.ClientSession = None
        self.application: Application = None
        self.rate_limiter = None
        self.challenge_db = None

bot_context = BotContext()

@lru_cache(maxsize=128)
def get_keyboard(role: str, lang: str, is_admin: bool = False) -> ReplyKeyboardMarkup:
    if lang not in TRANSLATIONS or 'menu' not in TRANSLATIONS[lang]:
        lang = 'en'
    menu = TRANSLATIONS[lang]['menu']
    role_friendly = normalize_role(role)
    if role_friendly == 'Candidate':
        options = [
            [menu['job_list'], menu['my_profile']],
            [menu['my_applications'], menu['dashboard']],
            [menu['challenge']],
            [menu['voucher']]
        ]
    else:
        options = [
            [menu['post_job'], menu['dashboard']],
            [menu['applicants'], menu['my_jobs']],
            [menu['my_profile']],
            [menu['challenge']],
            [menu['voucher']]
        ]
    
    if is_admin:
        options.append(["📣 Broadcast Message", "🎁 Remind non-voters"])
        
    return ReplyKeyboardMarkup(options, resize_keyboard=True, one_time_keyboard=False)


class RateLimiter:
    def __init__(self, messages_per_second: int = 1, max_burst: int = 30):
        self.rate = messages_per_second
        self.burst = max_burst
        self.tokens = defaultdict(lambda: max_burst)
        self.last_refill = defaultdict(lambda: asyncio.get_event_loop().time())
        self.lock = asyncio.Lock()

    async def _refill(self, chat_id: int):
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_refill[chat_id]
        new_tokens = min(self.burst, self.tokens[chat_id] + elapsed * self.rate)
        self.tokens[chat_id] = new_tokens
        self.last_refill[chat_id] = now

    async def _send_request(self, chat_id: int, method, **kwargs):
        async with self.lock:
            await self._refill(chat_id)
            if self.tokens[chat_id] < 1:
                wait_time = (1 - self.tokens[chat_id]) / self.rate
                await asyncio.sleep(wait_time)
                await self._refill(chat_id)
            self.tokens[chat_id] -= 1

        try:
            return await method(chat_id=chat_id, **kwargs)
        except telegram.error.Forbidden as e:
            # Gracefully handle blocked/deactivated users
            logger.warning(f"Skipping chat_id {chat_id}: {e.message}")
            raise e # We still raise it so the calling function (broadcast) knows it failed
        except Exception as e:
            if "Too Many Requests" in str(e):
                retry_after = int(str(e).split("retry after ")[-1]) if "retry after" in str(e) else 5
                await asyncio.sleep(retry_after)
                return await self._send_request(chat_id, method, **kwargs)
            else:
                logger.error(f"Failed to send request for chat_id {chat_id}: {e}", exc_info=True)
                raise

    async def send_message(self, chat_id: int, text: str, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.send_message,
            text=text,
            **kwargs
        )

    async def send_photo(self, chat_id: int, photo, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.send_photo,
            photo=photo,
            **kwargs
        )

    async def send_document(self, chat_id: int, document, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.send_document,
            document=document,
            **kwargs
        )

    async def copy_message(self, chat_id: int, from_chat_id: int, message_id: int, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.copy_message,
            from_chat_id=from_chat_id,
            message_id=message_id,
            **kwargs
        )

async def fetch_account(telegram_id: str):
    """The API's check-user answer for this Telegram account, or None if it can't be reached."""
    try:
        async with bot_context.session.get(
            f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                return await response.json()
    except Exception as e:
        logger.error(f"check-user failed for {telegram_id}: {e}")
    return None

async def get_user_role(telegram_id: str) -> str:
    async with bot_context.session.get(
        f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
        timeout=aiohttp.ClientTimeout(total=10)
    ) as response:
        if response.status == 200:
            data = await response.json()
            return data.get('role', 'unknown').capitalize() if data.get('registered') else 'unknown'
    return 'unknown'

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id if update.effective_chat else (update.effective_message.chat_id if update.effective_message else None)
    if chat_id:
        await bot_context.rate_limiter.send_message(
            chat_id,
            TRANSLATIONS[context.user_data.get('language', 'en')]['cancel']
        )
    context.user_data.clear()
    return ConversationHandler.END
