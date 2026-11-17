# 🚀 Beleqet Promo Bot & Mini App

**Beleqet Promo Bot** is an advanced Social Media Marketing (SMM) and promotional automation platform integrated into Telegram as a native **Telegram Mini App (TMA)**. Tailored for Ethiopian creators and businesses, it enables users to seamlessly boost their social media presence across TikTok, Instagram, Telegram, Facebook, and YouTube, while offering referral incentives and automated local payment methods.

---

## ✨ Key Features

### 📱 Telegram Mini App (TMA) & Bot
- **Seamless Authentication:** Secure user identification via Telegram initData HMAC-SHA256 signature verification.
- **Rich Interactive UI:** Embedded custom web front-end ([index.html](file:///C:/Users/Bisrat%20Shiferaw/Pictures/beleqet-app/beleqet%20promo%20bot/index.html) & [styles.css](file:///C:/Users/Bisrat%20Shiferaw/Pictures/beleqet-app/beleqet%20promo%20bot/styles.css)) allowing seamless navigation and immediate ordering inside Telegram.
- **Interactive Commands & Callbacks:** Welcome menus, referral link generators (`/invite`), and interactive support channels.

### 🔄 SMM Panel Automation
- **Dynamic Service Pricing:** Pulls real-time SMM services from providers (e.g., SMMLand) and dynamically converts USD rates to Ethiopian Birr (ETB) using live exchange rate APIs.
- **Built-in Profit Margin:** Easily configurable markup percentage (default 20%) over base SMM costs.
- **Automated Order Processing & Sync:** Submits orders directly to provider APIs and features automatic synchronization for partial or canceled orders, instantly processing user refunds.

### 💳 Payments & Wallet System
- **Chapa Gateway Integration:** Automated deposits via Telebirr, CBE Birr, and Ethiopian commercial bank cards.
- **Manual Bank Transfers with Telegram Workflow:** Users upload screenshot proofs and transaction numbers. Administrators receive high-priority Telegram notifications with inline **✅ Approve / ❌ Reject** buttons that credit user balances immediately upon click.
- **Dual Currency System:** Support for both regular cash balances (ETB) and free reward promotional points.

### 🔗 Inter-Bot Ecosystem Communication
- **Cross-Bot Transfers:** Secure internal transfer API endpoint allowing external ecosystem bots (such as the Beleqet Referral Bot) to push earned balance and rewards directly into a user's Promo wallet using HMAC secure headers.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.12, Flask, Flask-CORS, SQLite3 (with WAL mode & row locking protection)
- **Telegram SDK:** `pyTelegramBotAPI` (TeleBot) with webhook integration
- **WSGI & Server:** Gunicorn, Nginx Reverse Proxy
- **Containerization:** Docker & Docker Compose
- **Front-end:** Responsive Vanilla HTML5 / Custom CSS3 / JavaScript

---

## 📂 Project Structure

```text
├── server.py              # Main Flask server, database schema, API routes & Telegram webhook handlers
├── index.html             # Telegram Mini App UI frontend
├── styles.css             # Mini App stylesheet
├── Dockerfile             # Python 3.12 Slim container definition
├── docker-compose.yml     # Compose setup with volume persistence for SQLite & uploaded proofs
├── requirements.txt       # Python dependency list
├── setup_vps.sh           # Automated Ubuntu VPS setup, Nginx security headers & Let's Encrypt SSL script
└── .env.example           # Environment variables reference
```

---

## ⚙️ Configuration (.env)

Create a `.env` file in the root directory by duplicating [.env.example](file:///C:/Users/Bisrat%20Shiferaw/Pictures/beleqet-app/beleqet%20promo%20bot/.env.example):

```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Your Telegram Bot Token from @BotFather | `123456789:ABCdefGHI...` |
| `SMM_API_KEY` | API key from your SMM provider (e.g. SMMLand) | `a1b2c3d4e5...` |
| `CHAPA_SECRET_KEY`| Secret Key for Chapa payment gateways | `CHASECK_TEST-...` |
| `DB_PATH` | Path to SQLite Database | `database.db` |
| `ADMIN_ID` | Telegram User ID of the primary administrator | `123456789` |
| `WEBHOOK_DOMAIN` | HTTPS Domain for your webhooks and web app | `https://beleqet-promo-miniapp.beleqet.com`|
| `TRANSFER_SECRET_KEY`| Shared HMAC secret for cross-bot balance transfer | `a long random string` |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Python 3.10+
- Git

### 2. Installation & Running
```bash
# Clone the project & enter directory
cd "beleqet promo bot"

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask development server
python server.py
```
*The app will run locally at `http://localhost:5000`.*

---

## 🐳 Docker Deployment

The simplest way to run the application in a production-like environment is via Docker:

```bash
# Build and deploy in detached mode
docker-compose up -d --build

# Check application logs
docker logs -f beleqet_app
```
*Note: Docker Compose automatically provisions persistent volumes for `database.db` and user payment screenshot uploads (`uploads/`).*

---

## 🌐 Automated VPS Production Deployment

An automated shell script ([setup_vps.sh](file:///C:/Users/Bisrat%20Shiferaw/Pictures/beleqet-app/beleqet%20promo%20bot/setup_vps.sh)) is included for Ubuntu/Debian production servers. It performs the following automatically:
1. Installs Nginx, Certbot (Let's Encrypt), Docker, and Docker Compose.
2. Configures Nginx reverse proxy with modern security headers and Content Security Policy (CSP).
3. Issues FREE SSL/TLS HTTPS certificates.
4. Builds and launches the project inside Docker with safety protections against corrupt SQLite directories.

### Running VPS Setup on your server:
```bash
chmod +x setup_vps.sh
sudo ./setup_vps.sh
```
*After setup finishes, hit `https://your-domain.com/set_webhook` in your browser to bind Telegram webhook events to your freshly deployed app!*

---

## 📡 Key API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/services` | `GET` | Fetches live SMM services converted to ETB with profit margins applied. |
| `/api/order` | `POST` | Validates TMA authorization, checks balance/points, and executes SMM orders. |
| `/api/deposit/manual`| `POST` | Submits payment screenshots and notifies Telegram admin for 1-click review. |
| `/api/internal/transfer_points`| `POST` | Secure cross-bot ecosystem transfer endpoint (requires `X-Transfer-Secret` header). |
| `/set_webhook` | `GET` | Registers your `WEBHOOK_DOMAIN/webhook` directly with Telegram servers. |
| `/health` | `GET` | Container healthcheck monitoring endpoint. |

---

## 🤝 Contributing & Maintenance
When making modifications to the schema or endpoints:
- Keep SQLite execution safely wrapped inside single-worker processes or utilize proper transaction boundaries to avoid runtime table locks.
- Preserve Telegram HMAC header validations (`require_auth()`) on all state-mutating endpoints to protect user balances.
