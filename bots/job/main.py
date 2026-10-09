import asyncio
import re
import aiohttp
import telegram
import logging
import os
import sys
from functools import lru_cache
from collections import defaultdict
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'server'))
from voting_routes import init_challenge_db, register_challenge_routes
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, WebAppInfo, KeyboardButton
from telegram.ext import ( Application, 
                          CommandHandler, 
                          MessageHandler, 
                          CallbackQueryHandler, 
                          filters, ContextTypes, 
                          ConversationHandler, PicklePersistence )

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
    'challenge_mini_app_url': (os.getenv("CHALLENGE_MINI_APP_URL") or "https://webhook.beleqet.com/challenge").rstrip('/'),
}

# --- More verbose logging setup ---
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
# Suppress noisy logs from httpx, used by python-telegram-bot
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

LANGUAGE, ROLE, NAME, PHONE, EMAIL, TG_USERNAME, PASSWORD, CHANGE_LANGUAGE, TRADE_LICENSE, JOB_TITLE, COMPANY_NAME = range(11)
BROADCAST_MESSAGE, BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM = range(11, 15)

TRANSLATIONS = {
    'en': {
        'link_success': "Your account has been successfully linked!",
        'link_transfer_success': "You have successfully transferred your account to this new Telegram profile.",
        'select_language': "Please select your language:",
        'select_role': "Select your role:",
        'welcome_back': "Welcome back, {name}! You’re logged in as a {role}.\nSelect an option from the menu below:",
        'pending_employer': "You’re already registered as an Employer, but your account is still pending approval. You’ll be notified once approved.",
        'status_error': "Sorry, I couldn’t check your registration status. Let’s proceed with registration.",
        'role_selected': "Selected role: {role}\nNow, Please provide your full name:",
        'enter_name': "Great! Now please provide your email address:",
        'invalid_email': "Invalid email address. Please enter a valid email address:",
        'email_exists': "Email already registered. Please enter a different email address for registration.",
        'email_error': "Sorry, I couldn't verify email availability at the moment. Please try again later.",
        'enter_password': "Nice! Now please enter your desired password:",
        'registration_success': "Registration successful! You're now registered on our Job platform.\n",
        'pending_approval': "Your account is pending approval. You’ll be notified once approved.\n",
        'registration_details': "Name: {name}\nEmail: {email}\nRole: {role}",
        'registration_failed': "Registration failed: {error} (Status: {status})",
        'server_error': "Sorry, there was an error connecting to the server: {error}",
        'cancel': "Registration cancelled. You can start again with /start",
        'approved_employer': "Congratulations! Your Employer account has been approved by the admin. You can now log in and start using the platform.\nSelect an option from the menu below:",
        'open_section': "Click below to open {section}:",
        'change_language_prompt': "Please select your new language:",
        'language_updated': "Your language has been successfully updated.",
        'enter_job_title': "What is your professional Job Title? (e.g. Accountant, Driver, Developer):",
        'role_selected_candidate': "Selected role: Job Seeker\nNow, please provide your full name:",
        'role_selected_employer': "Selected role: Employer\nNow, please provide your Company Name:",
        'enter_trade_license': """Hello! We are thrilled to have you join the Beleqet Jobs community.

To ensure the highest quality of job postings on our platform, we just need to verify your account details. Please provide a clear copy of the following documents (PDF, PNG, or JPEG):

    <b>Companies:</b> Trade License and Business TIN Certificate.
    <b>Individuals:</b> A valid National ID, Passport, or Driver’s License.

Our team will review these promptly so you can start hiring your next great talent!""",
        'invalid_file_type': "Invalid file type. Please upload a PDF, PNG, or JPEG file. Not more than 5MB.",
        'processing_registration': "Uploading file and processing your registration... Please wait.",
        'denied_employer': "Your registration was denied. ❌\nYou can try again with better documents",
        'enter_phone': "Please enter your phone number (Required):",
        'enter_tg_username': "Please enter your Telegram username.\nLet employers reach you directly! Enter your Telegram username to make it easier for recruiters to contact you about job opportunities.",
        'skip': "Skip ➡️",
        'menu': {
            'dashboard': "Dashboard",
            'my_profile': "My Profile",
            'my_applications': "My Applications",
            'post_job': "Post Job",
            'applicants': "Applicants",
            'my_jobs': "My Jobs",
            'job_list': "Jobs",
            'challenge': "SGS Challenge"
        }
    },
    'am': {
        'link_success': "መለያዎ በተሳካ ሁኔታ ተገናኝቷል!",
        'link_transfer_success': "መለያዎን ወደዚህ አዲስ የቴሌግራም ፕሮፋይል በተሳካ ሁኔታ አስተላልፈዋል።",
        'select_language': "እባክዎ ቋንቋዎን ይምረጡ:",
        'welcome_back': "እንኳን ተመልሰው በደህና መጡ አቶ፣ {name}! እንደ በ'ሮልነት' {role} ገብተዋል(ተካተዋል)።\nአማራጮችን ከታች ከቀረበዉ ሜኑ መሀከል ማግኘትና መምረጥ ይችላሉ:",
        'pending_employer': "እንደ ቀጣሪ ተደርገው ተመዝግበዋል፣ ሆኖም ግን አካውንትዎ ገና አልጸደቀም። እንደጸደቀ ወዲያዉኑ ይነገረዎታል።",
        'status_error': "ይቅርታ፣ የምዝገባ ደረጃዎን(ሁኔታዎን)መፈተሽና ማረጋገጥ አልቻልኩም። ስለዚህ ወደ ምዝገባው እናምራ።",
        'select_role': "እባክዎ ሚናዎን ይምረጡ:",
        'role_selected': "የተመረጠ ሚና: {role}\nአሁን ደግሞ፣ ሙሉ ስምዎን ያስገቡ:",
        'enter_name': "በጣም ጥሩ! አሁን ደግሞ የኢሜል አድራሻዎን ያስገቡ:",
        'invalid_email': "ልክ ያልሆነ(የማይሰራ)የኢሜል አድራሻ!!እባክዎ ትክክለኛ የኢሜል አድራሻ ያስገቡ:",
        'email_exists': "ይህ ኢሜል ቀድሞ ተመዝግቧል። እባክዎ ለምዝገባ የሚሆን ሌላ የኢሜል አድራሻ ያስገቡ።",
        'email_error': "ይቅርታ፣ በአሁኑ ጊዜ የኢሜሉን መገኘት መቻልና አለመቻል ማረጋገጥ አልቻልኩም። እባክዎ ቆይተው ይሞክሩ።",
        'enter_password': "ጥሩ! አሁን የሚፈልጉትን የይለፍ ቃል ያስገቡ:",
        'registration_success': "ምዝገባው ተሳክቷል! አሁን በሥራ ፕላትፎርማችን ላይ ተመዝግበዋል።\n",
        'pending_approval': "መለያ አካውንትዎ ፈቃድ እየጠበቀ ነው።ተፈቅዶ ሲያልቅ ይነገርዎታል\n",
        'registration_details': "ስም: {name}\nኢሜል: {email}\nሚና: {role}",
        'registration_failed': "ምዝገባው አልተሳካም {error} (ሁኔታ: {status})",
        'server_error': "ይቅርታ፣ ከ'ሰర్ቨር'በመገናኘት ሂደት ላይ አንዳች ስህተት(ኢረር)ተፈጥሯል: {error}",
        'cancel': "ምዝገባ ተሰርዟል። ሆኖም /start የሚለውን በመጠቀም እንደገና መጀመር ይችላሉ።",
        'approved_employer': "ኦ! እንኳን ደስ ያለዎት! አድሚኒስትሬተሩ የቀጣሪነት አካውንትዎን ተቀብሎታል። አሁን መግባትና ፕላትፎርሙን መጠቀም ይችላሉ።\nከታች ባለው ሜኑ ይጠቀሙ:",
        'open_section': "ያለውን ጠቅ ያርጉ ለመክፈት ከታች {section}:",
        'change_language_prompt': "እባክዎ አዲሱን ቋንቋዎን ይምረጡ:",
        'language_updated': "ቋንቋዎ በተሳካ ሁኔታ ተለውጧል።",
        'enter_job_title': "የሥራ መደብዎ ምንድን ነው? (ምሳሌ፡ አካውንታንት፣ ሾፌር፣ ዲቨሎፐር):",
        'role_selected_candidate': "የተመረጠ ሚና: ሥራ ፈላጊ\nአሁን ደግሞ፣ ሙሉ ስምዎን ያስገቡ:",
        'role_selected_employer': "የተመረጠ ሚና: ቀጣሪ\nአሁን ደግሞ፣ የድርጅቱን ስም ያስገቡ:",
        'enter_trade_license': """ሰላም! የበለቀት ስራዎች (Beleqet Jobs) ማህበረሰብ አባል ስለሆኑ በጣም ደስተኞች ነን።

በድረ-ገጻችን ላይ የሚወጡ የስራ ማስታወቂያዎች ተአማኒነት ያላቸው እና ጥራት ያላቸው መሆናቸውን ለማረጋገጥ፣ የተቋምዎን ወይም የግል መረጃዎን ማረጋገጥ ይኖርብናል። እባክዎ የሚከተሉትን ሰነዶች በ(PDF, PNG, ወይም JPEG) ቅርጸት ያያይዙ፦

    <b>ለድርጅቶች፦</b> የፀና የንግድ ፈቃድ እና የንግድ ታክስ ከፋይ መለያ ቁጥር (TIN) ሰርተፍኬት።
    <b>ለግለሰቦች፦</b> የታደሰ ብሄራዊ መታወቂያ፣ ፓስፖርት፣ ወይም የመንጃ ፈቃድ።

የላኩትን ሰነዶች በፍጥነት መርምረን ስናጠናቅቅ፣ ምርጥ ሰራተኞችን ወዲያውኑ መቅጠር መጀመር ይችላሉ!""",
        'invalid_file_type': "የፋይል አይነት ልክ አይደለም። እባክዎ PDF፣ PNG ወይም JPEG ፋይል ይጫኑ። ከ5MB በላይ አይደለም።",
        'processing_registration': "ፋይሉን እየጫንን እና ምዝገባዎን እያጠናቀቅን ነው... እባክዎ ይጠብቁ።",
        'denied_employer': "የቀጣሪነት ምዝገባ ጥያቄዎ ውድቅ ተደርጓል። ❌\nትክክለኛ ሰነዶችን በመያዝ እንደገና መመዝገብ ይችላሉ።",
        'enter_phone': "እባክዎ ስልክ ቁጥርዎን ያስገቡ (ግዴታ):",
        'enter_tg_username': "እባክዎ የቴሌግራም ተጠቃሚ ስምዎን (ዩዘርኔም) ያስገቡ።\nአሰሪዎች በቀጥታ እንዲያገኙዎ ያድርጉ! ቀጣሪዎች ስለ ስራ እድሎች በቀላሉ ሊያነጋግሩዎ እንዲችሉ የቴሌግራም የተጠቃሚ ስምዎን ያስገቡ።",
        'skip': "ዝለል ➡️",
        'menu': {
            'dashboard': "ዳሽቦርድ",
            'my_profile': "የእኔ መገለጫ",
            'my_applications': "የእኔ ማመልከቻዎች",
            'post_job': "ሥራ መለጠፍ",
            'applicants': "አመልካቾች",
            'my_jobs': "የእኔ ሥራዎች",
            'job_list': "ስራዎች",
            'challenge': "SGS Challenge"
        }
    }
}

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

