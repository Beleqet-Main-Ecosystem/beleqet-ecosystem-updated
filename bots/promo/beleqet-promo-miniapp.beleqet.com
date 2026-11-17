server {
    listen 80;
    server_name beleqet-promo-miniapp.beleqet.com;

    # Payment screenshots are up to 5 MB.
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Only the referral bots on this server send transfers, straight to 127.0.0.1:8002.
    location /api/internal/ {
        return 404;
    }
}
