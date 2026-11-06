import os
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from urllib.parse import parse_qsl

import aiosqlite
from aiohttp import web

logger = logging.getLogger(__name__)

# bots/job/sgs_challenge.db, wherever the bot is started from (it used to follow the working folder).
CHALLENGE_DB_PATH = os.getenv("SGS_CHALLENGE_DB_PATH") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "sgs_challenge.db"
)
ALLOWED_AVATAR_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
# What a voucher is worth, as shown to voters (set SGS_VOUCHER_OFFER, e.g. "10% off any Super SGS Furniture order").
VOUCHER_OFFER = os.getenv("SGS_VOUCHER_OFFER") or "a discount at Super SGS Furniture"
# No 0/O, 1/I/L: codes are read out loud and typed in at the shop.
VOUCHER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _int_field(body: dict, key: str, default: int) -> int:
    """A whole number from an admin form, or ValueError (answered as 400, not a crash)."""
    value = body.get(key, default)
    if value in (None, ""):
        return default
    return int(value)


def _verified_telegram_id(request: web.Request, bot_token: str) -> str:
    """The Telegram user id from the X-Init-Data header, only if Telegram signed it."""
    verified = verify_init_data(request.headers.get("X-Init-Data", ""), bot_token)
    if not verified:
        return ""
    user = verified.get("user") or {}
    return str(user.get("id", "")) if isinstance(user, dict) else ""
INIT_DATA_MAX_AGE_SECONDS = 24 * 3600
MAX_AVATAR_BYTES = 5 * 1024 * 1024


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

    auth_date = int(pairs.get("auth_date", 0))
    if auth_date and (time.time() - auth_date) > INIT_DATA_MAX_AGE_SECONDS:
        return None

    if "user" in pairs:
        try:
            pairs["user"] = json.loads(pairs["user"])
        except (json.JSONDecodeError, TypeError):
            pass
    return pairs