MENU_URLS = {
    'candidate': {
        'dashboard': f"{CONFIG['mini_app_url']}/dashboard",
        'my_profile': f"{CONFIG['mini_app_url']}/profile",
        'my_applications': f"{CONFIG['mini_app_url']}/applications",
        'job_list': f"{CONFIG['mini_app_url']}/jobs",
    },
    'employer': {
        'post_job': f"{CONFIG['mini_app_url']}/post-job",
        'dashboard': f"{CONFIG['mini_app_url']}/dashboard",
        'my_profile': f"{CONFIG['mini_app_url']}/profile",
        'my_jobs': f"{CONFIG['mini_app_url']}/dashboard",
        'applicants': f"{CONFIG['mini_app_url']}/applications",
    }
}

class BotContext:
    def __init__(self):
        self.session: aiohttp.ClientSession = None
        self.application: Application = None
        self.rate_limiter = None

bot_context = BotContext()

@lru_cache(maxsize=128)
def get_keyboard(role: str, lang: str, is_admin: bool = False) -> ReplyKeyboardMarkup:
    menu = TRANSLATIONS[lang]['menu']
    role_friendly = normalize_role(role)
    options = (
        [[menu['job_list'], menu['my_profile']],
         [menu['my_applications'], menu['dashboard']],
         [menu['challenge']]]
        if role_friendly == 'Candidate' else
        [[menu['post_job'], menu['dashboard']],
         [menu['applicants'], menu['my_jobs']],
         [menu['my_profile']],
         [menu['challenge']]]
    )
    
    if is_admin:
        options.append(["📣 Broadcast Message"])
        
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

    async def copy_message(self, chat_id: int, from_chat_id: int, message_id: int, **kwargs):
        await self._send_request(
            chat_id,
            bot_context.application.bot.copy_message,
            from_chat_id=from_chat_id,
            message_id=message_id,
            **kwargs
        )

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # 1. Determine chat_id and effective_user safely
    user = update.effective_user
    if update.message:
        chat_id = update.message.chat_id
    elif update.callback_query:
        chat_id = update.callback_query.message.chat_id
    else:
        return ConversationHandler.END

    # --- PRIORITY 1: Deep linking for REGISTRATION from a job post ---
    if context.args and context.args[0].startswith("register_job-"):
        job_info = context.args[0].replace("register_", "")
        context.user_data['post_registration_job'] = job_info
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("English", callback_data='en'), InlineKeyboardButton("አማርኛ", callback_data='am')]
        ])
        await bot_context.rate_limiter.send_message(
            chat_id,
            "Welcome! To view this job, you need to register first.\n\n"
            "እባክዎ ቋንቋዎን ይምረጡ:\nPlease select your language:",
            reply_markup=keyboard
        )
        return LANGUAGE

    # --- PRIORITY 2: Deep linking for viewing a JOB ---
    if context.args and context.args[0].startswith("job-"):
        job_slug = context.args[0].split("job-", 1)[1]
        job_detail_url = f"{CONFIG['mini_app_url']}/jobs/{job_slug}"
        if not job_detail_url.startswith(('http://', 'https://')):
             job_detail_url = 'https://' + job_detail_url
             
        keyboard = [[InlineKeyboardButton("View Job Details", web_app=WebAppInfo(url=job_detail_url))]]
        await bot_context.rate_limiter.send_message(
            chat_id,
            "Click the button below to view the job details:", 
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return ConversationHandler.END

    # --- PRIORITY 3: Deep linking for SGS CHALLENGE ---
    if context.args and context.args[0] == "challenge":
        await challenge_command(update, context)
        return ConversationHandler.END

    # --- PRIORITY 4: Deep linking for ACCOUNT LINKING ---
    if context.args:
        telegram_id = str(user.id)
        token = context.args[0]
        if len(token) == 32:
            async with bot_context.session.post(
                f"{CONFIG['wp_api_url']}/../link-telegram",
                json={'token': token, 'telegram_id': telegram_id},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    role = normalize_role(data.get('role'))
                    lang = context.user_data.get('language', 'en')
                    link_type = data.get('link_type', 'new')

                    context.user_data['role'] = role
                    context.user_data['language'] = lang
                    
                    success_message = TRANSLATIONS[lang].get('link_transfer_success') if link_type == 'transfer' else TRANSLATIONS[lang].get('link_success')
                    welcome_message = TRANSLATIONS[lang]['welcome_back'].format(name=user.first_name, role=role)
                    
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        text=f"{success_message}\n\n{welcome_message}",
                        reply_markup=get_keyboard(role, lang, user.id in CONFIG['admin_ids'])
                    )
                else:
                    await bot_context.rate_limiter.send_message(chat_id, "Error: Linking failed.")
            return ConversationHandler.END

    # --- PRIORITY 4: Regular start logic (Status Check) ---
    telegram_id = str(user.id)
    async with bot_context.session.get(f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}", timeout=30) as response:
        if response.status == 200:
            data = await response.json()
            if data.get('registered'):
                lang = data.get('language') or 'en'
                role_raw = data.get('role', 'unknown')
                status_raw = data.get('status', 'pending').lower()
                role_friendly = normalize_role(role_raw)

                if status_raw == 'denied' and normalize_role(role_raw) == 'Employer':
                    logger.info(f"Employer {telegram_id} was denied. Restarting registration.")
                    context.user_data.clear() 
                else:
                    context.user_data['language'] = lang
                    context.user_data['role'] = role_friendly 
                    
                    if role_raw == 'candidate' or (role_raw == 'employer' and status_raw == 'approved'):
                        is_admin = user.id in CONFIG['admin_ids']
                        
                        await bot_context.rate_limiter.send_message(
                            chat_id,
                            TRANSLATIONS[lang]['welcome_back'].format(name=user.first_name, role=role_friendly),
                            reply_markup=get_keyboard(role_friendly, lang, is_admin)
                        )
                        return ConversationHandler.END
                    
                    elif role_raw == 'employer' and status_raw == 'pending':
                        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['pending_employer'])
                        return ConversationHandler.END

    # --- RE-REGISTRATION / NEW USER ---
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("English", callback_data='en'), InlineKeyboardButton("አማርኛ", callback_data='am')]
    ])
    await bot_context.rate_limiter.send_message(
        chat_id,
        "እባክዎ ቋንቋዎን ይምረጡ:\nPlease select your language:",
        reply_markup=keyboard
    )
    return LANGUAGE

