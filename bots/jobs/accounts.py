"""Confirming an employer's email with a code, and linking an existing account to Telegram."""
import aiohttp
import re
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes, ConversationHandler

from config import CONFIG, EMAIL_CODE, EMAIL_PATTERN, LINK_CODE, LINK_EMAIL, NEW_EMAIL, logger
from texts import TRANSLATIONS
from common import MENU_URLS, bot_context, get_keyboard, menu_key_for, normalize_role, six_digit_code
from menu import handle_menu_selection

# --- EMAIL CONFIRMATION (employers, before posting jobs) ---

async def bot_api(path: str, payload: dict):
    """POST to one of the API's bot endpoints; (HTTP status, JSON body or {})."""
    try:
        async with bot_context.session.post(
            f"{CONFIG['wp_api_url']}/../{path}",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            try:
                data = await response.json()
            except Exception:
                data = {}
            return response.status, data if isinstance(data, dict) else {}
    except Exception as e:
        logger.error(f"Bot API call {path} failed: {e}")
        return 0, {}


def api_message(data: dict, fallback: str = 'please try again in a moment') -> str:
    message = data.get('message') if isinstance(data, dict) else None
    if isinstance(message, list):
        message = '; '.join(str(m) for m in message)
    return message or fallback


def code_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t['code_resend'], callback_data='code_resend'),
         InlineKeyboardButton(t['code_change_email'], callback_data='code_change')],
        [InlineKeyboardButton(t['code_later'], callback_data='code_later')],
    ])


def post_job_markup(lang: str) -> InlineKeyboardMarkup:
    label = TRANSLATIONS[lang]['menu']['post_job']
    return InlineKeyboardMarkup([[InlineKeyboardButton(label, web_app=WebAppInfo(url=MENU_URLS['employer']['post_job']))]])


async def send_email_code(chat_id: int, context: ContextTypes.DEFAULT_TYPE, telegram_id: str, email: str = None) -> int:
    """Asks the API to email a code (to `email` when given, after setting it). The next state."""
    lang = context.user_data.get('language') or 'en'
    payload = {'telegram_id': telegram_id}
    if email:
        payload['email'] = email
    status, data = await bot_api('email-code', payload)
    if status == 200 and data.get('already_confirmed'):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['code_confirmed'], reply_markup=post_job_markup(lang))
        return ConversationHandler.END
    if status == 200 and data.get('sent'):
        await bot_context.rate_limiter.send_message(
            chat_id,
            TRANSLATIONS[lang]['code_sent'].format(email=data.get('email') or email or ''),
            reply_markup=code_keyboard(lang),
        )
        return EMAIL_CODE
    await bot_context.rate_limiter.send_message(
        chat_id, TRANSLATIONS[lang]['code_failed'].format(error=api_message(data))
    )
    # A bad or taken address: ask for another. Too many codes, or no answer: try again later.
    if status in (400, 409):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_new_email'])
        return NEW_EMAIL
    return ConversationHandler.END


async def leave_for_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """A menu button pressed mid-confirmation ends it and does what the button says."""
    text = update.effective_message.text if update.effective_message else None
    if text and menu_key_for(text):
        await handle_menu_selection(update, context)
        return True
    return False


async def handle_email_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return EMAIL_CODE
    if await leave_for_menu(update, context):
        return ConversationHandler.END
    lang = context.user_data.get('language') or 'en'
    code = six_digit_code(message.text)
    if not code:
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['code_format'])
        return EMAIL_CODE
    status, data = await bot_api('confirm-email', {'telegram_id': str(update.effective_user.id), 'code': code})
    if status == 200 and data.get('confirmed'):
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['code_confirmed'] + "\n\n" + TRANSLATIONS[lang]['job_review_note'],
            reply_markup=post_job_markup(lang),
        )
        return ConversationHandler.END
    await bot_context.rate_limiter.send_message(
        message.chat_id,
        TRANSLATIONS[lang]['code_failed'].format(error=api_message(data)),
        reply_markup=code_keyboard(lang),
    )
    return EMAIL_CODE


