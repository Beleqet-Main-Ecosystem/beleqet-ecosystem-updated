"""The SGS Challenge in the bot: the challenge button, the voter's voucher, and bringing in people who
haven't voted yet (a pinned reminder at most twice, one nudge, a card after registering). The voucher is
20% off at Super SGS Furniture (voting_routes.VOUCHER_OFFER)."""
import asyncio
import os
import sys
import time
from html import escape
from urllib.parse import quote

import telegram
from telegram import BotCommand, BotCommandScopeChat, InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sgs-challenge', 'server'))
import voting_routes  # noqa: E402

from config import CONFIG, logger  # noqa: E402
from common import bot_context  # noqa: E402

# People who haven't voted get two reminders at most; the first is pinned in their chat.
MAX_REMINDERS = 2
REMIND_BUTTON = "🎁 Remind non-voters"
# The bot's description starts with this line.
DESCRIPTION_MARK = "🎁 SGS Challenge:"


def challenge_url(creator_id=None) -> str:
    url = f"{CONFIG['challenge_mini_app_url']}?startapp=vote"
    return f"{url}&creator={creator_id}" if creator_id else url


def vote_button(text="🗳️ Vote Now / ድምጽ ይስጡ", creator_id=None) -> InlineKeyboardButton:
    return InlineKeyboardButton(text, web_app=WebAppInfo(url=challenge_url(creator_id)))


def bot_username() -> str:
    bot = bot_context.application.bot if bot_context.application else None
    return getattr(bot, 'username', None) or 'BeleqetJobs_Bot'


def challenge_link(creator_id=None) -> str:
    """The link that opens the challenge in the bot, for anyone: registered or not."""
    return f"https://t.me/{bot_username()}?start=challenge" + (f"-{creator_id}" if creator_id else "")


def share_button() -> InlineKeyboardButton:
    text = (f"Vote for your favourite creator in the Super SGS Furniture Creative Challenge "
            f"and get {voting_routes.VOUCHER_OFFER}!")
    return InlineKeyboardButton(
        "📤 Invite friends to vote / ጓደኞችን ይጋብዙ",
        url=f"https://t.me/share/url?url={quote(challenge_link())}&text={quote(text)}",
    )


def offer_lines() -> str:
    return f"{escape(voting_routes.VOUCHER_OFFER)}\n{escape(voting_routes.VOUCHER_OFFER_AM)}"


def challenge_row() -> list:
    """The challenge button, as a keyboard row."""
    return [[vote_button("🎁 SGS Challenge – vote & get 20% off · ድምጽ ይስጡ 20% ቅናሽ ያግኙ")]]


async def has_voted(telegram_id) -> bool:
    db = getattr(bot_context, 'challenge_db', None)
    return bool(db) and await voting_routes.has_voted(db, telegram_id)


async def challenge_command(update: Update, context: ContextTypes.DEFAULT_TYPE, creator_id=None):
    """/challenge, the menu button and the challenge links."""
    lines = [
        "🎁 <b>Super SGS Furniture Creative Challenge</b>",
        "Vote for your favourite creator and get a voucher:",
        offer_lines(),
    ]
    await update.effective_message.reply_text(
        "\n".join(lines), parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[vote_button(creator_id=creator_id)]]),
    )


def voucher_message(code: str, redeemed: bool) -> str:
    lines = [
        "🎁 <b>Your Super SGS Furniture voucher</b> · የSuper SGS Furniture ቫውቸርዎ",
        "",
        f"<code>{escape(code)}</code>",
        "",
        offer_lines(),
        "",
        "Show this message at Super SGS Furniture. The code works once.",
        "ይህን መልዕክት በSuper SGS Furniture ያሳዩ። ኮዱ አንድ ጊዜ ብቻ ይሰራል።",
    ]
    if redeemed:
        lines += ["", "⚠️ This voucher has already been used. · ይህ ቫውቸር ጥቅም ላይ ውሏል።"]
    return "\n".join(lines)


