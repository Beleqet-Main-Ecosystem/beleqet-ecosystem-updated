"""The web server's handlers: health check, errors, and the website's webhook."""
import hmac
import os
import telegram
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
