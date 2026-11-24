"""Registration: /start, language, role, and each question until the account is created."""
import aiohttp
import re
import telegram
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, Update, WebAppInfo
from telegram.ext import ContextTypes, ConversationHandler

from config import CHANGE_LANGUAGE, CITY, COMPANY_NAME, CONFIG, CONTACT_NAME, COUNTRY, COUNTRY_TYPED, EMAIL, EMAIL_CODE, GENDER, JOB_TITLE, LANGUAGE, LINK_EMAIL, NAME, PASSWORD, PHONE, REGISTRATION_KEYS, ROLE, TG_USERNAME, TRADE_LICENSE, logger
from texts import COUNTRY_BUTTONS, ETHIOPIAN_CITIES, TRANSLATIONS
import challenge
from common import MINI_APP, bot_context, country_from_text, full_telegram_name, get_keyboard, get_user_role, normalize_role, own_phone, password_ok, registration_payload, role_keyboard
from accounts import send_email_code

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
        job_detail_url = f"{MINI_APP}/jobs/{job_slug}"
        if not job_detail_url.startswith(('http://', 'https://')):
             job_detail_url = 'https://' + job_detail_url
             
        keyboard = [[InlineKeyboardButton("View Job Details", web_app=WebAppInfo(url=job_detail_url))]]
        await bot_context.rate_limiter.send_message(
            chat_id,
            "Click the button below to view the job details:", 
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return ConversationHandler.END

    # --- PRIORITY 3: Deep linking for SGS CHALLENGE (challenge, or challenge-<creator id>) ---
    if context.args and (context.args[0] == "challenge" or context.args[0].startswith("challenge-")):
        creator = context.args[0].removeprefix("challenge").removeprefix("-")
        await challenge.challenge_command(update, context, creator_id=int(creator) if creator.isdigit() else None)
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
    # The challenge is one tap away from the first screen: voting doesn't wait for registration.
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("English", callback_data='en'), InlineKeyboardButton("አማርኛ", callback_data='am')],
        *challenge.challenge_row(),
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

    await query.edit_message_text(TRANSLATIONS[lang]['select_role'], reply_markup=role_keyboard(lang))
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

    if role_input == 'existing':
        await query.edit_message_text(TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL

    if role_input not in ROLE_MAP:
        if role_input in ['en', 'am']:
            if context.user_data.get('language') != role_input:
                context.user_data['language'] = role_input
                try:
                    await query.edit_message_text(TRANSLATIONS[role_input]['select_role'], reply_markup=role_keyboard(role_input))
                except telegram.error.BadRequest as e:
                    if "Message is not modified" not in str(e):
                        raise e
            return ROLE
        return LANGUAGE

    for key in REGISTRATION_KEYS:
        context.user_data.pop(key, None)
    context.user_data.update({
        'role_input': role_input,
        'role': normalize_role(role_input)
    })

    if role_input == 'employer':
        await query.edit_message_text(TRANSLATIONS[lang]['role_selected_employer'])
        return COMPANY_NAME
    # Job seekers: the name on their Telegram is one tap away.
    name = full_telegram_name(query.from_user)
    buttons = [[InlineKeyboardButton(TRANSLATIONS[lang]['use_this_name'].format(name=name)[:60], callback_data='use_tg_name')]] if name else []
    await query.edit_message_text(
        TRANSLATIONS[lang]['name_or_type'] if name else TRANSLATIONS[lang]['role_selected_candidate'],
        reply_markup=InlineKeyboardMarkup(buttons) if buttons else None,
    )
    return NAME
    
async def get_company_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return COMPANY_NAME
    context.user_data['company_name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_contact_name'])
    return CONTACT_NAME

async def get_contact_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """The employer's own name: the account is theirs, the company is its profile."""
    message = update.effective_message
    if not message or not message.text:
        return CONTACT_NAME
    context.user_data['contact_name'] = message.text.strip()
    context.user_data['name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_phone'])
    return PHONE

def share_phone_keyboard(lang: str) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(TRANSLATIONS[lang]['share_phone_button'], request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )


async def ask_for_phone(chat_id: int, lang: str) -> int:
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['share_phone_prompt'], reply_markup=share_phone_keyboard(lang))
    return PHONE


async def get_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return NAME
    context.user_data['name'] = message.text.strip()
    lang = context.user_data.get('language', 'en')
    return await ask_for_phone(message.chat_id, lang)


