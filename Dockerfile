# =============================================================================
# Beleqet Backend — Multi-Stage Production Image
<<<<<<< HEAD
=======
#
# build → prune → run: the runner ships only production dependencies.
# This version includes the Alpine 3.21 compatibility fix and security hardening.
>>>>>>> 91eb983 (fix: resolve security review comments, CI regressions, and prisma alpine compatibility)
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

# Generate Prisma client and build NestJS source
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

# Install only production dependencies
RUN npm ci --omit=dev && npx prisma generate

# ── Stage 3: Final Runner (Hardened Image) ──────────────────────────────────
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

# Copy production artifacts from previous stages
COPY --from=pruner --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Use non-privileged user for security
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
