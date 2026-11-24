"""SGS Challenge: the 20% voucher in the bot, shop staff, creator links, and how people who haven't voted
are reminded. Run: python -m pytest -q"""
import asyncio
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
from types import SimpleNamespace
from urllib.parse import quote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "sgs-challenge", "server"))

from aiohttp import web  # noqa: E402
from aiohttp.test_utils import TestClient, TestServer  # noqa: E402

import challenge  # noqa: E402
import common  # noqa: E402
import registration  # noqa: E402
import voting_routes  # noqa: E402
from voting_routes import init_challenge_db, register_challenge_routes  # noqa: E402

TOKEN = "123456:TEST-ONLY-not-a-real-bot-token"
ADMIN, STAFF = 1001, 2002


def init_data(user_id: int) -> str:
    """Telegram's signed launch data for this user, as the Mini App sends it."""
    auth_date = int(time.time())
    user = json.dumps({"id": user_id, "first_name": "Test"}, separators=(",", ":"))
    check = f"auth_date={auth_date}\nuser={user}"
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    digest = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return f"auth_date={auth_date}&user={quote(user)}&hash={digest}"


async def challenge_app(on_vote=None):
    """The challenge routes on a fresh database, with one creator, Sara (id 1)."""
    db = await init_challenge_db(os.path.join(tempfile.mkdtemp(), "challenge.db"))
    await db.execute("INSERT INTO challenge_creators (name, handle) VALUES ('Sara', 'sara')")
    await db.commit()
    app = web.Application()
    register_challenge_routes(app, db, bot_token=TOKEN, admin_ids=[ADMIN], staff_ids=[STAFF], on_vote=on_vote)
    client = TestClient(TestServer(app))
    await client.start_server()
    return client, db


def vote(client, user_id):
    return client.post("/api/challenge/vote", json={"initData": init_data(user_id), "creator_id": 1})


def test_a_vote_sends_the_voucher_to_the_bot_and_a_failure_there_keeps_the_vote():
    async def check():
        calls = []

        async def on_vote(telegram_id, creator_name, code):
            calls.append((telegram_id, creator_name, code))
            if telegram_id == "6":
                raise RuntimeError("Telegram is down")

        client, db = await challenge_app(on_vote)
        try:
            answer = await vote(client, 5)
            body = await answer.json()
            assert answer.status == 200 and body["coupon_code"].startswith("SGS-")
            assert calls == [("5", "Sara", body["coupon_code"])]
            # The message failing doesn't undo the vote.
            assert (await vote(client, 6)).status == 200
            assert await voting_routes.voter_ids(db) == {"5", "6"}
        finally:
            await client.close()
            await db.close()
    asyncio.run(check())


def test_the_creators_list_carries_the_20_percent_offer():
    async def check():
        client, db = await challenge_app()
        try:
            creators = await (await client.get("/api/challenge/creators")).json()
            assert creators["offer"] == "20% off any order at Super SGS Furniture"
            assert "20%" in creators["offer_am"]
        finally:
            await client.close()
            await db.close()
    asyncio.run(check())


def test_shop_staff_check_and_mark_vouchers_and_nothing_else():
    async def check():
        client, db = await challenge_app()
        try:
            code = (await (await vote(client, 5)).json())["coupon_code"]
            staff = {"X-Init-Data": init_data(STAFF)}
            assert await (await client.post("/api/challenge/admin/check", headers=staff)).json() == {
                "is_admin": False, "is_staff": True}
            checked = await (await client.post("/api/challenge/admin/voucher/check", headers=staff, json={"code": code})).json()
            assert checked["found"] and checked["redeemed_at"] is None
            assert (await client.post("/api/challenge/admin/voucher/redeem", headers=staff, json={"code": code})).status == 200
            # Not the creators, the votes or the uploads.
            assert (await client.get("/api/challenge/admin/creators", headers=staff)).status == 401
            assert (await client.post("/api/challenge/admin/reset", headers=staff)).status == 401
            # A voter is neither.
            assert (await client.post("/api/challenge/admin/check", headers={"X-Init-Data": init_data(5)})).status == 401
        finally:
            await client.close()
            await db.close()
    asyncio.run(check())


