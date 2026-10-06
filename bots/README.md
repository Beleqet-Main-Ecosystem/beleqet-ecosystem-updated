# Beleqet Platform - Comprehensive Deployment Guide

> Full-stack Telegram bot ecosystem for Ethiopia's leading job board and referral reward platform.
> This monorepo contains three production services that run together behind Nginx on a VPS (accessible over a VPN).

## Table of Contents

1. Project Overview
2. Architecture Diagram
3. Repository Structure
4. Services At a Glance
5. Database Schema
6. Environment Variables Reference
7. Dependencies
8. Server Prerequisites
9. VPN / Network Setup
10. Step-by-Step Deployment
11. Nginx Config Reference
12. API Endpoint Reference
13. Admin Operations
14. Monitoring and Logs
15. Backup and Recovery
16. Security Hardening
17. Troubleshooting
18. Quick Reference Card

---

## 1. Project Overview

The **Beleqet Platform** is composed of three cooperating Telegram bots and associated REST APIs, all deployed on a single Linux VPS behind Nginx. Each project serves a distinct purpose:

| Service | Bot Purpose | Domain | Port |
|---|---|---|---|
| beleqet-bot | Beleqet Academy referral rewards and mini-app | beleqetaca-api.beleqet.com | 8000 |
| shareandwin | Beleqet Jobs share-and-win referral rewards | beleqetjobs-api.beleqet.com | 8001 |
| job | Beleqet Jobs registration bot + SGS Challenge mini-app (webhook mode) | webhook.beleqet.com | 8080 |

All three services share the beleqet.com root domain and are secured with Let's Encrypt TLS certificates managed by Certbot.

---

## 2. Architecture Diagram

```
Internet / Telegram API
        |
        v
+-------------------------------------------------------+
|                  Linux VPS (Ubuntu/Debian)             |
|                 (Access via VPN + SSH)                 |
|                                                       |
|   +---------------------------------------------+    |
|   |         Nginx (Port 80 / 443)               |    |
|   |  beleqetaca-api.beleqet.com  --> :8000       |    |
|   |  beleqetjobs-api.beleqet.com --> :8001       |    |
|   |  webhook.beleqet.com          --> :8080       |    |
|   +---------------------------------------------+    |
|                                                       |
|   +-----------+    +-----------+    +----------+      |
|   | beleqet-  |    | shareand  |    |   job    |      |
|   | bot       |    | win       |    |  main.py |      |
|   | main.py   |    | main.py   |    | (aiohttp |      |
|   | api.py    |    | api.py    |    | webhook) |      |
|   | Polling   |    | Polling   |    | Port 8080|      |
|   | Port 8000 |    | Port 8001 |    +----------+      |
|   +-----------+    +-----------+                       |
|                                                       |
|   +---------------------------------------------------+|
|   | SQLite: referrals.db (x2)  sgs_challenge.db      ||
|   +---------------------------------------------------+|
+-------------------------------------------------------+
```

---

## 3. Repository Structure

```
bel/
+-- README.md
+-- beleqet-bot/
|   +-- .env
|   +-- main.py              (Telegram bot, polling, 781 lines)
|   +-- api.py               (FastAPI REST, Port 8000)
|   +-- requirements.txt
|   +-- referrals.db         (auto-created SQLite)
|   +-- bot_persistence      (PicklePersistence state)
|   +-- Promo.jpg
|   +-- beleqetaca-api.beleqet.com  (Nginx vhost config)
|
+-- shareandwin/
|   +-- .env
|   +-- main.py              (Telegram bot, polling, 781 lines)
|   +-- api.py               (FastAPI REST, Port 8001)
|   +-- requirements.txt
|   +-- referrals.db
|   +-- bot_persistence
|   +-- Promo.jpg
|   +-- beleqetjobs-api.beleqet.com (Nginx vhost config)
|
+-- job/
    +-- .env
    +-- main.py              (Bot + aiohttp webhook, 1376 lines)
    +-- requirements.txt
    +-- sgs_challenge.db     (SQLite for SGS Challenge)
    +-- telegram-bot         (Nginx vhost config)
    +-- sgs-challenge/
        +-- app/
        |   +-- index.html   (SGS Challenge Telegram Mini App)
        |   +-- style.css
        |   +-- app.js
        |   +-- uploads/
        +-- server/
            +-- voting_routes.py  (aiohttp routes for challenge API)
```


---

## 4. Services At a Glance

### 4.1 beleqet-bot - Academy / Boost Bot

**Purpose:** A referral rewards bot for the Beleqet Academy channel. Users share a unique invite link; when a new user joins through that link and stays in the channel, the referrer earns 1 point (= 1 ETB). Points can be withdrawn to a phone number (mobile money) or transferred to the Beleqet SMM Promo Bot.

