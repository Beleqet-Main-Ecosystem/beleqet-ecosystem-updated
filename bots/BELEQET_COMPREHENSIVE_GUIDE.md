# Beleqet Platform — Deep Explanation & Complete Deployment Guide

> Written for someone new to DevOps. Every term is explained the first time it appears.
> The code is already written. Your job is to deploy it on a Linux server.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [Understanding the Folder Structure](#2-understanding-the-folder-structure)
3. [Bot 1: beleqet-bot (Academy Rewards)](#3-bot-1-beleqet-bot--academy-rewards-bot)
4. [Bot 2: shareandwin (Jobs Rewards)](#4-bot-2-shareandwin--jobs-rewards-bot)
5. [Bot 3: job (Registration + SGS Challenge)](#5-bot-3-job--registration--sgs-challenge)
6. [How the Three Bots Connect to Each Other](#6-how-the-three-bots-connect-to-each-other)
7. [The Database — How Data Is Stored](#7-the-database--how-data-is-stored)
8. [The Server Infrastructure](#8-the-server-infrastructure)
9. [Complete Step-by-Step Deployment](#9-complete-step-by-step-deployment)
10. [After Deployment — Daily Operations](#10-after-deployment--daily-operations)
11. [Troubleshooting Guide](#11-troubleshooting-guide)
12. [Full Terminology Dictionary](#12-full-terminology-dictionary)

---

## 1. What Is This Project?

### The Business Context

Beleqet is an Ethiopian job platform (like LinkedIn + job board). It has a website at `beleqet.com`. This codebase is the **Telegram** part of the platform — three bots and a mini voting website that all live together on one rented Linux computer.

### What Is a "Bot"?

A **Telegram bot** is an automated account on Telegram that responds to messages with code. When you message it, your message goes to Telegram's servers, which forward it to the bot's code running on a computer somewhere, which processes it and sends a reply back.

```
You type "/start"
      ↓
Telegram's servers
      ↓
Your server running the Python code
      ↓
Python reads your message, runs logic
      ↓
Sends a reply back through Telegram
      ↓
You see the reply
```

### What Is a "Monorepo"?

> **Monorepo** = mono (one) + repo (repository = project folder)

It means one parent folder contains multiple separate projects. All three bots live in one `beleqet/` folder. They don't share any code — they just live next to each other for organizational convenience.

```
beleqet/               ← The monorepo (parent folder)
  ├── beleqet-bot/     ← Project 1: a complete, independent Python program
  ├── shareandwin/     ← Project 2: another complete, independent Python program
  └── job/             ← Project 3: another complete, independent Python program
```

Each sub-folder has its own:
- Python files (the code)
- `.env` file (secret configuration)
- `requirements.txt` (list of external libraries needed)
- SQLite database file (the data storage)

---

## 2. Understanding the Folder Structure

Let's look at every file and what it does:

```
beleqet/
│
├── beleqet-bot/
│   ├── main.py                       ← The Telegram bot itself (781 lines)
│   ├── api.py                        ← A small web server for the Mini App (192 lines)
│   ├── .env                          ← Secret config values (bot token, admin IDs, etc.)
│   ├── requirements.txt              ← List of Python libraries to install
│   ├── referrals.db                  ← SQLite database (auto-created when bot first runs)
│   ├── bot_persistence               ← A file where the bot saves conversation state
│   ├── Promo.jpg                     ← Welcome image sent to new users
│   └── beleqetaca-api.beleqet.com    ← Nginx config file (traffic routing rules)
│
├── shareandwin/
│   ├── main.py                       ← The Telegram bot (781 lines, nearly identical to above)
│   ├── api.py                        ← Small web server (port 8001)
│   ├── .env                          ← Different secret values
│   ├── requirements.txt              ← Same libraries
│   ├── referrals.db                  ← Separate database
│   ├── bot_persistence               ← Separate conversation state
│   ├── Promo.jpg                     ← Welcome image
│   └── beleqetjobs-api.beleqet.com   ← Nginx config file
│
└── job/
    ├── main.py                       ← The job bot + web server (1376 lines, most complex)
    ├── .env                          ← Config for job bot
    ├── requirements.txt              ← Different libraries
    ├── sgs_challenge.db              ← Database for SGS challenge voting
    ├── telegram-bot                  ← Nginx config file
    └── sgs-challenge/
        ├── app/
        │   ├── index.html            ← The voting website (opens inside Telegram)
        │   ├── style.css             ← Styling for the website
        │   ├── app.js                ← Frontend JavaScript logic
        │   └── uploads/              ← Uploaded creator images
        └── server/
            └── voting_routes.py      ← API endpoints for the voting system (445 lines)
```

---

## 3. Bot 1: beleqet-bot — Academy Rewards Bot

### What It Does (User's Perspective)

1. User messages the bot on Telegram
2. Bot sends a welcome message + photo with a "Join Channel" button
3. User clicks and joins the Beleqet Academy Telegram channel
4. User gets a unique invite link (like `https://t.me/BeleqetBoost?start=123456789`)
5. User shares this link with friends
6. When a friend joins via that link → **+1 point = +1 ETB** for the referrer
7. If the friend later leaves → point is taken away (keeps it honest)
8. User can withdraw earnings to mobile money (minimum 50 ETB)
9. User can also transfer points to the Beleqet Promo Bot

---

## 4. Bot 2: shareandwin — Jobs Rewards Bot

This is nearly copy-paste identical to `beleqet-bot`. The differences:

| Feature | beleqet-bot | shareandwin |
|---|---|---|
| Bot name | BeleqetBoost_Bot | BeleqetJobsInviteAndWin_Bot |
| Channel | Beleqet Academy | Beleqet Jobs |
| Invite link | `t.me/BeleqetBoost` | `t.me/BeleqetJobs` |
| Mini App URL | `beleqetaca-miniapp.beleqet.com` | `beleqetjobs-miniapp.beleqet.com` |
| FastAPI port | 8000 | 8001 |
| Transfer tag | "Beleqet Academy Bot" | "Share & Win Bot" |
| ADMIN_IDS | single value | comma-separated list |
| Welcome media | `Promo.jpg` (photo) | MP4 video URL |

---

## 5. Bot 3: job — Registration + SGS Challenge

This is the most complex service. It does TWO completely different things inside one program:

### Part A: Job Registration Bot
- Bilingual onboarding: English / Amharic
- Job Seeker registration vs Employer registration (with Trade License verification)
- Integration with WordPress (`beleqet.com/vacancy`) via REST API
- Telegram Mini App dashboard launcher

### Part B: SGS Challenge Voting Mini App
- Located in `job/sgs-challenge/`
- Embedded voting mini-app for TikTok creators
- Protected with HMAC-SHA256 signature verification

---

## 6. How the Three Bots Connect to Each Other

- `beleqet-bot` and `shareandwin` communicate with external Promo SMM Bot via HTTP for point transfers.
- `job` communicates with WordPress via HTTP for user account registration.
- The three bots run independently on the same server behind Nginx.

---

## 7. The Database — How Data Is Stored

SQLite databases live directly on disk as `.db` files:
- `beleqet-bot/referrals.db`
- `shareandwin/referrals.db`
- `job/sgs_challenge.db`

---

## 8. The Server Infrastructure

- **VPS:** Ubuntu Linux server running 24/7.
- **VPN (WireGuard):** Secures management access (SSH port 22 only accessible via VPN subnet `10.8.0.0/24`).
- **Nginx:** Reverse proxy forwarding domain requests to internal ports (`8000`, `8001`, `8080`).
- **systemd:** Manages background services, restart on crash, and autostart on reboot.

---

## 9. Complete Step-by-Step Deployment

### Phase 1: Connect via VPN
```powershell
# Open WireGuard GUI on Windows -> Activate tunnel
# SSH into VPS:
ssh ubuntu@10.8.0.1
```

### Phase 2: Install Packages on Server
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git ufw curl sqlite3
```

### Phase 3: Upload Code from Local Machine
In local Windows PowerShell:
```powershell
ssh ubuntu@10.8.0.1 "sudo mkdir -p /opt/beleqet && sudo chown ubuntu:ubuntu /opt/beleqet"
scp -r "C:\Users\m\Downloads\Telegram Desktop\beleqet\beleqet-bot" ubuntu@10.8.0.1:/opt/beleqet/
scp -r "C:\Users\m\Downloads\Telegram Desktop\beleqet\shareandwin" ubuntu@10.8.0.1:/opt/beleqet/
scp -r "C:\Users\m\Downloads\Telegram Desktop\beleqet\job" ubuntu@10.8.0.1:/opt/beleqet/
```

### Phase 4: Virtual Environments
On VPS:
```bash
# Service 1
cd /opt/beleqet/beleqet-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install fastapi "uvicorn[standard]" httpx
deactivate

# Service 2
cd /opt/beleqet/shareandwin
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install fastapi "uvicorn[standard]" httpx
deactivate

# Service 3
cd /opt/beleqet/job
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### Phase 5: Lock File Permissions
```bash
chmod 600 /opt/beleqet/beleqet-bot/.env
chmod 600 /opt/beleqet/shareandwin/.env
chmod 600 /opt/beleqet/job/.env
```

### Phase 6: SSL & Nginx Configuration
```bash
# SSL Certificates
sudo certbot --nginx \
  -d beleqetaca-api.beleqet.com \
  -d beleqetjobs-api.beleqet.com \
  -d webhook.beleqet.com \
  --non-interactive --agree-tos \
  -m admin@beleqet.com

# Nginx vhosts
sudo cp /opt/beleqet/beleqet-bot/beleqetaca-api.beleqet.com /etc/nginx/sites-available/
sudo cp /opt/beleqet/shareandwin/beleqetjobs-api.beleqet.com /etc/nginx/sites-available/
sudo cp /opt/beleqet/job/telegram-bot /etc/nginx/sites-available/webhook.beleqet.com

sudo ln -s /etc/nginx/sites-available/beleqetaca-api.beleqet.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/beleqetjobs-api.beleqet.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/webhook.beleqet.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

### Phase 7: Systemd Services
Setup systemd files for:
- `beleqet-bot.service`
- `beleqet-bot-api.service`
- `shareandwin-bot.service`
- `shareandwin-api.service`
- `beleqet-jobs-bot.service`

Enable & Start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now beleqet-bot beleqet-bot-api shareandwin-bot shareandwin-api beleqet-jobs-bot
```

### Phase 8: Webhook Registration (job bot only)
```bash
BOT_TOKEN=$(grep BOT_TOKEN /opt/beleqet/job/.env | cut -d'"' -f2)
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.beleqet.com/webhook",
    "secret_token": "27805717db90707de557a1b62257c54936f563dc0e23e92762d33445cc60e4b4",
    "allowed_updates": ["message", "callback_query", "chat_member"]
  }'
```

### Phase 9: Database WAL Mode
```bash
sqlite3 /opt/beleqet/beleqet-bot/referrals.db "PRAGMA journal_mode=WAL;"
sqlite3 /opt/beleqet/shareandwin/referrals.db  "PRAGMA journal_mode=WAL;"
```

---

## 10. After Deployment — Daily Operations

### Logs
```bash
sudo journalctl -f -u beleqet-bot -u beleqet-bot-api -u shareandwin-bot -u shareandwin-api -u beleqet-jobs-bot
```

### Restarting
```bash
sudo systemctl restart beleqet-jobs-bot
```

---

## 11. Troubleshooting Guide

- **Bot not responding:** Check `sudo systemctl status beleqet-bot` and `sudo journalctl -n 50 -u beleqet-bot`.
- **502 Bad Gateway:** The FastAPI backend is down. Check port 8000/8001 via `ss -tlnp`.
- **Database locked:** Ensure WAL mode is active on SQLite files.
- **Webhook issues:** Run `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.

---

## 12. Full Terminology Dictionary

- **VPS:** Virtual Private Server
- **SSH:** Secure Shell remote terminal
- **VPN / WireGuard:** Encrypted tunnel protecting management ports
- **Nginx:** Reverse proxy web server
- **SSL / Certbot:** HTTPS TLS certificates
- **systemd:** Linux service daemon manager
- **venv:** Python virtual isolated environment
- **FastAPI / Uvicorn:** Web API framework and runner
- **WAL Mode:** Write-Ahead Logging for SQLite concurrency
- **Webhook vs Polling:** Push vs pull mechanisms for Telegram updates
