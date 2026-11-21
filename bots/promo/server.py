import time
import logging
import requests
import sqlite3
import uuid
import hmac
import hashlib
from urllib.parse import parse_qsl
import json

from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
import os
from dotenv import load_dotenv
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

load_dotenv()

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Everything the bot writes (its database, the payment screenshots) lives in data/, which deploys
# never touch and the nightly backup copies. DATA_DIR moves it, for the tests.
DATA_DIR = os.getenv("DATA_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "promo.db")
ADMIN_ID = os.getenv("ADMIN_ID", "").strip()
WEBHOOK_DOMAIN = os.getenv("WEBHOOK_DOMAIN", "").strip().rstrip("/")
# Sent by Telegram with every webhook call, so nobody else can post fake updates.
WEBHOOK_SECRET_TOKEN = os.getenv("WEBHOOK_SECRET_TOKEN", "").strip()
# Shared with the referral bots; no transfers are accepted while it's unset.
TRANSFER_SECRET_KEY = os.getenv("TRANSFER_SECRET_KEY", "").strip()
INIT_DATA_MAX_AGE_SECONDS = 24 * 3600

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- File upload safety ---
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

GLOBAL_BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
if GLOBAL_BOT_TOKEN:
    bot = telebot.TeleBot(GLOBAL_BOT_TOKEN)
else:
    bot = None

SMM_API_URL = "https://smmland.com/api/v2"
SMM_API_KEY = os.getenv("SMM_API_KEY")

CHAPA_SECRET_KEY = os.getenv("CHAPA_SECRET_KEY")

PROFIT_MARGIN_PERCENT = 20
services_cache = []
services_cache_time = 0
SERVICES_CACHE_TTL = 1800  # 30 minutes

cached_exchange_rate = 160.0
last_exchange_rate_fetch = 0

def get_usd_to_etb_rate():
    global cached_exchange_rate, last_exchange_rate_fetch
    if time.time() - last_exchange_rate_fetch > 3600:
        try:
            res = requests.get("https://open.er-api.com/v6/latest/USD", timeout=10)
            data = res.json()
            if "rates" in data and "ETB" in data["rates"]:
                cached_exchange_rate = float(data["rates"]["ETB"])
                last_exchange_rate_fetch = time.time()
        except Exception as e:
            logger.warning("Error fetching live exchange rate: %s", e)
    return cached_exchange_rate

def get_services():
    global services_cache, services_cache_time
    if not services_cache or (time.time() - services_cache_time > SERVICES_CACHE_TTL):
        try:
            payload = {'key': SMM_API_KEY, 'action': 'services'}
            response = requests.post(SMM_API_URL, data=payload, timeout=15)
            services_cache = response.json()
            services_cache_time = time.time()
        except Exception as e:
            logger.warning("Error fetching services: %s", e)
            return []
    return services_cache

@app.route('/api/services', methods=['GET'])
def api_services():
    services = get_services()
    if not isinstance(services, list):
        return jsonify({"status": "error", "message": "Failed to fetch services."}), 500
    
    modified_services = []
    for srv in services:
        try:
            original_rate_usd = float(srv.get('rate', 0))
            current_rate = get_usd_to_etb_rate()
            new_rate_etb = (original_rate_usd * current_rate) * (1 + PROFIT_MARGIN_PERCENT / 100)
            srv_copy = dict(srv)
            srv_copy['rate'] = round(new_rate_etb, 4)
            modified_services.append(srv_copy)
        except (ValueError, TypeError):
            continue

    return jsonify({"status": "success", "services": modified_services})

def data_check_hash(fields, bot_token):
    """Telegram's hash of the Mini App's initData fields, keyed with the bot token."""
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(fields.items())
    )
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