**Key Features:**
- Referral tracking - Tracks who referred whom using the SQLite successful_referrals table
- Dynamic scoring - Score increases when a referred user joins, decreases if they leave
- Withdrawal system - Users request cash-out (min 50 ETB); admin approves/rejects via inline buttons; points are deducted immediately on request and refunded on rejection
- Point transfer - Users can transfer points to the SMM Promo Bot (/api/transfer)
- Broadcast - Admin can broadcast messages to all users (with optional inline button)
- Post to Channel - Schedule posts with photo, text, and button to Telegram channels
- Scheduled Posts - Supports one-time or repeating scheduled posts (stored in DB, restored on restart)
- Admin Management - Multi-admin system; admins can add/remove other admins
- User Stats - Admin command to see total users and scores
- Inline mode - Users can use @BeleqetBoost_Bot inline to share their referral link in any chat

**Running mode:** python-telegram-bot POLLING mode + FastAPI server on port 8000

**Target Channels monitored for join/leave:**
- -1001669125004
- -1001199095627
- -1002877767689
- -1001989588782

---

### 4.2 shareandwin - Jobs Invite-and-Win Bot

**Purpose:** Nearly identical architecture to beleqet-bot but serves the Beleqet Jobs channel (BeleqetJobsInviteAndWin_Bot). Users invite friends; each active referral earns 1 point.

**Key Differences from beleqet-bot:**
- Points attributed to the Beleqet Jobs channel (-1001199095627)
- Welcome video is a URL-based MP4 hosted on the website
- Multiple admin IDs loaded from ADMIN_IDS (comma-separated)
- Internal transfer source tag is "Share & Win Bot"
- FastAPI runs on port 8001
- Nginx proxies beleqetjobs-api.beleqet.com to port 8001

**Running mode:** python-telegram-bot POLLING mode + FastAPI server on port 8001

---

### 4.3 job - Beleqet Jobs Bot + SGS Challenge

**Purpose:** The flagship job registration and onboarding bot for beleqet.com/vacancy. Users register as Job Seekers or Employers (verified with trade license document), then access job listings via a Telegram Mini App. Also hosts the SGS Furniture Creative Challenge voting mini-app.

**Registration and Auth:**
- Bilingual UI (English / Amharic)
- Role-based onboarding: Job Seeker (name, phone, email, Telegram username, job title, password) or Employer (company name, trade license document upload)
- WordPress backend integration via REST API (WORDPRESS_API_URL)
- Account linking - existing website accounts linked to Telegram via deep link token
- Account transfer - link existing account to a new Telegram profile

**Job Board Integration:**
- Deep linking to specific job listings (/start job-<slug>)
- Full Mini App keyboard menu (Dashboard, My Profile, My Applications, Post Job, Applicants, My Jobs, Jobs list)
- Payment decision system for employer subscriptions (approve/reject via inline buttons)

**SGS Creative Challenge Mini App:**
- Embedded at https://webhook.beleqet.com/challenge/
- Users vote for TikTok creators (one vote per Telegram account)
- Telegram Mini App init data verified with HMAC-SHA256
- Admin panel: add/edit creators, reset votes, set active/inactive status
- Winner tracking with coupon code generation for employers
- Separate sgs_challenge.db SQLite database

**Infrastructure:**
- Combined aiohttp web server (port 8080) + Telegram polling
- Rate limiter (1 msg/sec, burst of 30) to respect Telegram API limits
- PicklePersistence for conversation state
- Webhook endpoint at /webhook with secret token verification
- Health check at / (GET)

---

## 5. Database Schema

### referrals.db (used by beleqet-bot and shareandwin)

```sql
CREATE TABLE users (
    user_id   INTEGER PRIMARY KEY,
    score     INTEGER NOT NULL DEFAULT 0,
    username  TEXT
);

CREATE TABLE pending_referrals (
    new_user_id  INTEGER PRIMARY KEY,
    referrer_id  INTEGER NOT NULL
);

CREATE TABLE successful_referrals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id      INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    is_active        INTEGER NOT NULL DEFAULT 1,
    UNIQUE(referrer_id, referred_user_id)
);
CREATE INDEX idx_referrer_id ON successful_referrals (referrer_id);

CREATE TABLE withdrawals (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL,
    amount              INTEGER NOT NULL,
    phone_number        TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    request_timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_timestamp DATETIME
);

CREATE TABLE admins (
    user_id INTEGER PRIMARY KEY
);

CREATE TABLE scheduled_posts (
    job_id            TEXT PRIMARY KEY,
    post_text         TEXT,
    scheduled_time    TEXT,   -- 'YYYY-MM-DD at HH:MM' (EAT)
    repeat            INTEGER,
    post_photo        TEXT,
    post_button_text  TEXT,
    post_button_url   TEXT
);
```

### sgs_challenge.db (used by job)

```sql
CREATE TABLE challenge_creators (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    handle     TEXT NOT NULL,
    avatar_url TEXT,
    tiktok_url TEXT,
    views      INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE challenge_votes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id  INTEGER NOT NULL,
    telegram_id TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    UNIQUE(creator_id, telegram_id)
);

CREATE TABLE challenge_coupons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    coupon_code TEXT NOT NULL,
    created_at  INTEGER NOT NULL
);
```

---

## 6. Environment Variables Reference

### beleqet-bot/.env