async def send_voucher_after_vote(telegram_id: str, creator_name: str, code) -> None:
    """Right after a vote: thanks, and the voucher, kept in the chat for the shop."""
    if not code:
        return
    await bot_context.rate_limiter.send_message(
        int(telegram_id),
        f"✅ Thank you for voting for <b>{escape(creator_name)}</b>! · ድምጽ ስለሰጡ እናመሰግናለን!\n\n"
        + voucher_message(code, redeemed=False),
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[share_button()]]),
    )
    await unpin_reminder(telegram_id)


async def voucher_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/voucher and the "My voucher" button."""
    db = getattr(bot_context, 'challenge_db', None)
    voucher = await voting_routes.voucher_of(db, update.effective_user.id) if db else None
    if voucher:
        await update.effective_message.reply_text(
            voucher_message(voucher[0], bool(voucher[1])), parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup([[share_button()]]),
        )
        return
    await update.effective_message.reply_text(
        "You get your voucher when you vote in the SGS Challenge:\n"
        "ቫውቸርዎን በSGS Challenge ድምጽ ሲሰጡ ያገኛሉ፦\n\n" + offer_lines(),
        parse_mode='HTML', reply_markup=InlineKeyboardMarkup([[vote_button()]]),
    )


async def after_registration(chat_id: int, telegram_id, context: ContextTypes.DEFAULT_TYPE) -> None:
    """One card after someone finishes registering in the bot. It counts as their nudge, so the first menu
    tap doesn't ask again."""
    if await has_voted(telegram_id):
        return
    context.user_data['sgs_nudged'] = True
    await bot_context.rate_limiter.send_message(
        chat_id,
        "🎁 One more thing: vote in the <b>SGS Challenge</b> and get a voucher · አንድ ተጨማሪ ነገር፦ በSGS Challenge "
        "ድምጽ ይስጡ፣ ቫውቸር ያግኙ\n\n" + offer_lines(),
        parse_mode='HTML', reply_markup=InlineKeyboardMarkup([[vote_button()]]),
    )