def validate_telegram_data(auth_header):
    """The Telegram user in the Mini App's initData, or None if Telegram didn't sign it or it's too old."""
    if not auth_header or not auth_header.startswith("tma "):
        return None
    init_data = auth_header[4:].strip()
    try:
        parsed_data = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=False))
    except Exception as e:
        logger.warning("initData parse failed: %s", e)
        return None

    hash_value = parsed_data.pop('hash', None)
    if not hash_value:
        return None

    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        logger.error("BOT_TOKEN env var is missing!")
        return None

    # Accounts differ on whether `signature` is part of the hashed fields; either way only
    # Telegram (holding the bot token) can produce a match.
    without_signature = {k: v for k, v in parsed_data.items() if k != 'signature'}
    if not any(
        hmac.compare_digest(data_check_hash(fields, bot_token), hash_value)
        for fields in (parsed_data, without_signature)
    ):
        return None

    try:
        if time.time() - int(parsed_data.get('auth_date', '0')) > INIT_DATA_MAX_AGE_SECONDS:
            return None
        return json.loads(parsed_data.get('user', '{}'))
    except Exception:
        return None

def require_auth():
    auth_header = request.headers.get("Authorization")
    tg_user = validate_telegram_data(auth_header)
    if not tg_user:
        return None
    return str(tg_user.get("id"))

