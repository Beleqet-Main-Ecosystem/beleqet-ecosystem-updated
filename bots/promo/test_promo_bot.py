"""Checks the Promotion bot refuses what it must: forged Mini App sign-ins, its own files, fake
webhook calls, transfers without the shared secret, and deposit approvals from anyone but the admin.

Run from this folder: python -m unittest test_promo_bot
"""
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest import mock
from urllib.parse import urlencode

BOT_TOKEN = "123456:TEST-token_for_tests_only"
ADMIN = 1000
WORK_DIR = tempfile.mkdtemp()
HERE = os.path.dirname(os.path.abspath(__file__))

os.environ.update({
    "BOT_TOKEN": BOT_TOKEN,
    "ADMIN_ID": str(ADMIN),
    "DB_PATH": os.path.join(WORK_DIR, "database.db"),
    "TRANSFER_SECRET_KEY": "test-transfer-secret",
    "WEBHOOK_SECRET_TOKEN": "test-webhook-secret",
    "WEBHOOK_DOMAIN": "https://promo.example",
})
# The server serves files from its own folder and writes uploads to the one it runs in (the same
# folder on the server). Both point at a scratch folder here, holding the files it must never hand out.
os.chdir(WORK_DIR)
for name, text in {"index.html": "<html></html>", "styles.css": "body{}", ".env": "BOT_TOKEN=secret", "server.py": "#"}.items():
    with open(name, "w") as f:
        f.write(text)
os.makedirs("uploads", exist_ok=True)
with open(os.path.join("uploads", "proof.png"), "wb") as f:
    f.write(b"png")

sys.path.insert(0, HERE)
import server  # noqa: E402

server.app.root_path = WORK_DIR