| Variable | Description |
|---|---|
| BOT_TOKEN | Telegram bot token from @BotFather |
| CHANNEL_ID | Primary channel ID to monitor for membership changes |
| CHANNEL_USERNAME | Channel username (for display) |
| ADMIN_ID | Primary admin Telegram user ID |
| PAYMENT_HANDLER_ID | Telegram ID that receives withdrawal requests |
| TARGET_CHATS | Comma-separated list of channel IDs to monitor |
| WELCOME_PHOTO_FILE_ID | Local path or Telegram file ID for welcome photo |
| PROMO_BOT_API_URL | (optional) Internal URL for Promo SMM Bot transfer endpoint |
| TRANSFER_SECRET_KEY | (optional) Shared secret for Promo Bot API auth |

### shareandwin/.env

| Variable | Description |
|---|---|
| BOT_TOKEN | Telegram bot token |
| CHANNEL_ID | Primary Jobs channel ID |
| CHANNEL_USERNAME | Bot username |
| ADMIN_ID | Primary admin Telegram ID |
| PAYMENT_HANDLER_ID | Withdrawal approver ID |
| ADMIN_IDS | Multiple admin IDs (comma-separated) |
| WELCOME_VIDEO_FILE_ID | URL to welcome MP4 video |
| WELCOME_PHOTO_FILE_ID | Local path or file ID for welcome photo |

### job/.env

| Variable | Description |
|---|---|
| BOT_TOKEN | Telegram bot token |
| WORDPRESS_API_URL | WordPress custom REST API base URL |
| BELEQET_API_SECRET_TOKEN | Secret token for WordPress API calls |
| BOT_WEBHOOK_URL | Full URL Telegram should call for updates |
| CHALLENGE_MINI_APP_URL | Public URL for the SGS Challenge mini app |
| MINI_APP_URL | Public URL for the job board mini app (WordPress) |
| CANDIDATE_PROMO_PHOTO_ID | Telegram file ID for candidate promo photo |
| EMPLOYER_PROMO_PHOTO_ID | Telegram file ID for employer promo photo |
| WEBHOOK_SECRET_TOKEN | Token Telegram sends in X-Telegram-Bot-Api-Secret-Token header |
| ADMIN_IDS | Comma-separated admin Telegram IDs |

> SECURITY WARNING: Never commit .env files to version control. Set file permissions to 600 on the server.

---

## 7. Dependencies

### beleqet-bot and shareandwin (requirements.txt)

```
python-telegram-bot[job-queue]   # Telegram bot library with APScheduler
python-dotenv                    # Loads .env files
pytz                             # Timezone handling (Africa/Addis_Ababa)
python-telegram-bot-calendar     # Calendar widget for scheduling
aiosqlite                        # Async SQLite driver

# MISSING from requirements.txt - must add manually:
fastapi                          # REST API framework
uvicorn[standard]                # ASGI server for FastAPI
httpx                            # Async HTTP client
```

### job (requirements.txt)

```
python-telegram-bot>=20.0        # Telegram bot library
aiohttp                          # Async HTTP server and client
python-dotenv                    # Environment variable loading
aiosqlite                        # Async SQLite driver
```


---

## 8. Server Prerequisites

| Requirement | Notes |
|---|---|
| OS: Ubuntu 22.04 LTS / Debian 12 | Recommended |
| Python 3.10+ (3.11 recommended) | Check: python3 --version |
| pip latest | pip install --upgrade pip |
| Nginx latest stable | Reverse proxy |
| Certbot latest | Let's Encrypt TLS |
| systemd | Built-in process management |
| OpenSSH | Built-in remote access |
| Git latest | Code deployment |
| UFW | Built-in firewall |

Minimum server specs:
- 1 vCPU, 1 GB RAM (2 GB recommended for 3 concurrent services)
- 20 GB SSD storage
- 1 public IPv4 address

DNS records required (all pointing to your server public IP):

```
beleqetaca-api.beleqet.com  A  <SERVER_PUBLIC_IP>
beleqetjobs-api.beleqet.com A  <SERVER_PUBLIC_IP>
webhook.beleqet.com          A  <SERVER_PUBLIC_IP>
```

---

## 9. VPN / Network Setup

The server is managed OVER A VPN. The VPS is only reachable for SSH administration through a private VPN IP, while its public IP remains open for web traffic (ports 80/443).

### Why use a VPN for server management?

- Security: SSH port (22) is not exposed to the public internet
- Access control: Only authenticated VPN clients can reach the management plane
- Auditability: All admin sessions pass through the VPN gateway

### Recommended Setup: WireGuard VPN

```bash
# On the server - install WireGuard
sudo apt update && sudo apt install -y wireguard

# Generate server key pair
wg genkey | tee /etc/wireguard/server_private.key | \
  wg pubkey > /etc/wireguard/server_public.key

chmod 600 /etc/wireguard/server_private.key

# Create WireGuard config (replace placeholders)
sudo tee /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = PASTE_SERVER_PRIVATE_KEY_HERE
PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Your admin workstation
PublicKey  = <YOUR_CLIENT_PUBLIC_KEY>
AllowedIPs = 10.8.0.2/32
EOF

# Enable WireGuard
sudo systemctl enable --now wg-quick@wg0
```

### Firewall Rules (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow WireGuard VPN tunnel
sudo ufw allow 51820/udp

