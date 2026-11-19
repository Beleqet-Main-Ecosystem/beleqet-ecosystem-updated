# nginx

The site configs exactly as production runs them. On the server each file is
`/etc/nginx/sites-available/<name>.conf`, enabled by a link in `/etc/nginx/sites-enabled/`.

| File | Serves | Goes to |
|---|---|---|
| `beleqetjobs.conf` | beleqetjobs.com (website and SGS Challenge), api., admin., www. | 3001, 8082, 4000, 3000 |
| `boost.conf` | boost.beleqetjobs.com: the Boost bot's Mini App, and its API under /api/ | files, 8000 |
| `go.conf` | go.beleqetjobs.com: the Go bot's Mini App, and its API under /api/ | files, 8001 |
| `promo.conf` | promo.beleqetjobs.com: the Promotion bot | 8002 |

Deploys don't install these. After changing one here, copy it to the server, then
`sudo nginx -t && sudo systemctl reload nginx`. All of these addresses are behind Cloudflare
(proxied DNS records), which serves the public certificate; nginx uses the origin certificate in
`/etc/nginx/ssl/`.
