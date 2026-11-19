#!/usr/bin/env python3
import sys
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "referrals.db")

def print_help():
    print("""
Beleqet Test Account Helper
---------------------------
Usage:
  py manage_test_accounts.py status <user_id>
      Check account status, current balance, and referral history.

  py manage_test_accounts.py reset <user_id>
      Completely wipe an account so the bot treats it as a BRAND NEW user.
      (Allows you to re-test the invite link /start <referrer_id>).

  py manage_test_accounts.py set-score <user_id> <amount>
      Set points/balance directly (e.g. 100) to test withdrawals immediately.

  py manage_test_accounts.py reset-referral <referrer_id> <referred_id>
      Remove only the link between referrer and referred user.
""")

def get_db():
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file not found at {DB_FILE}")
        sys.exit(1)
    return sqlite3.connect(DB_FILE)

def check_status(user_id: int):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT user_id, score, username FROM users WHERE user_id = ?", (user_id,))
    u = cur.fetchone()
    if not u:
        print(f"User {user_id} is NOT in the database (acts as a completely new user).")
        con.close()
        return

    print(f"\n--- User Status: {user_id} (@{u[2]}) ---")
    print(f"Balance / Score: {u[1]} ETB")
    
    cur.execute("SELECT referrer_id, is_active FROM successful_referrals WHERE referred_user_id = ?", (user_id,))
    ref = cur.fetchone()
    if ref:
        print(f"Referred by: {ref[0]} (Active in channel: {'Yes' if ref[1] == 1 else 'No'})")
    else:
        print("Referred by: None (Not referred by anyone)")

    cur.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ?", (user_id,))
    total_invited = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ? AND is_active = 1", (user_id,))
    active_invited = cur.fetchone()[0]
    print(f"Referrals Made: {total_invited} total ({active_invited} currently active in channel)")

    cur.execute("SELECT id, amount, phone_number, status, request_timestamp FROM withdrawals WHERE user_id = ?", (user_id,))
    withdrawals = cur.fetchall()
    print(f"Withdrawals: {len(withdrawals)} request(s)")
    for w in withdrawals:
        print(f"  - #{w[0]}: {w[1]} ETB to {w[2]} [{w[3]}] at {w[4]}")
    con.close()

def reset_user(user_id: int):
    con = get_db()
    cur = con.cursor()
    cur.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
    cur.execute("DELETE FROM successful_referrals WHERE referred_user_id = ?", (user_id,))
    cur.execute("DELETE FROM successful_referrals WHERE referrer_id = ?", (user_id,))
    cur.execute("DELETE FROM pending_referrals WHERE new_user_id = ?", (user_id,))
    cur.execute("DELETE FROM pending_referrals WHERE referrer_id = ?", (user_id,))
    cur.execute("DELETE FROM withdrawals WHERE user_id = ?", (user_id,))
    con.commit()
    con.close()
    print(f"\n[OK] User {user_id} has been completely wiped from referrals.db.")
    print("This Telegram account is now BRAND NEW to the bot and can be used to test invite links again.")

def set_score(user_id: int, score: int):
    con = get_db()
    cur = con.cursor()
    cur.execute("INSERT OR IGNORE INTO users (user_id, score) VALUES (?, ?)", (user_id, score))
    cur.execute("UPDATE users SET score = ? WHERE user_id = ?", (score, user_id))
    con.commit()
    con.close()
    print(f"\n[OK] Set user {user_id} balance to {score} ETB.")

def reset_referral_link(referrer_id: int, referred_id: int):
    con = get_db()
    cur = con.cursor()
    cur.execute("DELETE FROM successful_referrals WHERE referrer_id = ? AND referred_user_id = ?", (referrer_id, referred_id))
    cur.execute("DELETE FROM users WHERE user_id = ?", (referred_id,))
    con.commit()
    con.close()
    print(f"\n[OK] Reset referral link between {referrer_id} and {referred_id}.")

def main():
    if len(sys.argv) < 3:
        print_help()
        sys.exit(0)

    cmd = sys.argv[1].lower()
    try:
        uid = int(sys.argv[2])
    except ValueError:
        print("Error: user_id must be a number.")
        sys.exit(1)

    if cmd == "status":
        check_status(uid)
    elif cmd == "reset":
        reset_user(uid)
    elif cmd == "set-score":
        if len(sys.argv) < 4:
            print("Usage: py manage_test_accounts.py set-score <user_id> <amount>")
            sys.exit(1)
        score = int(sys.argv[3])
        set_score(uid, score)
    elif cmd == "reset-referral":
        if len(sys.argv) < 4:
            print("Usage: py manage_test_accounts.py reset-referral <referrer_id> <referred_id>")
            sys.exit(1)
        referred_id = int(sys.argv[3])
        reset_referral_link(uid, referred_id)
    else:
        print(f"Unknown command: {cmd}")
        print_help()

if __name__ == "__main__":
    main()
