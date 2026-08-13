# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV npm_config_fetch_timeout=600000 \
    npm_config_fetch_retries=5
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build

# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ffmpeg ca-certificates wget \
    python3 python3-pip python3-dev build-essential pkg-config \
    libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev libavfilter-dev libswscale-dev libswresample-dev \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install --no-cache-dir --upgrade pip --break-system-packages \
  && python3 -m pip install --no-cache-dir --break-system-packages "ctranslate2>=4.0,<5" "faster-whisper==1.1.1"

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts

USER node

EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=10s --start-period=180s --retries=15 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1

# Start the server only. Migrations are a separate, explicitly controlled
# deployment step (scripts/deploy/migrate.sh) — the container never mutates the
# schema on start. Exec form with the node binary directly: npm/npx are stripped
# from this image above, so any npm-based CMD would fail to start.
CMD ["node", "dist/main"]
