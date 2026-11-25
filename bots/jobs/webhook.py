"""The web server's handlers: health check, errors, and the website's webhook."""
import aiohttp
import hmac
import os
import telegram
from html import escape
from aiohttp import web
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from config import CONFIG, logger
from texts import TRANSLATIONS
from common import bot_context, get_keyboard, normalize_role

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

RECEIPT_MAX_BYTES = 10 * 1024 * 1024


def _payment_lines(data: dict) -> list:
    """Who paid, for what, how much and the bank reference. Everything came from the payer or their
    bank, so it's escaped."""
    def field(key):
        return escape(str(data.get(key) or '').strip())

    lines = []
    if field('payer'):
        lines.append(f"<b>Payer:</b> {field('payer')}")
    if field('plan'):
        lines.append(f"<b>Plan:</b> {field('plan')}")
    lines += [
        f"<b>Amount:</b> {field('amount')} {field('currency')}",
        f"<b>Bank reference:</b> <code>{field('reference')}</code>",
    ]
    return lines


def payment_alert_text(data: dict) -> str:
    """The admins' alert for a bank-transfer receipt, with what the automatic CBE check found, if it ran."""
    lines = ["🚨 <b>Bank transfer to check</b>", "", *_payment_lines(data)]
    lines.append(f"<b>Payment:</b> <code>{escape(str(data.get('order_id') or ''))}</code>")
    if data.get('cbe_check'):
        lines.append(f"🔎 <b>CBE check:</b> {escape(str(data['cbe_check']))}")
    lines += [
        "",
        "Check that this amount reached our account with this reference before you approve. "
        "Approving starts the plan.",
    ]
    return "\n".join(lines)


def auto_approved_text(data: dict) -> str:
    """The admins' notice for a transfer that matched its receipt on CBE's site: its plan has started."""
    lines = ["✅ <b>Bank transfer approved automatically</b>", "", *_payment_lines(data)]
    if data.get('bank_payer'):
        lines.append(f"<b>Sent by (CBE):</b> {escape(str(data['bank_payer']))}")
    if data.get('paid_at'):
        lines.append(f"<b>Sent at:</b> {escape(str(data['paid_at']))}")
    lines += [
        "",
        "CBE's receipt shows this amount reached our account, and the reference hadn't paid for "
        "anything before, so the plan has started. Nothing to do.",
    ]
    return "\n".join(lines)


async def download_receipt(url):
    """The receipt's bytes and file name, or None. Uploaded to Telegram rather than linked: Telegram
    doesn't take PDFs or WebP images from a link as a photo."""
    if not isinstance(url, str) or not url.startswith(('http://', 'https://')):
        return None
    try:
        # A session of its own: the shared one sends the API token with every request.
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as response:
                if response.status != 200:
                    logger.warning(f"Receipt download failed: HTTP {response.status}")
                    return None
                content = await response.content.read(RECEIPT_MAX_BYTES + 1)
    except Exception as e:
        logger.warning(f"Receipt download failed: {e}")
        return None
    if not content or len(content) > RECEIPT_MAX_BYTES:
        return None
    return content, url.split('?')[0].rsplit('/', 1)[-1] or 'receipt'


async def send_payment_alert(chat_id, text, keyboard, receipt):
    """Sends the alert with the receipt as a photo or a file, or as text alone when it can't be attached."""
    if receipt:
        content, name = receipt
        senders = [] if name.lower().endswith('.pdf') else [('photo', bot_context.rate_limiter.send_photo)]
        senders.append(('document', bot_context.rate_limiter.send_document))
        for kind, send in senders:
            try:
                await send(chat_id, content, filename=name, caption=text, reply_markup=keyboard, parse_mode='HTML')
                return
            except telegram.error.Forbidden:
                raise
            except Exception as e:
                logger.warning(f"Couldn't send the receipt to admin {chat_id} as a {kind}: {e}")
    await bot_context.rate_limiter.send_message(
        chat_id,
        f"{text}\n\n<i>The receipt couldn't be attached. See it in the admin site, under Payments.</i>",
        reply_markup=keyboard,
        parse_mode='HTML',
    )


async def webhook_handler(request: web.Request) -> web.Response:
    # 1. Security Check: Validate Secret Token
    expected_token = os.getenv("WEBHOOK_SECRET_TOKEN")
    provided_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    if not expected_token or not provided_token or not hmac.compare_digest(provided_token, expected_token):
        logger.warning(f"Unauthorized webhook access attempt from {request.remote}")
        return web.Response(text="Forbidden", status=403)
    
    logger.info(f"Incoming authorized webhook request to path: {request.path}")
    try:
        data = await request.json()
        action = data.get('action')

        if action == 'manual_payment_uploaded':
            order_id = str(data.get('order_id') or '')
            if not order_id:
                return web.Response(text="Missing order_id", status=400)
            text = payment_alert_text(data)
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Approve", callback_data=f"approve_payment_{order_id}"),
                    InlineKeyboardButton("❌ Reject", callback_data=f"reject_payment_{order_id}")
                ]
            ])
            receipt = await download_receipt(data.get('receipt_url'))
            for admin_id in CONFIG['admin_ids']:
                try:
                    await send_payment_alert(admin_id, text, keyboard, receipt)
                except Exception as e:
                    logger.error(f"Failed to send manual payment notification to admin {admin_id}: {e}")
            return web.Response(text="OK", status=200)

        if action == 'manual_payment_auto_approved':
            text = auto_approved_text(data)
            for admin_id in CONFIG['admin_ids']:
                try:
                    await bot_context.rate_limiter.send_message(admin_id, text, parse_mode='HTML')
                except Exception as e:
                    logger.error(f"Failed to tell admin {admin_id} about an automatic approval: {e}")
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
