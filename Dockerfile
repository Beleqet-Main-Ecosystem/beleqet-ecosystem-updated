# =============================================================================
# Beleqet backend — production image
#
# build → prune → run: the runner ships only production dependencies (which
# include the prisma CLI so `prisma migrate deploy` can run as an explicit
# deployment step — the container itself NEVER mutates the schema on start).
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl ffmpeg

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

# ── Prune stage: production-only node_modules + generated Prisma client ──────
FROM node:20-alpine AS pruner

WORKDIR /app

RUN apk add --no-cache openssl ffmpeg

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# ffmpeg/ffprobe are invoked at runtime by the video-interview module
# (src/modules/video-interview/ffmpeg.service.ts execFile calls), not just
# needed to build — must be present in the final image, matching upstream's
# original single-stage Dockerfile which installed it in both stages.
#
# Strip the base image's npm/corepack CLIs: runtime never needs them (CMD is
# `node dist/main`; migrations use `./node_modules/.bin/prisma`), and they
# ship a vulnerable bundled `tar` (CVE-2026-59873) that fails Trivy CRITICAL.
RUN apk add --no-cache openssl ffmpeg \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /opt/yarn-v* \
  && python3 -m pip install --no-cache-dir faster-whisper

COPY --from=pruner --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts

USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1

CMD ["node", "dist/main"]