async def handle_language_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    lang = query.data
    
    if lang not in ['en', 'am']:
        logger.warning(f"Unexpected callback data in language selection: {lang}")
        return LANGUAGE 

    context.user_data['language'] = lang
    logger.info(f"Language selected: {lang} for new user {query.from_user.id}")

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("Employer" if lang == 'en' else "ቀጣሪ", callback_data='employer'),
         InlineKeyboardButton("Job Seeker" if lang == 'en' else "ሥራ ፈላጊ", callback_data='candidate')]
    ])
    await query.edit_message_text(TRANSLATIONS[lang]['select_role'], reply_markup=keyboard)
    return ROLE

async def change_language_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point for the /language command."""
    # Check if user is registered first
    telegram_id = str(update.effective_user.id)
    async with bot_context.session.get(f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}") as response:
        if response.status != 200 or not (await response.json()).get('registered'):
            await update.message.reply_text("You need to be registered to change the language. Please use /start to register.")
            return ConversationHandler.END
            
    lang = context.user_data.get('language', 'en')
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("English", callback_data='lang_en'), InlineKeyboardButton("አማርኛ", callback_data='lang_am')]
    ])
    await bot_context.rate_limiter.send_message(
        update.message.chat_id,
        TRANSLATIONS[lang]['change_language_prompt'],
        reply_markup=keyboard
    )
    return CHANGE_LANGUAGE

async def handle_language_update(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handles the actual language update."""
    query = update.callback_query
    await query.answer()

    new_lang = query.data.split('_')[1]  # Extracts 'en' or 'am' from 'lang_en' or 'lang_am'
    telegram_id = str(query.from_user.id)

    # Update language on the backend
    async with bot_context.session.post(
        f"{CONFIG['wp_api_url']}/../update-language",
        json={'telegram_id': telegram_id, 'language': new_lang},
        timeout=aiohttp.ClientTimeout(total=10)
    ) as response:
        if response.status == 200:
            context.user_data['language'] = new_lang
            role = await get_user_role(telegram_id)
            await query.edit_message_text(text=TRANSLATIONS[new_lang]['language_updated'])
            # Show the main menu in the new language
            if role != 'unknown':
                 await bot_context.rate_limiter.send_message(
                    query.message.chat_id,
                    text=f"Menu (in {new_lang}):",
                    reply_markup=get_keyboard(role.capitalize(), new_lang, query.from_user.id in CONFIG['admin_ids'])
                )
        else:
            lang = context.user_data.get('language', 'en')
            await query.edit_message_text(text=TRANSLATIONS[lang]['server_error'].format(error='Could not update language'))

    return ConversationHandler.END