async def nudge_once(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """A single line, once per person, when someone who hasn't voted uses the bot for something else."""
    if context.user_data.get('sgs_nudged'):
        return
    if await has_voted(update.effective_user.id):
        context.user_data['sgs_nudged'] = True
        return
    context.user_data['sgs_nudged'] = True
    await bot_context.rate_limiter.send_message(
        update.effective_chat.id,
        "🎁 Have you voted in the SGS Challenge? Vote and get a voucher · በSGS Challenge ድምጽ ሰጥተዋል? "
        "ድምጽ ይስጡ፣ ቫውቸር ያግኙ\n" + offer_lines(),
        parse_mode='HTML', reply_markup=InlineKeyboardMarkup([[vote_button()]]),
    )


# ── Reminders for people who haven't voted (an admin sends them) ─────────────

def reminder_message(number: int) -> str:
    """The first reminder invites; the second is the last one."""
    if number == 1:
        lines = [
            "🎁 You haven't voted in the <b>Super SGS Furniture Creative Challenge</b> yet!",
            "Pick your favourite creator and get a voucher:",
            "",
            "🎁 በ<b>Super SGS Furniture</b> የፈጠራ ውድድር እስካሁን ድምጽ አልሰጡም!",
            "የሚወዱትን ፈጣሪ ይምረጡ፣ ቫውቸር ያግኙ፦",
            "",
            offer_lines(),
        ]
    else:
        lines = [
            "⏰ Last chance to vote in the <b>Super SGS Furniture Creative Challenge</b> and get your voucher!",
            "⏰ በSuper SGS Furniture የፈጠራ ውድድር ድምጽ ሰጥተው ቫውቸር ለማግኘት የመጨረሻ ዕድል!",
            "",
            offer_lines(),
        ]
    return "\n".join(lines)


async def bot_user_ids() -> set:
    """Everyone the bot can message: Beleqet accounts with Telegram, and anyone who has used the bot."""
    ids = {str(uid) for uid in bot_context.application.user_data.keys()}
    base_url = CONFIG['wp_api_url'].removesuffix('/register')
    async with bot_context.session.get(f"{base_url}/get-all-telegram-ids", timeout=30) as response:
        if response.status == 200:
            ids |= {str(uid) for uid in (await response.json()).get('telegram_ids', [])}
        else:
            logger.warning(f"Reminder audience: the API answered HTTP {response.status}; using the bot's own users")
    return ids


async def reminder_audience(db, everyone: set) -> list:
    """(telegram_id, reminders sent so far) for each person who hasn't voted and has a reminder left."""
    voters = await voting_routes.voter_ids(db)
    async with db.execute("SELECT telegram_id, sent FROM challenge_reminders") as cur:
        sent = {row[0]: row[1] for row in await cur.fetchall()}
    return sorted((tid, sent.get(tid, 0)) for tid in everyone - voters if sent.get(tid, 0) < MAX_REMINDERS)


def _is_admin(update: Update) -> bool:
    return bool(update.effective_user) and update.effective_user.id in CONFIG['admin_ids']


async def remind_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """The admin's "Remind non-voters" button: a preview and a count, then Send or Cancel."""
    if not _is_admin(update):
        return
    db = bot_context.challenge_db
    audience = await reminder_audience(db, await bot_user_ids())
    first = sum(1 for _, sent in audience if sent == 0)
    await update.effective_message.reply_text("Preview of what they receive:")
    await update.effective_message.reply_text(
        reminder_message(1 if first else 2), parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[vote_button()]]))
    if not audience:
        await update.effective_message.reply_text("Everyone has voted or already had both reminders.")
        return
    await update.effective_message.reply_text(
        f"Send it to {len(audience)} people who haven't voted? ({first} get their first reminder, which is pinned; "
        f"{len(audience) - first} their second and last.)",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("✅ Send", callback_data='sgs_remind'),
                                            InlineKeyboardButton("Cancel", callback_data='sgs_cancel')]]),
    )


