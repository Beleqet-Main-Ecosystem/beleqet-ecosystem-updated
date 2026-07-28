# =============================================================================
# Beleqet Backend — Multi-Stage Production Image
# =============================================================================

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS builder
WORKDIR /app
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat

# Install build dependencies + gcompat/libstdc++ for Prisma engine
RUN apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
COPY . .
RUN npm run build

# ── Stage 2: Prune ───────────────────────────────────────────────────────────
# ── Stage 2: Prune (Production dependencies only) ────────────────────────────
FROM node:22-alpine3.21 AS pruner
WORKDIR /app
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat

# Install libraries needed to generate production Prisma engine
RUN apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Stage 3: Runner
FROM node:22-alpine3.21
WORKDIR /app
ENV NODE_ENV=production
RUN sed -i 's/https/http/g' /etc/apk/repositories && \
    apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat wget ca-certificates \

# CRITICAL FIXES:
# 1. Install gcompat & libstdc++ so Prisma can run on Alpine 3.21.
# 2. ffmpeg is required for the Video Interview module.
# 3. STRIP npm, npx, corepack, and yarn to pass Trivy CRITICAL scans (tar CVE fix).
RUN apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat \
  && rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /opt/yarn-v*

COPY --from=pruner /app/package.json ./
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
USER node
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=10s --start-period=180s --retries=15 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
CMD sh -c "npx prisma migrate deploy && npm run start:prod"

# Healthcheck verifies the GraphQL server is responding for the smoke test
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1

# Start the application
CMD ["node", "dist/main"]