def get_db():
    """Get a database connection with WAL mode and row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            balance REAL DEFAULT 0.0,
            free_points INTEGER DEFAULT 50
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS manual_deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            amount REAL,
            transaction_number TEXT,
            screenshot_path TEXT,
            status TEXT DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    try:
        c.execute('ALTER TABLE users ADD COLUMN first_name TEXT')
        c.execute('ALTER TABLE users ADD COLUMN last_name TEXT')
        c.execute('ALTER TABLE users ADD COLUMN email TEXT')
    except sqlite3.OperationalError:
        pass 
    try:
        c.execute('ALTER TABLE users ADD COLUMN referred_by TEXT')
        c.execute('ALTER TABLE users ADD COLUMN has_deposited_for_referral BOOLEAN DEFAULT 0')
        c.execute('ALTER TABLE users ADD COLUMN referral_earnings REAL DEFAULT 0.0')
    except sqlite3.OperationalError:
        pass 
        
    try:
        c.execute('ALTER TABLE users ADD COLUMN notifications INTEGER DEFAULT 1')
    except sqlite3.OperationalError:
        pass 
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            service_id TEXT,
            link TEXT,
            quantity INTEGER,
            cost REAL,
            panel_order_id TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            tx_ref TEXT PRIMARY KEY,
            user_id TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending'
        )
    ''')
    c.execute('INSERT OR IGNORE INTO users (user_id, balance, free_points) VALUES (?, ?, ?)', ('default_user', 0.0, 50))
    conn.commit()
    conn.close()

init_db()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route('/api/internal/transfer_points', methods=['POST'])
def transfer_points():
    if not TRANSFER_SECRET_KEY:
        return jsonify({"status": "error", "message": "Transfers are not set up"}), 503
    secret = request.headers.get("X-Transfer-Secret")
    if not secret or not hmac.compare_digest(secret, TRANSFER_SECRET_KEY):
        return jsonify({"status": "error", "message": "Unauthorized: Invalid transfer secret key"}), 401
    
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("user_id", "")).strip()
    amount = data.get("amount", 0)
    source = data.get("source", "Referral Bot")
    
    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({"status": "error", "message": "Invalid transfer amount"}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid transfer amount"}), 400
        
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('SELECT balance, free_points FROM users WHERE user_id = ?', (user_id,))
        row = c.fetchone()
        if not row:
            c.execute('INSERT INTO users (user_id, balance, free_points) VALUES (?, ?, ?)', (user_id, amount, 50))
            new_balance = amount
        else:
            c.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (amount, user_id))
            new_balance = row[0] + amount
            
        tx_ref = f"transfer-{uuid.uuid4().hex[:8]}"
        c.execute(
            'INSERT INTO transactions (tx_ref, user_id, amount, status) VALUES (?, ?, ?, ?)',
            (tx_ref, user_id, amount, 'success')
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Database error during point transfer: %s", e)
        return jsonify({"status": "error", "message": "Database update failed"}), 500
    finally:
        conn.close()
        
    if bot:
        try:
            notification_msg = (
                f"🎉 *Transfer Received!*\n\n"
                f"You received *{amount} ETB* into your Promo balance from your *{source}* rewards!\n"
                f"💰 *Current Balance:* `{round(new_balance, 2)} ETB`\n\n"
                f"Your account is credited and ready for placing orders!"
            )
            bot.send_message(int(user_id), notification_msg, parse_mode='Markdown')
        except Exception as e:
            logger.warning("Could not send Telegram notification to transferred user %s: %s", user_id, e)
            
    return jsonify({
        "status": "success",
        "message": "Points transferred and balance credited successfully",
        "new_balance": round(new_balance, 2),
        "tx_ref": tx_ref
    }), 200

@app.route('/api/deposit/manual', methods=['POST'])
def manual_deposit():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    amount = request.form.get('amount')
    transaction_number = request.form.get('transaction_number')
    screenshot = request.files.get('screenshot')
    
    if not amount or not transaction_number or not screenshot:
        return jsonify({"status": "error", "message": "Missing required fields."}), 400
        
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({"status": "error", "message": "Invalid amount."}), 400
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid amount."}), 400
    
    # Validate uploaded file: extension and size
    if not screenshot.filename or not allowed_file(screenshot.filename):
        return jsonify({"status": "error", "message": "Invalid file type. Only PNG, JPG, JPEG, GIF, WEBP allowed."}), 400
    
    screenshot.seek(0, os.SEEK_END)
    file_size = screenshot.tell()
    screenshot.seek(0)
    if file_size > MAX_FILE_SIZE:
        return jsonify({"status": "error", "message": "File too large. Maximum size is 5 MB."}), 400
        
    filename = secure_filename(f"{user_id}_{int(time.time())}_{screenshot.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    screenshot.save(filepath)
    
    conn = get_db()
    c = conn.cursor()
    c.execute(
        'INSERT INTO manual_deposits (user_id, amount, transaction_number, screenshot_path) VALUES (?, ?, ?, ?)',
        (user_id, amount, transaction_number, filepath)
    )
    deposit_id = c.lastrowid
    conn.commit()
    conn.close()
    
    if bot:
        markup = InlineKeyboardMarkup()
        markup.add(
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_deposit_{deposit_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_deposit_{deposit_id}")
        )
        caption = f"🧾 *New Manual Deposit Request*\n\nUser ID: `{user_id}`\nAmount: `{amount} ETB`\nTxn Number: `{transaction_number}`"
        try:
            with open(filepath, 'rb') as photo:
                bot.send_photo(ADMIN_ID, photo, caption=caption, parse_mode='Markdown', reply_markup=markup)
        except Exception as e:
            logger.error("Failed to send manual deposit to admin: %s", e)
            
    return jsonify({"status": "success", "message": "Deposit request submitted successfully! Pending admin approval."})

@app.route('/api/order', methods=['POST'])
def create_order():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.json
    service_id = str(data.get('service'))
    link = data.get('link')
    payment_type = data.get('payment_type', 'balance')
    
    try:
        quantity = int(data.get('quantity', 100))
        if quantity < 1:
            return jsonify({"status": "error", "message": "Quantity must be at least 1."}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid quantity."}), 400

    services = get_services()
    if not isinstance(services, list):
        return jsonify({"status": "error", "message": "Could not fetch service list."}), 500

    selected_service = next((s for s in services if str(s.get('service')) == service_id), None)
    
    if not selected_service:
        return jsonify({"status": "error", "message": "The selected service was not found."}), 400

    try:
        original_rate_usd = float(selected_service.get('rate', 0))
        current_rate = get_usd_to_etb_rate()
        new_rate_etb = (original_rate_usd * current_rate) * (1 + PROFIT_MARGIN_PERCENT / 100)
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "The service price is invalid."}), 400

    conn = get_db()
    c = conn.cursor()

    c.execute('SELECT balance, free_points FROM users WHERE user_id = ?', (user_id,))
    row = c.fetchone()
    if not row:
        c.execute('INSERT INTO users (user_id, balance, free_points) VALUES (?, ?, ?)', (user_id, 0.0, 50))
        balance, free_points = 0.0, 50
    else:
        balance, free_points = row[0], row[1]
    
    if payment_type == 'balance':
        cost = (quantity * new_rate_etb) / 1000
        if balance < cost:
            conn.close()
            return jsonify({"status": "error", "message": "Insufficient balance! Please use 'Add Fund' to top up."}), 400
        c.execute('UPDATE users SET balance = balance - ? WHERE user_id = ?', (cost, user_id))
    else:
        cost = 0
        required_points = quantity * 2
        if free_points < required_points:
            conn.close()
            return jsonify({"status": "error", "message": "Insufficient free points!"}), 400
        c.execute('UPDATE users SET free_points = free_points - ? WHERE user_id = ?', (required_points, user_id))

    payload = {
        'key': SMM_API_KEY,
        'action': 'add',
        'service': service_id,
        'link': link,
        'quantity': quantity
    }

    try:
        response = requests.post(SMM_API_URL, data=payload, timeout=15)
        res_json = response.json()
        if 'order' in res_json:
            panel_order_id = str(res_json['order'])
            c.execute('''
                INSERT INTO orders (user_id, service_id, link, quantity, cost, panel_order_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, service_id, link, quantity, cost, panel_order_id))
            
            # Send notification if enabled
            c.execute('SELECT notifications FROM users WHERE user_id = ?', (user_id,))
            notif_row = c.fetchone()
            if notif_row and notif_row[0] == 1:
                bot_token = os.getenv("BOT_TOKEN")
                if bot_token:
                    try:
                        msg_text = f"🎉 *Order Placed Successfully!*\n\n*Service:* {selected_service.get('name', 'N/A')}\n*Link:* {link}\n*Quantity:* {quantity}\n*Charge:* ETB {cost:.2f}\n*Order ID:* {panel_order_id}"
                        requests.post(f"https://api.telegram.org/bot{bot_token}/sendMessage", json={
                            "chat_id": str(user_id),
                            "text": msg_text,
                            "parse_mode": "Markdown"
                        }, timeout=5)
                    except Exception:
                        pass
                        
            conn.commit()
            conn.close()
            return jsonify({"status": "success", "order_id": panel_order_id})
        else:
            conn.rollback()
            conn.close()
            return jsonify({"status": "error", "message": res_json.get('error', 'Order error occurred')}), 400
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/user/register', methods=['POST'])
def register_user():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.json
    start_param = data.get('start_param')

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
    row = c.fetchone()
    
    if not row:
        referred_by = None
        if start_param and str(start_param) != str(user_id):
            c.execute('SELECT user_id FROM users WHERE user_id = ?', (start_param,))
            if c.fetchone():
                referred_by = str(start_param)
                
        c.execute('INSERT INTO users (user_id, balance, free_points, referred_by) VALUES (?, ?, ?, ?)', (user_id, 0.0, 50, referred_by))
        conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    auth_user = require_auth()
    if not auth_user or auth_user != user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT balance, free_points, first_name, last_name, email, referral_earnings, notifications FROM users WHERE user_id = ?', (user_id,))
    row = c.fetchone()
    
    c.execute('SELECT COUNT(*) FROM users WHERE referred_by = ?', (user_id,))
    referred_count = c.fetchone()[0]
    conn.close()
    
    if row:
        return jsonify({
            "status": "success",
            "user": {
                "balance": row[0],
                "free_points": row[1],
                "first_name": row[2] or "",
                "last_name": row[3] or "",
                "email": row[4] or "",
                "referral_earnings": row[5] or 0.0,
                "notifications": bool(row[6] if row[6] is not None else 1),
                "referred_count": referred_count
            }
        })
    else:
        return jsonify({"status": "error", "message": "User not found"}), 404

@app.route('/api/user/profile', methods=['POST'])
def update_profile():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.json
    
    first_name = str(data.get('first_name', '')).strip().title()
    last_name = str(data.get('last_name', '')).strip().title()
    email = str(data.get('email', '')).strip().lower()
    
    if not first_name or not last_name or not email:
        return jsonify({"status": "error", "message": "Please provide all details"}), 400
        
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT OR IGNORE INTO users (user_id, balance, free_points) VALUES (?, ?, ?)', (user_id, 0.0, 50))
    c.execute('''
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ? 
        WHERE user_id = ?
    ''', (first_name, last_name, email, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Profile updated!"})

@app.route('/api/user/notifications', methods=['POST'])
def update_notifications():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.json
    enabled = data.get('enabled', True)
        
    conn = get_db()
    c = conn.cursor()
    c.execute('UPDATE users SET notifications = ? WHERE user_id = ?', (1 if enabled else 0, user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/pay/initialize', methods=['POST'])
def initialize_payment():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.json
    amount = float(data.get('amount', 0))
    
    if amount < 10:
        return jsonify({"status": "error", "message": "Minimum amount is 10 ETB"}), 400
        
    tx_ref = f"beleqet-{uuid.uuid4().hex[:10]}"
    
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT first_name, last_name, email FROM users WHERE user_id = ?', (user_id,))
    user_row = c.fetchone()
    
    if not user_row or not user_row[2]:
        conn.close()
        return jsonify({"status": "error", "message": "Please complete your profile first."}), 400
        
    first_name, last_name, email = user_row[0], user_row[1], user_row[2]
    
    c.execute('INSERT INTO transactions (tx_ref, user_id, amount, status) VALUES (?, ?, ?, ?)', (tx_ref, user_id, amount, 'pending'))
    conn.commit()
    conn.close()
    headers = {
        "Authorization": f"Bearer {CHAPA_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "amount": amount,
        "currency": "ETB",
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "tx_ref": tx_ref,
        "custom_title": "Add Funds",
        "return_url": "https://t.me/Beleqet_PromotionBot"
    }
    
    try:
        res = requests.post("https://api.chapa.co/v1/transaction/initialize", json=payload, headers=headers, timeout=15)
        res_json = res.json()
        if res_json.get("status") == "success":
            return jsonify({"status": "success", "checkout_url": res_json["data"]["checkout_url"]})
        else:
            chapa_msg = res_json.get("message", "Unknown Chapa error")
            logger.error("Chapa Init Error: %s", res_json)
            return jsonify({"status": "error", "message": f"Chapa Error: {chapa_msg}"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def process_referral_reward(user_id, amount, c):
    if amount >= 50:
        c.execute('SELECT referred_by, has_deposited_for_referral FROM users WHERE user_id = ?', (user_id,))
        user_row = c.fetchone()
        if user_row and user_row[0] and not user_row[1]:
            referrer_id = user_row[0]
            c.execute('UPDATE users SET balance = balance + 1, referral_earnings = referral_earnings + 1 WHERE user_id = ?', (referrer_id,))
            c.execute('UPDATE users SET has_deposited_for_referral = 1 WHERE user_id = ?', (user_id,))

@app.route('/api/pay/webhook', methods=['POST'])
def payment_webhook():
    """Chapa Webhook"""
    chapa_signature = request.headers.get('Chapa-Signature')
    if not chapa_signature:
        return jsonify({"status": "error", "message": "No signature"}), 401
        
    expected_sig = hmac.new(CHAPA_SECRET_KEY.encode() if CHAPA_SECRET_KEY else b"", request.data, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, chapa_signature):
        return jsonify({"status": "error", "message": "Invalid signature"}), 401

    data = request.json
    if not data or data.get("status") != "success":
        return jsonify({"status": "ignored"}), 200
        
    tx_ref = data.get("tx_ref")
    
    headers = {"Authorization": f"Bearer {CHAPA_SECRET_KEY}"}
    try:
        verify_res = requests.get(f"https://api.chapa.co/v1/transaction/verify/{tx_ref}", headers=headers, timeout=15)
        verify_data = verify_res.json()
        if verify_data.get("status") != "success":
            return jsonify({"status": "unverified"}), 400
    except Exception:
        return jsonify({"status": "error"}), 500

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT user_id, amount, status FROM transactions WHERE tx_ref = ?', (tx_ref,))
    row = c.fetchone()
    
    if row and row[2] == 'pending':
        user_id, amount = row[0], row[1]
        c.execute('UPDATE transactions SET status = ? WHERE tx_ref = ? AND status = ?', ('success', tx_ref, 'pending'))
        if c.rowcount > 0:
            c.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (amount, user_id))
            process_referral_reward(user_id, amount, c)
            conn.commit()
        
    conn.close()
    return jsonify({"status": "received"}), 200

@app.route('/api/pay/verify_pending/<user_id>', methods=['GET'])
def verify_pending_payments(user_id):
    """Manually check all pending transactions for a user with Chapa."""
    auth_user = require_auth()
    if not auth_user or auth_user != user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT tx_ref, amount FROM transactions WHERE user_id = ? AND status = ?', (user_id, 'pending'))
    pending_txs = c.fetchall()
    
    verified_count = 0
    headers = {"Authorization": f"Bearer {CHAPA_SECRET_KEY}"}
    
    for tx_ref, amount in pending_txs:
        try:
            res = requests.get(f"https://api.chapa.co/v1/transaction/verify/{tx_ref}", headers=headers, timeout=10)
            data = res.json()
            if data.get("status") == "success":
                c.execute('UPDATE transactions SET status = ? WHERE tx_ref = ? AND status = ?', ('success', tx_ref, 'pending'))
                if c.rowcount > 0:
                    c.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (amount, user_id))
                    process_referral_reward(user_id, amount, c)
                    verified_count += 1
        except Exception as e:
            logger.warning("Error verifying pending tx: %s", e)
            continue
            
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "verified_count": verified_count}), 200

@app.route('/api/orders/<user_id>', methods=['GET'])
def get_orders(user_id):
    auth_user = require_auth()
    if not auth_user or auth_user != user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id, service_id, link, quantity, cost, status, panel_order_id FROM orders WHERE user_id = ? ORDER BY id DESC', (user_id,))
    rows = c.fetchall()
    conn.close()
    
    orders = []
    for row in rows:
        orders.append({
            "id": row[0],
            "service_id": row[1],
            "link": row[2],
            "quantity": row[3],
            "cost": row[4],
            "status": row[5],
            "panel_order_id": row[6]
        })
        
    return jsonify({"status": "success", "orders": orders})

@app.route('/api/transactions/<user_id>', methods=['GET'])
def get_transactions(user_id):
    auth_user = require_auth()
    if not auth_user or auth_user != user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT tx_ref, amount, status FROM transactions WHERE user_id = ? ORDER BY rowid DESC', (user_id,))
    rows = c.fetchall()
    
    c.execute('SELECT transaction_number, amount, status FROM manual_deposits WHERE user_id = ? ORDER BY id DESC', (user_id,))
    manual_rows = c.fetchall()
    
    conn.close()
    
    transactions = []
    for row in rows:
        transactions.append({
            "tx_ref": row[0],
            "amount": row[1],
            "status": row[2]
        })
        
    for m_row in manual_rows:
        transactions.append({
            "tx_ref": "CBE: " + str(m_row[0]),
            "amount": m_row[1],
            "status": m_row[2]
        })
        
    return jsonify({"status": "success", "transactions": transactions})


@app.route('/api/orders/sync', methods=['POST'])
def sync_orders():
    user_id = require_auth()
    if not user_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
        
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, panel_order_id, cost FROM orders WHERE user_id = ? AND status IN ('pending', 'Processing', 'In progress')", (user_id,))
    pending_orders = c.fetchall()
    
    if not pending_orders:
        conn.close()
        return jsonify({"status": "success", "message": "No pending orders."})
        
    order_ids = ",".join([p[1] for p in pending_orders])
    
    payload = {
        'key': SMM_API_KEY,
        'action': 'status',
        'orders': order_ids
    }
    try:
        res = requests.post(SMM_API_URL, data=payload, timeout=15)
        res_data = res.json()
        
        updated_count = 0
        refund_amount = 0
        
        for local_id, panel_id, cost in pending_orders:
            if panel_id in res_data:
                panel_status = res_data[panel_id].get('status', 'Pending')
                # If canceled, refund
                if panel_status.lower() in ['canceled', 'partial']:
                    if panel_status.lower() == 'canceled':
                        c.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (cost, user_id))
                        refund_amount += cost
                    elif panel_status.lower() == 'partial':
                        charge = float(res_data[panel_id].get('charge', 0))
                        # Simplistic refund logic for partial
                        refund = max(0, cost - charge)
                        if refund > 0:
                            c.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (refund, user_id))
                            refund_amount += refund
                            
                if panel_status != 'pending':
                    c.execute('UPDATE orders SET status = ? WHERE id = ?', (panel_status, local_id))
                    updated_count += 1
                    
        conn.commit()
    except Exception as e:
        logger.error("Sync error: %s", e)
    finally:
        conn.close()
        
    return jsonify({"status": "success", "updated": updated_count, "refunded": refund_amount})


# The Mini App is these two files. Nothing else in this folder (.env, the code, data/ with the
# database and the payment screenshots) is ever served.
PUBLIC_FILES = {'index.html', 'styles.css'}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if path not in PUBLIC_FILES:
        abort(404)
    return send_from_directory('.', path)

# --- TELEGRAM BOT HANDLERS & WEBHOOK ---

@app.route('/set_webhook', methods=['GET'])
def set_webhook():
    if not bot:
        return "Bot token not configured", 500
    if not WEBHOOK_DOMAIN:
        return "WEBHOOK_DOMAIN env var not set", 500
    if not WEBHOOK_SECRET_TOKEN:
        return "WEBHOOK_SECRET_TOKEN env var not set", 500
    webhook_url = f"{WEBHOOK_DOMAIN}/webhook"
    bot.remove_webhook()
    success = bot.set_webhook(url=webhook_url, secret_token=WEBHOOK_SECRET_TOKEN)
    if success:
        return f"Webhook set successfully to {webhook_url}", 200
    else:
        return "Failed to set webhook", 500

@app.route('/webhook', methods=['POST'])
def webhook():
    if not bot:
        return "Bot not configured", 500
    received = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
    if not WEBHOOK_SECRET_TOKEN or not hmac.compare_digest(received, WEBHOOK_SECRET_TOKEN):
        return "Forbidden", 403
    if request.headers.get('content-type') == 'application/json':
        json_string = request.get_data().decode('utf-8')
        update = telebot.types.Update.de_json(json_string)
        bot.process_new_updates([update])
        return '', 200
    else:
        return "Forbidden", 403

if bot:
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        user_id = message.chat.id
        markup = InlineKeyboardMarkup(row_width=1)
        
        bot_username = bot.get_me().username
        
        start_param = ""
        parts = message.text.split()
        if len(parts) > 1:
            start_param = f"&start_param={parts[1]}"
            
        web_app_url = f"{WEBHOOK_DOMAIN}/?bot={bot_username}{start_param}"
        
        markup.add(
            InlineKeyboardButton("🚀 Open Beleqet Promotion App", web_app=telebot.types.WebAppInfo(web_app_url)),
            InlineKeyboardButton("🎁 ነፃ ገንዘብ/ሪፈራል (Earn Cash & Points)", callback_data="earn_free"),
            InlineKeyboardButton("💳 አካውንት ለመሙላት (Add Funds)", callback_data="add_funds"),
            InlineKeyboardButton("📢 Join Official Channel", url="https://t.me/BeleqetJobs"),
            InlineKeyboardButton("🎧 Contact Support", url="https://t.me/Beleqet")
        )
        
        welcome_text = (
            "**እንኳን ወደ Beleqet Promotion በደህና መጡ!** 🚀\n\n"
            """እዚህ ጋር ሁለት ትልልቅ ዕድሎች ይጠብቁዎታል፡