async def handle_role_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    role_input = query.data
    lang = context.user_data.get('language', 'en')

    ROLE_MAP = {
        'employer': 'wp_job_board_pro_employer',
        'candidate': 'wp_job_board_pro_candidate'
    }

    if role_input not in ROLE_MAP:
        if role_input in ['en', 'am']:
            if context.user_data.get('language') != role_input:
                context.user_data['language'] = role_input
                keyboard = InlineKeyboardMarkup([
                    [InlineKeyboardButton("Employer" if role_input == 'en' else "ቀጣሪ", callback_data='employer'),
                     InlineKeyboardButton("Job Seeker" if role_input == 'en' else "ሥራ ፈላጊ", callback_data='candidate')]
                ])
                try:
                    await query.edit_message_text(TRANSLATIONS[role_input]['select_role'], reply_markup=keyboard)
                except telegram.error.BadRequest as e:
                    if "Message is not modified" not in str(e):
                        raise e
            return ROLE
        return LANGUAGE

    context.user_data.update({
        'role_input': role_input,
        'role': normalize_role(role_input)
    })

    if role_input == 'employer':
        await query.edit_message_text(TRANSLATIONS[lang]['role_selected_employer'])
        return COMPANY_NAME
    else:
        await query.edit_message_text(TRANSLATIONS[lang]['role_selected_candidate'])
        return NAME
    
async def get_company_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return COMPANY_NAME
    context.user_data['company_name'] = message.text.strip()
    context.user_data['name'] = message.text.strip() 
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_phone'])
    return PHONE

async def get_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return NAME
    context.user_data['name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_phone']
    )
    return PHONE

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message:
        return PHONE

    lang = context.user_data.get('language', 'en')
    phone_input = None

    if message.contact and message.contact.phone_number:
        phone_input = message.contact.phone_number.strip()
        if phone_input.startswith('251') and not phone_input.startswith('+251'):
            phone_input = '+' + phone_input
    elif message.text:
        phone_input = message.text.strip()

    if not phone_input:
        return PHONE

    ethiopian_phone_pattern = r'^(\+251|0)[79][0-9]{8}$'
    
    if not re.match(ethiopian_phone_pattern, phone_input):
        error_msg = (
            "Invalid format. Please enter a valid Ethiopian number starting with 09... or 07..." 
            if lang == 'en' else 
            "ልክ ያልሆነ ቅርጸት። እባክዎ በ 09... ወይም 07... የሚጀምር ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ"
        )
        await bot_context.rate_limiter.send_message(message.chat_id, error_msg)
        return PHONE

    context.user_data['phone'] = phone_input
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_name']
    )
    return EMAIL

async def check_email_exists(email: str) -> dict:
    async with bot_context.session.get(
        f"{CONFIG['wp_api_url']}/../check-user?email={email}",
        timeout=aiohttp.ClientTimeout(total=30)
    ) as response:
        return await response.json() if response.status == 200 else None

async def get_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        if update.callback_query:
            await update.callback_query.answer()
        return EMAIL

    email = message.text.strip()
    lang = context.user_data.get('language', 'en')

    if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['invalid_email']
        )
        return EMAIL

    result = await check_email_exists(email)
    
    if result is None:
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['email_error']
        )
        return EMAIL

    is_registered = result.get('email_registered', False)
    can_proceed = result.get('can_reregister', False)

    if is_registered and not can_proceed:
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['email_exists']
        )
        return EMAIL

    context.user_data['email'] = email
    
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(TRANSLATIONS[lang]['skip'], callback_data='skip_tg')]])
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_tg_username'],
        reply_markup=keyboard
    )
    return TG_USERNAME

async def get_tg_username(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    lang = context.user_data.get('language', 'en')
    
    if update.callback_query:
        await update.callback_query.answer()
        context.user_data['tg_username'] = ""
        await bot_context.rate_limiter.send_message(
            update.callback_query.message.chat_id, 
            TRANSLATIONS[lang]['enter_password']
        )
    else:
        message = update.effective_message
        if not message or not message.text:
            return TG_USERNAME
        context.user_data['tg_username'] = message.text.strip()
        await bot_context.rate_limiter.send_message(
            message.chat_id, 
            TRANSLATIONS[lang]['enter_password']
        )
        
    return PASSWORD

async def get_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return PASSWORD

    user_data = context.user_data
    user_data['password'] = message.text
    lang = user_data.get('language', 'en')
    role_input = user_data.get('role_input', '')

    if role_input == 'employer':
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['enter_trade_license'],
            parse_mode='HTML'
        )
        return TRADE_LICENSE
    
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['enter_job_title']
    )
    return JOB_TITLE

async def get_job_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return JOB_TITLE
    context.user_data['job_title'] = message.text.strip()
    return await submit_registration(update, context)

async def get_trade_license(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message:
        return TRADE_LICENSE
    user_data = context.user_data
    lang = user_data.get('language', 'en')
    telegram_id = str(update.effective_user.id)
    chat_id = message.chat_id
    
    import time
    timestamp = int(time.time())
    
    document = message.document
    photo = message.photo
    
    if document:
        original_ext = document.file_name.lower().split('.')[-1]
        file_name = f"TG_{telegram_id}_{timestamp}.{original_ext}"
        file_obj = await document.get_file()
    elif photo:
        file_name = f"TG_{telegram_id}_{timestamp}.jpg"
        file_obj = await photo[-1].get_file()
    else:
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
        return TRADE_LICENSE

    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['processing_registration'])

    # Download as bytes (no Base64 encoding needed)
    file_bytes = await file_obj.download_as_bytearray()
    
    user_data['trade_license_bytes'] = bytes(file_bytes)
    user_data['trade_license_name'] = file_name
    
    return await submit_registration(update, context)

