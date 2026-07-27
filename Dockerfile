# =============================================================================
# Beleqet Backend — Multi-Stage Production Image
#
# Aligned with main branch standards + CI compatibility fixes.
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS builder

WORKDIR /app

# Install build dependencies + gcompat/libstdc++ for Prisma engine compatibility
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npm run prisma:generate

COPY . .

RUN npm run build

# ── Stage 2: Prune (Production dependencies only) ────────────────────────────
FROM node:22-alpine3.21 AS pruner

WORKDIR /app

RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# ── Stage 3: Final Runner (Hardened Image) ──────────────────────────────────
FROM node:22-alpine3.21

WORKDIR /app

ENV NODE_ENV=production

# 1. Install runtime dependencies (ffmpeg is required for Video Interview module).
# 2. FIX: Install gcompat & libstdc++ so Prisma can run on Alpine 3.21.
# 3. STRIP VULNERABLE CLIs: remove npm/corepack/yarn to pass Trivy CRITICAL scans.
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /opt/yarn-v*

# Copy production artifacts with correct ownership for the non-root 'node' user
COPY --from=pruner --chown=node:node /app/package.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

USER node

EXPOSE 4000

# Healthcheck verifies the server is responding before marking the build as success
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1

# Apply committed migrations (production-safe) before starting the server.
CMD sh -c "npx prisma migrate deploy && npm run start:prod"