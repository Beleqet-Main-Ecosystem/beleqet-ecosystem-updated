# Load Balancer (Nginx)

Infrastructure solution for [issue #41](https://github.com/Beleqet-Main-Ecosystem/beleqet-ecosystem-updated/issues/41) — Performance & Network.

Traffic is distributed by **Nginx**, not by an in-app NestJS router. This avoids memory leaks from sticky-session maps, unreliable connection tracking, and returning unreachable Docker-internal URLs to clients.

## Features

| Requirement | Implementation |
|-------------|----------------|
| Traffic distribution | Nginx `upstream` (`ip_hash` default; `least_conn` / round robin optional) |
| Health checks | Passive: `max_fails` + `fail_timeout`; Docker `healthcheck` on backends |
| Failover | `proxy_next_upstream` skips dead backends |
| Sticky sessions | **`ip_hash` enabled by default** (required for Socket.IO chat handshake) |
| WebSockets | `Upgrade` / `Connection` headers + `/socket.io/` location |
| Multi-currency | Forwards `X-Currency` / `X-Region` to backends |
| Horizontal scaling | Add more `server backend-N:4000` lines + compose services |

## Quick start

```bash
docker compose -f docker-compose.yml -f docker-compose.load-balancer.yml up -d --build
```

- Public entry: **http://localhost:8080**
- LB liveness: **http://localhost:8080/lb-health** → `ok`
- API (via LB): **http://localhost:8080/api/docs**

## WebSocket / Chat (Socket.IO)

Chat uses NestJS Socket.IO under `/socket.io/` (namespace `/chat`). The LB:

1. Enables **`ip_hash`** so long-polling handshake requests stick to one backend
2. Forwards **`Upgrade`** / **`Connection`** so HTTP can upgrade to WebSocket
3. Uses a long `proxy_read_timeout` on `/socket.io/` for persistent connections

Without these, chat fails with `400 Session ID unknown` or never upgrades.

## Switching strategies

Default is **`ip_hash`** (do not disable it if chat is behind this LB).

To try least connections instead, edit `upstream beleqet_backend`: comment out `ip_hash;` and uncomment `least_conn;`, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.load-balancer.yml up -d --force-recreate nginx-lb
```

## Deployment checklist

### Docker build

- [ ] `docker compose -f docker-compose.yml -f docker-compose.load-balancer.yml build` succeeds
- [ ] Images start without restart loops (`docker ps` shows healthy/up)
- [ ] Host port **8080** is free (standalone `:4000` backend is disabled in LB mode)

### Environment variables

LB mode reuses the same backend secrets as `docker-compose.yml` (JWT, DB, Redis, OpenAI). No NestJS `LOAD_BALANCER_*` env vars are required — routing is entirely in Nginx.

- [ ] `DATABASE_URL`, `REDIS_*`, `JWT_ACCESS_SECRET` set for each backend container
- [ ] No secrets committed; use `.env` / secret store in production

### Error handling / failover

- [ ] `max_fails=3 fail_timeout=30s` present on each upstream server
- [ ] `proxy_next_upstream` covers `error timeout http_502 http_503 http_504`
- [ ] Stopping one backend still serves traffic via the other (`docker stop beleqet-backend-1`)

### Verification

```bash
curl -s http://localhost:8080/lb-health
# ok

curl -sI http://localhost:8080/api/docs | head -n 1
# HTTP/1.1 200 ...
```

## Tests

```bash
npm test -- --testPathPattern=load-balancer.nginx
```