async def submit_registration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Submits the final registration data to the WordPress API."""
    user_data = context.user_data
    lang = user_data.get('language', 'en')
    chat_id = update.effective_chat.id if update.effective_chat else (update.effective_message.chat_id if update.effective_message else None)

    form_data = aiohttp.FormData()
    form_data.add_field('telegram_id', str(update.effective_user.id))
    form_data.add_field('name', user_data.get('name'))
    form_data.add_field('email', user_data.get('email'))
    form_data.add_field('password', user_data.get('password'))
    form_data.add_field('username', f"tg_{update.effective_user.id}")
    backend_role = ROLE_BACKEND.get(user_data.get('role_input', ''), user_data.get('role', ''))
    form_data.add_field('role', backend_role)
    form_data.add_field('language', lang)
    form_data.add_field('phone', user_data.get('phone', ''))
    form_data.add_field('tg_username', user_data.get('tg_username', '')),
    form_data.add_field('job_title', user_data.get('job_title', '')),
    form_data.add_field('company_name', user_data.get('company_name', ''))

    if 'trade_license_bytes' in user_data:
        form_data.add_field('trade_license_file', 
                           user_data['trade_license_bytes'],
                           filename=user_data['trade_license_name'],
                           content_type='application/octet-stream')

    try:
        
        async with bot_context.session.post(CONFIG['wp_api_url'], data=form_data, timeout=60) as response:
            if response.status == 201 or response.status == 200:
                data = await response.json()
                context.user_data['role'] = normalize_role(data.get('role'))
                context.user_data['language'] = data.get('language')
                status = data.get('status', 'approved')
                role = normalize_role(user_data.get('role_input', ''))
                
                msg = TRANSLATIONS[lang]['registration_success']
                if status == 'pending':
                    msg += TRANSLATIONS[lang]['pending_approval']

                details = TRANSLATIONS[lang]['registration_details'].format(
                    name=user_data.get('name'), email=user_data.get('email'), role=role
                )
                
                if chat_id:
                    await bot_context.rate_limiter.send_message(
                        chat_id, text=msg + details,
                        reply_markup=get_keyboard(role, lang, update.effective_user.id in CONFIG['admin_ids']) if status != 'pending' else None
                    )

                # Post-registration redirect logic
                post_reg_job = context.user_data.get('post_registration_job')
                if post_reg_job and chat_id:
                    clean_slug = post_reg_job.replace('job-', '')
                    mini_app_job_url = f"{CONFIG['mini_app_url']}/jobs/{clean_slug}"
                    
                    if lang == 'am':
                        btn_text = "ስራውን ለመክፈት እዚህ ይጫኑ"
                        success_txt = "ምዝገባው ተጠናቋል! አሁን ማየት ወደ ፈለጉት ስራ እንመልስዎ።"
                    else:
                        btn_text = "Click Here to Open the Job"
                        success_txt = "Registration complete! Now, let's get you back to the job you wanted to see."
                        
                    keyboard = [[InlineKeyboardButton(btn_text, web_app=WebAppInfo(url=mini_app_job_url))]]
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        text=success_txt,
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
            else:
                try:
                    error_data = await response.json()
                    error_message = error_data.get('message', 'An unknown error occurred.')
                except Exception:
                    error_message = f"Could not parse server response. Status: {response.status}"

                if chat_id:
                    await bot_context.rate_limiter.send_message(
                        chat_id,
                        TRANSLATIONS[lang]['registration_failed'].format(error=error_message, status=response.status)
                    )

    except Exception as e:
        logger.error(f"Error during registration submission: {e}", exc_info=True)
        if chat_id:
            await bot_context.rate_limiter.send_message(
                chat_id, TRANSLATIONS[lang]['server_error'].format(error="an unexpected issue")
            )
    finally:
        keys_to_remove = ['trade_license_bytes', 'trade_license_name', 'password', 'role_input']
        for key in keys_to_remove:
            context.user_data.pop(key, None)
            
        logger.info(f"Cleaned up heavy registration data for user {update.effective_user.id}")
    return ConversationHandler.END

async def handle_menu_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:

    if not update.message or not update.message.text:
        return

    text = update.message.text
    user = update.effective_user
    telegram_id = str(user.id)
    
    # --- !! REPLACEMENT LOGIC !! ---
    # 1. Try to get role and language from the cache first
    role = normalize_role(context.user_data.get('role'))
    lang = context.user_data.get('language')

    # 2. If not in cache, fetch from API (fallback for safety)
    if role == 'Unknown' or not lang:
        logger.info(f"Cache miss for user {telegram_id}. Fetching from API.")
        async with bot_context.session.get(
            f"{CONFIG['wp_api_url']}/../check-user?telegram_id={telegram_id}",
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get('registered'):
                    role = normalize_role(data.get('role', 'unknown'))
                    lang = data.get('language', 'en')
                    # Save to cache for next time
                    context.user_data['role'] = role
                    context.user_data['language'] = lang
    
    if not lang:
        lang = 'en'
    # --- !! END OF REPLACEMENT !! ---

    menu = TRANSLATIONS[lang]['menu']
    menu_key = next((key for key, value in menu.items() if value == text), None)
    
    if not menu_key or not role or role == 'unknown':
        logger.warning(f"Menu handler failed for user {telegram_id}. Text: '{text}'. Role: {role}. Menu Key: {menu_key}")
        return

    if menu_key == 'challenge':
        await challenge_command(update, context)
        return

    if role == 'Candidate' and menu_key in ['dashboard', 'my_profile', 'my_applications', 'job_list']:
        photo_id = CONFIG.get('candidate_promo_photo_id')
        
        caption = """ምርጥ የሥራ ዕድሎች ለማቅረብ ከቀዳሚ ቀጣሪዎች እና ድርጅቶች ጋር እንሰራለን።\n
        ችሎታዎች ዋጋ አላቸው፤ በሚያስፈልጉበት ቦታዎች ላይ ያግኟቸው።\n

