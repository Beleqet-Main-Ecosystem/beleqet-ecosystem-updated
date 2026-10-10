# -*- coding: utf-8 -*-
import os
import aiosqlite
import asyncio
from telegram.error import TelegramError
import json
import random
import logging
from uuid import uuid4
import pytz
from dotenv import load_dotenv
from telegram import InlineQueryResultArticle, InputTextMessageContent, WebAppInfo
from datetime import datetime, time, date
from telegram import (
    Update,
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton
)
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    InlineQueryHandler,
    PicklePersistence,
    filters,
)
from telegram_bot_calendar import DetailedTelegramCalendar
from telegram import ChatMemberUpdated
from telegram.ext import ChatMemberHandler

# --- ⚙️ CONFIGURATION ---
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
TARGET_CHATS = [
    -1001669125004, 
    -1001199095627, 
    -1002877767689, 
    -1001989588782
]
CHANNEL_ID = int(os.getenv("CHANNEL_ID", "-1001199095627"))
PRIMARY_ADMIN_ID = int(os.getenv("ADMIN_ID", "6359221369"))
DB_FILE = "referrals.db"
WELCOME_PHOTO_FILE_ID = os.getenv("WELCOME_PHOTO_FILE_ID")
CHANNEL_INVITE_LINK = os.getenv("CHANNEL_INVITE_LINK", "https://t.me/BeleqetJobs")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://beleqetjobs-miniapp.beleqet.com/")

# --- 🗄️ ASYNC DATABASE SETUP ---
async def setup_database():
    """Initializes the database schema asynchronously."""
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, username TEXT)")
        await db.execute("CREATE TABLE IF NOT EXISTS pending_referrals (new_user_id INTEGER PRIMARY KEY, referrer_id INTEGER NOT NULL)")
        await db.execute("CREATE TABLE IF NOT EXISTS successful_referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER NOT NULL, referred_user_id INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, UNIQUE(referrer_id, referred_user_id))")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                phone_number TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                request_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_timestamp DATETIME
            )
        """)
        await db.execute("CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY)")
        await db.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (PRIMARY_ADMIN_ID,))
        await db.execute("CREATE INDEX IF NOT EXISTS idx_referrer_id ON successful_referrals (referrer_id)")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                job_id TEXT PRIMARY KEY,
                post_text TEXT,
                scheduled_time TEXT,
                repeat INTEGER
            )
        """)

        try:
            await db.execute("ALTER TABLE scheduled_posts ADD COLUMN post_photo TEXT")
            await db.execute("ALTER TABLE scheduled_posts ADD COLUMN post_button_text TEXT")
            await db.execute("ALTER TABLE scheduled_posts ADD COLUMN post_button_url TEXT")
        except aiosqlite.OperationalError:
            pass

        await db.commit()
    logging.info("Database setup complete.")

async def migrate_pending_data():
    """Migrates any legacy pending referrals to successful referrals on startup."""
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            async with db.execute("SELECT new_user_id, referrer_id FROM pending_referrals") as cursor:
                pending = await cursor.fetchall()
            
            if not pending:
                return

            logging.info(f"🔄 Found {len(pending)} pending referrals. Starting migration...")
            migrated_count = 0
            
            for new_user_id, referrer_id in pending:
                async with db.execute("SELECT id FROM successful_referrals WHERE referrer_id = ? AND referred_user_id = ?", (referrer_id, new_user_id)) as check:
                    if await check.fetchone():
                        continue
                
                await db.execute("INSERT INTO successful_referrals (referrer_id, referred_user_id) VALUES (?, ?)", (referrer_id, new_user_id))
                await db.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,))
                migrated_count += 1
            
            await db.execute("DELETE FROM pending_referrals")
            await db.commit()
            
    except Exception as e:
        logging.error(f"❌ Error during pending referral migration: {e}")

