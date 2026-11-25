"""Checks the Promotion bot refuses what it must: forged Mini App sign-ins, its own files, fake
webhook calls, transfers without the shared secret, and deposit approvals from anyone but the admin.
And that it tells the right people when something is wrong: the customer when they can fix it, the
admin when only Beleqet can (an empty SMMLand balance, a missing key), with manual deposits offered
only once their account is set.

Run from this folder: python -m unittest test_promo_bot
"""
import hashlib
import hmac
import io
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
    "DATA_DIR": os.path.join(WORK_DIR, "data"),
    "TRANSFER_SECRET_KEY": "test-transfer-secret",
    "WEBHOOK_SECRET_TOKEN": "test-webhook-secret",
    "WEBHOOK_DOMAIN": "https://promo.example",
})
# The server serves files from its own folder, with its data/ folder inside it (the same layout as on
# the server). Both point at a scratch folder here, holding the files it must never hand out.
os.chdir(WORK_DIR)
for name, text in {"index.html": "<html></html>", "styles.css": "body{}", ".env": "BOT_TOKEN=secret", "server.py": "#"}.items():
    with open(name, "w") as f:
        f.write(text)
os.makedirs(os.path.join("data", "uploads"), exist_ok=True)
with open(os.path.join("data", "uploads", "proof.png"), "wb") as f:
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
        for path in ("/.env", "/data/promo.db", "/data/promo.db-wal", "/server.py", "/data/uploads/proof.png", "/../.env"):
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

    def test_approval_pays_the_inviter_on_a_first_deposit_of_50_or_more(self):
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, free_points, referral_earnings) VALUES ('4100', 0, 50, 0)")
            conn.execute(
                "INSERT OR REPLACE INTO users (user_id, balance, free_points, referred_by, has_deposited_for_referral) "
                "VALUES ('4101', 0, 50, '4100', 0)"
            )
            self.deposit = conn.execute(
                "INSERT INTO manual_deposits (user_id, amount, transaction_number, screenshot_path) VALUES ('4101', 60, 'FT2', 'x')"
            ).lastrowid
        self.click("approve", by=ADMIN)
        self.assertEqual(self.balance(4101), 60)
        self.assertEqual(self.balance(4100), 1)

    def approve_cbe_transfer(self, **jobs):
        """Approves a deposit paid with CBE transfer ft26329 ab12c while Beleqet Jobs answers `jobs`."""
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute("UPDATE manual_deposits SET transaction_number = 'ft26329 ab12c' WHERE id = ?", (self.deposit,))
        with mock.patch.object(server, "JOBS_API_URL", "http://jobs.example/api/v1"), \
                mock.patch.object(server, "BANK_REFERENCES_SECRET", "shared-secret"), \
                mock.patch.object(server.requests, "post", **jobs) as post:
            answered = self.click("approve", by=ADMIN)
        return post, answered

    def test_approval_records_the_transfer_with_jobs_first(self):
        before = self.balance(4001)
        post, _ = self.approve_cbe_transfer(return_value=mock.Mock(status_code=200))
        post.assert_called_once_with(
            "http://jobs.example/api/v1/bank-references/claim",
            json={"reference": "FT26329AB12C", "usedBy": f"promotion:{self.deposit}"},
            headers={"X-Bank-References-Secret": "shared-secret"},
            timeout=15,
        )
        self.assertEqual(self.status(), "approved")
        self.assertEqual(self.balance(4001), before + 100)

    def test_a_transfer_that_paid_for_a_jobs_plan_is_not_approved(self):
        before = self.balance(4001)
        jobs = mock.Mock(status_code=409, json=lambda: {"message": "FT26329AB12C already paid for another Jobs payment (p1)."})
        _, answered = self.approve_cbe_transfer(return_value=jobs)
        answered.assert_called_once_with(
            "cb", "FT26329AB12C already paid for another Jobs payment (p1). Reject this deposit.", show_alert=True
        )
        self.assertEqual(self.status(), "pending")
        self.assertEqual(self.balance(4001), before)

    def test_nothing_is_approved_while_jobs_cannot_be_asked(self):
        before = self.balance(4001)
        _, answered = self.approve_cbe_transfer(side_effect=server.requests.ConnectionError("down"))
        self.assertIn("nothing was approved", answered.call_args.args[1])
        self.assertEqual(self.status(), "pending")
        self.assertEqual(self.balance(4001), before)


class ConfigTest(PromoBotTest):
    def test_tells_the_page_the_bots_name_and_the_deposit_account_once_set(self):
        with mock.patch.object(server, "_bot_username", "BeleqetPromoTestBot"), \
                mock.patch.object(server, "MANUAL_DEPOSIT_ACCOUNT", ""), mock.patch.object(server, "MANUAL_DEPOSIT_NAME", ""):
            body = self.client.get("/api/config").get_json()
        self.assertEqual(body["bot_username"], "BeleqetPromoTestBot")
        self.assertIsNone(body["manual_deposit"])
        with mock.patch.object(server, "_bot_username", "BeleqetPromoTestBot"), \
                mock.patch.object(server, "MANUAL_DEPOSIT_ACCOUNT", "1000999"), mock.patch.object(server, "MANUAL_DEPOSIT_NAME", "Beleqet"):
            body = self.client.get("/api/config").get_json()
        self.assertEqual(body["manual_deposit"], {"bank": "CBE", "account": "1000999", "name": "Beleqet"})

    def test_no_placeholder_account(self):
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute("INSERT OR IGNORE INTO users (user_id, balance, free_points) VALUES ('default_user', 0, 50)")
        server.init_db()
        with sqlite3.connect(server.DB_PATH) as conn:
            self.assertIsNone(conn.execute("SELECT 1 FROM users WHERE user_id = 'default_user'").fetchone())

    def test_chapa_sends_customers_back_to_this_bot(self):
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO users (user_id, balance, free_points, first_name, last_name, email) "
                "VALUES ('7001', 0, 50, 'Abebe', 'Kebede', 'abebe@example.com')"
            )
        chapa = mock.Mock(json=lambda: {"status": "success", "data": {"checkout_url": "https://checkout.chapa.co/x"}})
        with mock.patch.object(server, "_bot_username", "BeleqetPromoTestBot"), \
                mock.patch.object(server.requests, "post", return_value=chapa) as post:
            res = self.client.post("/api/pay/initialize", json={"amount": 100}, headers=tma(init_data(7001)))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(post.call_args.kwargs["json"]["return_url"], "https://t.me/BeleqetPromoTestBot")