➡️በዌብሳይታችን ላይ <b>በነፃ</b>፣ ሲቪዎትን በተለያዩ ይዘት ባላቸው ቴምፕሌትስ በማዘጋጀት ተጠቃሚ እንዲሆኑ እናደርጋለን።\n
➡️ለኢንተርቪ ከመጠራቶት በፊት፣ <b>እንዴት</b> እና <b>በምን</b> መልኩ ልዘጋጅ ብለው እንዳይጨነቁ በማሰብ፣ ዓለማቀፋዊ ዕይታ ያላቸውን ምክረ-ሐሳቦች በማቅረብ ጭንቀቶን እናቀላለል፣\n
➡️<b>የዜሮ</b> እና <b>የተለያዩ ዓመታት</b>፣ የሥራ ቅጥር ማስታወቂያዎችን በብዛት በቴሌግራም እና በዌብሳይታችን ላይ፣በሰፊው ተደራሽ እንዲሆኑ በመልቀቅ የስራ ባለቤት እናደርጎታለን።\n       
ለፈጣን የስራ ማስታወቂያዎች <b>የቴሌግራም ቻናላችንን ይቀላቀሉ</b> እና <b>አሁኑኑ ለማመልከት ድረገጻችንን ይጎብኙ!</b>በቀላሉ በእጅ ስልኮትያገኛሉ።\n
https://t.me/BeleqetJobs <b>እና</b>\n
https://beleqetjobs.com ላይማስታወቂያዎችን በመመልከት <b>አሁኑኑ</b> ያመልክቱ"""

        if photo_id:
            await bot_context.rate_limiter.send_photo(
                chat_id=update.message.chat_id,
                photo=photo_id,
                caption=caption,
                parse_mode='HTML'
            )

    if role == 'Employer' and menu_key in ['post_job', 'dashboard', 'my_profile', 'my_jobs', 'applicants']:
        photo_id = CONFIG.get('employer_promo_photo_id')

        caption = """እኛ <b>Beleqet Jobs</b> የእርሶን ጭንቀትና የጊዜ ብክነት ለማብቃት፣ ከሺህ በላይ አመልካቾች መካከል ትክክለኛውን ሰው በፍጥነት እናገኝልዎታለን። ከእንግዲህ የሚያስጨንቅ ፍለጋ የለም!
ትክክለኛውን እጩ በደቂቃዎች ውስጥ ወደ እርስዎ እናመጣለን።

ማስታወቂያ ከማውጣት እስከ ኢንተርቪው ድረስ ያለውን የቅጥር ውስብስብነት ስናግዞት፣ እርስዎ በዋና ስራዎ ላይያተኩሩ። ሸክሙን ከትከሻዎ ላይ እናነሳለን።

የቅጥር ፈተናዎች እንዳያዘገዩዎት። የእኛ ቁርጠኛ ቡድን ልዩ ፍላጎቶችዎን በመረዳት ይሠራል፣ ለድርጅትዎ የስራ ባህል እና መስፈርቶች በትክክል የሚስማሙ የተመረጡ እጩዎችን ያቀርባል።

ቅጥርዎን ያስተላልፉ – እንዴት እንደሆነ ይወቁ!

ተስማሚ የሰው ኃይልዎን ለመገንባት ከእኛ ጋር ይስሩ!

ዛሬውኑ የ<b>Beleqet Jobs</b>ን
➡️የቴሌግራም(https://t.me/BeleqetJobs) እና
➡️የዌብሳይት(https://beleqetjobs.com) ገፆቻችንን በመቀላቀልይመልከቱ!

<b>Beleqet Jobs</b> ለንግድዎ፣ ለቤተሰብዎና ለጓደኞችዎ ተጨማሪ ትርፍ ጊዜ በመስጠት የቅጥር ጊዜዎን ይቀንሳል፣ ጭንቀትዎን ያቀላል፣ ለእርሶም የሚገባዎትን እረፍት ይሰጥዎታል"""

        if photo_id:
            await bot_context.rate_limiter.send_photo(
                chat_id=update.message.chat_id,
                photo=photo_id,
                caption=caption,
                parse_mode='HTML'
            )

    links = MENU_URLS.get('candidate' if role == "Candidate" else 'employer', {})

    if menu_key in links:
        url = links[menu_key]
        keyboard = [[InlineKeyboardButton(text, web_app=WebAppInfo(url=url))]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await bot_context.rate_limiter.send_message(
            chat_id=update.message.chat_id,
            text=TRANSLATIONS[lang]['open_section'].format(section=text),
            reply_markup=reply_markup
        )

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

async def restart_from_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    return await start(update, context)

async def health_check(request: web.Request) -> web.Response:
    logger.info("Health check endpoint was accessed.")
    return web.Response(text="Bot is running!")

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error(msg="Exception while handling an update:", exc_info=context.error)
    
    if isinstance(context.error, telegram.error.Forbidden):
        return
    try:
        if isinstance(update, Update) and update.effective_message:
            text = "Sorry, an unexpected error occurred. Please use /start to restart the process."
            await update.effective_message.reply_text(text)
    except Exception as e:
        logger.error(f"Failed to send error notification: {e}")

async def webhook_handler(request: web.Request) -> web.Response:
    # 1. Security Check: Validate Secret Token
    expected_token = os.getenv("WEBHOOK_SECRET_TOKEN")
    provided_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    if not expected_token or provided_token != expected_token:
        logger.warning(f"Unauthorized webhook access attempt from {request.remote}")
        return web.Response(text="Forbidden", status=403)
    
    logger.info(f"Incoming authorized webhook request to path: {request.path}")
    try:
        data = await request.json()
        action = data.get('action')

        if action == 'manual_payment_uploaded':
            order_id = data.get('order_id')
            amount = data.get('amount')
            currency = data.get('currency')
            reference = data.get('reference')
            receipt_url = data.get('receipt_url')

            caption = (
                f"🚨 <b>New Manual Payment Uploaded!</b>\n\n"
                f"<b>Order ID:</b> #{order_id}\n"
                f"<b>Total Amount:</b> {amount} {currency}\n"
                f"<b>Reference:</b> <code>{reference}</code>"
            )
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve_payment_{order_id}"),
                    InlineKeyboardButton("❌ Reject", callback_data=f"reject_payment_{order_id}")
                ]
            ])
            for admin_id in CONFIG['admin_ids']:
                try:
                    await bot_context.rate_limiter.send_photo(
                        chat_id=admin_id,
                        photo=receipt_url,
                        caption=caption,
                        reply_markup=keyboard,
                        parse_mode='HTML'
                    )
                except Exception as e:
                    logger.error(f"Failed to send manual payment notification to admin {admin_id}: {e}")
            return web.Response(text="OK", status=200)

        # Existing logic for user approval/denial
        telegram_id = data.get('telegram_id')
        status = data.get('status')
        role = data.get('role')
        language = data.get('language', 'en')
        message_override = data.get('message')

        if not telegram_id:
            return web.Response(text="Missing telegram_id", status=400)

        # 1. Initialize variables
        notification_text = ""
        current_reply_markup = None # This will hold either the Menu or the Inline Button

        # 2. Handle Approved Status
        if status == 'approved':
            if role == 'wp_job_board_pro_employer':
                notification_text = TRANSLATIONS[language].get('approved_employer', '')
            else:
                notification_text = TRANSLATIONS[language].get('registration_success', '')
            
            # Show the actual Menu Button for approved users
            friendly_role = normalize_role(role)
            is_admin = int(telegram_id) in CONFIG['admin_ids']
            current_reply_markup = get_keyboard(friendly_role, language, is_admin)
            
            # Update cache
            chat_data = bot_context.application.user_data.get(int(telegram_id))
            if chat_data is not None:
                chat_data['role'] = friendly_role
                chat_data['language'] = language

        # 3. Handle Denied Status
        elif status == 'denied':
            notification_text = TRANSLATIONS[language].get('denied_employer', '')
            btn_text = "Register Again" if language == 'en' else "እንደገና ይመዝገቡ"
            current_reply_markup = InlineKeyboardMarkup([[
                InlineKeyboardButton(btn_text, callback_data='restart_reg')
            ]])

        final_message = message_override if message_override else notification_text

        # 4. Send message
        try:
            await bot_context.rate_limiter.send_message(
                chat_id=telegram_id,
                text=final_message,
                reply_markup=current_reply_markup,
                parse_mode='HTML'
            )
        except telegram.error.Forbidden:
            logger.info(f"Webhook failed: Bot was blocked by user {telegram_id}")
            return web.Response(text="User blocked bot", status=200)

        return web.Response(text="OK", status=200)

    except Exception as e:
        logger.error(f"Error in webhook_handler: {e}", exc_info=True)
        return web.Response(text="Internal Server Error", status=500)

    # --- 📣 BROADCAST HANDLERS ---
async def broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.effective_user.id not in CONFIG['admin_ids']:
        return ConversationHandler.END

    await update.message.reply_text(
        "📣 **Admin Broadcast Mode**\n\n"
        "Please send the message you want to broadcast to ALL registered users.\n"
        "You can send text, a photo, a video, or forward a message.\n\n"
        "Send /cancel to abort.",
        parse_mode='Markdown',
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("/cancel")]], resize_keyboard=True)
    )
    return BROADCAST_MESSAGE