# Allow public web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CRITICAL: Only allow SSH from VPN subnet, NOT from the public internet
sudo ufw allow from 10.8.0.0/24 to any port 22

sudo ufw enable
sudo ufw status verbose
```

### Client Config (your workstation)

Create a file called wg0.conf on your local machine:

```ini
[Interface]
Address    = 10.8.0.2/32
PrivateKey = <YOUR_CLIENT_PRIVATE_KEY>
DNS        = 1.1.1.1

[Peer]
PublicKey           = <SERVER_PUBLIC_KEY>
Endpoint            = <SERVER_PUBLIC_IP>:51820
AllowedIPs          = 10.8.0.0/24
PersistentKeepalive = 25
```

Then connect and SSH:

```bash
# Linux
sudo wg-quick up wg0

# Then SSH into the server
ssh ubuntu@10.8.0.1
```

> TIP: For team access, generate a unique key pair for each team member and add each as a [Peer] block on the server. Revoke access by removing the peer block and reloading: sudo systemctl reload wg-quick@wg0

---

## 10. Step-by-Step Deployment

### Step 1 - Connect to Server via VPN + SSH

```bash
# Linux: bring up VPN
sudo wg-quick up wg0

# macOS/Windows: use WireGuard GUI app

# SSH into the server (after VPN is active)
ssh ubuntu@10.8.0.1
```

---

### Step 2 - Install System Packages

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y \
  python3 python3-pip python3-venv \
  nginx \
  certbot python3-certbot-nginx \
  git ufw curl sqlite3

# Verify Python
python3 --version   # Must be 3.10+
```

---

### Step 3 - Clone / Transfer the Code

Option A - Git (recommended):

```bash
git clone https://github.com/your-org/beleqet-platform.git /opt/beleqet
cd /opt/beleqet
```

Option B - SCP over VPN (from your local machine while connected):

```bash
scp -r ./beleqet-bot  ubuntu@10.8.0.1:/opt/beleqet/
scp -r ./shareandwin  ubuntu@10.8.0.1:/opt/beleqet/
scp -r ./job          ubuntu@10.8.0.1:/opt/beleqet/
```

Set ownership:

```bash
sudo chown -R ubuntu:ubuntu /opt/beleqet
```

---

### Step 4 - Python Virtual Environments

```bash
# Service 1: beleqet-bot
cd /opt/beleqet/beleqet-bot
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install fastapi "uvicorn[standard]" httpx
deactivate

# Service 2: shareandwin
cd /opt/beleqet/shareandwin
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install fastapi "uvicorn[standard]" httpx
deactivate

# Service 3: job
cd /opt/beleqet/job
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

---

### Step 5 - Configure Environment Variables

```bash
# Edit each file with your production values
nano /opt/beleqet/beleqet-bot/.env
nano /opt/beleqet/shareandwin/.env
nano /opt/beleqet/job/.env

# Lock down permissions
chmod 600 /opt/beleqet/beleqet-bot/.env
chmod 600 /opt/beleqet/shareandwin/.env
chmod 600 /opt/beleqet/job/.env
```

---

### Step 6 - SSL Certificates with Certbot

DNS records MUST already point to your server IP before running this:

```bash
sudo certbot --nginx \
  -d beleqetaca-api.beleqet.com \
  -d beleqetjobs-api.beleqet.com \
  -d webhook.beleqet.com \
  --non-interactive --agree-tos \
  -m admin@beleqet.com

# Verify auto-renewal works
sudo certbot renew --dry-run
```

---

### Step 7 - Nginx Configuration

```bash
# beleqet-bot API (port 8000)
sudo cp /opt/beleqet/beleqet-bot/beleqetaca-api.beleqet.com \
        /etc/nginx/sites-available/beleqetaca-api.beleqet.com
sudo ln -s /etc/nginx/sites-available/beleqetaca-api.beleqet.com \
           /etc/nginx/sites-enabled/

# shareandwin API (port 8001)
sudo cp /opt/beleqet/shareandwin/beleqetjobs-api.beleqet.com \
        /etc/nginx/sites-available/beleqetjobs-api.beleqet.com
sudo ln -s /etc/nginx/sites-available/beleqetjobs-api.beleqet.com \
           /etc/nginx/sites-enabled/

# job bot webhook (port 8080)
sudo cp /opt/beleqet/job/telegram-bot \
        /etc/nginx/sites-available/webhook.beleqet.com
sudo ln -s /etc/nginx/sites-available/webhook.beleqet.com \
           /etc/nginx/sites-enabled/

# Remove the default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

### Step 8 - Systemd Service Files

Create all service files:

