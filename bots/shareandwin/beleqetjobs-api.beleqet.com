server {
    server_name beleqetjobs-api.beleqet.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (useful if you ever add websockets to FastAPI)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/beleqetjobs-api.beleqet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beleqetjobs-api.beleqet.com/privkey.pem;
}
server {
    if ($host = beleqetjobs-api.beleqet.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name beleqetjobs-api.beleqet.com;
    return 404; # managed by Certbot


}