1️⃣ ንግድዎን እና ሶሻል ሚዲያዎን ማሳደግ ይፈልጋሉ?
ምርትዎን ለብዙ ሚሊዮኖች ማድረስ፣ ገጽዎን ተአማኒ ማድረግ እና ሽያጭዎን በከፍተኛ ሁኔታ ማሳደግ የሚያስችሉ ዘመናዊ መሣሪያዎች!\n

2️⃣ ያለ ምንም ኢንቨስትመንት በስልክዎ ገቢ ማግኘት ይፈልጋሉ?
ሰዎችን በመጋበዝ ብቻ በየቀኑ አስተማማኝ የኪስ ገንዘብ እና ነፃ የፕሮሞሽን ነጥቦችን ይሰብስቡ!\n\n """
            "**አገልግሎቶቻችን፦**\n"
            "📱 TikTok: Followers, Likes, & Shares\n"
            "📱 Instagram: Followers & Engagement\n"
            "📱 Telegram: Members, Views & Stars\n"
            "📱 Facebook: Page Like, Follower, Views\n"
            "📱 YouTube: Subscribers, Views, Live Stream\n\n"
            "ከታች ያለውን **'Open Beleqet Promotion App'** በመጫን ስራውን ይጀምሩ!"
        )
        bot.send_message(user_id, welcome_text, parse_mode="Markdown", reply_markup=markup)

    @bot.message_handler(commands=['invite'])
    def send_invite(message):
        share_link = f"https://t.me/{bot.get_me().username}?start={message.chat.id}"
        share_url = f"https://t.me/share/url?url={share_link}&text=Join%20Beleqet%20Promotion%20and%20earn%20together!"
        
        markup = InlineKeyboardMarkup()
        markup.add(InlineKeyboardButton("📤 Share Link to Friends", url=share_url))
        
        bot.send_message(
            message.chat.id,
            f"🎁 **ጓደኛዎን በመጋበዝ 1 ETB ያግኙ!**\n\nይህንን ሊንክ ለጓደኛዎ ይላኩ:\n`{share_link}`",
            parse_mode="Markdown",
            reply_markup=markup
        )

    @bot.callback_query_handler(func=lambda call: True)
    def handle_query(call):
        if call.data == "earn_free":
            bot.answer_callback_query(call.id)
            share_link = f"https://t.me/{bot.get_me().username}?start={call.message.chat.id}"
            share_url = f"https://t.me/share/url?url={share_link}&text=Join%20Beleqet%20Promotion%20and%20earn%20together!"
            
            share_markup = InlineKeyboardMarkup()
            share_markup.add(InlineKeyboardButton("📤 Share Link to Friends", url=share_url))
            
            bot.send_message(
                call.message.chat.id,
                "🎁 **ነፃ ነጥብ እና ገንዘብ ማሰባሰቢያ መንገድ:**\n\n"
                "1. ጓደኞችዎን በመጋበዝ (Referral)\n"
                "2. ጓደኛዎ ሲመዘገብና ሲሞላ 1 ETB ያግኙ!\n\n"
                f"ይህንን ሊንክ ለጓደኛዎ ይላኩ:\n`{share_link}`",
                parse_mode="Markdown",
                reply_markup=share_markup
            )
        elif call.data == "add_funds":
            bot.answer_callback_query(call.id)
            bot.send_message(
                call.message.chat.id,
                "💳 **የክፍያ አማራጮች (Chapa):**\n"
                "በሚኒ አፑ ውስጥ 'Add Fund' የሚለውን በመጫን በቴሌብር (Telebirr) ወይም በባንክ አካውንትዎን በራስ ሰር መሙላት ይችላሉ።"
            )
        elif call.data.startswith(("approve_deposit_", "reject_deposit_")) and str(call.from_user.id) != ADMIN_ID:
            # The buttons are only on the admin's copy, but a crafted callback can come from anyone.
            bot.answer_callback_query(call.id, "Only the admin can do this.")
        elif call.data.startswith("approve_deposit_"):
            deposit_id = call.data.split("_")[-1]
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT user_id, amount, status FROM manual_deposits WHERE id = ?", (deposit_id,))
            row = c.fetchone()
            # Only the click that moves it out of 'pending' credits the balance, so a double click pays once.
            if row and row[2] == 'pending' and c.execute(
                "UPDATE manual_deposits SET status = 'approved' WHERE id = ? AND status = 'pending'", (deposit_id,)
            ).rowcount == 1:
                user_id, amount = row[0], row[1]
                c.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, user_id))
                conn.commit()
                bot.edit_message_caption(
                    caption=f"{call.message.caption}\n\n✅ *Status: APPROVED*", 
                    chat_id=call.message.chat.id, 
                    message_id=call.message.message_id, 
                    parse_mode='Markdown'
                )
                try:
                    bot.send_message(user_id, f"✅ Your manual deposit of {amount} ETB has been APPROVED and added to your balance!")
                except Exception:
                    pass
            else:
                bot.answer_callback_query(call.id, "Already processed or not found.")
            conn.close()
            
        elif call.data.startswith("reject_deposit_"):
            deposit_id = call.data.split("_")[-1]
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT user_id, status FROM manual_deposits WHERE id = ?", (deposit_id,))
            row = c.fetchone()
            if row and row[1] == 'pending' and c.execute(
                "UPDATE manual_deposits SET status = 'rejected' WHERE id = ? AND status = 'pending'", (deposit_id,)
            ).rowcount == 1:
                user_id = row[0]
                conn.commit()
                bot.edit_message_caption(
                    caption=f"{call.message.caption}\n\n❌ *Status: REJECTED*", 
                    chat_id=call.message.chat.id, 
                    message_id=call.message.message_id, 
                    parse_mode='Markdown'
                )
                try:
                    bot.send_message(user_id, "❌ Your manual deposit request has been REJECTED. Please contact admin if this is a mistake.")
                except Exception:
                    pass
            else:
                bot.answer_callback_query(call.id, "Already processed or not found.")
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)