async def use_telegram_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    name = full_telegram_name(query.from_user) or 'Telegram User'
    context.user_data['name'] = name
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except Exception:
        pass
    return await ask_for_phone(query.message.chat_id, lang)

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message:
        return PHONE

    lang = context.user_data.get('language', 'en')

    # Job seekers share the number Telegram verified; it's how employers reach them.
    if context.user_data.get('role_input') != 'employer':
        phone = own_phone(message, update.effective_user)
        if not phone:
            await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['share_phone_only'], reply_markup=share_phone_keyboard(lang))
            return PHONE
        context.user_data['phone'] = phone
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['phone_received'].format(phone=phone), reply_markup=ReplyKeyboardRemove())
        return await ask_gender(message.chat_id, lang)

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
        TRANSLATIONS[lang]['enter_email']
    )
    return EMAIL

async def ask_gender(chat_id: int, lang: str) -> int:
    t = TRANSLATIONS[lang]
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(t['gender_male'], callback_data='gender_MALE'),
                                      InlineKeyboardButton(t['gender_female'], callback_data='gender_FEMALE')]])
    await bot_context.rate_limiter.send_message(chat_id, t['ask_gender'], reply_markup=keyboard)
    return GENDER


async def get_gender(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    context.user_data['gender'] = query.data.split('_', 1)[1]
    t = TRANSLATIONS[lang]
    rows = [[InlineKeyboardButton(en if lang == 'en' else am, callback_data=f'country_{code}')]
            for code, en, am in COUNTRY_BUTTONS]
    rows.append([InlineKeyboardButton(t['other_country'], callback_data='country_other')])
    chosen = t['gender_male'] if context.user_data['gender'] == 'MALE' else t['gender_female']
    await query.edit_message_text(f"{t['ask_gender']} {chosen}")
    await bot_context.rate_limiter.send_message(query.message.chat_id, t['ask_country'], reply_markup=InlineKeyboardMarkup(rows))
    return COUNTRY


async def ask_city(chat_id: int, context: ContextTypes.DEFAULT_TYPE) -> int:
    lang = context.user_data.get('language', 'en')
    t = TRANSLATIONS[lang]
    if context.user_data.get('country') == 'ET':
        labels = [en if lang == 'en' else am for en, am in ETHIOPIAN_CITIES]
        rows = [[InlineKeyboardButton(labels[i], callback_data=f'city_{i}'),
                 InlineKeyboardButton(labels[i + 1], callback_data=f'city_{i + 1}')]
                for i in range(0, len(labels) - 1, 2)]
        rows.append([InlineKeyboardButton(t['other_city'], callback_data='city_other')])
        await bot_context.rate_limiter.send_message(chat_id, t['ask_city'], reply_markup=InlineKeyboardMarkup(rows))
    else:
        await bot_context.rate_limiter.send_message(chat_id, t['type_city'])
    return CITY


async def get_country(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language', 'en')
    choice = query.data.split('_', 1)[1]
    if choice == 'other':
        await query.edit_message_text(TRANSLATIONS[lang]['type_country'])
        return COUNTRY_TYPED
    context.user_data['country'] = choice
    names = {code: (en if lang == 'en' else am) for code, en, am in COUNTRY_BUTTONS}
    await query.edit_message_text(f"{TRANSLATIONS[lang]['ask_country']} {names.get(choice, choice)}")
    return await ask_city(query.message.chat_id, context)


async def get_typed_country(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return COUNTRY_TYPED
    # An unknown name isn't worth stopping for: the person can fix it in their profile.
    context.user_data['country'] = country_from_text(message.text)
    return await ask_city(message.chat_id, context)


async def get_city(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    lang = context.user_data.get('language', 'en')
    query = update.callback_query
    if query:
        await query.answer()
        choice = query.data.split('_', 1)[1]
        if choice == 'other':
            await query.edit_message_text(TRANSLATIONS[lang]['type_city'])
            return CITY
        city = ETHIOPIAN_CITIES[int(choice)][0]
        await query.edit_message_text(f"{TRANSLATIONS[lang]['ask_city']} {city}")
        chat_id = query.message.chat_id
    else:
        message = update.effective_message
        if not message or not message.text:
            return CITY
        city = re.sub(r'\s+', ' ', message.text).strip()[:80]
        chat_id = message.chat_id
    context.user_data['city'] = city
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_job_title'])
    return JOB_TITLE


async def check_email_exists(email: str) -> dict:
    try:
        url = f"{CONFIG['wp_api_url']}/../check-user?email={email}"
        async with bot_context.session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=10)
        ) as response:
            if response.status == 200:
                return await response.json()
            logger.warning(f"Email check returned HTTP status {response.status} from {url}")
            return None
    except Exception as e:
        logger.error(f"Error checking email availability for {email}: {e}")
        return None

async def get_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        if update.callback_query:
            await update.callback_query.answer()
        return EMAIL

    email = message.text.strip().lower()
    lang = context.user_data.get('language', 'en')

    if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['invalid_email']
        )
        return EMAIL

    result = await check_email_exists(email)
    
    if result is not None:
        is_registered = result.get('email_registered', False)
        can_proceed = result.get('can_reregister', False)

        if is_registered and not can_proceed:
            await bot_context.rate_limiter.send_message(
                message.chat_id,
                TRANSLATIONS[lang]['email_exists']
            )
            return EMAIL
    else:
        logger.warning(f"Could not verify email {email} availability upfront; proceeding with registration.")

    context.user_data['email'] = email

    # The Telegram username comes from Telegram itself when registering, so there's nothing to ask.
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['enter_password'])
    return PASSWORD

