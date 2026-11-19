# nginx

The site configs exactly as production runs them. On the server each file is
`/etc/nginx/sites-available/<name>.conf`, enabled by a link in `/etc/nginx/sites-enabled/`.

| File | Serves | Goes to |
|---|---|---|
| `beleqetjobs.conf` | beleqetjobs.com (website and SGS Challenge), api., admin., www. | 3001, 8082, 4000, 3000 |
| `boost-api.conf` | beleqetaca-api.beleqet.com, the Boost bot's Mini App API | 8000 |
| `go-api.conf` | beleqetjobs-api.beleqet.com, the Go bot's Mini App API | 8001 |
| `promo.conf` | beleqet-promo-miniapp.beleqet.com, the Promotion bot | 8002 |

Deploys don't install these. After changing one here, copy it to the server, then
`sudo nginx -t && sudo systemctl reload nginx`. The TLS certificates are managed by certbot,
which edits these files when it renews; copy such changes back here.