async def post_init(application: Application):
    """Runs async setup after the application is initialized."""
    await setup_database()
    await migrate_pending_data()

    try:
        from telegram import MenuButtonWebApp
        await application.bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Launch Beleqet",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        )
        logging.info(f">>> Telegram Chat Menu Button set to {WEBAPP_URL} <<<")
    except Exception as e:
        logging.warning(f"Could not set chat menu button: {e}")
    
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            async with db.execute("SELECT job_id, post_text, scheduled_time, repeat, post_photo, post_button_text, post_button_url FROM scheduled_posts") as cursor:
                posts = await cursor.fetchall()
                
        eat_tz = pytz.timezone("Africa/Addis_Ababa")
        now_utc = datetime.now(pytz.utc)
        
        for job_id, post_text, scheduled_time_str, repeat_times, post_photo, btn_text, btn_url in posts:
            scheduled_time_eat = eat_tz.localize(datetime.strptime(scheduled_time_str, '%Y-%m-%d at %H:%M'))
            scheduled_time_utc = scheduled_time_eat.astimezone(pytz.utc)
            
            job_data = {
                'post_text': post_text, 
                'post_photo': post_photo, 
                'post_button_text': btn_text,
                'post_button_url': btn_url 
            }
            
            if scheduled_time_utc > now_utc:
                if repeat_times == 1:
                    application.job_queue.run_once(send_scheduled_post, when=scheduled_time_utc, data=job_data, name=job_id)
                else:
                    interval_seconds = 24 * 3600 / repeat_times
                    application.job_queue.run_repeating(send_scheduled_post, interval=interval_seconds, first=scheduled_time_utc, data=job_data, name=job_id)
            else:
                async with aiosqlite.connect(DB_FILE) as db:
                    await db.execute("DELETE FROM scheduled_posts WHERE job_id = ?", (job_id,))
                    await db.commit()
        
    except Exception as e:
        logging.error(f"❌ Failed to reload scheduled posts: {e}")

async def is_admin(user_id: int) -> bool:
    """Checks if a user ID is in the admins table asynchronously."""
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT user_id FROM admins WHERE user_id = ?", (user_id,)) as cursor:
            return await cursor.fetchone() is not None

# --- ⌨️ KEYBOARD DEFINITIONS ---
# For regular users - LAUNCHES WEB APP
main_menu_keyboard = [
    [KeyboardButton("📱 Open Dashboard", web_app=WebAppInfo(url=WEBAPP_URL))]
]
main_menu_markup = ReplyKeyboardMarkup(main_menu_keyboard, resize_keyboard=True)

# For admins
admin_menu_keyboard = [
    [KeyboardButton("📱 Mini App ይክፈቱ", web_app=WebAppInfo(url=WEBAPP_URL))],
    [KeyboardButton("📣 Broadcast Message"), KeyboardButton("📢 Post to Channel")],
    [KeyboardButton("👑 Manage Admins"), KeyboardButton("📊 User Stats")],
    [KeyboardButton("🗓️ Scheduled Posts")]
]
admin_menu_markup = ReplyKeyboardMarkup(admin_menu_keyboard, resize_keyboard=True)

# --- 🧠 CONVERSATION STATES ---
POST_TEXT, POST_PHOTO, POST_BUTTON_TEXT, POST_BUTTON_URL, ASK_SCHEDULE_DATE, ASK_REPEATING_TIMES, POST_CONFIRM = range(2, 9)
ADMIN_MENU, ADD_ADMIN_ID, REMOVE_ADMIN_ID = range(9, 12)
BROADCAST_MESSAGE, BROADCAST_BUTTON_TEXT, BROADCAST_BUTTON_URL, BROADCAST_CONFIRM = range(12, 16)