async def remind_decision(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not _is_admin(update):
        await query.answer("Only the bot's admins can do this.", show_alert=True)
        return
    await query.answer()
    if query.data == 'sgs_cancel':
        await query.edit_message_text("Cancelled.")
    elif query.data == 'sgs_remind':
        await query.edit_message_text("Sending… I'll tell you when it's done.")
        asyncio.create_task(send_reminders(update.effective_chat.id))


async def _send_with_retry(chat_id: int, text: str):
    """Sends a reminder; when Telegram says to slow down, waits as long as it asks and tries once more."""
    send = bot_context.application.bot.send_message
    markup = InlineKeyboardMarkup([[vote_button()]])
    try:
        return await send(chat_id, text, parse_mode='HTML', reply_markup=markup)
    except telegram.error.RetryAfter as e:
        wait = e.retry_after.total_seconds() if hasattr(e.retry_after, 'total_seconds') else e.retry_after
        await asyncio.sleep(float(wait) + 1)
        return await send(chat_id, text, parse_mode='HTML', reply_markup=markup)


async def send_reminders(admin_chat_id: int) -> None:
    db = bot_context.challenge_db
    sent_ok = failed = 0
    try:
        audience = await reminder_audience(db, await bot_user_ids())
        for telegram_id, sent in audience:
            number = sent + 1
            try:
                message = await _send_with_retry(int(telegram_id), reminder_message(number))
                pinned = None
                if number == 1:
                    try:
                        await bot_context.application.bot.pin_chat_message(
                            int(telegram_id), message.message_id, disable_notification=True)
                        pinned = message.message_id
                    except telegram.error.TelegramError as e:
                        logger.info(f"Could not pin the reminder for {telegram_id}: {e}")
                await db.execute(
                    "INSERT INTO challenge_reminders (telegram_id, sent, last_at, pinned_message_id) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(telegram_id) DO UPDATE SET sent = excluded.sent, last_at = excluded.last_at, "
                    "pinned_message_id = COALESCE(excluded.pinned_message_id, challenge_reminders.pinned_message_id)",
                    (telegram_id, number, int(time.time()), pinned))
                await db.commit()
                sent_ok += 1
            except telegram.error.Forbidden:
                # Blocked the bot or never opened it: never try again.
                await db.execute(
                    "INSERT INTO challenge_reminders (telegram_id, sent, last_at) VALUES (?, ?, ?) "
                    "ON CONFLICT(telegram_id) DO UPDATE SET sent = excluded.sent, last_at = excluded.last_at",
                    (telegram_id, MAX_REMINDERS, int(time.time())))
                await db.commit()
                failed += 1
            except Exception as e:
                logger.warning(f"Reminder to {telegram_id} failed: {e}")
                failed += 1
            await asyncio.sleep(0.05)
    except Exception as e:
        logger.error(f"Challenge reminders stopped: {e}", exc_info=True)
    await bot_context.rate_limiter.send_message(
        admin_chat_id, f"✅ Challenge reminders sent: {sent_ok}. Not delivered (blocked or never opened the bot): {failed}.")


async def unpin_reminder(telegram_id) -> None:
    """Voted: the pinned reminder has done its job."""
    db = getattr(bot_context, 'challenge_db', None)
    if not db:
        return
    async with db.execute(
        "SELECT pinned_message_id FROM challenge_reminders WHERE telegram_id = ? AND pinned_message_id IS NOT NULL",
        (str(telegram_id),),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return
    try:
        await bot_context.application.bot.unpin_chat_message(int(telegram_id), message_id=row[0])
    except telegram.error.TelegramError as e:
        logger.info(f"Could not unpin the reminder for {telegram_id}: {e}")
    await db.execute("UPDATE challenge_reminders SET pinned_message_id = NULL WHERE telegram_id = ?", (str(telegram_id),))
    await db.commit()


# ── The bot's profile: its command menu and description ──────────────────

def described(description: str) -> str:
    """The bot's description with the challenge line at the top (once, however often it's set)."""
    rest = "\n\n".join(part for part in description.split("\n\n") if not part.startswith(DESCRIPTION_MARK))
    line = f"{DESCRIPTION_MARK} vote for your favourite creator and get {voting_routes.VOUCHER_OFFER}!"
    return f"{line}\n\n{rest}"[:512] if rest else line[:512]


# The Menu list everyone sees, and the extra commands only the bot's admins see in theirs.
COMMANDS = [
    BotCommand("start", "Start the bot"),
    BotCommand("challenge", "🎁 SGS Challenge: vote & get a voucher"),
    BotCommand("voucher", "🎁 My SGS Challenge voucher"),
    BotCommand("language", "Allows user to change their preferred language"),
    BotCommand("cancel", "Stops the current operation"),
]
ADMIN_COMMANDS = [
    BotCommand("broadcast", "📣 Send a message to all users"),
    BotCommand("remind", "🎁 Remind people who haven't voted"),
]


async def setup_profile(bot) -> None:
    """/challenge and /voucher in the Menu list for everyone, /broadcast and /remind also in the admins',
    and the challenge in the description."""
    try:
        await bot.set_my_commands(COMMANDS)
        for admin_id in CONFIG['admin_ids']:
            try:
                await bot.set_my_commands(COMMANDS + ADMIN_COMMANDS, scope=BotCommandScopeChat(chat_id=admin_id))
            except telegram.error.TelegramError as e:
                # An admin who has never opened the bot has no chat with it yet.
                logger.info(f"Could not set the admin commands for {admin_id}: {e}")
        current = (await bot.get_my_description()).description or ""
        wanted = described(current)
        if wanted != current:
            await bot.set_my_description(wanted)
    except telegram.error.TelegramError as e:
        logger.warning(f"Could not update the bot's commands or description: {e}")
