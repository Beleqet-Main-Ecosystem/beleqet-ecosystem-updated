"""The Mini App's API (api.py): only the signed-in Telegram user reads or spends their balance, and
an airtime payout names its provider. Run from bots/boost: python -m unittest test_api"""
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import tempfile
import time
import unittest
from unittest import mock
from urllib.parse import urlencode

BOT_TOKEN = "123456:TEST-token_for_tests_only"
os.environ.update({"BOT_TOKEN": BOT_TOKEN, "ADMIN_ID": "1000", "REQUIRE_TELEGRAM_AUTH": "true"})
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

USER = 5001


def init_data(user_id, token=BOT_TOKEN):
    """initData as Telegram signs it for `user_id`."""
    fields = {
        "auth_date": str(int(time.time())),
        "query_id": "AAH-test",
        "user": json.dumps({"id": user_id, "first_name": "Test"}),
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def signed(user_id=USER):
    return {"X-Telegram-Init-Data": init_data(user_id)}


class FakeTelegram:
    """Stands in for httpx.AsyncClient; keeps the messages the API sends to the admin."""
    sent = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json=None):
        FakeTelegram.sent.append(json)
        return mock.Mock(status_code=200, text="ok")


class ApiTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.mkdtemp()
        api.DB_FILE = os.path.join(folder, "boost.db")
        with sqlite3.connect(api.DB_FILE) as db:
            db.execute("CREATE TABLE users (user_id INTEGER PRIMARY KEY, score INTEGER NOT NULL DEFAULT 0, username TEXT)")
            db.execute("CREATE TABLE successful_referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER NOT NULL, "
                       "referred_user_id INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)")
            db.execute("CREATE TABLE withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, "
                       "phone_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', request_timestamp DATETIME, processed_timestamp DATETIME)")
            db.execute("INSERT INTO users (user_id, score) VALUES (?, 100)", (USER,))
        FakeTelegram.sent = []
        patcher = mock.patch.object(api.httpx, "AsyncClient", FakeTelegram)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(api.app)

    def balance(self):
        with sqlite3.connect(api.DB_FILE) as db:
            return db.execute("SELECT score FROM users WHERE user_id = ?", (USER,)).fetchone()[0]

    def payouts(self):
        with sqlite3.connect(api.DB_FILE) as db:
            return [row[0] for row in db.execute("SELECT phone_number FROM withdrawals")]

    def withdraw(self, headers=None, **body):
        return self.client.post("/api/withdraw", json={"user_id": USER, "amount": 60, **body}, headers=headers or {})

    def test_stats_only_for_the_signed_in_user(self):
        self.assertEqual(self.client.get(f"/api/user/{USER}/stats").status_code, 401)
        self.assertEqual(self.client.get(f"/api/user/{USER}/stats", headers=signed(USER + 1)).status_code, 401)
        response = self.client.get(f"/api/user/{USER}/stats", headers=signed())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["balance"], 100)

    def test_withdrawal_without_the_users_signature_is_refused(self):
        self.assertEqual(self.withdraw(phone_number="0911223344").status_code, 401)
        self.assertEqual(self.withdraw(headers=signed(USER + 1), phone_number="0911223344").status_code, 401)
        self.assertEqual(self.balance(), 100)
        self.assertEqual(self.payouts(), [])

    def test_cash_withdrawal(self):
        response = self.withdraw(headers=signed(), phone_number="0911 22-33-44")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.balance(), 40)
        self.assertEqual(self.payouts(), ["0911223344"])

    def test_airtime_withdrawal_names_its_provider(self):
        response = self.withdraw(headers=signed(), phone_number="0711223344", airtime_provider="Safaricom")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.payouts(), ["0711223344 (Safaricom airtime)"])
        self.assertIn("0711223344 (Safaricom airtime)", FakeTelegram.sent[0]["text"])

    def test_unknown_airtime_provider_is_refused(self):
        response = self.withdraw(headers=signed(), phone_number="0711223344", airtime_provider="Acme")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.balance(), 100)


if __name__ == "__main__":
    unittest.main()