# --- 🤖 BOT HANDLERS ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            await db.execute("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", (user.id, user.username))
            await db.execute("UPDATE users SET username = ? WHERE user_id = ?", (user.username, user.id))
            await db.commit()
    except aiosqlite.Error as e:
        logging.error(f"Database error in start: {e}")

    menu_markup = admin_menu_markup if await is_admin(user.id) else main_menu_markup

    amharic_welcome_text = """🎓 እውቀትን ያጋሩ – በገንዘብ እና በነፃ ስልጠና ይሸለሙ! 💰
አንድ ድንጋይ ሁለት ወፍ! ወጣቶች ክህሎት አዳብረው ራሳቸውን እንዲቀይሩ እየረዱ፣ እርስዎ ለሚያደርጉት ጥረት ተገቢውን ክፍያ እና የነፃ ስልጠና ያግኙ!
በአሁኑ ወቅት በቴሌግራም ላይ ብዙ አሳሳች መልዕክቶች እንዳሉ እናውቃለን። Beleqet Academy ግን ለውጤታማነቱ እና ለግልጽነቱ ዋስትና የሚሰጥ፣ 100% እውነተኛ የገቢ እና የትምህርት ዕድል ይዞላችሁ ቀርቧል።

🚀 እንዴት ይሰራል?
1️⃣ ዳሽቦርዱን ይክፈቱ፦ ከታች ያለውን "📱 Open Dashboard" የሚለውን ቁልፍ ሲጫኑ የሚኒ አፕ ገጽዎ ይከፈታል። 
2️⃣ ሊንክዎን ይውሰዱ፦ በDashboard ላይ "Copy Invite Link" የሚለውን በመጫን የእርስዎን ልዩ መለያ ይውሰዱ። 
3️⃣ ገቢዎን ይሰብስቡ፦ ሰዎች በእርስዎ ሊንክ በገቡ ቁጥር በDashboard ላይ ገንዘብዎ ሲጨምር ያያሉ።

የገቢዎን ማስያዣ ይጠብቁ፦ ከተጠቃሚዎች ገቢ ሲጨምር ዳሽቦርዱን ይክፈቱ እና "Withdraw" የሚለውን ቁልፍ በመጫን ገንዘብዎን ወደ እርስዎ መለያ ይጠቀሙ።
"""

    if context.args:
        try:
            referrer_id = int(context.args[0])
            if referrer_id != user.id:
                async with aiosqlite.connect(DB_FILE) as db:
                    async with db.execute("INSERT OR IGNORE INTO successful_referrals (referrer_id, referred_user_id) VALUES (?, ?)", (referrer_id, user.id)) as cursor:
                        if cursor.rowcount > 0:
                            await db.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,))
                            await db.commit()
                        
                            try:
                                await context.bot.send_message(
                                    chat_id=referrer_id, 
                                    text=f"🎉 Congratulations! A new user ({user.first_name}) joined using your link. You have earned 1 point!"
                                )
                            except Exception as e:
                                logging.warning(f"Could not send notification: {e}")

        except (ValueError, IndexError, aiosqlite.Error):
            pass

    join_button_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("Join Our Channel 📢", url=CHANNEL_INVITE_LINK)],
        [InlineKeyboardButton("Mini App ይክፈቱ 📱", web_app=WebAppInfo(url=WEBAPP_URL))]
    ])

    await update.message.reply_photo(
        photo=WELCOME_PHOTO_FILE_ID, 
        caption=amharic_welcome_text, 
        reply_markup=join_button_markup
    )

    await update.message.reply_text(
        "👇 Use the menu button below to open your Mini App Dashboard:",
        reply_markup=menu_markup
    )

async def main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reply_markup = admin_menu_markup if await is_admin(update.effective_user.id) else main_menu_markup
    await update.message.reply_text("You are at the main menu. Click below to open your dashboard.", reply_markup=reply_markup)

async def track_chats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    result = update.chat_member
    if not result or update.effective_chat.id != CHANNEL_ID:
        return

    user_id = result.from_user.id
    new_status = result.new_chat_member.status
    left_statuses = ['left', 'kicked', 'deleted']
    joined_statuses = ['member', 'administrator', 'creator']

    async with aiosqlite.connect(DB_FILE) as db:
        # Find the referrer
        async with db.execute("SELECT referrer_id, is_active FROM successful_referrals WHERE referred_user_id = ?", (user_id,)) as cursor:
            referral_data = await cursor.fetchone()
            
        if not referral_data:
            return 

        referrer_id, currently_active = referral_data

        if new_status in left_statuses and currently_active == 1:
            # User left! Mark inactive and DEDUCT the point
            await db.execute("UPDATE successful_referrals SET is_active = 0 WHERE referred_user_id = ?", (user_id,))
            await db.execute("UPDATE users SET score = score - 1 WHERE user_id = ?", (referrer_id,)) 
            
        elif new_status in joined_statuses and currently_active == 0:
            # User rejoined! Mark active and RESTORE the point
            await db.execute("UPDATE successful_referrals SET is_active = 1 WHERE referred_user_id = ?", (user_id,))
            await db.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,)) 
            
        await db.commit()