```bash
# --- beleqet-bot: Telegram polling bot ---
sudo tee /etc/systemd/system/beleqet-bot.service > /dev/null <<EOF
[Unit]
Description=Beleqet Academy Bot (Telegram Polling)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/beleqet/beleqet-bot
EnvironmentFile=/opt/beleqet/beleqet-bot/.env
ExecStart=/opt/beleqet/beleqet-bot/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# --- beleqet-bot: FastAPI server (port 8000) ---
sudo tee /etc/systemd/system/beleqet-bot-api.service > /dev/null <<EOF
[Unit]
Description=Beleqet Academy FastAPI Server (Port 8000)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/beleqet/beleqet-bot
EnvironmentFile=/opt/beleqet/beleqet-bot/.env
ExecStart=/opt/beleqet/beleqet-bot/venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# --- shareandwin: Telegram polling bot ---
sudo tee /etc/systemd/system/shareandwin-bot.service > /dev/null <<EOF
[Unit]
Description=Beleqet Jobs Share-and-Win Bot (Telegram Polling)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/beleqet/shareandwin
EnvironmentFile=/opt/beleqet/shareandwin/.env
ExecStart=/opt/beleqet/shareandwin/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# --- shareandwin: FastAPI server (port 8001) ---
sudo tee /etc/systemd/system/shareandwin-api.service > /dev/null <<EOF
[Unit]
Description=Beleqet Jobs Share-and-Win FastAPI Server (Port 8001)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/beleqet/shareandwin
EnvironmentFile=/opt/beleqet/shareandwin/.env
ExecStart=/opt/beleqet/shareandwin/venv/bin/uvicorn api:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# --- job: Combined aiohttp + Bot (port 8080) ---
sudo tee /etc/systemd/system/beleqet-jobs-bot.service > /dev/null <<EOF
[Unit]
Description=Beleqet Jobs Registration Bot + SGS Challenge (Port 8080)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/beleqet/job
EnvironmentFile=/opt/beleqet/job/.env
ExecStart=/opt/beleqet/job/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

---

### Step 9 - Start and Enable All Services

```bash
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable beleqet-bot beleqet-bot-api
sudo systemctl enable shareandwin-bot shareandwin-api
sudo systemctl enable beleqet-jobs-bot

# Start immediately
sudo systemctl start beleqet-bot beleqet-bot-api
sudo systemctl start shareandwin-bot shareandwin-api
sudo systemctl start beleqet-jobs-bot

# Check status
sudo systemctl status beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot
```

---

### Step 10 - Register Telegram Webhook (Job Bot Only)

beleqet-bot and shareandwin use polling - no webhook needed for them.
Only the job bot requires webhook registration:

```bash
# Replace with your actual values from job/.env
BOT_TOKEN="<JOB_BOT_TOKEN>"
WEBHOOK_URL="https://webhook.beleqet.com/webhook"
SECRET_TOKEN="<WEBHOOK_SECRET_TOKEN>"

curl -X POST "https://api.telegram.org/bot/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"\",
    \"secret_token\": \"\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"chat_member\"]
  }"

# Verify registration
curl "https://api.telegram.org/bot/getWebhookInfo"
```

---

### Step 11 - Verify Everything Is Working

```bash
# 1. Check all services are active
sudo systemctl is-active beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# 2. Test API endpoints
curl -s https://beleqetaca-api.beleqet.com/api/user/123/stats
curl -s https://beleqetjobs-api.beleqet.com/api/user/123/stats
curl -s https://webhook.beleqet.com/

# 3. Check SQLite databases exist
ls -lh /opt/beleqet/beleqet-bot/referrals.db
ls -lh /opt/beleqet/shareandwin/referrals.db
ls -lh /opt/beleqet/job/sgs_challenge.db

# 4. Check Nginx
sudo nginx -t
sudo systemctl status nginx

# 5. Test SSL
curl -I https://beleqetaca-api.beleqet.com
curl -I https://beleqetjobs-api.beleqet.com
curl -I https://webhook.beleqet.com
```


---

## 11. Nginx Config Reference

### beleqetaca-api.beleqet.com (proxies to Port 8000)

```nginx
server {
    server_name beleqetaca-api.beleqet.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/beleqetaca-api.beleqet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beleqetaca-api.beleqet.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name beleqetaca-api.beleqet.com;
    return 301 https://$host$request_uri;
}
```

### beleqetjobs-api.beleqet.com (proxies to Port 8001)

```nginx
server {
    server_name beleqetjobs-api.beleqet.com;

    location / {
        proxy_pass          http://127.0.0.1:8001;
        proxy_http_version  1.1;
        proxy_set_header    Host $host;
        proxy_set_header    X-Real-IP $remote_addr;
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_set_header    Upgrade $http_upgrade;
        proxy_set_header    Connection "upgrade";
    }

    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/beleqetjobs-api.beleqet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beleqetjobs-api.beleqet.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name beleqetjobs-api.beleqet.com;
    return 301 https://$host$request_uri;
}
```

### webhook.beleqet.com (proxies to Port 8080)

```nginx
server {
    listen 443 ssl;
    server_name webhook.beleqet.com;

    location / {
        proxy_pass          http://127.0.0.1:8080;
        proxy_set_header    Host $host;
        proxy_set_header    X-Real-IP $remote_addr;
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
    }

    ssl_certificate     /etc/letsencrypt/live/webhook.beleqet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.beleqet.com/privkey.pem;
}