async def init_challenge_db(path: str = CHALLENGE_DB_PATH):
    db = await aiosqlite.connect(path)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS challenge_creators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            handle TEXT NOT NULL,
            avatar_url TEXT,
            tiktok_url TEXT,
            views INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS challenge_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator_id INTEGER NOT NULL,
            telegram_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(creator_id, telegram_id)
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS challenge_coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT NOT NULL,
            coupon_code TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    """)
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_votes_single_user ON challenge_votes (telegram_id)")
    # One voucher per person, however often registration is retried.
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_coupons_single_user ON challenge_coupons (telegram_id)")
    await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_coupons_code ON challenge_coupons (coupon_code)")
    # When the shop accepted the voucher (older databases lack the column).
    async with db.execute("PRAGMA table_info(challenge_coupons)") as cur:
        columns = [row[1] for row in await cur.fetchall()]
    if "redeemed_at" not in columns:
        await db.execute("ALTER TABLE challenge_coupons ADD COLUMN redeemed_at INTEGER")
    await db.commit()

    return db

def register_challenge_routes(app: web.Application, db: aiosqlite.Connection, bot_token: str, wp_api_url: str = None, admin_ids: list = None):
    if admin_ids is None:
        admin_ids = []

    def _verify_admin_header(request: web.Request):
        init_data = request.headers.get("X-Init-Data", "")
        verified = verify_init_data(init_data, bot_token)
        if not verified:
            return False
        user = verified.get("user") or {}
        try:
            telegram_id = int(user.get("id", 0))
        except ValueError:
            return False
        if telegram_id not in admin_ids:
            return False
        return True

    async def _voucher_for(telegram_id: str, create: bool):
        """(code, redeemed_at) for this voter; with create, a new unique code if they have none yet."""
        async with db.execute(
            "SELECT coupon_code, redeemed_at FROM challenge_coupons WHERE telegram_id = ?", (telegram_id,)
        ) as cur:
            row = await cur.fetchone()
        if row or not create:
            return row
        for _ in range(5):
            code = "SGS-" + "".join(secrets.choice(VOUCHER_ALPHABET) for _ in range(6))
            try:
                await db.execute(
                    "INSERT INTO challenge_coupons (telegram_id, coupon_code, created_at) VALUES (?, ?, ?)",
                    (telegram_id, code, int(time.time())),
                )
                await db.commit()
                return (code, None)
            except aiosqlite.IntegrityError:
                # Same voter at the same moment (one voucher each) or, rarely, a code clash: try again.
                async with db.execute(
                    "SELECT coupon_code, redeemed_at FROM challenge_coupons WHERE telegram_id = ?", (telegram_id,)
                ) as cur:
                    row = await cur.fetchone()
                if row:
                    return row
        raise RuntimeError("could not issue a voucher")

    async def get_creators(request: web.Request) -> web.Response:
        # "Voted by me" only for the Telegram user who signed the request: a plain ?uid= let
        # anyone look up how another person voted.
        telegram_id = _verified_telegram_id(request, bot_token)

        async with db.execute(
            "SELECT id, name, handle, avatar_url, tiktok_url, views, sort_order FROM challenge_creators "
            "WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
        ) as cur:
            rows = await cur.fetchall()

        creator_ids = [r[0] for r in rows]
        vote_counts = {cid: 0 for cid in creator_ids}
        voted_by_me = set()
        if creator_ids:
            placeholders = ",".join("?" * len(creator_ids))
            async with db.execute(
                f"SELECT creator_id, COUNT(*) FROM challenge_votes WHERE creator_id IN ({placeholders}) GROUP BY creator_id",
                creator_ids,
            ) as cur:
                for creator_id, cnt in await cur.fetchall():
                    vote_counts[creator_id] = cnt
            if telegram_id:
                async with db.execute(
                    f"SELECT creator_id FROM challenge_votes WHERE telegram_id = ? AND creator_id IN ({placeholders})",
                    [telegram_id, *creator_ids],
                ) as cur:
                    voted_by_me = {r[0] for r in await cur.fetchall()}

        creators = [
            {
                "id": r[0],
                "name": r[1],
                "handle": r[2],
                "avatar_url": r[3],
                "tiktok_url": r[4],
                "views": r[5],
                "votes": vote_counts.get(r[0], 0),
                "voted_by_me": r[0] in voted_by_me,
            }
            for r in rows
        ]
        total_votes = sum(c["votes"] for c in creators)
        total_views = sum(c["views"] for c in creators)
        return web.json_response({
            "creators": creators,
            "total_votes": total_votes,
            "total_views": total_views,
        })

    async def cast_vote(request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid request body."}, status=400)

        init_data = body.get("initData", "")
        creator_id = body.get("creator_id")
        if not creator_id:
            return web.json_response({"error": "creator_id is required."}, status=400)

        verified = verify_init_data(init_data, bot_token)
        if not verified:
            return web.json_response(
                {"error": "Could not verify your Telegram session. Please reopen the app from the bot."},
                status=401,
            )

        user = verified.get("user") or {}
        telegram_id = str(user.get("id", ""))
        if not telegram_id:
            return web.json_response({"error": "Missing Telegram user id."}, status=401)

        if wp_api_url:
            import aiohttp
            import os
            headers = {}
            token = os.getenv("BELEQET_API_SECRET_TOKEN")
            if token:
                headers["X-Beleqet-API-Token"] = token
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(f"{wp_api_url}/../check-user?telegram_id={telegram_id}", headers=headers, timeout=10) as response:
                        if response.status == 200:
                            data = await response.json()
                            if not data.get('registered'):
                                return web.json_response({"error": "You must be registered to Beleqet Jobs before voting.", "not_registered": True}, status=403)
                        else:
                            return web.json_response({"error": "Could not verify your registration status at this time."}, status=500)
                except Exception as e:
                    logger.error(f"Error checking registration for {telegram_id}: {e}")
                    return web.json_response({"error": "Error connecting to the verification server."}, status=500)

        async with db.execute(
            "SELECT id FROM challenge_creators WHERE id = ? AND is_active = 1", (creator_id,)
        ) as cur:
            if not await cur.fetchone():
                return web.json_response({"error": "This creator is not part of the challenge."}, status=404)

        async with db.execute(
            "SELECT COUNT(*) FROM challenge_votes WHERE telegram_id = ?", (telegram_id,)
        ) as cur:
            (total_user_votes,) = await cur.fetchone()
            if total_user_votes > 0:
                return web.json_response({"error": "You have already cast your vote! You can only vote for one creator in this contest."}, status=403)

        try:
            await db.execute(
                "INSERT INTO challenge_votes (creator_id, telegram_id, created_at) VALUES (?, ?, ?)",
                (creator_id, telegram_id, int(time.time())),
            )
            await db.commit()
        except aiosqlite.IntegrityError:
            return web.json_response({"error": "You have already cast your vote! You can only vote for one creator in this contest."}, status=409)

        async with db.execute(
            "SELECT COUNT(*) FROM challenge_votes WHERE creator_id = ?", (creator_id,)
        ) as cur:
            (votes,) = await cur.fetchone()

        # The reward for voting: a Super SGS Furniture voucher (one per person).
        try:
            voucher = await _voucher_for(telegram_id, create=True)
        except Exception as e:
            logger.error(f"Could not issue a voucher for {telegram_id}: {e}")
            voucher = None
        return web.json_response({
            "ok": True,
            "votes": votes,
            "coupon_code": voucher[0] if voucher else None,
            "voucher_offer": VOUCHER_OFFER,
        })

    async def my_voucher(request: web.Request) -> web.Response:
        """The signed-in voter's voucher, so they can show it again at the shop."""
        telegram_id = _verified_telegram_id(request, bot_token)
        if not telegram_id:
            return web.json_response({"error": "Please open the challenge from the bot."}, status=401)
        async with db.execute("SELECT 1 FROM challenge_votes WHERE telegram_id = ?", (telegram_id,)) as cur:
            voted = await cur.fetchone() is not None
        # Someone who voted before vouchers existed gets theirs now.
        voucher = await _voucher_for(telegram_id, create=voted)
        return web.json_response({
            "coupon_code": voucher[0] if voucher else None,
            "redeemed": bool(voucher and voucher[1]),
            "voucher_offer": VOUCHER_OFFER,
        })

    async def register_user(request: web.Request) -> web.Response:
        """
        Creates the Beleqet Jobs account from the Mini App form, through the API's bot endpoint
        (POST /api/v1/telegram/register, JSON, X-Beleqet-API-Token). Success is reported only when
        the API says the account exists; its own message is shown otherwise.
        """
        try:
            data = await request.post()
        except Exception:
            return web.json_response({"error": "Invalid request body."}, status=400)

        verified = verify_init_data(data.get("initData", ""), bot_token)
        if not verified:
            return web.json_response({"error": "Could not verify your Telegram session. Please reopen the app from the bot."}, status=401)
        user = verified.get("user") or {}
        telegram_id = str(user.get("id", "")) if isinstance(user, dict) else ""
        if not telegram_id:
            return web.json_response({"error": "Missing Telegram user id."}, status=401)
        if not wp_api_url:
            return web.json_response({"error": "Registration is not available right now."}, status=503)

        def field(name: str) -> str:
            value = data.get(name, "")
            return value.strip() if isinstance(value, str) else ""

        role = "employer" if field("role") == "employer" else "candidate"
        name, email, password = field("name"), field("email").lower(), data.get("password", "")
        password = password if isinstance(password, str) else ""
        if not name:
            return web.json_response({"error": "Please enter your full name."}, status=400)
        if not EMAIL_PATTERN.match(email):
            return web.json_response({"error": "Please enter a valid email address."}, status=400)
        if len(password) < 8:
            return web.json_response({"error": "The password must be at least 8 characters."}, status=400)
        if role == "employer" and not field("company_name"):
            return web.json_response({"error": "Please enter your company name."}, status=400)

        payload = {
            "telegram_id": telegram_id,
            "name": name,
            "email": email,
            "password": password,
            "role": role,
            "phone": field("phone"),
            "tg_username": field("tg_username").lstrip("@"),
            "job_title": field("job_title"),
            "company_name": field("company_name"),
        }
        headers = {}
        token = os.getenv("BELEQET_API_SECRET_TOKEN")
        if token:
            headers["X-Beleqet-API-Token"] = token

        import aiohttp
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(wp_api_url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    try:
                        answer = await response.json(content_type=None)
                    except Exception:
                        answer = {}
        except Exception as e:
            logger.error(f"Registration request for {telegram_id} failed: {e}")
            return web.json_response({"error": "Could not reach the registration server. Please try again."}, status=502)

        if response.status in (200, 201) and answer.get("success") and answer.get("registered"):
            # The voucher comes with the vote, not with registering.
            return web.json_response({"ok": True})

        message = answer.get("message")
        if isinstance(message, list):
            message = "; ".join(str(m) for m in message)
        logger.warning(f"Registration refused for {telegram_id}: HTTP {response.status} {message}")
        status = 409 if response.status == 409 else 400
        return web.json_response({"error": message or "Registration failed. Please try again."}, status=status)

    def _normalise_code(value) -> str:
        return re.sub(r"[^A-Z0-9-]", "", str(value or "").upper())

    async def admin_voucher_check(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid request body."}, status=400)
        code = _normalise_code(body.get("code") if isinstance(body, dict) else "")
        async with db.execute(
            "SELECT created_at, redeemed_at FROM challenge_coupons WHERE coupon_code = ?", (code,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return web.json_response({"found": False, "code": code})
        return web.json_response({"found": True, "code": code, "issued_at": row[0], "redeemed_at": row[1]})

    async def admin_voucher_redeem(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid request body."}, status=400)
        code = _normalise_code(body.get("code") if isinstance(body, dict) else "")
        # Only an unused voucher can be marked: a code works once.
        cur = await db.execute(
            "UPDATE challenge_coupons SET redeemed_at = ? WHERE coupon_code = ? AND redeemed_at IS NULL",
            (int(time.time()), code),
        )
        await db.commit()
        if cur.rowcount == 1:
            return web.json_response({"ok": True, "code": code})
        async with db.execute("SELECT redeemed_at FROM challenge_coupons WHERE coupon_code = ?", (code,)) as c2:
            row = await c2.fetchone()
        if not row:
            return web.json_response({"error": "This voucher code does not exist."}, status=404)
        return web.json_response({"error": "This voucher was already used.", "redeemed_at": row[0]}, status=409)

    async def admin_check(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        return web.json_response({"is_admin": True})

    async def admin_get_creators(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        async with db.execute("SELECT id, name, handle, avatar_url, tiktok_url, views, is_active, sort_order FROM challenge_creators ORDER BY sort_order ASC, id ASC") as cur:
            rows = await cur.fetchall()
        creators = [{"id": r[0], "name": r[1], "handle": r[2], "avatar_url": r[3], "tiktok_url": r[4], "views": r[5], "is_active": r[6], "sort_order": r[7]} for r in rows]
        
        creator_ids = [c["id"] for c in creators]
        if creator_ids:
            placeholders = ",".join("?" * len(creator_ids))
            async with db.execute(f"SELECT creator_id, COUNT(*) FROM challenge_votes WHERE creator_id IN ({placeholders}) GROUP BY creator_id", creator_ids) as cur:
                vote_counts = {r[0]: r[1] for r in await cur.fetchall()}
            for c in creators:
                c["votes"] = vote_counts.get(c["id"], 0)
        else:
            for c in creators:
                c["votes"] = 0
                
        async with db.execute("SELECT COUNT(DISTINCT telegram_id) FROM challenge_votes") as cur:
            (total_voters,) = await cur.fetchone()
        
        async with db.execute("SELECT COUNT(*) FROM challenge_votes") as cur:
            (total_votes,) = await cur.fetchone()

        async with db.execute(
            "SELECT COUNT(*), COUNT(redeemed_at) FROM challenge_coupons"
        ) as cur:
            vouchers_issued, vouchers_redeemed = await cur.fetchone()
            
        return web.json_response({
            "creators": creators,
            "stats": {
                "total_voters": total_voters,
                "total_votes": total_votes,
                "active_creators": sum(1 for c in creators if c["is_active"]),
                "total_creators": len(creators),
                "vouchers_issued": vouchers_issued,
                "vouchers_redeemed": vouchers_redeemed,
            }
        })

    async def _creator_fields(request: web.Request):
        """(name, handle, avatar_url, tiktok_url, views, is_active, sort_order) or an error message."""
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return None, "Invalid request body."
        if not isinstance(body, dict):
            return None, "Invalid request body."
        name = str(body.get("name") or "").strip()
        handle = str(body.get("handle") or "").strip()
        if not name or not handle:
            return None, "Name and TikTok handle are required."
        try:
            numbers = (_int_field(body, "views", 0), _int_field(body, "is_active", 1), _int_field(body, "sort_order", 0))
        except (TypeError, ValueError):
            return None, "Views and order must be whole numbers."
        avatar_url = str(body.get("avatar_url") or "").strip()
        tiktok_url = str(body.get("tiktok_url") or "").strip()
        return (name, handle, avatar_url, tiktok_url, *numbers), None

    async def admin_add_creator(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        fields, error = await _creator_fields(request)
        if error:
            return web.json_response({"error": error}, status=400)
        await db.execute(
            "INSERT INTO challenge_creators (name, handle, avatar_url, tiktok_url, views, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            fields,
        )
        await db.commit()
        return web.json_response({"ok": True})

    async def admin_edit_creator(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        creator_id = request.match_info["id"]
        fields, error = await _creator_fields(request)
        if error:
            return web.json_response({"error": error}, status=400)
        new_avatar_url = fields[2]
        
        # Check if the avatar URL changed and delete the old one if it's local
        async with db.execute("SELECT avatar_url FROM challenge_creators WHERE id=?", (creator_id,)) as cur:
            row = await cur.fetchone()
            if row and row[0]:
                old_avatar_url = row[0]
                if old_avatar_url != new_avatar_url and old_avatar_url.startswith("/challenge/uploads/"):
                    # Only ever a file directly inside uploads/, whatever the stored URL says.
                    filename = os.path.basename(old_avatar_url.split("/challenge/uploads/")[-1])
                    filepath = os.path.join(os.path.dirname(__file__), '..', 'app', 'uploads', filename)
                    if os.path.exists(filepath):
                        try:
                            os.remove(filepath)
                        except OSError:
                            pass
                            
        await db.execute(
            "UPDATE challenge_creators SET name=?, handle=?, avatar_url=?, tiktok_url=?, views=?, is_active=?, sort_order=? WHERE id=?",
            (*fields, creator_id),
        )
        await db.commit()
        return web.json_response({"ok": True})

    async def admin_delete_creator(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        creator_id = request.match_info["id"]
        
        # Check if the creator has a local avatar and delete it
        async with db.execute("SELECT avatar_url FROM challenge_creators WHERE id=?", (creator_id,)) as cur:
            row = await cur.fetchone()
            if row and row[0] and row[0].startswith("/challenge/uploads/"):
                filename = os.path.basename(row[0].split("/challenge/uploads/")[-1])
                filepath = os.path.join(os.path.dirname(__file__), '..', 'app', 'uploads', filename)
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except OSError:
                        pass
        
        await db.execute("DELETE FROM challenge_creators WHERE id=?", (creator_id,))
        await db.execute("DELETE FROM challenge_votes WHERE creator_id=?", (creator_id,))
        await db.commit()
        return web.json_response({"ok": True})

    async def admin_reset_votes(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        await db.execute("DELETE FROM challenge_votes")
        await db.commit()
        return web.json_response({"ok": True})

    async def admin_upload_avatar(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
            
        data = await request.post()
        if 'file' not in data:
            return web.json_response({"error": "No file provided"}, status=400)
            
        file_field = data['file']
        filename = file_field.filename
        
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Images only: anything else saved here would be served from the Mini App's own address.
        extension = os.path.splitext(filename or "")[1].lower()
        if extension not in ALLOWED_AVATAR_EXTENSIONS:
            return web.json_response({"error": "Upload a JPG, PNG, WEBP or GIF image."}, status=400)
        content = file_field.file.read(MAX_AVATAR_BYTES + 1)
        if len(content) > MAX_AVATAR_BYTES:
            return web.json_response({"error": "The image must be 5 MB or smaller."}, status=400)

        # Letters, digits, _ and - only, then the checked extension: no second extension can sneak in.
        safe_base = re.sub(r'[^a-zA-Z0-9_\-]', '_', os.path.splitext(os.path.basename(filename))[0])[:60] or "avatar"
        safe_name = f"{int(time.time())}_{safe_base}{extension}"
        file_path = os.path.join(uploads_dir, safe_name)

        with open(file_path, 'wb') as f:
            f.write(content)
            
        return web.json_response({"url": f"/challenge/uploads/{safe_name}"})

    app.router.add_get("/api/challenge/creators", get_creators)
    app.router.add_post("/api/challenge/vote", cast_vote)
    app.router.add_post("/api/challenge/register", register_user)
    
    app.router.add_post("/api/challenge/admin/check", admin_check)
    app.router.add_get("/api/challenge/admin/creators", admin_get_creators)
    app.router.add_post("/api/challenge/admin/creators", admin_add_creator)
    app.router.add_put(r"/api/challenge/admin/creators/{id:\d+}", admin_edit_creator)
    app.router.add_delete(r"/api/challenge/admin/creators/{id:\d+}", admin_delete_creator)
    app.router.add_post("/api/challenge/admin/reset", admin_reset_votes)
    app.router.add_post("/api/challenge/admin/upload", admin_upload_avatar)
    app.router.add_get("/api/challenge/my-voucher", my_voucher)
    app.router.add_post("/api/challenge/admin/voucher/check", admin_voucher_check)
    app.router.add_post("/api/challenge/admin/voucher/redeem", admin_voucher_redeem)

    logger.info("[challenge] routes registered (with admin routes)")