# --- 📢 ADMIN & VERIFICATION HANDLERS ---
async def handle_admin_decision(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    action, withdrawal_id, user_id, amount = query.data.split(':')
    user_id, amount = int(user_id), int(amount)
    original_message = query.message.text

    try:
        async with aiosqlite.connect(DB_FILE) as db:
            # 1. Check if the withdrawal has already been processed (prevents double-clicking)
            async with db.execute("SELECT status FROM withdrawals WHERE id = ?", (withdrawal_id,)) as cursor:
                withdrawal = await cursor.fetchone()
                if not withdrawal or withdrawal[0] != 'pending':
                    await query.edit_message_text(text=f"{original_message}\n\n--- ⚠️ Status: ALREADY PROCESSED ---")
                    return

            if action == "approve":
                # Note: We DO NOT deduct points here anymore, because api.py already locked and deducted them.
                # We just mark the withdrawal as successfully paid.
                await db.execute("UPDATE withdrawals SET status = 'paid', processed_timestamp = ? WHERE id = ?", (datetime.now(), withdrawal_id))
                await db.commit()
                
                await query.edit_message_text(text=f"{original_message}\n\n--- ✅ Status: PAID ---", parse_mode='Markdown')

                user_notification = (f"🎉 Your withdrawal request for **{amount} Birr** has been approved and sent!\n\nየጠየቁት የ {amount} ብር ወጪ ተፈቅዷል እና ተልኳል!")
                await context.bot.send_message(chat_id=user_id, text=user_notification, parse_mode='Markdown')

            elif action == "reject":
                # REFUND THE POINTS! Since api.py took them when they requested, we must give them back upon rejection.
                await db.execute("UPDATE users SET score = score + ? WHERE user_id = ?", (amount, user_id))
                
                await db.execute("UPDATE withdrawals SET status = 'rejected', processed_timestamp = ? WHERE id = ?", (datetime.now(), withdrawal_id))
                await db.commit()
                
                await query.edit_message_text(text=f"{original_message}\n\n--- ❌ Status: REJECTED (Points Refunded) ---", parse_mode='Markdown')
                
                rejection_reason = (f"⚠️ **Withdrawal Rejected**\n\nYour request for {amount} Birr was not approved, and your {amount} points have been refunded to your account. \n\nየጠየቁት የ {amount} ብር ወጪ አልተፈቀደም፡ ሆኖም {amount} ነጥብዎ ወደ ሂሳብዎ ተመልሷል።")
                await context.bot.send_message(chat_id=user_id, text=rejection_reason, parse_mode='Markdown')

    except aiosqlite.Error as e:
        # Silently log to primary admin if database locks or fails
        await context.bot.send_message(chat_id=PRIMARY_ADMIN_ID, text=f"Database error processing request #{withdrawal_id}: {e}")

# --- 📣 BROADCAST HANDLERS ---
async def broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await is_admin(update.effective_user.id):
        return ConversationHandler.END
        
    await update.message.reply_text(
        "📣 **Broadcast Mode**\nSend the message you want to broadcast.\nOr send /cancel to stop.",
        reply_markup=ReplyKeyboardMarkup([[KeyboardButton("/cancel")]], resize_keyboard=True)
    )
    return BROADCAST_MESSAGE

async def broadcast_get_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_msg_id'] = update.message.message_id
    await update.message.reply_text("Add a **Button Text** (e.g., 'Join Now') or press /skip.", reply_markup=ReplyKeyboardMarkup([["/skip"]], resize_keyboard=True))
    return BROADCAST_BUTTON_TEXT

async def broadcast_get_button_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = update.message.text
    await update.message.reply_text("Great. Now send the **URL** for the button:")
    return BROADCAST_BUTTON_URL

async def broadcast_skip_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_text'] = None
    context.user_data['broadcast_btn_url'] = None
    keyboard = [[InlineKeyboardButton("Confirm Broadcast ✅", callback_data="broadcast_confirm"), InlineKeyboardButton("Cancel ❌", callback_data="broadcast_cancel")]]
    await update.message.reply_text("No button added. Confirm broadcast?", reply_markup=InlineKeyboardMarkup(keyboard))
    return BROADCAST_CONFIRM

async def broadcast_get_button_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['broadcast_btn_url'] = update.message.text
    keyboard = [[InlineKeyboardButton("Confirm Broadcast ✅", callback_data="broadcast_confirm"), InlineKeyboardButton("Cancel ❌", callback_data="broadcast_cancel")]]
    await update.message.reply_text("Button saved! Confirm broadcast?", reply_markup=InlineKeyboardMarkup(keyboard))
    return BROADCAST_CONFIRM


# 1. Define the background job
async def background_broadcast(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    users, admin_chat_id, msg_id, reply_markup = job.data
    success_count, fail_count = 0, 0
    
    for user in users:
        try:
            await context.bot.copy_message(chat_id=user[0], from_chat_id=admin_chat_id, message_id=msg_id, reply_markup=reply_markup)
            success_count += 1
        except TelegramError:
            fail_count += 1
        await asyncio.sleep(0.05) 

    await context.bot.send_message(chat_id=admin_chat_id, text=f"✅ **Broadcast Complete!**\nSuccess: `{success_count}`\nFailed: `{fail_count}`", parse_mode='Markdown')

async def broadcast_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    if query.data == "broadcast_confirm":
        await query.edit_message_text("🚀 Broadcast started in the background. You can continue using the bot!")
        msg_id = context.user_data.get('broadcast_msg_id')
        admin_chat_id = update.effective_chat.id
        
        btn_text = context.user_data.get('broadcast_btn_text')
        btn_url = context.user_data.get('broadcast_btn_url')
        reply_markup = InlineKeyboardMarkup([[InlineKeyboardButton(btn_text, url=btn_url)]]) if btn_text and btn_url else None

        async with aiosqlite.connect(DB_FILE) as db:
            async with db.execute("SELECT user_id FROM users") as cursor:
                users = await cursor.fetchall()
        
        # Offload to JobQueue!
        context.application.job_queue.run_once(
            background_broadcast, 
            when=1, 
            data=(users, admin_chat_id, msg_id, reply_markup)
        )
        return ConversationHandler.END


async def broadcast_cancel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Broadcast cancelled.", reply_markup=admin_menu_markup)
    return ConversationHandler.END

# --- 📢 ADMIN POSTING CONVERSATION HANDLERS ---
async def post_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await is_admin(update.effective_user.id): return ConversationHandler.END
    await update.message.reply_text("Send message text for new post.")
    return POST_TEXT

async def post_get_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['post_text'] = update.message.text
    await update.message.reply_text("Send a photo, or /skip.", reply_markup=ReplyKeyboardMarkup([["/skip"]], resize_keyboard=True))
    return POST_PHOTO

async def post_get_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['post_photo'] = (await update.message.photo[-1].get_file()).file_id
    await update.message.reply_text("Send button text.", reply_markup=admin_menu_markup)
    return POST_BUTTON_TEXT

async def post_skip_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['post_photo'] = None
    await update.message.reply_text("Send button text.", reply_markup=admin_menu_markup)
    return POST_BUTTON_TEXT

async def post_get_button_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["post_button_text"] = update.message.text
    await update.message.reply_text("Send button URL.")
    return POST_BUTTON_URL

async def post_get_button_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["post_button_url"] = update.message.text
    cal = DetailedTelegramCalendar(min_date=date.today(), start_stage='month')
    calendar_markup, step = cal.build()
    
    reply_markup = InlineKeyboardMarkup(json.loads(calendar_markup).get("inline_keyboard", [])) if isinstance(calendar_markup, str) else calendar_markup
    if reply_markup:
        btns = list(reply_markup.inline_keyboard)
        btns.append([InlineKeyboardButton("Post Now 🚀", callback_data="post_now")])
        reply_markup = InlineKeyboardMarkup(btns)
    
    await update.message.reply_text("📅 Select date:", reply_markup=reply_markup)
    return ASK_SCHEDULE_DATE

async def handle_calendar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    result, keyboard, step = DetailedTelegramCalendar(min_date=date.today()).process(query.data)

    if not result and keyboard:
        btns = list(InlineKeyboardMarkup(json.loads(keyboard).get("inline_keyboard", [])).inline_keyboard if isinstance(keyboard, str) else keyboard.inline_keyboard)
        btns.append([InlineKeyboardButton("Post Now 🚀", callback_data="post_now")])
        await query.edit_message_text("📅 Select date:", reply_markup=InlineKeyboardMarkup(btns))
        return ASK_SCHEDULE_DATE

    if result:
        eat_tz = pytz.timezone("Africa/Addis_Ababa")
        context.user_data["scheduled_time_eat"] = eat_tz.localize(datetime.combine(result, time(random.randint(8, 21), random.randint(0, 59))))
        context.user_data["schedule_now"] = False
        await query.edit_message_text(f"Selected Date: {result}\nRepeat in 24h? (1 for once):")
        return ASK_REPEATING_TIMES

async def post_now(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data['schedule_now'] = True
    await query.edit_message_text("Repeat in 24h? (1 for once):")
    return ASK_REPEATING_TIMES

async def post_get_repeating_times(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        context.user_data['schedule_times'] = int(update.message.text)
    except ValueError:
        await update.message.reply_text("Invalid number.")
        return ASK_REPEATING_TIMES

    keyboard = [[InlineKeyboardButton("Confirm & Schedule ✅", callback_data="post_confirm"), InlineKeyboardButton("Cancel ❌", callback_data="post_cancel")]]
    await update.message.reply_text("Preview confirmed. Confirm schedule?", reply_markup=InlineKeyboardMarkup(keyboard))
    return POST_CONFIRM

async def send_scheduled_post(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    keyboard = [[InlineKeyboardButton(job.data.get('post_button_text'), url=job.data.get('post_button_url'))]]
    for target in TARGET_CHATS:
        try:
            if job.data.get('post_photo'):
                await context.bot.send_photo(chat_id=target, photo=job.data.get('post_photo'), caption=job.data['post_text'], reply_markup=InlineKeyboardMarkup(keyboard))
            else:
                await context.bot.send_message(chat_id=target, text=job.data['post_text'], reply_markup=InlineKeyboardMarkup(keyboard))
        except Exception: pass
    
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT repeat FROM scheduled_posts WHERE job_id = ?", (job.name,)) as cursor:
            if (await cursor.fetchone() or [0])[0] == 1:
                await db.execute("DELETE FROM scheduled_posts WHERE job_id = ?", (job.name,))
                await db.commit()

async def post_decision_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "post_confirm":
        job_data = {
            'post_text': context.user_data.get('post_text'), 
            'post_photo': context.user_data.get('post_photo'), 
            'post_button_text': context.user_data.get('post_button_text'),
            'post_button_url': context.user_data.get('post_button_url') 
        }
        schedule_times = context.user_data.get('schedule_times')
        
        if context.user_data.get('schedule_now', False):
            context.application.job_queue.run_once(send_scheduled_post, when=1, data=job_data, name=f"post_{uuid4()}")
            await query.edit_message_text("🚀 Sending momentarily.")
        else:
            eat = context.user_data.get('scheduled_time_eat')
            job_id = f"post_{uuid4()}"
            async with aiosqlite.connect(DB_FILE) as db:
                await db.execute("INSERT INTO scheduled_posts (job_id, post_text, scheduled_time, repeat, post_photo, post_button_text, post_button_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (job_id, job_data['post_text'], eat.strftime('%Y-%m-%d at %H:%M'), schedule_times, job_data['post_photo'], job_data['post_button_text'], job_data['post_button_url']))
                await db.commit()
            context.application.job_queue.run_once(send_scheduled_post, when=eat.astimezone(pytz.utc), data=job_data, name=job_id)
            await query.edit_message_text("📅 Post scheduled.")
    return ConversationHandler.END

async def post_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelled.", reply_markup=admin_menu_markup)
    return ConversationHandler.END

# --- 👑 ADMIN MANAGEMENT CONVERSATION HANDLERS ---
async def manage_admins_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.effective_user.id != PRIMARY_ADMIN_ID: return ConversationHandler.END
    await update.message.reply_text("👑 Admin Menu", reply_markup=ReplyKeyboardMarkup([["➕ Add Admin", "➖ Remove Admin"], ["📋 List Admins", "⬅️ Back to Main Menu"]], resize_keyboard=True))
    return ADMIN_MENU

async def ask_for_add_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Send User ID to add:")
    return ADD_ADMIN_ID

async def add_admin_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            await db.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (int(update.message.text),))
            await db.commit()
        await update.message.reply_text("✅ Added.")
    except ValueError: pass
    await manage_admins_start(update, context)
    return ADMIN_MENU

async def ask_for_remove_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Send User ID to remove:")
    return REMOVE_ADMIN_ID

async def remove_admin_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            await db.execute("DELETE FROM admins WHERE user_id = ?", (int(update.message.text),))
            await db.commit()
        await update.message.reply_text("✅ Removed.")
    except ValueError: pass
    await manage_admins_start(update, context)
    return ADMIN_MENU

async def list_admins(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT user_id FROM admins") as cursor:
            admins = await cursor.fetchall()
    await update.message.reply_text("\n".join([f"- `{a[0]}`" for a in admins]), parse_mode='Markdown')
    return ADMIN_MENU

async def back_to_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Returning.", reply_markup=admin_menu_markup if await is_admin(update.effective_user.id) else main_menu_markup)
    return ConversationHandler.END

# --- 📊 USER STATS HANDLER ---
async def get_user_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await is_admin(update.effective_user.id): return
    
    async with aiosqlite.connect(DB_FILE) as db:
        # We use a LEFT JOIN to get the current 'score' (which has points deducted) 
        # alongside the COUNT of their all-time referrals.
        query = """
            SELECT u.username, u.user_id, u.score, COUNT(s.referred_user_id) 
            FROM users u 
            LEFT JOIN successful_referrals s ON u.user_id = s.referrer_id 
            GROUP BY u.user_id 
            ORDER BY u.score DESC
            LIMIT 100
        """
        async with db.execute(query) as cursor:
            stats = await cursor.fetchall()
    
    if not stats:
        await update.message.reply_text("No data.")
        return

    msg = "📊 **User Stats & Balances**\n\n"
    for uname, uid, score, total_refs in stats:
        # Format the username to prevent markdown errors, or use the ID if no username exists
        escaped_uname = uname.replace('_', r'\_') if uname else ""
        user_display = f"@{escaped_uname}" if uname else f"`{uid}`"
        
        # Display both the current withdrawable balance and their all-time invites
        msg += f"👤 {user_display}\n💰 **Balance:** {score} Birr/Points | 📈 **Total Refs:** {total_refs}\n\n"
        
    # Send the message, making sure it doesn't exceed Telegram's length limit
    await update.message.reply_text(msg[:4096], parse_mode='Markdown')

# --- 🗓️ SCHEDULED POSTS HANDLERS ---
async def manage_scheduled_posts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await is_admin(update.effective_user.id): return
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT job_id, post_text, scheduled_time, repeat FROM scheduled_posts") as cursor:
            posts = await cursor.fetchall()
            
    if not posts:
        await update.message.reply_text("There are no scheduled posts.")
        return
        
    for job_id, post_text, scheduled_time, repeat in posts:
        keyboard = [
            [
                InlineKeyboardButton("Duplicate 📑", callback_data=f"duplicate_post:{job_id}"),
                InlineKeyboardButton("Cancel ❌", callback_data=f"cancel_post:{job_id}")
            ]
        ]
        await update.message.reply_text(
            f"🗓️ **Post:** `{post_text[:50]}...`\n**Time:** {scheduled_time}", 
            reply_markup=InlineKeyboardMarkup(keyboard), 
            parse_mode='Markdown'
        )

async def duplicate_post_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    job_id = query.data.split(":")[1]

    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT post_text, repeat, post_photo, post_button_text, post_button_url FROM scheduled_posts WHERE job_id = ?", (job_id,)) as cursor:
            post = await cursor.fetchone()

    if not post:
        await query.edit_message_text("Error: Original post data not found.")
        return ConversationHandler.END

    # Load previous data into context
    context.user_data['post_text'] = post[0]
    context.user_data['schedule_times'] = post[1]
    context.user_data['post_photo'] = post[2]
    context.user_data['post_button_text'] = post[3] if post[3] else "Join Channel 📢"
    context.user_data['post_button_url'] = post[4] if post[4] else CHANNEL_INVITE_LINK
    
    cal = DetailedTelegramCalendar(min_date=date.today(), start_stage='month')
    calendar_markup, step = cal.build()
    
    reply_markup = InlineKeyboardMarkup(json.loads(calendar_markup).get("inline_keyboard", [])) if isinstance(calendar_markup, str) else calendar_markup

    await query.edit_message_text(
        "📑 **Duplicating Post**\nSelect the **Month** for the new post:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return ASK_SCHEDULE_DATE

async def cancel_post_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    job_id = query.data.split(":")[1]
    
    jobs = context.application.job_queue.get_jobs_by_name(job_id)
    for job in jobs: job.schedule_removal()
    
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("DELETE FROM scheduled_posts WHERE job_id = ?", (job_id,))
        await db.commit()
    await query.edit_message_text("✅ Post cancelled.")

# --- 🛰️ INLINE QUERY HANDLER ---
async def handle_inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    inline_query = update.inline_query

    user = inline_query.from_user
    user_id = user.id

    referral_link = (
        f"https://t.me/BeleqetJobsInviteAndWin_Bot?start={user_id}"
    )

    invite_text = f"""
🎓 Join Beleqet Academy and start earning while you learn!

💰 Earn rewards for referrals
📚 Access free learning opportunities
🚀 Register here:
{referral_link}
""".strip()

    results = [
        InlineQueryResultArticle(
            id=str(uuid4()),
            title="🚀 Invite to Beleqet Academy",
            description="Send your referral link instantly",
            input_message_content=InputTextMessageContent(
                message_text=invite_text
            ),
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton(
                        "🎓 Open Beleqet Academy",
                        url=referral_link
                    )
                ]
            ])
        )
    ]

    await inline_query.answer(
        results=results,
        cache_time=0,
        is_personal=True
    )

def main():
    logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
    application = Application.builder().token(BOT_TOKEN).persistence(PicklePersistence(filepath="bot_persistence")).post_init(post_init).build()

    application.add_handler(ConversationHandler(
        entry_points=[
            MessageHandler(filters.Regex("^📢 Post to Channel$"), post_start),
            CallbackQueryHandler(duplicate_post_callback, pattern="^duplicate_post:")],
        states={
            POST_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, post_get_text)],
            POST_PHOTO: [MessageHandler(filters.PHOTO, post_get_photo), CommandHandler("skip", post_skip_photo)],
            POST_BUTTON_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, post_get_button_text)],
            POST_BUTTON_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, post_get_button_url)],
            ASK_SCHEDULE_DATE: [CallbackQueryHandler(post_now, pattern="^post_now$"), CallbackQueryHandler(handle_calendar)],
            ASK_REPEATING_TIMES: [MessageHandler(filters.TEXT & ~filters.COMMAND, post_get_repeating_times)],
            POST_CONFIRM: [CallbackQueryHandler(post_decision_callback, pattern="^post_")],
        },
        fallbacks=[CommandHandler("cancel", post_cancel)],
    ))

    application.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📣 Broadcast Message$"), broadcast_start)],
        states={
            BROADCAST_MESSAGE: [MessageHandler(filters.ALL & ~filters.COMMAND, broadcast_get_message)],
            BROADCAST_BUTTON_TEXT: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_text), CommandHandler("skip", broadcast_skip_button)],
            BROADCAST_BUTTON_URL: [MessageHandler(filters.TEXT & ~filters.COMMAND, broadcast_get_button_url)],
            BROADCAST_CONFIRM: [CallbackQueryHandler(broadcast_action, pattern="^broadcast_")],
        },
        fallbacks=[CommandHandler("cancel", broadcast_cancel_cmd)],
    ))

    application.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^👑 Manage Admins$"), manage_admins_start)],
        states={
            ADMIN_MENU: [MessageHandler(filters.Regex("^➕ Add Admin$"), ask_for_add_id), MessageHandler(filters.Regex("^➖ Remove Admin$"), ask_for_remove_id), MessageHandler(filters.Regex("^📋 List Admins$"), list_admins)],
            ADD_ADMIN_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_admin_id)],
            REMOVE_ADMIN_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, remove_admin_id)],
        },
        fallbacks=[MessageHandler(filters.Regex("^⬅️ Back to Main Menu$"), back_to_main_menu)],
    ))

    application.add_handler(CommandHandler("start", start))
    application.add_handler(ChatMemberHandler(track_chats, ChatMemberHandler.CHAT_MEMBER))
    application.add_handler(MessageHandler(filters.Regex("^🏠 Main Menu$"), main_menu))
    application.add_handler(MessageHandler(filters.Regex("^📊 User Stats$"), get_user_stats))
    application.add_handler(MessageHandler(filters.Regex("^🗓️ Scheduled Posts$"), manage_scheduled_posts))
    application.add_handler(CallbackQueryHandler(handle_admin_decision, pattern="^(approve|reject):"))
    application.add_handler(CallbackQueryHandler(cancel_post_callback, pattern="^cancel_post:"))
    application.add_handler(InlineQueryHandler(handle_inline_query))

    print("Bot is running...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()