server {
    listen 80;
    server_name webhook.beleqet.com;
    return 301 https://$host$request_uri;
}
```

---

## 12. API Endpoint Reference

### beleqet-bot FastAPI (Port 8000)

Base URL: https://beleqetaca-api.beleqet.com

| Method | Path | Description |
|---|---|---|
| GET | /api/user/{user_id}/stats | Fetch user balance, total referrals, active referrals |
| POST | /api/withdraw | Request a cash withdrawal (minimum 50 ETB) |
| POST | /api/transfer | Transfer points to SMM Promo Bot |

GET /api/user/{user_id}/stats - Response example:

```json
{
  "balance": 125,
  "totalReferrals": 30,
  "activeReferrals": 25
}
```

POST /api/withdraw - Request body:

```json
{
  "user_id": 123456789,
  "amount": 100,
  "phone_number": "0911234567"
}
```

POST /api/transfer - Request body:

```json
{
  "user_id": 123456789,
  "amount": 50
}
```

> Points are deducted immediately. If the downstream Promo Bot API fails, a rollback restores the balance automatically.

---

### shareandwin FastAPI (Port 8001)

Base URL: https://beleqetjobs-api.beleqet.com

Identical API surface as beleqet-bot. Same three endpoints with the same request/response formats.
The transfer source tag is "Share & Win Bot" (vs "Beleqet Academy Bot").

---

### job Bot aiohttp Webhook (Port 8080)

Base URL: https://webhook.beleqet.com

| Method | Path | Description |
|---|---|---|
| GET | / | Health check - returns 200 OK |
| POST | /webhook | Telegram update receiver (secured with X-Telegram-Bot-Api-Secret-Token) |
| GET | /challenge | Serves SGS Challenge mini-app index.html |
| GET | /challenge/ | Same as above |
| GET | /challenge/* | Static files (CSS, JS, images) |

SGS Challenge API routes (registered by voting_routes.py):

| Method | Path | Auth Required |
|---|---|---|
| GET | /challenge/api/creators | Telegram init data |
| POST | /challenge/api/vote | Telegram init data |
| GET | /challenge/api/winners | Telegram init data |
| POST | /challenge/api/admin/creators | Admin + Telegram init data |
| PUT | /challenge/api/admin/creators/{id} | Admin + Telegram init data |
| POST | /challenge/api/admin/reset-votes | Admin + Telegram init data |
| POST | /challenge/api/register | Telegram init data |

> All challenge API calls verify Telegram Mini App initData HMAC-SHA256 with 24-hour TTL.

---

## 13. Admin Operations

### Managing Admins (beleqet-bot / shareandwin)

Use the Manage Admins button in the admin keyboard menu:
- Add Admin - send a Telegram user ID to grant admin rights
- Remove Admin - send a Telegram user ID to revoke admin rights
- List Admins - see all current admins

Or directly via SQLite on the server:

```bash
sqlite3 /opt/beleqet/beleqet-bot/referrals.db \
  "INSERT OR IGNORE INTO admins (user_id) VALUES (YOUR_TELEGRAM_ID);"
```

---

### Approving / Rejecting Withdrawals

1. User submits withdrawal via mini-app dashboard
2. FastAPI (api.py) IMMEDIATELY deducts points and inserts a 'pending' record
3. Payment handler receives a Telegram message with Approve/Reject inline buttons
4. Click Approve - marks withdrawal as 'paid' (balance already deducted, no further DB change)
5. Click Reject - refunds the points to user's score and marks as 'rejected'

> IMPORTANT: Points are locked at request time. Approval is just marking it paid. Rejection triggers the refund.

---

### Broadcasting Messages

1. Click "Broadcast Message" in admin keyboard
2. Send any message type (text, photo, video, sticker, etc.)
3. Optionally add a button (text + URL)
4. Confirm - bot queues a background job and sends at ~20 messages/second
5. A completion report is sent to admin when done

---

### Scheduling Channel Posts

1. Click "Post to Channel" in admin keyboard
2. Enter post text
3. Optionally attach a photo
4. Optionally add an inline button (text + URL)
5. Choose: Post Now OR select date/time from the calendar (East Africa Time)
6. Set repeat count (how many times per day to repeat)
7. Confirm - stored in scheduled_posts table and survives bot restarts

---

### SGS Challenge Admin Panel

The admin tab is only visible in the mini-app if your Telegram ID is in ADMIN_IDS.

Actions:
- Add Creator - fill in name, handle, avatar URL or upload image, TikTok URL
- Edit Creator - toggle active/inactive, update any field
- Reset Votes - permanently wipes all votes (use with caution)

---

## 14. Monitoring and Logs

### Live Log Tailing

```bash
# All five services at once
sudo journalctl -f \
  -u beleqet-bot \
  -u beleqet-bot-api \
  -u shareandwin-bot \
  -u shareandwin-api \
  -u beleqet-jobs-bot

# Single service
sudo journalctl -f -u beleqet-bot

# Last 100 lines with timestamps
sudo journalctl -n 100 -u beleqet-jobs-bot

# Since a specific time
sudo journalctl -u beleqet-bot --since "2026-10-01 08:00:00"
```

### Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Service Status Overview

```bash
sudo systemctl status beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot
```

### Useful Database Queries

```bash
# Total users in Academy bot
sqlite3 /opt/beleqet/beleqet-bot/referrals.db "SELECT COUNT(*) FROM users;"

# Top 10 referrers by score
sqlite3 /opt/beleqet/beleqet-bot/referrals.db \
  "SELECT user_id, username, score FROM users ORDER BY score DESC LIMIT 10;"