async def handle_new_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return NEW_EMAIL
    if await leave_for_menu(update, context):
        return ConversationHandler.END
    lang = context.user_data.get('language') or 'en'
    email = message.text.strip().lower()
    if not re.match(EMAIL_PATTERN, email):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['invalid_email'])
        return NEW_EMAIL
    return await send_email_code(message.chat_id, context, str(update.effective_user.id), email)


async def code_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Send / Send a new code, Change email, Later."""
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language') or 'en'
    chat_id = query.message.chat_id
    if query.data == 'code_later':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['code_later_text'])
        return ConversationHandler.END
    if query.data == 'code_change':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['enter_new_email'])
        return NEW_EMAIL
    return await send_email_code(chat_id, context, str(query.from_user.id))


# --- "I ALREADY HAVE AN ACCOUNT": link this Telegram to it with a code sent to its email ---

def link_keyboard(lang: str) -> InlineKeyboardMarkup:
    t = TRANSLATIONS[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t['code_resend'], callback_data='link_resend'),
         InlineKeyboardButton(t['link_other_email'], callback_data='link_change')],
        [InlineKeyboardButton(t['link_cancel'], callback_data='link_cancel')],
    ])


async def send_link_code(chat_id: int, context: ContextTypes.DEFAULT_TYPE, telegram_id: str) -> int:
    lang = context.user_data.get('language') or 'en'
    email = context.user_data.get('link_email')
    status, data = await bot_api('link-account', {'telegram_id': telegram_id, 'email': email})
    if status == 200 and data.get('sent'):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_code_sent'].format(email=data.get('email') or email), reply_markup=link_keyboard(lang))
        return LINK_CODE
    await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_failed'].format(error=api_message(data)))
    # No such account, or not an email: ask again. Too many codes, or no answer: stop here.
    if status in (400, 403, 404):
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL
    return ConversationHandler.END


async def get_link_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return LINK_EMAIL
    lang = context.user_data.get('language') or 'en'
    email = message.text.strip().lower()
    if not re.match(EMAIL_PATTERN, email):
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['invalid_email'])
        return LINK_EMAIL
    context.user_data['link_email'] = email
    return await send_link_code(message.chat_id, context, str(update.effective_user.id))


async def get_link_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    message = update.effective_message
    if not message or not message.text:
        return LINK_CODE
    lang = context.user_data.get('language') or 'en'
    code = six_digit_code(message.text)
    if not code:
        await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['code_format'])
        return LINK_CODE
    user = update.effective_user
    status, data = await bot_api('link-account/confirm', {
        'telegram_id': str(user.id),
        'email': context.user_data.get('link_email'),
        'code': code,
        'tg_username': getattr(user, 'username', None) or '',
    })
    if status == 200 and data.get('linked'):
        lang = data.get('language') or lang
        role = normalize_role(data.get('role'))
        context.user_data.update({'language': lang, 'role': role})
        context.user_data.pop('link_email', None)
        await bot_context.rate_limiter.send_message(
            message.chat_id,
            TRANSLATIONS[lang]['link_done'].format(name=data.get('first_name') or ''),
            reply_markup=get_keyboard(role, lang, user.id in CONFIG['admin_ids']),
        )
        return ConversationHandler.END
    await bot_context.rate_limiter.send_message(message.chat_id, TRANSLATIONS[lang]['link_failed'].format(error=api_message(data)), reply_markup=link_keyboard(lang))
    return LINK_CODE


async def link_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get('language') or 'en'
    chat_id = query.message.chat_id
    if query.data == 'link_cancel':
        context.user_data.pop('link_email', None)
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_cancelled'])
        return ConversationHandler.END
    if query.data == 'link_change':
        await bot_context.rate_limiter.send_message(chat_id, TRANSLATIONS[lang]['link_enter_email'])
        return LINK_EMAIL
    return await send_link_code(chat_id, context, str(query.from_user.id))
