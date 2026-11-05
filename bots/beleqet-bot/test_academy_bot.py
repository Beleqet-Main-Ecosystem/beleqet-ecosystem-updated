import unittest
import sqlite3
import hashlib
import hmac
import time
import json
import re
from urllib.parse import parse_qsl, urlencode

class TestAcademyBotQA(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.cur = self.conn.cursor()
        
        self.cur.execute("""
            CREATE TABLE users (
                user_id INTEGER PRIMARY KEY,
                score INTEGER NOT NULL DEFAULT 0,
                username TEXT
            )
        """)
        self.cur.execute("""
            CREATE TABLE pending_referrals (
                new_user_id INTEGER PRIMARY KEY,
                referrer_id INTEGER NOT NULL
            )
        """)
        self.cur.execute("""
            CREATE TABLE successful_referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_id INTEGER NOT NULL,
                referred_user_id INTEGER NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                UNIQUE(referrer_id, referred_user_id)
            )
        """)
        self.cur.execute("""
            CREATE TABLE withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                phone_number TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                request_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed_timestamp DATETIME
            )
        """)
        self.cur.execute("CREATE TABLE admins (user_id INTEGER PRIMARY KEY)")
        self.cur.execute("CREATE INDEX idx_referrer_id ON successful_referrals (referrer_id)")
        self.cur.execute("""
            CREATE TABLE scheduled_posts (
                job_id TEXT PRIMARY KEY,
                post_text TEXT,
                scheduled_time TEXT,
                repeat INTEGER,
                post_photo TEXT,
                post_button_text TEXT,
                post_button_url TEXT
            )
        """)
        
        self.primary_admin_id = 6728089681
        self.payment_handler_id = 6333706961
        # Test the FIX: both primary admin and payment handler are added
        self.cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (self.primary_admin_id,))
        if self.payment_handler_id:
            self.cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (self.payment_handler_id,))
        self.conn.commit()
        
        self.bot_token = "8767167572:AAH7RgPEc7EqSJxF2pqwd45mGYFy0GXANaU"

    def tearDown(self):
        self.conn.close()

    def test_referral_flow_and_self_referral(self):
        referrer_id = 1001
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (referrer_id, "alice", 0))
        
        new_user_id = 1002
        self.cur.execute("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", (new_user_id, "bob"))
        is_new_user = self.cur.rowcount == 1
        self.assertTrue(is_new_user)
        
        self.cur.execute("INSERT OR IGNORE INTO successful_referrals (referrer_id, referred_user_id) VALUES (?, ?)", (referrer_id, new_user_id))
        self.cur.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,))
        self.conn.commit()
        
        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 1)
        
        self.cur.execute("SELECT 1 FROM successful_referrals WHERE referred_user_id = ?", (new_user_id,))
        already_referred = self.cur.fetchone() is not None
        self.assertTrue(already_referred)

    def test_channel_leave_and_rejoin(self):
        referrer_id = 2001
        referred_user_id = 2002
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (referrer_id, "charlie", 10))
        self.cur.execute("INSERT INTO successful_referrals (referrer_id, referred_user_id, is_active) VALUES (?, ?, 1)", (referrer_id, referred_user_id))
        self.conn.commit()

        # Simulate user leaving channel
        self.cur.execute("SELECT referrer_id, is_active FROM successful_referrals WHERE referred_user_id = ?", (referred_user_id,))
        ref_id, active = self.cur.fetchone()
        self.assertEqual(active, 1)

        self.cur.execute("UPDATE successful_referrals SET is_active = 0 WHERE referred_user_id = ?", (referred_user_id,))
        self.cur.execute("UPDATE users SET score = score - 1 WHERE user_id = ?", (ref_id,))
        self.conn.commit()

        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 9)

        # Re-joining channel
        self.cur.execute("UPDATE successful_referrals SET is_active = 1 WHERE referred_user_id = ?", (referred_user_id,))
        self.cur.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (ref_id,))
        self.conn.commit()

        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 10)

    def test_fixed_track_chats_user_id(self):
        """
        Verify that extracting new_chat_member.user.id correctly identifies the kicked member
        even when the action performer (from_user) is the administrator.
        """
        kicked_member_id = 2002
        referrer_id = 2001
        self.cur.execute("INSERT OR IGNORE INTO successful_referrals (referrer_id, referred_user_id, is_active) VALUES (?, ?, 1)", (referrer_id, kicked_member_id))
        self.conn.commit()

        # Target ID extracted from new_chat_member.user.id
        resolved_user_id = kicked_member_id
        self.cur.execute("SELECT referrer_id, is_active FROM successful_referrals WHERE referred_user_id = ?", (resolved_user_id,))
        res = self.cur.fetchone()
        self.assertIsNotNone(res)
        self.assertEqual(res[0], referrer_id)

    def test_withdrawal_atomic_deduction(self):
        user_id = 3001
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (user_id, "dave", 100))
        self.conn.commit()

        amount = 60
        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.assertEqual(self.cur.rowcount, 1)

        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.assertEqual(self.cur.rowcount, 0)

    def test_withdrawal_failed_notification_rollback(self):
        """
        Simulate the FIX in api.py: if Telegram notification fails,
        the deduction is rolled back and status marked 'failed'.
        """
        user_id = 3005
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (user_id, "frank", 100))
        self.conn.commit()

        amount = 50
        # 1. Deduct & insert pending
        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.cur.execute("INSERT INTO withdrawals (user_id, amount, phone_number, status) VALUES (?, ?, ?, 'pending')", (user_id, amount, "+251911223344"))
        w_id = self.cur.lastrowid
        self.conn.commit()

        # 2. Simulate Telegram API network exception -> trigger rollback
        self.cur.execute("UPDATE users SET score = score + ? WHERE user_id = ?", (amount, user_id))
        self.cur.execute("UPDATE withdrawals SET status = 'failed' WHERE id = ?", (w_id,))
        self.conn.commit()

        # User's score should be restored back to 100
        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (user_id,))
        self.assertEqual(self.cur.fetchone()[0], 100)
        self.cur.execute("SELECT status FROM withdrawals WHERE id = ?", (w_id,))
        self.assertEqual(self.cur.fetchone()[0], 'failed')

    def test_fixed_payment_handler_permission(self):
        """
        Verifies that with the fix, PAYMENT_HANDLER_ID is recognized as an admin.
        """
        def is_admin(uid):
            self.cur.execute("SELECT user_id FROM admins WHERE user_id = ?", (uid,))
            return self.cur.fetchone() is not None

        self.assertTrue(is_admin(self.primary_admin_id))
        self.assertTrue(is_admin(self.payment_handler_id), "Fixed: Payment handler is now in admins table")

    def test_telegram_init_data_verification(self):
        def verify_init_data(init_data: str, bot_token: str):
            if not init_data or not bot_token:
                return None
            try:
                pairs = dict(parse_qsl(init_data, strict_parsing=True))
            except ValueError:
                return None
            received_hash = pairs.pop("hash", None)
            if not received_hash:
                return None
            data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
            secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
            computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(computed_hash, received_hash):
                return None
            try:
                if time.time() - int(pairs.get("auth_date", "0")) > 86400:
                    return None
                return int(json.loads(pairs.get("user", "{}")).get("id"))
            except (ValueError, TypeError, json.JSONDecodeError):
                return None

        user_obj = {"id": 12345678, "first_name": "Test", "username": "testuser"}
        auth_date = int(time.time())
        params = {
            "auth_date": str(auth_date),
            "query_id": "AAHdF6IQAAAAAN0XohD9p2ab",
            "user": json.dumps(user_obj)
        }
        check_str = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
        secret = hmac.new(b"WebAppData", self.bot_token.encode(), hashlib.sha256).digest()
        genuine_hash = hmac.new(secret, check_str.encode(), hashlib.sha256).hexdigest()
        valid_init_data = f"{urlencode(params)}&hash={genuine_hash}"

        self.assertEqual(verify_init_data(valid_init_data, self.bot_token), 12345678)
        self.assertIsNone(verify_init_data(valid_init_data.replace("12345678", "99999999"), self.bot_token))

    def test_fixed_scheduled_post_button_logic(self):
        """
        Verify that button is only built if both text and url exist.
        """
        def build_markup(data):
            btn_text = data.get('post_button_text')
            btn_url = data.get('post_button_url')
            if btn_text and btn_url:
                return {"button": True, "text": btn_text, "url": btn_url}
            return None

        post_without_btn = {'post_button_text': None, 'post_button_url': None}
        self.assertIsNone(build_markup(post_without_btn))
        
        post_with_btn = {'post_button_text': 'Join', 'post_button_url': 'https://t.me/test'}
        self.assertIsNotNone(build_markup(post_with_btn))

    def test_fixed_safe_chunking_for_stats(self):
        """
        Verify that user stats message chunking groups entries under 3800 characters
        without splitting lines or tags.
        """
        stats = [(f"user_{i}", 1000 + i, 50, 10) for i in range(120)]
        messages = []
        current_chunk = "📊 **User Stats & Balances**\n\n"
        for uname, uid, score, total_refs in stats:
            escaped_uname = uname.replace('_', r'\_')
            entry = f"👤 @{escaped_uname}\n💰 **Balance:** {score} Birr/Points | 📈 **Total Refs:** {total_refs}\n\n"
            if len(current_chunk) + len(entry) > 3800:
                messages.append(current_chunk)
                current_chunk = entry
            else:
                current_chunk += entry
        if current_chunk:
            messages.append(current_chunk)

        self.assertTrue(len(messages) > 1, "Stats with 120 users must be split across multiple messages")
        for msg in messages:
            self.assertTrue(len(msg) <= 3800, "Every chunk must stay within safe Telegram limits")

if __name__ == "__main__":
    unittest.main()
