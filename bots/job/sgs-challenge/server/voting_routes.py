import os
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qsl

import aiosqlite
from aiohttp import web

logger = logging.getLogger(__name__)

CHALLENGE_DB_PATH = "sgs_challenge.db"
INIT_DATA_MAX_AGE_SECONDS = 24 * 3600


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

    async def get_creators(request: web.Request) -> web.Response:
        telegram_id = request.query.get("uid", "")

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
            return web.json_response({"error": "You already voted for this creator."}, status=409)

        async with db.execute(
            "SELECT COUNT(*) FROM challenge_votes WHERE creator_id = ?", (creator_id,)
        ) as cur:
            (votes,) = await cur.fetchone()

        return web.json_response({"ok": True, "votes": votes})

    async def register_user(request: web.Request) -> web.Response:
        try:
            data = await request.post()
            init_data = data.get("initData", "")
            
            verified = verify_init_data(init_data, bot_token)
            if not verified:
                return web.json_response({"error": "Could not verify your Telegram session. Please reopen the app from the bot."}, status=401)
                
            user = verified.get("user") or {}
            telegram_id = str(user.get("id", ""))
            if not telegram_id:
                return web.json_response({"error": "Missing Telegram user id."}, status=401)

            if not wp_api_url:
                return web.json_response({"error": "WordPress API URL not configured."}, status=500)

            import aiohttp
            form_data = aiohttp.FormData()
            form_data.add_field('telegram_id', telegram_id)
            form_data.add_field('name', data.get('name', ''))
            form_data.add_field('email', data.get('email', ''))
            form_data.add_field('password', data.get('password', ''))
            form_data.add_field('username', f"tg_{telegram_id}")
            
            role_input = data.get('role', '')
            backend_role = 'wp_job_board_pro_employer' if role_input == 'employer' else 'wp_job_board_pro_candidate'
            form_data.add_field('role', backend_role)
            
            form_data.add_field('language', 'am')
            form_data.add_field('phone', data.get('phone', ''))
            form_data.add_field('tg_username', data.get('tg_username', ''))
            form_data.add_field('job_title', data.get('job_title', ''))
            form_data.add_field('company_name', data.get('company_name', ''))
            
            trade_license = data.get('trade_license')
            if trade_license and hasattr(trade_license, 'file'):
                form_data.add_field('trade_license_file', 
                                   trade_license.file.read(),
                                   filename=trade_license.filename,
                                   content_type=trade_license.content_type)
            elif trade_license:
                # Fallback if trade_license is just a string (shouldn't happen but just in case)
                pass

            try:
                import os
                headers = {}
                token = os.getenv("BELEQET_API_SECRET_TOKEN")
                if token:
                    headers["X-Beleqet-API-Token"] = token
                async with aiohttp.ClientSession() as session:
                    async with session.post(wp_api_url, data=form_data, headers=headers, timeout=60) as response:
                        if response.status in (200, 201):
                            response_data = await response.json()
                            coupon_code = response_data.get("coupon_code")
                            if coupon_code:
                                await db.execute(
                                    "INSERT INTO challenge_coupons (telegram_id, coupon_code, created_at) VALUES (?, ?, ?)",
                                    (telegram_id, coupon_code, int(time.time()))
                                )
                                await db.commit()
                            return web.json_response({"ok": True, "coupon_code": coupon_code})
                        else:
                            try:
                                error_data = await response.json()
                                error_message = error_data.get('message', f'An unknown error occurred. Status: {response.status}')
                            except Exception:
                                error_text = await response.text()
                                error_message = f"An unknown error occurred. Status: {response.status}. Body: {error_text}"
                            logger.warning(f"WordPress API returned error: {error_message}")
                            return web.json_response({"error": error_message}, status=400)
            except Exception as e:
                logger.error(f"Error during registration proxy: {e}", exc_info=True)
                return web.json_response({"error": f"Error connecting to the registration server: {str(e)}"}, status=500)
        except Exception as e:
            logger.error(f"Unhandled exception in register_user: {e}", exc_info=True)
            return web.json_response({"error": f"Internal exception: {str(e)}"}, status=500)

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
            
        return web.json_response({
            "creators": creators,
            "stats": {
                "total_voters": total_voters,
                "total_votes": total_votes,
                "active_creators": sum(1 for c in creators if c["is_active"]),
                "total_creators": len(creators)
            }
        })

    async def admin_add_creator(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        body = await request.json()
        await db.execute(
            "INSERT INTO challenge_creators (name, handle, avatar_url, tiktok_url, views, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (body.get("name", ""), body.get("handle", ""), body.get("avatar_url", ""), body.get("tiktok_url", ""), int(body.get("views", 0)), int(body.get("is_active", 1)), int(body.get("sort_order", 0)))
        )
        await db.commit()
        return web.json_response({"ok": True})

    async def admin_edit_creator(request: web.Request) -> web.Response:
        if not _verify_admin_header(request):
            return web.json_response({"error": "Unauthorized"}, status=401)
        creator_id = request.match_info["id"]
        body = await request.json()
        new_avatar_url = body.get("avatar_url", "")
        
        # Check if the avatar URL changed and delete the old one if it's local
        async with db.execute("SELECT avatar_url FROM challenge_creators WHERE id=?", (creator_id,)) as cur:
            row = await cur.fetchone()
            if row and row[0]:
                old_avatar_url = row[0]
                if old_avatar_url != new_avatar_url and old_avatar_url.startswith("/challenge/uploads/"):
                    filename = old_avatar_url.split("/challenge/uploads/")[-1]
                    filepath = os.path.join(os.path.dirname(__file__), '..', 'app', 'uploads', filename)
                    if os.path.exists(filepath):
                        try:
                            os.remove(filepath)
                        except OSError:
                            pass
                            
        await db.execute(
            "UPDATE challenge_creators SET name=?, handle=?, avatar_url=?, tiktok_url=?, views=?, is_active=?, sort_order=? WHERE id=?",
            (body.get("name", ""), body.get("handle", ""), new_avatar_url, body.get("tiktok_url", ""), int(body.get("views", 0)), int(body.get("is_active", 1)), int(body.get("sort_order", 0)), creator_id)
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
                filename = row[0].split("/challenge/uploads/")[-1]
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
        
        import time
        import re
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        
        safe_base = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', os.path.basename(filename))
        safe_name = f"{int(time.time())}_{safe_base}"
        file_path = os.path.join(uploads_dir, safe_name)
        
        with open(file_path, 'wb') as f:
            f.write(file_field.file.read())
            
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

    logger.info("[challenge] routes registered (with admin routes)")