async def broadcast_get_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Save the original message ID
    context.user_data['broadcast_msg_id'] = update.message.message_id

    await update.message.reply_text(
        "Message received! Do you want to add a custom button with a link to the bottom of this message?\n\n"
        "🔘 **If YES:** Type the text for the button (e.g., 'Click Here' or 'Apply Now').\n"
        "⏩ **If NO:** Just send /skip.",
        parse_mode='Markdown'
    )
    return BROADCAST_BUTTON_TEXT

async def broadcast_skip_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = None
    context.user_data['broadcast_btn_url'] = None
    return await show_broadcast_confirmation(update, context)

async def broadcast_get_button_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = update.message.text
    await update.message.reply_text(
        "Great! Now send the **URL/Link** for the button (e.g., `https://google.com`):",
        parse_mode='Markdown'
    )
    return BROADCAST_BUTTON_URL

async def broadcast_get_button_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    url = update.message.text.strip()
    
    # Simple validation to ensure Telegram accepts the URL
    if not url.startswith(("http://", "https://", "t.me/")):
        await update.message.reply_text("⚠️ Please enter a valid URL starting with `http://`, `https://`, or `t.me/`", parse_mode='Markdown')
        return BROADCAST_BUTTON_URL
        
    context.user_data['broadcast_btn_url'] = url
    return await show_broadcast_confirmation(update, context)

