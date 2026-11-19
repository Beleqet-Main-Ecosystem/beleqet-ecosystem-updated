# Beleqet Promotion bot

"Beleqet Promotion" is a Telegram bot with a Mini App where people buy social media promotion
(TikTok, Instagram, Telegram, Facebook and YouTube followers, likes and views) with a wallet in
birr. It's also where the referral bots send their rewards: the Boost (`bots/boost`) and Go
(`bots/go`) bots move points into a user's Promotion wallet.

- **Orders** go to the SMM panel (smmland.com). Its USD prices are shown in birr at the live rate
  plus 20%. Cancelled and partial orders are refunded when the user's orders sync.
- **Add Funds** works by Chapa (Telebirr, CBE Birr, cards) or by bank transfer: the user uploads a
  screenshot, and `ADMIN_ID` gets it in Telegram with Approve / Reject buttons.
- **Free points:** every new user gets 50, spent at 2 per unit ordered.
- **Referrals:** `/invite` gives a link. The inviter earns 1 birr when their friend first adds
  50 birr or more.

Files: `server.py` (Flask API, the bot's webhook and handlers, SQLite), `index.html` and `styles.css`
(the Mini App; `styles.css` is built from `input.css` with Tailwind 4).

It used to run on an Oracle Cloud server, which stopped answering in November 2026. It wasn't in
this repo then; the code came from `Beleqet-Main-Ecosystem/beleqet-app`. Everyone's balances were in
that server's database, so here it starts with empty wallets.

## How it runs

Like the other bots, it runs from `/opt/beleqet/promo` under systemd: the service is `beleqet-promo-bot`,
gunicorn with one worker on `127.0.0.1:8002`. nginx serves it at
`https://beleqet-promo-miniapp.beleqet.com` (see the file of that name here).

Every merge to `main` copies the code there and restarts it (`scripts/deploy/deploy-production.sh`).
Its `.env`, `venv` and `data/` (the database `promo.db` and the payment screenshots in `uploads/`)
stay on the server and are never overwritten; `data/` is backed up every night.

Only `index.html` and `styles.css` are served. The bot's `.env`, its database and the payment
screenshots never are.

## Settings (`.env`)

See `.env.example`. `BOT_TOKEN`, `WEBHOOK_SECRET_TOKEN` and `ADMIN_ID` are needed for the bot.
`SMM_API_KEY` is needed for orders, `CHAPA_SECRET_KEY` for Chapa top-ups, and `TRANSFER_SECRET_KEY`
for transfers from the referral bots.

## Setting it up on a new server

```bash
sudo mkdir -p /opt/beleqet/promo && sudo chown ahmed:ahmed /opt/beleqet/promo
cp -r bots/promo/. /opt/beleqet/promo/ && cd /opt/beleqet/promo
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cp .env.example .env && chmod 600 .env   # then fill it in
```

`/etc/systemd/system/beleqet-promo-bot.service`:

```ini
[Unit]
Description=Beleqet Promotion bot and Mini App (Port 8002)
After=network.target
[Service]
Type=simple
User=ahmed
WorkingDirectory=/opt/beleqet/promo
EnvironmentFile=/opt/beleqet/promo/.env
ExecStart=/opt/beleqet/promo/venv/bin/gunicorn --workers 1 --bind 127.0.0.1:8002 server:app
Restart=always
RestartSec=10
[Install]
WantedBy=multi-user.target
```

Keep it to one worker: the bot's handlers and SQLite expect a single process.

Then:

1. Start it: `sudo systemctl daemon-reload && sudo systemctl enable --now beleqet-promo-bot`.
2. Add the site: copy `beleqet-promo-miniapp.beleqet.com` to `/etc/nginx/sites-available/`, link it
   in `sites-enabled`, then `sudo nginx -t && sudo systemctl reload nginx`.
3. Once the domain's DNS points at the server, get its certificate:
   `sudo certbot --nginx -d beleqet-promo-miniapp.beleqet.com`.
4. Once `BOT_TOKEN` and `WEBHOOK_SECRET_TOKEN` are set, connect the bot to Telegram by opening
   `https://beleqet-promo-miniapp.beleqet.com/set_webhook` once.

## Transfers from the referral bots

The referral bots on the same server send transfers straight to this bot, with these lines in both
`/opt/beleqet/boost/.env` and `/opt/beleqet/go/.env`:

```
PROMO_BOT_API_URL=http://127.0.0.1:8002/api/internal/transfer_points
TRANSFER_SECRET_KEY=<the same value as in this bot's .env>
```

Then restart `beleqet-boost-api` and `beleqet-go-api`. nginx doesn't pass `/api/internal/` through
from outside.

Without `TRANSFER_SECRET_KEY`, transfers are switched off on both sides: the referral bots answer
"Transfers are not available right now" and this bot refuses them.

## Tests

From this folder: `python -m unittest test_promo_bot`. The tests cover sign-in, the files it
serves, the webhook secret, transfers and deposit approval. They are never copied to the server.
