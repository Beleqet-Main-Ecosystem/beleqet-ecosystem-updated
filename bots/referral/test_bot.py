"""The referral bot (main.py, profiles.py): referrals count once, leaving the channel takes the point
back, only admins decide withdrawals, and Boost and Go each get their own settings.
Run from bots/referral: python -m pytest test_bot.py"""
import asyncio
import os
import sqlite3
import subprocess
import sys
from types import SimpleNamespace

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.update({
    "BOT_TOKEN": "123456:TEST-token_for_tests_only", "BOT_NAME": "boost",
    "ADMIN_ID": "1000", "PAYMENT_HANDLER_ID": "2000", "ADMIN_IDS": "3000,3001",
})
for name in ("CHANNEL_ID", "WEBAPP_URL", "CHANNEL_INVITE_LINK", "WELCOME_PHOTO_FILE_ID"):
    os.environ.pop(name, None)
sys.path.insert(0, HERE)
import main  # noqa: E402
import profiles  # noqa: E402

REFERRER, FRIEND, ADMIN = 10, 11, 1000


@pytest.fixture(autouse=True)
def database(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_FILE", str(tmp_path / "bot.db"))
    asyncio.run(main.setup_database())
    return main.DB_FILE


def query(sql, *args):
    with sqlite3.connect(main.DB_FILE) as db:
        return db.execute(sql, args).fetchall()


def score(user_id):
    return query("SELECT score FROM users WHERE user_id = ?", user_id)[0][0]


class Recorder:
    """Stands in for the bot, a message or a callback query: keeps what the handler sent."""

    def __init__(self):
        self.sent = []

    def __getattr__(self, name):
        async def record(*args, **kwargs):
            self.sent.append((name, args, kwargs))
        return record

    def texts(self):
        return [kwargs.get("text", args[0] if args else "") for _, args, kwargs in self.sent]


def user(user_id, username=None):
    return SimpleNamespace(id=user_id, username=username or f"user{user_id}", first_name="Test")


def start(user_id, *args):
    update = SimpleNamespace(effective_user=user(user_id), message=Recorder())
    context = SimpleNamespace(args=list(args), bot=Recorder())
    asyncio.run(main.start(update, context))
    return context.bot


def channel_event(user_id, status, chat_id=None):
    member = SimpleNamespace(user=user(user_id), status=status)
    update = SimpleNamespace(
        chat_member=SimpleNamespace(new_chat_member=member),
        effective_chat=SimpleNamespace(id=chat_id if chat_id is not None else main.CHANNEL_ID),
    )
    asyncio.run(main.track_chats(update, SimpleNamespace()))


def decide(admin_id, data):
    callback = Recorder()
    callback.from_user = user(admin_id)
    callback.data = data
    callback.message = SimpleNamespace(text="Withdrawal request")
    context = SimpleNamespace(bot=Recorder())
    asyncio.run(main.handle_admin_decision(SimpleNamespace(callback_query=callback), context))
    return callback, context.bot


def test_admins_come_from_the_settings():
    for admin_id in (1000, 2000, 3000, 3001):
        assert asyncio.run(main.is_admin(admin_id))
    assert not asyncio.run(main.is_admin(REFERRER))


def test_a_referral_counts_once():
    start(REFERRER)
    bot = start(FRIEND, str(REFERRER))
    assert score(REFERRER) == 1
    assert any("earned 1 point" in text for text in bot.texts())

    start(FRIEND, str(REFERRER))      # opening the bot again
    start(12, str(REFERRER))          # a second friend
    assert score(REFERRER) == 2


def test_referrals_that_dont_count():
    start(15, "15")                   # your own link, on your first start
    assert score(15) == 0
    start(REFERRER)
    start(13)
    start(13, str(REFERRER))          # someone who already used the bot
    start(14, "not-a-number")
    assert score(REFERRER) == 0


def test_leaving_the_channel_takes_the_point_back_until_they_return():
    start(REFERRER)
    start(FRIEND, str(REFERRER))

    channel_event(FRIEND, "left")
    channel_event(FRIEND, "kicked")   # already gone: no second deduction
    assert score(REFERRER) == 0
    assert query("SELECT is_active FROM successful_referrals WHERE referred_user_id = ?", FRIEND) == [(0,)]

    channel_event(FRIEND, "member")
    assert score(REFERRER) == 1

    channel_event(FRIEND, "left", chat_id=-1)   # a chat the bot doesn't count
    assert score(REFERRER) == 1


def test_only_admins_decide_withdrawals_and_a_rejection_refunds_once():
    start(FRIEND)
    # Two requests of 60; the API took the points when they were made, leaving 5.
    with sqlite3.connect(main.DB_FILE) as db:
        db.executemany("INSERT INTO withdrawals (user_id, amount, phone_number) VALUES (?, 60, '0911000000')",
                       [(FRIEND,), (FRIEND,)])
        db.execute("UPDATE users SET score = 5 WHERE user_id = ?", (FRIEND,))
        rejected, approved = [row[0] for row in db.execute("SELECT id FROM withdrawals ORDER BY id")]

    decide(FRIEND, f"reject:{rejected}")              # not an admin
    assert query("SELECT status FROM withdrawals WHERE id = ?", rejected) == [("pending",)]

    _, bot = decide(ADMIN, f"reject:{rejected}")
    assert query("SELECT status FROM withdrawals WHERE id = ?", rejected) == [("rejected",)]
    assert score(FRIEND) == 65
    assert any("refunded" in text for text in bot.texts())

    callback, _ = decide(ADMIN, f"reject:{rejected}")  # pressed again
    assert score(FRIEND) == 65
    assert any("ALREADY PROCESSED" in text for text in callback.texts())

    decide(ADMIN, f"approve:{approved}")
    assert query("SELECT status FROM withdrawals WHERE id = ?", approved) == [("paid",)]
    assert score(FRIEND) == 65


def test_user_stats_fit_in_telegram_messages():
    with sqlite3.connect(main.DB_FILE) as db:
        db.executemany("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)",
                       [(5000 + i, f"long_user_name_{i}", i) for i in range(120)])
    message = Recorder()
    asyncio.run(main.get_user_stats(SimpleNamespace(effective_user=user(ADMIN), message=message), SimpleNamespace()))
    texts = message.texts()
    assert len(texts) > 1
    assert all(len(text) <= 4096 for text in texts)
    assert sum(text.count("👤") for text in texts) == 100        # the top 100
    assert r"@long\_user\_name\_119" in "".join(texts)            # Markdown-safe


@pytest.mark.parametrize("name", sorted(profiles.PROFILES))
def test_invite_links_open_this_bot(name, monkeypatch):
    monkeypatch.setattr(main, "BOT", profiles.PROFILES[name])
    inline = Recorder()
    inline.from_user = user(42)
    asyncio.run(main.handle_inline_query(SimpleNamespace(inline_query=inline), SimpleNamespace()))
    (_, _, kwargs), = inline.sent
    text = kwargs["results"][0].input_message_content.message_text
    assert f"https://t.me/{profiles.PROFILES[name].bot_username}?start=42" in text


@pytest.mark.parametrize("name", sorted(profiles.PROFILES))
def test_each_bot_runs_with_its_own_settings(name):
    p = profiles.PROFILES[name]
    assert os.path.exists(os.path.join(HERE, p.welcome_photo))
    env = {k: v for k, v in os.environ.items() if k not in ("ADMIN_ID", "PAYMENT_HANDLER_ID", "ADMIN_IDS")}
    env["BOT_NAME"] = name
    out = subprocess.run(
        [sys.executable, "-c", "import main, api; print(main.DB_FILE, main.CHANNEL_ID, main.PRIMARY_ADMIN_ID,"
         " main.WEBAPP_URL, main.CHANNEL_INVITE_LINK, api.DB_FILE, api.TRANSFER_SOURCE, sep='|')"],
        cwd=HERE, env=env, capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout.strip().split("|")
    assert out[0].endswith(p.db_file) and out[5].endswith(p.db_file)
    assert out[1:5] == [str(p.channel_id), str(p.admin_id), p.webapp_url, p.channel_invite_link]
    assert out[6] == p.transfer_source


def test_the_bots_dont_share_a_database_or_a_name():
    bots = list(profiles.PROFILES.values())
    for field in ("db_file", "bot_username", "webapp_url", "welcome_photo"):
        assert len({getattr(p, field) for p in bots}) == len(bots), field


def test_a_bot_is_picked_by_its_folder(tmp_path, monkeypatch):
    monkeypatch.delenv("BOT_NAME")
    for folder, expected in (("go", "go"), ("boost", "boost")):
        copy = tmp_path / folder
        copy.mkdir()
        (copy / "profiles.py").write_text(open(os.path.join(HERE, "profiles.py"), encoding="utf-8").read(), encoding="utf-8")
        out = subprocess.run([sys.executable, "-c", "import profiles; print(profiles.current().name)"],
                             cwd=copy, capture_output=True, text=True, env={**os.environ}, check=True)
        assert out.stdout.strip() == expected
    unknown = tmp_path / "referral"
    unknown.mkdir()
    (unknown / "profiles.py").write_text(open(os.path.join(HERE, "profiles.py"), encoding="utf-8").read(), encoding="utf-8")
    failed = subprocess.run([sys.executable, "-c", "import profiles; profiles.current()"],
                            cwd=unknown, capture_output=True, text=True, env={**os.environ})
    assert failed.returncode != 0 and "Unknown bot 'referral'" in failed.stderr
