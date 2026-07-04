# Load Balancer Module

Performance & Network module for the Beleqet Global Freelance Ecosystem.

## Features

| Feature | Implementation |
|---------|----------------|
| **Round Robin** | `RoundRobinStrategy` + Nginx default upstream |
| **Least Connections** | `LeastConnectionsStrategy` + Nginx `least_conn` |
| **IP Hash / Sticky Sessions** | `IpHashStrategy` + Nginx `ip_hash` + session map |
| **Health Checks** | `LoadBalancerHealthCheckService` (scheduled HTTP probes) |
| **Multi-currency routing** | Filter backends by `X-Currency` header (ISO 4217) |
| **Region routing** | Filter backends by `X-Region` header (ISO 3166-1) |
| **GDPR** | Public API hides internal URLs; IPs pseudonymized in logs |
| **i18n** | Error messages in `src/i18n/en/` and `src/i18n/am/` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/load-balancer/ping` | Public | Upstream health probe |
| GET | `/api/v1/load-balancer/status` | Public | Pool status summary |
| GET | `/api/v1/load-balancer/backends` | Public | Backend list (URLs hidden) |
| POST | `/api/v1/load-balancer/route` | Public | Select backend for a request |
| POST | `/api/v1/load-balancer/release/:id` | Public | Release connection slot |
| GET | `/api/v1/load-balancer/admin/backends` | Admin | Full backend list with URLs |
| PATCH | `/api/v1/load-balancer/admin/config` | Admin | Update strategy / sticky sessions |
| POST | `/api/v1/load-balancer/admin/backends` | Admin | Register a backend |
| DELETE | `/api/v1/load-balancer/admin/backends/:id` | Admin | Remove a backend |
| POST | `/api/v1/load-balancer/admin/health-check` | Admin | Trigger health check |

## Docker (with Nginx)

```bash
docker compose -f docker-compose.yml -f docker-compose.load-balancer.yml up
```

Traffic enters on **port 8080** (Nginx) and is distributed across `backend-1` and `backend-2`.

## Environment Variables

See `.env.example` — `LOAD_BALANCER_*` section.