class ManualDepositTest(PromoBotTest):
    def submit(self):
        data = {"amount": "250", "transaction_number": "FT_99*X", "screenshot": (io.BytesIO(b"png"), "proof.png")}
        return self.client.post("/api/deposit/manual", data=data, headers=tma(init_data(5001)), content_type="multipart/form-data")

    def test_refused_until_an_account_is_set(self):
        with mock.patch.object(server, "MANUAL_DEPOSIT_ACCOUNT", ""), mock.patch.object(server.bot, "send_photo") as sent:
            self.assertEqual(self.submit().status_code, 503)
        sent.assert_not_called()

    def test_admin_is_told_who_sent_it_and_to_check_the_bank_first(self):
        with mock.patch.object(server, "MANUAL_DEPOSIT_ACCOUNT", "1000999"), mock.patch.object(server, "MANUAL_DEPOSIT_NAME", "Beleqet"), \
                mock.patch.object(server.bot, "send_photo") as sent:
            self.assertEqual(self.submit().status_code, 200)
        args, kwargs = sent.call_args
        self.assertEqual(args[0], str(ADMIN))
        self.assertIn("From: Test", kwargs["caption"])
        self.assertIn("Check that 250 ETB really arrived in the CBE account 1000999", kwargs["caption"])
        self.assertIn("FT_99*X", kwargs["caption"])
        self.assertNotIn("parse_mode", kwargs)  # plain text, so what users type can't break it


class SmmTest(PromoBotTest):
    SERVICES = [{"service": 1, "name": "Followers", "category": "Instagram Followers", "rate": "1.00", "min": 10, "max": 1000}]

    def setUp(self):
        super().setUp()
        server.services_cache, server.services_cache_time = [], 0
        server._last_alert.clear()
        with sqlite3.connect(server.DB_PATH) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, free_points, notifications) VALUES ('6001', 1000, 50, 0)")

    def fake_smmland(self, replies):
        def post(url, data=None, **kwargs):
            reply = replies[data["action"]]
            if isinstance(reply, Exception):
                raise reply
            return mock.Mock(json=lambda: reply)
        return post

    def order(self, add, balance="50"):
        replies = {"services": self.SERVICES, "add": add, "balance": {"balance": balance, "currency": "USD"}}
        with mock.patch.object(server.requests, "post", side_effect=self.fake_smmland(replies)), \
                mock.patch.object(server, "get_usd_to_etb_rate", return_value=100.0), \
                mock.patch.object(server.bot, "send_message") as alerts, \
                mock.patch.object(server.threading, "Thread", side_effect=lambda target, daemon: mock.Mock(start=target)):
            res = self.client.post(
                "/api/order", json={"service": 1, "link": "https://instagram.com/x", "quantity": 100}, headers=tma(init_data(6001))
            )
        return res, alerts

    def test_an_empty_smmland_account_is_for_the_admin_not_the_customer(self):
        res, alerts = self.order({"error": "Not enough funds on balance"})
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.get_json()["message"], server.SERVICE_UNAVAILABLE)
        self.assertEqual(self.balance(6001), 1000)
        self.assertEqual(alerts.call_args.args[0], str(ADMIN))
        self.assertIn("Not enough funds", alerts.call_args.args[1])

    def test_a_wrong_link_is_the_customers_to_fix(self):
        res, alerts = self.order({"error": "Incorrect link"})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.get_json()["message"], "Incorrect link")
        self.assertEqual(self.balance(6001), 1000)
        alerts.assert_not_called()

    def test_a_low_balance_after_an_order_warns_the_admin_once(self):
        res, alerts = self.order({"order": 777}, balance="3.50")
        self.assertEqual(res.status_code, 200)
        self.assertAlmostEqual(self.balance(6001), 1000 - 12)  # $1 per 1000 at 100 birr, plus 20%
        self.assertIn("low: 3.50 USD", alerts.call_args.args[1])
        _, alerts = self.order({"order": 778}, balance="3.40")
        alerts.assert_not_called()

    def test_without_services_the_page_is_told_and_so_is_the_admin(self):
        replies = {"services": {"error": "Invalid API key"}}
        with mock.patch.object(server.requests, "post", side_effect=self.fake_smmland(replies)), \
                mock.patch.object(server.bot, "send_message") as alerts:
            res = self.client.get("/api/services")
        self.assertEqual(res.status_code, 503)
        self.assertIn("unavailable", res.get_json()["message"])
        self.assertIn("Invalid API key", alerts.call_args.args[1])
        self.assertEqual(server.services_cache, [])  # an error isn't kept: the next visit asks again


if __name__ == "__main__":
    unittest.main()
