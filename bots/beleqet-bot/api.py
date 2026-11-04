from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from urllib.parse import parse_qsl
import aiosqlite
import hashlib
import hmac
import json
import logging
import os
import re
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# The Mini App proves who it is with the X-Telegram-Init-Data header, not cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# httpx logs every request URL at INFO, and Telegram URLs contain the bot token.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("referral-api")

DB_FILE = "referrals.db"
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
PROMO_BOT_API_URL = os.getenv("PROMO_BOT_API_URL", "https://beleqet-promo-miniapp.beleqet.com/api/internal/transfer_points")
TRANSFER_SECRET_KEY = os.getenv("TRANSFER_SECRET_KEY", "")
TRANSFER_SOURCE = "Beleqet Academy Bot"
MIN_TRANSFER_AMOUNT = 1
MIN_WITHDRAWAL_AMOUNT = 50
INIT_DATA_MAX_AGE_SECONDS = 24 * 3600
# Set to "false" only while the Mini App is being updated to send X-Telegram-Init-Data.
REQUIRE_TELEGRAM_AUTH = os.getenv("REQUIRE_TELEGRAM_AUTH", "true").lower() != "false"
PHONE_PATTERN = re.compile(r"^\+?[0-9]{9,15}$")


class WithdrawRequest(BaseModel):
    user_id: int
    amount: int
    phone_number: str


class TransferRequest(BaseModel):
    user_id: int
    amount: int