def test_old_and_new_challenge_buttons_and_the_voucher_button():
    assert common.menu_key_for("SGS Challenge") == ("challenge", "en")
    assert common.menu_key_for("🎁 SGS Challenge – vote & get 20% off") == ("challenge", "en")
    assert common.menu_key_for("🎁 የእኔ ቫውቸር") == ("voucher", "am")
    labels = [button.text for row in common.get_keyboard("Candidate", "en").keyboard for button in row]
    assert "🎁 My voucher" in labels and "🎁 SGS Challenge – vote & get 20% off" in labels
    admin = [button.text for row in common.get_keyboard("Employer", "en", is_admin=True).keyboard for button in row]
    assert challenge.REMIND_BUTTON in admin


def test_the_description_starts_with_the_challenge_once():
    original = "Beleqet Jobs helps people find work."
    with_challenge = challenge.described(original)
    assert with_challenge.startswith(challenge.DESCRIPTION_MARK) and with_challenge.endswith(original)
    assert "20%" in with_challenge
    assert challenge.described(with_challenge) == with_challenge


def test_reminders_go_only_to_people_who_have_not_voted_and_at_most_twice():
    async def check():
        db = await init_challenge_db(os.path.join(tempfile.mkdtemp(), "challenge.db"))
        try:
            await db.execute("INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (1, '10', 0)")
            await db.execute("INSERT INTO challenge_reminders (telegram_id, sent) VALUES ('11', 2), ('12', 1)")
            await db.commit()
            audience = await challenge.reminder_audience(db, {"10", "11", "12", "13"})
            assert audience == [("12", 1), ("13", 0)]
            first, last = challenge.reminder_message(1), challenge.reminder_message(2)
            assert "haven't voted" in first and "Last chance" in last
        finally:
            await db.close()
    asyncio.run(check())


def test_the_voucher_message_shows_the_code_the_offer_and_whether_it_was_used():
    text = challenge.voucher_message("SGS-AB2CD3", redeemed=False)
    assert "<code>SGS-AB2CD3</code>" in text and voting_routes.VOUCHER_OFFER in text
    assert "already been used" not in text
    assert "already been used" in challenge.voucher_message("SGS-AB2CD3", redeemed=True)


class Sender:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text, kwargs))


def test_people_who_have_not_voted_get_one_nudge_and_voters_none():
    async def check():
        db = await init_challenge_db(os.path.join(tempfile.mkdtemp(), "challenge.db"))
        await db.execute("INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (1, '21', 0)")
        await db.commit()
        sender = Sender()
        saved = (common.bot_context.challenge_db, common.bot_context.rate_limiter)
        common.bot_context.challenge_db, common.bot_context.rate_limiter = db, sender
        try:
            def update(user_id):
                return SimpleNamespace(effective_user=SimpleNamespace(id=user_id), effective_chat=SimpleNamespace(id=user_id))
            seeker = SimpleNamespace(user_data={})
            await challenge.nudge_once(update(20), seeker)
            await challenge.nudge_once(update(20), seeker)
            voter = SimpleNamespace(user_data={})
            await challenge.nudge_once(update(21), voter)
            assert [chat for chat, _, _ in sender.sent] == [20]
            assert seeker.user_data["sgs_nudged"] and voter.user_data["sgs_nudged"]
        finally:
            common.bot_context.challenge_db, common.bot_context.rate_limiter = saved
            await db.close()
    asyncio.run(check())


def test_a_creator_link_opens_the_challenge_at_their_card():
    async def check():
        replies = []

        async def reply_text(text, **kwargs):
            replies.append(kwargs["reply_markup"].inline_keyboard[0][0].web_app.url)

        update = SimpleNamespace(effective_message=SimpleNamespace(reply_text=reply_text),
                                 effective_user=SimpleNamespace(id=30), message=SimpleNamespace(chat_id=30),
                                 callback_query=None)
        context = SimpleNamespace(args=["challenge-7"], user_data={})
        await registration.start(update, context)
        context.args = ["challenge"]
        await registration.start(update, context)
        assert replies[0].endswith("?startapp=vote&creator=7")
        assert replies[1].endswith("?startapp=vote")
    asyncio.run(check())