def init_data(user_id, *, auth_date=None, signature=None, sign_signature=True, token=BOT_TOKEN):
    """initData as Telegram sends it, signed with `token`."""
    fields = {
        "auth_date": str(auth_date if auth_date is not None else int(time.time())),
        "query_id": "AAH-test",
        "user": json.dumps({"id": user_id, "first_name": "Test"}),
    }
    if signature:
        fields["signature"] = signature
    hashed = fields if sign_signature else {k: v for k, v in fields.items() if k != "signature"}
    check = "\n".join(f"{k}={v}" for k, v in sorted(hashed.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def tma(data):
    return {"Authorization": f"tma {data}"}


class PromoBotTest(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def balance(self, user_id):
        with sqlite3.connect(server.DB_PATH) as conn:
            row = conn.execute("SELECT balance FROM users WHERE user_id = ?", (str(user_id),)).fetchone()
        return row[0] if row else None


class FilesTest(PromoBotTest):
    def test_serves_the_mini_app(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/styles.css").status_code, 200)

    def test_never_serves_settings_database_code_or_uploads(self):
        for path in ("/.env", "/database.db", "/database.db-wal", "/server.py", "/uploads/proof.png", "/../.env"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)


class SignInTest(PromoBotTest):
    def test_forged_init_data_is_refused(self):
        forged = init_data(2001, token="999:not-the-bot-token")
        self.assertEqual(self.client.post("/api/user/register", json={}, headers=tma(forged)).status_code, 401)
        unsigned = urlencode({"user": json.dumps({"id": 2001}), "auth_date": int(time.time()), "hash": "0" * 64})
        self.assertEqual(self.client.post("/api/user/register", json={}, headers=tma(unsigned)).status_code, 401)

    def test_genuine_init_data_signs_in(self):
        headers = tma(init_data(2002))
        self.assertEqual(self.client.post("/api/user/register", json={}, headers=headers).status_code, 200)
        res = self.client.get("/api/user/2002", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["user"]["free_points"], 50)

    def test_signature_field_signed_or_not(self):
        for signed in (True, False):
            with self.subTest(signature_hashed=signed):
                data = init_data(2003, signature="ed25519sig", sign_signature=signed)
                self.assertEqual(self.client.post("/api/user/register", json={}, headers=tma(data)).status_code, 200)

    def test_old_init_data_is_refused(self):
        stale = init_data(2004, auth_date=int(time.time()) - 2 * 24 * 3600)
        self.assertEqual(self.client.post("/api/user/register", json={}, headers=tma(stale)).status_code, 401)

    def test_cannot_read_someone_elses_account(self):
        self.client.post("/api/user/register", json={}, headers=tma(init_data(2005)))
        self.assertEqual(self.client.get("/api/user/2005", headers=tma(init_data(2006))).status_code, 401)


class TransferTest(PromoBotTest):
    def send(self, secret, user_id="3001", amount=5):
        headers = {"X-Transfer-Secret": secret} if secret is not None else {}
        return self.client.post("/api/internal/transfer_points", json={"user_id": user_id, "amount": amount}, headers=headers)

    def test_wrong_or_missing_secret_is_refused(self):
        self.assertEqual(self.send("wrong").status_code, 401)
        self.assertEqual(self.send(None).status_code, 401)
        self.assertIsNone(self.balance(3001))

    def test_right_secret_credits_the_wallet(self):
        with mock.patch.object(server.bot, "send_message"):
            self.assertEqual(self.send("test-transfer-secret", user_id="3002", amount=7).status_code, 200)
        self.assertEqual(self.balance(3002), 7)

    def test_nothing_accepted_while_no_secret_is_set(self):
        with mock.patch.object(server, "TRANSFER_SECRET_KEY", ""):
            self.assertEqual(self.send("").status_code, 503)
            self.assertEqual(self.send("anything").status_code, 503)


class WebhookTest(PromoBotTest):
    def post(self, secret):
        headers = {"X-Telegram-Bot-Api-Secret-Token": secret} if secret is not None else {}
        return self.client.post("/webhook", data=json.dumps({"update_id": 1}), content_type="application/json", headers=headers)

    def test_only_telegram_can_post_updates(self):
        self.assertEqual(self.post(None).status_code, 403)
        self.assertEqual(self.post("wrong").status_code, 403)
        with mock.patch.object(server.bot, "process_new_updates") as process:
            self.assertEqual(self.post("test-webhook-secret").status_code, 200)
        process.assert_called_once()


class DepositApprovalTest(PromoBotTest):
    def setUp(self):
        super().setUp()
        self.handler = server.bot.callback_query_handlers[0]["function"]
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute("INSERT OR IGNORE INTO users (user_id, balance, free_points) VALUES ('4001', 0, 50)")
            self.deposit = conn.execute(
                "INSERT INTO manual_deposits (user_id, amount, transaction_number, screenshot_path) VALUES ('4001', 100, 'FT1', 'x')"
            ).lastrowid

    def click(self, action, by):
        call = SimpleNamespace(
            id="cb", data=f"{action}_deposit_{self.deposit}", from_user=SimpleNamespace(id=by),
            message=SimpleNamespace(caption="Deposit", chat=SimpleNamespace(id=by), message_id=1),
        )
        with mock.patch.object(server.bot, "answer_callback_query") as answered, \
                mock.patch.object(server.bot, "edit_message_caption"), \
                mock.patch.object(server.bot, "send_message"):
            self.handler(call)
        return answered

    def status(self):
        with sqlite3.connect(server.DB_PATH) as conn:
            return conn.execute("SELECT status FROM manual_deposits WHERE id = ?", (self.deposit,)).fetchone()[0]

    def test_only_the_admin_can_approve_or_reject(self):
        before = self.balance(4001)
        for action in ("approve", "reject"):
            answered = self.click(action, by=4001)
            answered.assert_called_once_with("cb", "Only the admin can do this.")
        self.assertEqual(self.status(), "pending")
        self.assertEqual(self.balance(4001), before)

    def test_admin_approval_pays_once(self):
        before = self.balance(4001)
        self.click("approve", by=ADMIN)
        self.click("approve", by=ADMIN)
        self.assertEqual(self.status(), "approved")
        self.assertEqual(self.balance(4001), before + 100)

    def test_rejected_deposit_cannot_then_be_approved(self):
        before = self.balance(4001)
        self.click("reject", by=ADMIN)
        self.click("approve", by=ADMIN)
        self.assertEqual(self.status(), "rejected")
        self.assertEqual(self.balance(4001), before)


if __name__ == "__main__":
    unittest.main()
