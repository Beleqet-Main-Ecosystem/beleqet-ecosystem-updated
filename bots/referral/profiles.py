"""Boost and Go are this one referral bot, run twice; these are the only ways the two differ.

Each copy finds its own entry by the folder it runs from (/opt/beleqet/boost or /opt/beleqet/go on
the server), or by BOT_NAME when that is set (local runs and tests). A bot's .env still overrides
the defaults here: CHANNEL_ID, ADMIN_ID, CHANNEL_INVITE_LINK, WEBAPP_URL, WELCOME_PHOTO_FILE_ID.
The Mini App's differences are in miniapp/src/bot.ts.
"""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Profile:
    name: str
    db_file: str                  # in data/
    channel_id: int
    admin_id: int
    channel_invite_link: str
    webapp_url: str
    bot_username: str             # invite links open this bot
    menu_button: str              # the chat's menu button, which opens the Mini App
    admin_open_app: str           # the admin keyboard's Mini App button
    welcome_open_app: str         # the welcome message's Mini App button
    transfer_source: str          # how the Promotion bot names transfers from this bot
    welcome_photo: str            # relative to this folder


PROFILES = {
    "boost": Profile(
        name="boost",
        db_file="boost.db",
        channel_id=-1001989588782,
        admin_id=6728089681,
        channel_invite_link="https://t.me/BeleqetBoost",
        webapp_url="https://boost.beleqetjobs.com/",
        bot_username="BeleqetBoost_Bot",
        menu_button="Launch Beleqet",
        admin_open_app="📱 Open Dashboard",
        welcome_open_app="Open Dashboard 📱",
        transfer_source="Beleqet Academy Bot",
        welcome_photo="welcome/boost.jpg",
    ),
    "go": Profile(
        name="go",
        db_file="go.db",
        channel_id=-1001199095627,
        admin_id=6359221369,
        channel_invite_link="https://t.me/BeleqetJobs",
        webapp_url="https://go.beleqetjobs.com/",
        bot_username="BeleqetJobsInviteAndWin_Bot",
        menu_button="Launch Beleqet Go",
        admin_open_app="📱 Mini App ይክፈቱ",
        welcome_open_app="Mini App ይክፈቱ 📱",
        transfer_source="Share & Win Bot",
        welcome_photo="welcome/go.jpg",
    ),
}


def current() -> Profile:
    name = os.getenv("BOT_NAME") or os.path.basename(os.path.dirname(os.path.abspath(__file__)))
    if name not in PROFILES:
        raise SystemExit(
            f"Unknown bot {name!r}: run it from a folder named {' or '.join(PROFILES)}, or set BOT_NAME."
        )
    return PROFILES[name]