async def show_broadcast_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Helper function to show the final confirmation screen."""
    keyboard = [[
        InlineKeyboardButton("Test Mode (Count Only) 🧪", callback_data="broadcast_test"),
    ],[
        InlineKeyboardButton("Confirm Broadcast ✅", callback_data="broadcast_confirm"),
        InlineKeyboardButton("Cancel ❌", callback_data="broadcast_cancel")
    ]]
    
    btn_text = context.user_data.get('broadcast_btn_text')
    btn_url = context.user_data.get('broadcast_btn_url')
    
    preview_msg = "All set! "
    if btn_text and btn_url:
        preview_msg += f"\n\n**Attached Button:** [{btn_text}]({btn_url})"
        
    await update.message.reply_text(
        f"{preview_msg}\n\nWhat would you like to do?\n\n"
        "🧪 **Test Mode:** Just count the database users, don't send anything.\n"
        "✅ **Confirm:** Send this message to ALL registered users.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True
    )
    return BROADCAST_CONFIRM

async def broadcast_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    import asyncio
    query = update.callback_query
    await query.answer()
    admin_chat_id = update.effective_chat.id

    # --- NEW: Generate the correct menu dynamically ---
    admin_role = context.user_data.get('role', 'employer')
    admin_lang = context.user_data.get('language', 'en')
    current_menu = get_keyboard(admin_role, admin_lang, is_admin=True)
    # ------------------------------------------------

    if query.data == "broadcast_cancel":
        await query.edit_message_text("Broadcast cancelled.")
        context.user_data.pop('broadcast_msg_id', None)
        context.user_data.pop('broadcast_btn_text', None)
        context.user_data.pop('broadcast_btn_url', None)
        # Replaced admin_menu_markup with current_menu
        await bot_context.rate_limiter.send_message(chat_id=admin_chat_id, text="Returning to menu.", reply_markup=current_menu)
        return ConversationHandler.END

    if query.data in ["broadcast_confirm", "broadcast_test"]:
        is_test = (query.data == "broadcast_test")
        action_text = "🚀 Testing API connection..." if is_test else "🚀 Fetching users and starting broadcast..."
        await query.edit_message_text(action_text)

        msg_id = context.user_data.get('broadcast_msg_id')
        btn_text = context.user_data.get('broadcast_btn_text')
        btn_url = context.user_data.get('broadcast_btn_url')
        
        custom_markup = None
        if btn_text and btn_url:
            custom_markup = InlineKeyboardMarkup([[InlineKeyboardButton(btn_text, url=btn_url)]])

        success_count = 0
        fail_count = 0

        try:
            base_url = CONFIG['wp_api_url'].rstrip('/register') 
            fetch_url = f"{base_url}/get-all-telegram-ids"

            async with bot_context.session.get(fetch_url, timeout=30) as response:
                if response.status != 200:
                    await bot_context.rate_limiter.send_message(admin_chat_id, f"❌ API Error: HTTP {response.status}")
                    return ConversationHandler.END
                
                data = await response.json()
                telegram_ids = data.get('telegram_ids', [])

            total_users = len(telegram_ids)

            if total_users == 0:
                await bot_context.rate_limiter.send_message(admin_chat_id, "⚠️ No users found via the WordPress API.")
                return ConversationHandler.END

            if is_test:
                sample_ids = ", ".join(str(uid) for uid in telegram_ids[:10])
                if total_users > 10: sample_ids += "..."
                
                await bot_context.rate_limiter.send_message(
                    chat_id=admin_chat_id,
                    text=f"✅ **WordPress API Test Successful!**\n\n**Total Users Found:** `{total_users}`\n**Sample IDs:** `{sample_ids}`",
                    parse_mode='Markdown',
                    reply_markup=current_menu # Replaced here
                )
            else:   
                for target_id in telegram_ids:
                    try:
                        await bot_context.rate_limiter.copy_message(
                            chat_id=int(target_id),
                            from_chat_id=admin_chat_id,
                            message_id=msg_id,
                            reply_markup=custom_markup 
                        )
                        success_count += 1
                    except telegram.error.Forbidden:
                        # This is now caught specifically without a full stack trace
                        fail_count += 1
                    except Exception as e:
                        logger.warning(f"Unexpected failure for {target_id}: {e}")
                        fail_count += 1

                    await asyncio.sleep(0.05) 

                await bot_context.rate_limiter.send_message(
                    chat_id=admin_chat_id,
                    text=f"✅ **Broadcast Complete!**\n\nSent to: `{success_count}` users\nFailed: `{fail_count}` users",
                    parse_mode='Markdown',
                    reply_markup=current_menu # Replaced here
                )

        except Exception as e:
            logger.error(f"Broadcast error: {e}", exc_info=True)
            await bot_context.rate_limiter.send_message(admin_chat_id, f"An error occurred: {e}", reply_markup=current_menu) # Replaced here

        context.user_data.pop('broadcast_msg_id', None)
        context.user_data.pop('broadcast_btn_text', None)
        context.user_data.pop('broadcast_btn_url', None)
        return ConversationHandler.END

async def broadcast_cancel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    admin_role = context.user_data.get('role', 'employer')
    admin_lang = context.user_data.get('language', 'en')
    current_menu = get_keyboard(admin_role, admin_lang, is_admin=True)
    # --------------------------------------------------

    await update.message.reply_text("Broadcast cancelled.", reply_markup=current_menu)
    context.user_data.pop('broadcast_msg_id', None)
    context.user_data.pop('broadcast_btn_text', None)
    context.user_data.pop('broadcast_btn_url', None)
    return ConversationHandler.END

async def handle_payment_decision(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    if update.effective_user.id not in CONFIG['admin_ids']:
        await query.edit_message_caption(caption="Unauthorized access.")
        return

    data = query.data
    action, order_id = data.rsplit('_', 1)
    status = 'completed' if action == 'approve_payment' else 'cancelled'

    payload = {
        'order_id': order_id,
        'status': status
    }
    
    try:
        async with bot_context.session.post(
            f"{CONFIG['wp_api_url']}/../update-payment-status",
            json=payload,
            headers={'X-Telegram-Bot-Api-Secret-Token': os.getenv("WEBHOOK_SECRET_TOKEN")},
            timeout=aiohttp.ClientTimeout(total=15)
        ) as response:
            if response.status == 200:
                result_text = "✅ Approved" if status == 'completed' else "❌ Rejected"
                new_caption = f"{query.message.caption}\n\n<b>Decision:</b> {result_text} by {update.effective_user.first_name}"
                await query.edit_message_caption(caption=new_caption, parse_mode='HTML')
            else:
                resp_text = await response.text()
                logger.error(f"Failed to update WP payment status: HTTP {response.status} - {resp_text}")
                await query.edit_message_caption(caption=f"{query.message.caption}\n\n<b>Error:</b> Failed to update WordPress status (HTTP {response.status}).", parse_mode='HTML')
    except Exception as e:
        logger.error(f"Error updating payment status: {e}", exc_info=True)
        await query.edit_message_caption(caption=f"{query.message.caption}\n\n<b>Error:</b> Exception occurred while updating status.", parse_mode='HTML')


async def challenge_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = f"{CONFIG['challenge_mini_app_url']}?startapp=vote"
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(
        "🗳️ Vote Now / ድምጽ ይስጡ", web_app=WebAppInfo(url=url)
    )]])
    await update.message.reply_text(
        "Super SGS Furniture Creative Challenge is live! Vote for your favourite creator 👇",
        reply_markup=kb
    )

async def main() -> None:
    logger.info("Script starting...")
    if not all(CONFIG.values()):
        logger.critical("Missing required environment variables! Please check your .env file or environment.")
        raise ValueError("Missing required environment variables.")

    unique_user_agent = 'BeleqetJobBot/1.0'

    # Initialize persistence
    persistence = PicklePersistence(filepath='bot_data.pickle')

    async with aiohttp.ClientSession(
    headers={
        'User-Agent': unique_user_agent,
        'X-Beleqet-API-Token': os.getenv("BELEQET_API_SECRET_TOKEN")
            }
        ) as session:

        bot_context.session = session
        bot_context.application = (
            Application.builder()
            .token(CONFIG['telegram_token'])
            .persistence(persistence)
            .build()
            )
        bot_context.rate_limiter = RateLimiter()
        bot_context.application.add_error_handler(error_handler)
        
        language_change_handler = ConversationHandler(
            entry_points=[CommandHandler('language', change_language_command)],
            states={
                CHANGE_LANGUAGE: [CallbackQueryHandler(handle_language_update, pattern='^lang_')],
            },
            fallbacks=[CommandHandler('cancel', cancel)],
        )

        conv_handler = ConversationHandler(
            entry_points=[CommandHandler('start', start),
                          CallbackQueryHandler(restart_from_button, pattern='^restart_reg$')],
            states={
                LANGUAGE: [CallbackQueryHandler(handle_language_selection, pattern='^(en|am)$')],
                ROLE: [CallbackQueryHandler(handle_role_selection)],
                COMPANY_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_company_name)],
                NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_name)],
                PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_phone)],
                EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_email)],
                TG_USERNAME: [
                            MessageHandler(filters.TEXT & ~filters.COMMAND, get_tg_username),
                            CallbackQueryHandler(get_tg_username, pattern='^skip_tg$')
                        ],
                PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_password)],
                TRADE_LICENSE: [MessageHandler((filters.Document.ALL | filters.PHOTO) & ~filters.COMMAND, get_trade_license)],
                JOB_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_job_title)],
            },
            fallbacks=[CommandHandler('cancel', cancel)],
            name="registration_conversation",
            persistent=True,
            allow_reentry=True
        )

        broadcast_conv = ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📣 Broadcast Message$"), broadcast_start)],
        states={
            BROADCAST_MESSAGE: [MessageHandler(filters.ALL & ~filters.COMMAND, broadcast_get_message)],
            BROADCAST_BUTTON_TEXT: [
                CommandHandler("skip", broadcast_skip_button),
                MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_text)
            ],
            BROADCAST_BUTTON_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_url)],
            BROADCAST_CONFIRM: [CallbackQueryHandler(broadcast_action, pattern="^broadcast_")],
        },
        fallbacks=[CommandHandler("cancel", broadcast_cancel_cmd)],
    )
        
        bot_context.application.add_handler(broadcast_conv)
        bot_context.application.add_handler(language_change_handler)
        bot_context.application.add_handler(conv_handler)
        bot_context.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_menu_selection))
        bot_context.application.add_handler(CallbackQueryHandler(handle_payment_decision, pattern='^(approve_payment_|reject_payment_)'))
        bot_context.application.add_handler(CommandHandler("challenge", challenge_command))

        app = web.Application()
        # --- NEW Health Check Route ---
        app.router.add_get('/', health_check)
        app.router.add_post('/webhook', webhook_handler)
        
        # --- SGS Challenge Routes ---
        challenge_db = await init_challenge_db()
        register_challenge_routes(app, challenge_db, bot_token=CONFIG['telegram_token'], wp_api_url=CONFIG['wp_api_url'], admin_ids=CONFIG['admin_ids'])
        
        async def challenge_index(request):
            return web.FileResponse(os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'app', 'index.html'))
            
        app.router.add_get('/challenge', challenge_index)
        app.router.add_get('/challenge/', challenge_index)
        app.router.add_static('/challenge/', path=os.path.join(os.path.dirname(__file__), 'sgs-challenge', 'app'), name='challenge_static')
        
        runner = web.AppRunner(app)
        await runner.setup()
        port = int(os.environ.get('PORT', 8082))
        site = web.TCPSite(runner, '0.0.0.0', port)
        await site.start()
        logger.info("======================================================")
        logger.info(f">>> Webhook server started on http://0.0.0.0:{port} <<<")
        logger.info("======================================================")


        await bot_context.application.initialize()
        await bot_context.application.start()

        try:
            from telegram import MenuButtonWebApp
            await bot_context.application.bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Open App",
                    web_app=WebAppInfo(url=CONFIG['mini_app_url'])
                )
            )
            logger.info(f">>> Telegram Chat Menu Button set to {CONFIG['mini_app_url']} <<<")
        except Exception as e:
            logger.warning(f"Could not set chat menu button: {e}")

        await bot_context.application.updater.start_polling(allowed_updates=Update.ALL_TYPES)
        logger.info(">>> Telegram bot started polling <<<")

        try:
            await asyncio.Event().wait()
        finally:
            await bot_context.application.updater.stop()
            await bot_context.application.stop()
            await runner.cleanup()
            logger.info("Bot and webhook server stopped gracefully.")


if __name__ == "__main__":
    asyncio.run(main())