def verify_init_data(init_data: str, bot_token: str):
    """Returns the Telegram user id signed into the Mini App's initData, or None if it isn't genuine."""
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
        if time.time() - int(pairs.get("auth_date", "0")) > INIT_DATA_MAX_AGE_SECONDS:
            return None
        return int(json.loads(pairs.get("user", "{}")).get("id"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def require_user(user_id: int, init_data):
    """Only the signed-in Telegram user may read or spend their own balance."""
    if not REQUIRE_TELEGRAM_AUTH:
        return
    if verify_init_data(init_data or "", BOT_TOKEN) != user_id:
        raise HTTPException(status_code=401, detail="Open this from the Telegram bot to continue.")


async def deduct(db, user_id: int, amount: int) -> bool:
    """Takes `amount` from the balance in one statement, so two requests can't spend it twice."""
    cursor = await db.execute(
        "UPDATE users SET score = score - ? WHERE user_id = ? AND score >= ?", (amount, user_id, amount)
    )
    return cursor.rowcount == 1


async def balance_of(db, user_id: int) -> int:
    async with db.execute("SELECT score FROM users WHERE user_id = ?", (user_id,)) as cursor:
        row = await cursor.fetchone()
    return row[0] if row else 0


@app.get("/api/user/{user_id}/stats")
async def get_user_stats(user_id: int, x_telegram_init_data: str = Header(None)):
    require_user(user_id, x_telegram_init_data)
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            balance = await balance_of(db, user_id)
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ?", (user_id,)) as cursor:
                total_referrals = (await cursor.fetchone())[0]
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ? AND is_active = 1", (user_id,)) as cursor:
                active_referrals = (await cursor.fetchone())[0]
        return {"balance": balance, "totalReferrals": total_referrals, "activeReferrals": active_referrals}
    except Exception:
        log.exception("stats failed for %s", user_id)
        raise HTTPException(status_code=500, detail="Could not load your stats. Please try again.")


@app.post("/api/withdraw")
async def request_withdrawal(req: WithdrawRequest, x_telegram_init_data: str = Header(None)):
    require_user(req.user_id, x_telegram_init_data)
    if req.amount < MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal amount is {MIN_WITHDRAWAL_AMOUNT} ETB.")
    phone = req.phone_number.replace(" ", "").replace("-", "")
    if not PHONE_PATTERN.match(phone):
        raise HTTPException(status_code=400, detail="Enter a valid phone number.")

    try:
        async with aiosqlite.connect(DB_FILE) as db:
            if not await deduct(db, req.user_id, req.amount):
                current = await balance_of(db, req.user_id)
                raise HTTPException(status_code=400, detail=f"Insufficient balance. Your withdrawable balance is {current} ETB.")
            cursor = await db.execute(
                "INSERT INTO withdrawals (user_id, amount, phone_number, status) VALUES (?, ?, ?, 'pending')",
                (req.user_id, req.amount, phone),
            )
            withdrawal_id = cursor.lastrowid
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ? AND is_active = 1", (req.user_id,)) as t_cursor:
                active_referrals = (await t_cursor.fetchone())[0]
            await db.commit()

        admin_message = (
            f"🚨 **New Withdrawal Request #{withdrawal_id}** 🚨\n\n"
            f"From User ID: `{req.user_id}`\n"
            f"Amount: {req.amount} Birr\n"
            f"Phone: `{phone}`\n\n"
            f"✅ Database Report: {active_referrals} members currently active in channel."
        )
        # The bot reads the user and amount from the database when the admin decides; the button only names the request.
        keyboard = {
            "inline_keyboard": [[
                {"text": "Approve ✅", "callback_data": f"approve:{withdrawal_id}"},
                {"text": "Reject ❌", "callback_data": f"reject:{withdrawal_id}"},
            ]]
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    # Routed to the dedicated payment handler, or the primary admin if none is set.
                    "chat_id": os.getenv("PAYMENT_HANDLER_ID", os.getenv("ADMIN_ID")),
                    "text": admin_message,
                    "parse_mode": "Markdown",
                    "reply_markup": keyboard,
                },
            )
        return {"status": "success", "message": "Withdrawal requested successfully!"}
    except HTTPException:
        raise
    except Exception:
        log.exception("withdrawal failed for %s", req.user_id)
        raise HTTPException(status_code=500, detail="Your request could not be completed. Please try again.")


@app.post("/api/transfer")
async def transfer_points_to_promo(req: TransferRequest, x_telegram_init_data: str = Header(None)):
    require_user(req.user_id, x_telegram_init_data)
    if req.amount < MIN_TRANSFER_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum transfer amount is {MIN_TRANSFER_AMOUNT} ETB/Points.")
    if not TRANSFER_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Transfers are not available right now.")

    try:
        async with aiosqlite.connect(DB_FILE) as db:
            if not await deduct(db, req.user_id, req.amount):
                current = await balance_of(db, req.user_id)
                raise HTTPException(status_code=400, detail=f"Insufficient balance. Your spendable score is {current} ETB/Points.")
            await db.commit()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    PROMO_BOT_API_URL,
                    headers={"X-Transfer-Secret": TRANSFER_SECRET_KEY},
                    json={"user_id": str(req.user_id), "amount": req.amount, "source": TRANSFER_SOURCE},
                )
            if res.status_code != 200:
                raise Exception(f"promo bot answered {res.status_code}")
            response_data = res.json()
            if response_data.get("status") != "success":
                raise Exception(response_data.get("message", "Unknown transfer error"))
        except Exception as api_err:
            # Refund the deduction: the points never arrived on the other side.
            log.warning("transfer failed for %s (%s); refunding", req.user_id, api_err)
            try:
                async with aiosqlite.connect(DB_FILE) as db:
                    await db.execute("UPDATE users SET score = score + ? WHERE user_id = ?", (req.amount, req.user_id))
                    await db.commit()
            except Exception:
                log.critical("could not refund %s points to %s", req.amount, req.user_id, exc_info=True)
            raise HTTPException(status_code=502, detail="Transfer to Promo Bot failed. Your points have been refunded.")

        return {
            "status": "success",
            "message": f"Successfully transferred {req.amount} ETB/Points to your SMM Promo Bot balance!",
            "new_promo_balance": response_data.get("new_balance"),
        }
    except HTTPException:
        raise
    except Exception:
        log.exception("transfer failed for %s", req.user_id)
        raise HTTPException(status_code=500, detail="Your request could not be completed. Please try again.")