# Pending withdrawals
sqlite3 /opt/beleqet/beleqet-bot/referrals.db \
  "SELECT id, user_id, amount, phone_number, request_timestamp FROM withdrawals WHERE status='pending';"

# All admins
sqlite3 /opt/beleqet/beleqet-bot/referrals.db "SELECT * FROM admins;"

# SGS Challenge vote leaderboard
sqlite3 /opt/beleqet/job/sgs_challenge.db \
  "SELECT c.name, c.handle, COUNT(v.id) as votes
   FROM challenge_creators c
   LEFT JOIN challenge_votes v ON c.id = v.creator_id
   GROUP BY c.id ORDER BY votes DESC;"
```

---

## 15. Backup and Recovery

### Automated Daily Backup

```bash
# Create backup script
sudo tee /usr/local/bin/beleqet-backup.sh > /dev/null <<'SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/beleqet/"
mkdir -p ""

echo "Starting backup to ..."

cp /opt/beleqet/beleqet-bot/referrals.db    "/beleqet-bot-referrals.db"
cp /opt/beleqet/shareandwin/referrals.db    "/shareandwin-referrals.db"
cp /opt/beleqet/job/sgs_challenge.db        "/sgs_challenge.db"
cp /opt/beleqet/beleqet-bot/bot_persistence "/beleqet-bot-persistence" 2>/dev/null || true
cp /opt/beleqet/shareandwin/bot_persistence  "/shareandwin-persistence" 2>/dev/null || true

# Keep only last 30 days of backups
find /var/backups/beleqet -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo "Backup complete: "
SCRIPT

sudo chmod +x /usr/local/bin/beleqet-backup.sh

# Schedule to run at 2:00 AM every day
echo "0 2 * * * root /usr/local/bin/beleqet-backup.sh >> /var/log/beleqet-backup.log 2>&1" \
  | sudo tee /etc/cron.d/beleqet-backup

# Test it immediately
sudo /usr/local/bin/beleqet-backup.sh
```

### Restore from Backup

```bash
# Stop all services first
sudo systemctl stop beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# Set the date to restore from
RESTORE_DATE="2026-10-01"

# Restore databases
cp /var/backups/beleqet//beleqet-bot-referrals.db \
   /opt/beleqet/beleqet-bot/referrals.db
cp /var/backups/beleqet//shareandwin-referrals.db \
   /opt/beleqet/shareandwin/referrals.db
cp /var/backups/beleqet//sgs_challenge.db \
   /opt/beleqet/job/sgs_challenge.db

# Restore persistence (if needed)
cp /var/backups/beleqet//beleqet-bot-persistence \
   /opt/beleqet/beleqet-bot/bot_persistence
cp /var/backups/beleqet//shareandwin-persistence \
   /opt/beleqet/shareandwin/bot_persistence

# Restart services
sudo systemctl start beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

echo "Restore complete."
```

---

## 16. Security Hardening

### 1. Secret Management

- All secrets live in .env files with 600 permissions (owner read/write only)
- Never hardcode tokens in Python source code
- Rotate BOT_TOKEN periodically via @BotFather (/revoke and /token commands)
- Rotate WEBHOOK_SECRET_TOKEN and re-register the webhook after rotation

### 2. Network Security

- SSH accessible ONLY through WireGuard VPN (UFW blocks port 22 from public internet)
- FastAPI servers listen on 127.0.0.1 ONLY - never exposed directly to the network
- Nginx is the sole public-facing entry point on ports 80 and 443

### 3. Telegram API Security

- Job bot webhook validates X-Telegram-Bot-Api-Secret-Token header on every request
- SGS Challenge API validates Telegram initData HMAC-SHA256 with 24-hour TTL
- Admin-only challenge routes additionally verify the sender's Telegram ID is in ADMIN_IDS

### 4. CORS Policy Tightening

The FastAPI servers use allow_origins=["*"] by default.
For production security, restrict to your actual domains:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://beleqetaca-miniapp.beleqet.com",
        "https://beleqetjobs-miniapp.beleqet.com",
        "https://webhook.beleqet.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
```

### 5. Rate Limiting

The job bot implements a token bucket rate limiter (1 msg/sec per chat, burst of 30) to avoid Telegram 429 errors during broadcasts.

### 6. Database Concurrency (WAL Mode)

Enable Write-Ahead Logging to prevent "database is locked" errors when the bot and FastAPI access SQLite simultaneously:

```bash
sqlite3 /opt/beleqet/beleqet-bot/referrals.db "PRAGMA journal_mode=WAL;"
sqlite3 /opt/beleqet/shareandwin/referrals.db  "PRAGMA journal_mode=WAL;"
```

### 7. SSL/TLS

- All traffic is HTTPS-only (HTTP port 80 redirects to 443)
- Certificates auto-renew via Certbot's built-in systemd timer (certbot.timer)
- Check renewal timer status: sudo systemctl status certbot.timer

---

## 17. Troubleshooting

### Bot Not Responding to Messages

