from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import aiosqlite
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "referrals.db"
PROMO_BOT_API_URL = os.getenv("PROMO_BOT_API_URL", "https://beleqet-promo-miniapp.beleqet.com/api/internal/transfer_points")
TRANSFER_SECRET_KEY = os.getenv("TRANSFER_SECRET_KEY", "synthetic_transfer_secret_key_please_change_in_production")
MIN_TRANSFER_AMOUNT = 1

class WithdrawRequest(BaseModel):
    user_id: int
    amount: int
    phone_number: str

class TransferRequest(BaseModel):
    user_id: int
    amount: int

@app.get("/api/user/{user_id}/stats")
async def get_user_stats(user_id: int):
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            # 1. Get the actual spendable SCORE (withdrawable balance)
            async with db.execute("SELECT score FROM users WHERE user_id = ?", (user_id,)) as cursor:
                user_data = await cursor.fetchone()
                balance = user_data[0] if user_data else 0

            # 2. Get total lifetime referrals
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ?", (user_id,)) as cursor:
                total_referrals = (await cursor.fetchone())[0]

            # 3. Get currently active referrals (just for stats display)
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ? AND is_active = 1", (user_id,)) as cursor:
                active_referrals = (await cursor.fetchone())[0]

        return {
            "balance": balance, # Fixed! Now uses the database score
            "totalReferrals": total_referrals,
            "activeReferrals": active_referrals
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/withdraw")
async def request_withdrawal(req: WithdrawRequest):
    if req.amount < 50:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is 50 ETB.")
        
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            # 1. Check actual SCORE balance
            async with db.execute("SELECT score FROM users WHERE user_id = ?", (req.user_id,)) as cursor:
                user_data = await cursor.fetchone()
                current_balance = user_data[0] if user_data else 0
                
            if req.amount > current_balance:
                raise HTTPException(status_code=400, detail=f"Insufficient balance. Your withdrawable balance is {current_balance} ETB.")

            # 2. ?? CRITICAL FIX: Deduct the points IMMEDIATELY
            await db.execute("UPDATE users SET score = score - ? WHERE user_id = ?", (req.amount, req.user_id))

            # 3. Insert pending request
            cursor = await db.execute(
                "INSERT INTO withdrawals (user_id, amount, phone_number, status) VALUES (?, ?, ?, 'pending')", 
                (req.user_id, req.amount, req.phone_number)
            )
            withdrawal_id = cursor.lastrowid
            
            # Optional: grab active referrals for admin message context
            async with db.execute("SELECT COUNT(*) FROM successful_referrals WHERE referrer_id = ? AND is_active = 1", (req.user_id,)) as t_cursor:
                active_referrals = (await t_cursor.fetchone())[0]
            
            await db.commit()

        # Send Telegram notification to the Admin
        admin_message = (
            f"?? **New Withdrawal Request #{withdrawal_id}** ??\n\n"
            f"From User ID: `{req.user_id}`\n"
            f"Amount: {req.amount} Birr\n"
            f"Phone: `{req.phone_number}`\n\n"
            f"? Database Report: {active_referrals} members currently active in channel."
        )
        
        keyboard = {
            "inline_keyboard": [[
                {"text": "Approve ?", "callback_data": f"approve:{withdrawal_id}:{req.user_id}:{req.amount}"},
                {"text": "Reject ?", "callback_data": f"reject:{withdrawal_id}:{req.user_id}:{req.amount}"}
            ]]
        }

        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{os.getenv('BOT_TOKEN')}/sendMessage",
                json={
                    # 2. ROUTE TO DEDICATED PAYMENT HANDLER (Falls back to ADMIN_ID if missing)
                    "chat_id": os.getenv("PAYMENT_HANDLER_ID", os.getenv("ADMIN_ID")), 
                    "text": admin_message,
                    "parse_mode": "Markdown",
                    "reply_markup": keyboard
                }
            )
            
        return {"status": "success", "message": "Withdrawal requested successfully!"}
        
    except HTTPException:
        raise 
    except Exception as e:
        print(f"Withdrawal Error: {e}") 
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/api/transfer")
async def transfer_points_to_promo(req: TransferRequest):
    if req.amount < MIN_TRANSFER_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Minimum transfer amount is {MIN_TRANSFER_AMOUNT} ETB/Points.")
        
    try:
        async with aiosqlite.connect(DB_FILE) as db:
            # 1. Check current SCORE balance
            async with db.execute("SELECT score FROM users WHERE user_id = ?", (req.user_id,)) as cursor:
                user_data = await cursor.fetchone()
                current_balance = user_data[0] if user_data else 0
                
            if req.amount > current_balance:
                raise HTTPException(status_code=400, detail=f"Insufficient balance. Your spendable score is {current_balance} ETB/Points.")
                
            # 2. Deduct the points immediately from referrals.db
            await db.execute("UPDATE users SET score = score - ? WHERE user_id = ?", (req.amount, req.user_id))
            await db.commit()

        # 3. Call the Promo SMM Bot backend to transfer balance
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    PROMO_BOT_API_URL,
                    headers={"X-Transfer-Secret": TRANSFER_SECRET_KEY},
                    json={
                        "user_id": str(req.user_id),
                        "amount": req.amount,
                        "source": "Share & Win Bot"
                    }
                )
                
            if res.status_code != 200:
                error_detail = "Failed to transfer points to SMM Promo Bot."
                try:
                    error_detail = res.json().get("message", error_detail)
                except Exception:
                    pass
                raise Exception(f"Server error: {error_detail}")
                
            response_data = res.json()
            if response_data.get("status") != "success":
                raise Exception(response_data.get("message", "Unknown transfer error"))

        except Exception as api_err:
            # Rollback: Refund the points if the HTTP transfer request failed
            print(f"Transfer failed ({api_err}), rolling back deduction for user {req.user_id}...")
            try:
                async with aiosqlite.connect(DB_FILE) as db:
                    await db.execute("UPDATE users SET score = score + ? WHERE user_id = ?", (req.amount, req.user_id))
                    await db.commit()
            except Exception as rollback_err:
                print(f"CRITICAL: Failed to rollback score deduction for user {req.user_id}: {rollback_err}")
            raise HTTPException(status_code=502, detail=f"Transfer to Promo Bot failed: {str(api_err)}. Your points have been refunded.")
            
        return {
            "status": "success", 
            "message": f"Successfully transferred {req.amount} ETB/Points to your SMM Promo Bot balance!",
            "new_promo_balance": response_data.get("new_balance")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transfer Error: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")