async def get_tg_username(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Only for conversations saved before the username question was dropped."""
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
    lang = user_data.get('language', 'en')
    # The password shouldn't stay readable in the chat. Bots may delete messages in private chats.
    try:
        await message.delete()
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['password_hidden'])
    except Exception as e:
        logger.info(f"Could not delete a password message: {e}")
    if not password_ok(message.text):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['password_too_short'])
        return PASSWORD
    user_data['password'] = message.text
    role_input = user_data.get('role_input', '')

    if role_input == 'employer':
        return await submit_registration(update, context)
    
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
    
    MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB limit
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

    if document:
        if document.file_size and document.file_size > MAX_FILE_BYTES:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        raw_name = document.file_name or "trade_license.pdf"
        original_ext = raw_name.lower().split('.')[-1] if '.' in raw_name else 'pdf'
        if original_ext not in ALLOWED_EXTENSIONS:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        file_name = f"TG_{telegram_id}_{timestamp}.{original_ext}"
        file_obj = await document.get_file()
    elif photo:
        best_photo = photo[-1]
        if best_photo.file_size and best_photo.file_size > MAX_FILE_BYTES:
            await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['invalid_file_type'])
            return TRADE_LICENSE
        file_name = f"TG_{telegram_id}_{timestamp}.jpg"
        file_obj = await best_photo.get_file()
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
    payload = registration_payload(user_data, update.effective_user)
    next_state = ConversationHandler.END
    registered = False

    try:
        req_kwargs = {'json': payload}

        async with bot_context.session.post(CONFIG['wp_api_url'], **req_kwargs, timeout=60) as response:
            if response.status == 201 or response.status == 200:
                data = await response.json()
                registered = True
                context.user_data['role'] = normalize_role(data.get('role'))
                context.user_data['language'] = data.get('language') or lang
                status = data.get('status', 'approved')
                role = normalize_role(user_data.get('role_input', ''))
                # Employers confirm their email before posting jobs; job seekers don't have to.
                if role == 'Employer' and not data.get('email_confirmed') and chat_id:
                    next_state = EMAIL_CODE
                
                msg = TRANSLATIONS[lang]['registration_success']
                if status == 'pending':
                    msg += TRANSLATIONS[lang]['pending_approval']

                details = (
                    TRANSLATIONS[lang]['registration_details'].format(name=user_data.get('name'), email=user_data.get('email'), role=role)
                    if user_data.get('email') else
                    TRANSLATIONS[lang]['registration_details_no_email'].format(name=user_data.get('name'), role=role)
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
                    mini_app_job_url = f"{MINI_APP}/jobs/{clean_slug}"
                    
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

    if next_state == EMAIL_CODE:
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['confirm_now'])
        return await send_email_code(chat_id, context, str(update.effective_user.id))
    if chat_id and registered:
        await challenge.after_registration(chat_id, update.effective_user.id, context)
    return ConversationHandler.END

async def restart_from_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    return await start(update, context)
