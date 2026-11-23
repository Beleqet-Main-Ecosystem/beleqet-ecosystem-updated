"""Admin tools: broadcasts and payment decisions."""
import aiohttp
import telegram
from html import escape
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes, ConversationHandler

from config import BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM, BROADCAST_MESSAGE, CONFIG, logger
from common import bot_context, get_keyboard

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
            base_url = CONFIG['wp_api_url'].removesuffix('/register')
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
    """Approve or Reject on a bank-transfer alert: the API approves it and starts the plan, or rejects
    it, as the admin site does. Only the bot's admins (ADMIN_IDS) can."""
    query = update.callback_query
    admin = update.effective_user
    if admin.id not in CONFIG['admin_ids']:
        await query.answer("Only the bot's admins can approve or reject payments.", show_alert=True)
        return
    await query.answer()

    action, order_id = query.data.rsplit('_', 1)
    approve = action == 'approve_payment'
    payload = {
        'order_id': order_id,
        'status': 'completed' if approve else 'cancelled',
        'admin_telegram_id': str(admin.id),
    }

    keep_buttons = False
    try:
        async with bot_context.session.post(
            f"{CONFIG['wp_api_url']}/../update-payment-status",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=15)
        ) as response:
            if response.status == 200:
                outcome = (f"✅ Approved by {admin.first_name}. The plan has started." if approve
                           else f"❌ Rejected by {admin.first_name}.")
            elif response.status in (404, 409):
                # Already decided (by another admin, or on the admin site), or gone.
                outcome = f"ℹ️ {await api_message(response) or 'Nothing to decide here any more.'}"
            else:
                logger.error(f"Payment decision failed: HTTP {response.status} - {await response.text()}")
                outcome = f"⚠️ Not saved (HTTP {response.status}). Try again, or use the admin site."
                keep_buttons = True
    except Exception as e:
        logger.error(f"Error updating payment status: {e}", exc_info=True)
        outcome = "⚠️ Couldn't reach the website. Try again, or use the admin site."
        keep_buttons = True
    await show_payment_outcome(query, outcome, keep_buttons)


async def api_message(response) -> str:
    """The message in an API error answer, or ''."""
    try:
        message = (await response.json()).get('message')
    except Exception:
        return ''
    return message if isinstance(message, str) else ''


async def show_payment_outcome(query, outcome: str, keep_buttons: bool) -> None:
    """Adds the outcome under the alert; the buttons go once it's decided."""
    message = query.message
    markup = message.reply_markup if keep_buttons else None
    try:
        if message.caption is not None:
            await query.edit_message_caption(
                caption=f"{message.caption_html}\n\n<b>{escape(outcome)}</b>", parse_mode='HTML', reply_markup=markup)
        else:
            await query.edit_message_text(
                text=f"{message.text_html}\n\n<b>{escape(outcome)}</b>", parse_mode='HTML', reply_markup=markup)
    except telegram.error.BadRequest as e:
        logger.warning(f"Couldn't show the payment decision: {e}")
