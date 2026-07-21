# =============================================================================
# Beleqet jobs frontend — production image (Next.js 14)
#
# This Dockerfile was missing although docker-compose.yml referenced it,
# which made `docker compose build` fail. Serves on port 3001 (matching the
# compose port mappings) via the PORT env var that `next start` honors.
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_ vars must be present at build time for Next.js static generation
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Prune stage: production-only dependencies ────────────────────────────────
FROM node:20-alpine AS pruner

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=pruner --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js

USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

CMD ["npm", "run", "start"]