```bash
# Check if the service is running and active
sudo systemctl status beleqet-bot

# Check for errors in the last 10 minutes
sudo journalctl -u beleqet-bot --since "10 minutes ago"

# Test manually (Ctrl+C to stop)
cd /opt/beleqet/beleqet-bot
source venv/bin/activate
python main.py
```

### API Returning 502 Bad Gateway

```bash
# The upstream FastAPI process is down
sudo systemctl status beleqet-bot-api

# Check if the port is actually listening
ss -tlnp | grep 8000
ss -tlnp | grep 8001

# Start manually to see error output
cd /opt/beleqet/beleqet-bot
source venv/bin/activate
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

### Webhook Not Receiving Telegram Updates

```bash
# Check current webhook registration
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# Common causes:
# - url is empty: re-run Step 10 (setWebhook)
# - pending_update_count is growing fast: app is crashing on incoming updates
# - last_error_message shows SSL error: check certificate expiry
# - last_error_message shows timeout: check if port 8080 is listening

# Check port 8080
ss -tlnp | grep 8080

# Check Nginx is forwarding to it
sudo journalctl -u nginx -n 20
```

### Database Locked Error

```bash
# Stop services to release the lock
sudo systemctl stop beleqet-bot beleqet-bot-api

# Find which process holds the lock
fuser /opt/beleqet/beleqet-bot/referrals.db
kill <PID>

# Enable WAL mode (prevents future lock contention)
sqlite3 /opt/beleqet/beleqet-bot/referrals.db "PRAGMA journal_mode=WAL;"

# Restart
sudo systemctl start beleqet-bot beleqet-bot-api
```

### SSL Certificate Expired

```bash
# Check expiry dates for all certificates
sudo certbot certificates

# Force renew all
sudo certbot renew --force-renewal

# Reload Nginx to pick up new certs
sudo systemctl reload nginx
```

### Job Bot Fails to Import voting_routes

```bash
# The file must exist at this exact path
ls /opt/beleqet/job/sgs-challenge/server/voting_routes.py

# If missing, check the sgs-challenge directory was transferred
ls /opt/beleqet/job/sgs-challenge/

# Re-upload just that directory
scp -r ./sgs-challenge ubuntu@10.8.0.1:/opt/beleqet/job/
sudo systemctl restart beleqet-jobs-bot
```

### Services Not Restarting After Code Update

```bash
# Always run daemon-reload after modifying service files
sudo systemctl daemon-reload

# Then restart
sudo systemctl restart beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# Check for errors
sudo journalctl -xe --unit=beleqet-jobs-bot
```

---

## 18. Quick Reference Card

### Service URLs

| Service | Public URL | Internal Port |
|---|---|---|
| Academy Bot REST API | https://beleqetaca-api.beleqet.com | 8000 |
| Jobs Share and Win REST API | https://beleqetjobs-api.beleqet.com | 8001 |
| Jobs Bot Webhook | https://webhook.beleqet.com/webhook | 8080 |
| SGS Challenge Mini App | https://webhook.beleqet.com/challenge/ | 8080 |
| Health Check | https://webhook.beleqet.com/ | 8080 |

### Systemd Service Names

| Description | Service Unit Name |
|---|---|
| Academy Bot Telegram polling | beleqet-bot |
| Academy Bot FastAPI (port 8000) | beleqet-bot-api |
| Share and Win Bot polling | shareandwin-bot |
| Share and Win FastAPI (port 8001) | shareandwin-api |
| Jobs Bot aiohttp + polling (port 8080) | beleqet-jobs-bot |

### Essential Commands

```bash
# Restart all services
sudo systemctl restart beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# Stop all services
sudo systemctl stop beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# Follow all logs simultaneously
sudo journalctl -f -u beleqet-bot -u beleqet-bot-api -u shareandwin-bot -u shareandwin-api -u beleqet-jobs-bot

# Pull latest code and restart (Git workflow)
cd /opt/beleqet && git pull
sudo systemctl restart beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot

# Run manual backup
sudo /usr/local/bin/beleqet-backup.sh

# Reload Nginx after config change
sudo nginx -t && sudo systemctl reload nginx

# Check SSL certificate expiry
sudo certbot certificates
```

### VPN Commands

```bash
# Connect to VPN (Linux)
sudo wg-quick up wg0

# Disconnect VPN
sudo wg-quick down wg0

# Check VPN status
sudo wg show

# SSH into server (must be connected to VPN first)
ssh ubuntu@10.8.0.1
```

### Service File Locations on Server

```
/etc/systemd/system/beleqet-bot.service
/etc/systemd/system/beleqet-bot-api.service
/etc/systemd/system/shareandwin-bot.service
/etc/systemd/system/shareandwin-api.service
/etc/systemd/system/beleqet-jobs-bot.service

/etc/nginx/sites-available/beleqetaca-api.beleqet.com
/etc/nginx/sites-available/beleqetjobs-api.beleqet.com
/etc/nginx/sites-available/webhook.beleqet.com

/etc/wireguard/wg0.conf
```

### Code Locations on Server

```
/opt/beleqet/beleqet-bot/
/opt/beleqet/shareandwin/
/opt/beleqet/job/
```

### Backup Location

```
/var/backups/beleqet/<YYYY-MM-DD>/
```

---