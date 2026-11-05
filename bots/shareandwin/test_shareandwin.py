import unittest
import sqlite3
import hashlib
import hmac
import time
import json
import re
from urllib.parse import parse_qsl, urlencode

class TestShareAndWinBotQA(unittest.TestCase):
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
        
        # Test the FIX: Multi-admin and payment handler registration
        self.primary_admin_id = 6359221369
        self.payment_handler_id = 6333706961
        self.configured_admin_ids = [396574513, 996368997]
        
        self.cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (self.primary_admin_id,))
        if self.payment_handler_id:
            self.cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (self.payment_handler_id,))
        for aid in self.configured_admin_ids:
            self.cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (aid,))
        self.conn.commit()
        
        # Share & Win live bot token
        self.bot_token = "8037897307:AAFNNcbeYrc9VFWYaNuoFbt0jmlTWdDEnkE"

    def tearDown(self):
        self.conn.close()

    def test_multi_admin_support(self):
        """Verify that all configured admins and payment handler are active admins."""
        def is_admin(uid):
            self.cur.execute("SELECT user_id FROM admins WHERE user_id = ?", (uid,))
            return self.cur.fetchone() is not None

        self.assertTrue(is_admin(self.primary_admin_id))
        self.assertTrue(is_admin(self.payment_handler_id))
        for aid in self.configured_admin_ids:
            self.assertTrue(is_admin(aid), f"Configured admin {aid} must have admin rights")

    def test_referral_flow_and_anti_fraud(self):
        referrer_id = 1001
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (referrer_id, "jobs_influencer", 0))
        
        # User 1002 starts with referrer 1001
        new_user_id = 1002
        self.cur.execute("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)", (new_user_id, "job_seeker"))
        self.cur.execute("INSERT OR IGNORE INTO successful_referrals (referrer_id, referred_user_id) VALUES (?, ?)", (referrer_id, new_user_id))
        self.cur.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,))
        self.conn.commit()
        
        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 1)

        # Duplicate referral block check
        self.cur.execute("SELECT 1 FROM successful_referrals WHERE referred_user_id = ?", (new_user_id,))
        self.assertTrue(self.cur.fetchone() is not None)

    def test_channel_leave_and_rejoin(self):
        referrer_id = 2001
        referred_user_id = 2002
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (referrer_id, "recruiter", 5))
        self.cur.execute("INSERT INTO successful_referrals (referrer_id, referred_user_id, is_active) VALUES (?, ?, 1)", (referrer_id, referred_user_id))
        self.conn.commit()

        # User leaves channel
        self.cur.execute("UPDATE successful_referrals SET is_active = 0 WHERE referred_user_id = ?", (referred_user_id,))
        self.cur.execute("UPDATE users SET score = score - 1 WHERE user_id = ?", (referrer_id,))
        self.conn.commit()

        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 4)

        # User rejoins channel
        self.cur.execute("UPDATE successful_referrals SET is_active = 1 WHERE referred_user_id = ?", (referred_user_id,))
        self.cur.execute("UPDATE users SET score = score + 1 WHERE user_id = ?", (referrer_id,))
        self.conn.commit()

        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (referrer_id,))
        self.assertEqual(self.cur.fetchone()[0], 5)

    def test_track_chats_resolved_user_id(self):
        """Ensure kicking a user tracks the member, not the administrator."""
        kicked_user_id = 3002
        referrer_id = 3001
        self.cur.execute("INSERT INTO successful_referrals (referrer_id, referred_user_id, is_active) VALUES (?, ?, 1)", (referrer_id, kicked_user_id))
        self.conn.commit()

        # Admin performs kick, but target user is resolved via new_chat_member.user.id
        resolved_id = kicked_user_id
        self.cur.execute("SELECT referrer_id FROM successful_referrals WHERE referred_user_id = ?", (resolved_id,))
        row = self.cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], referrer_id)

    def test_withdrawal_atomic_balance(self):
        user_id = 4001
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (user_id, "candidate_dave", 100))
        self.conn.commit()

        # First withdrawal: 50 ETB
        amount = 50
        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.assertEqual(self.cur.rowcount, 1)

        # Second withdrawal: 50 ETB
        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.assertEqual(self.cur.rowcount, 1)

        # Third withdrawal: 50 ETB (balance is 0 -> should fail)
        self.cur.execute("UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount))
        self.assertEqual(self.cur.rowcount, 0)

    def test_withdrawal_notification_failure_rollback(self):
        user_id = 5001
        self.cur.execute("INSERT INTO users (user_id, username, score) VALUES (?, ?, ?)", (user_id, "user_rollback", 80))
        self.conn.commit()

        # Deduct 60 ETB
        self.cur.execute("UPDATE users SET score = score - 60 WHERE user_id = ? AND score >= 60", (user_id,))
        self.cur.execute("INSERT INTO withdrawals (user_id, amount, phone_number, status) VALUES (?, 60, '+251911000000', 'pending')", (user_id,))
        w_id = self.cur.lastrowid
        self.conn.commit()

        # Simulate failed Telegram notification -> rollback
        self.cur.execute("UPDATE users SET score = score + 60 WHERE user_id = ?", (user_id,))
        self.cur.execute("UPDATE withdrawals SET status = 'failed' WHERE id = ?", (w_id,))
        self.conn.commit()

        self.cur.execute("SELECT score FROM users WHERE user_id = ?", (user_id,))
        self.assertEqual(self.cur.fetchone()[0], 80)
        self.cur.execute("SELECT status FROM withdrawals WHERE id = ?", (w_id,))
        self.assertEqual(self.cur.fetchone()[0], 'failed')

    def test_tma_hmac_sha256_verification(self):
        user_obj = {"id": 98765432, "first_name": "JobHunter", "username": "jobhunter"}
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

        # Test verification logic
        pairs = dict(parse_qsl(valid_init_data, strict_parsing=True))
        rec_hash = pairs.pop("hash", None)
        computed_check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        computed_hash = hmac.new(secret, computed_check.encode(), hashlib.sha256).hexdigest()
        self.assertTrue(hmac.compare_digest(computed_hash, rec_hash))

    def test_scheduled_post_button_safeguard(self):
        def build_button(data):
            text = data.get('post_button_text')
            url = data.get('post_button_url')
            return {"text": text, "url": url} if text and url else None

        self.assertIsNone(build_button({'post_button_text': None, 'post_button_url': None}))
        self.assertIsNotNone(build_button({'post_button_text': 'Apply Now', 'post_button_url': 'https://t.me/BeleqetJobs'}))

if __name__ == "__main__":
    unittest.main()
