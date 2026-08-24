# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS builder
WORKDIR /app
RUN sed -i 's/https/http/g' /etc/apk/repositories && apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build

# ── Stage 2: Prune ───────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS pruner
WORKDIR /app
RUN sed -i 's/https/http/g' /etc/apk/repositories && apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate && rm -rf node_modules/onnxruntime-node

# ── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:22-alpine3.21
WORKDIR /app
ENV NODE_ENV=production
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
  apk add --no-cache \
    openssl ffmpeg ffmpeg-dev ffmpeg-libs \
    gcompat libstdc++ libc6-compat \
    wget ca-certificates \
    python3 py3-pip pkgconf \
    gcc g++ musl-dev python3-dev \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
            /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-v*
# Install faster-whisper in a separate RUN so a pip failure doesn't break the
# entire backend image. Chat-to-Text degrades gracefully at runtime if absent.
RUN python3 -m pip install --no-cache-dir --prefer-binary "av==14.3.0" --break-system-packages \
  && python3 -m pip install --no-cache-dir --prefer-binary faster-whisper --break-system-packages \
  && apk del gcc g++ musl-dev python3-dev \
  || (echo "WARNING: faster-whisper unavailable — Chat-to-Text disabled" \
      && apk del gcc g++ musl-dev python3-dev 2>/dev/null; true)

COPY --from=pruner --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
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
