# =============================================================================
# Beleqet jobs frontend — production image (Next.js 14)
# Build context: repo root (so packages/common is accessible)
# =============================================================================

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS builder

WORKDIR /repo

# Copy shared package first so npm can resolve file: dependency
COPY packages/common ./packages/common

# Install jobs-frontend deps
WORKDIR /repo/beleqet-jobs-nextjs
COPY beleqet-jobs-nextjs/package.json beleqet-jobs-nextjs/package-lock.json ./
RUN npm ci

COPY beleqet-jobs-nextjs/ .

ARG NEXT_PUBLIC_API_URL=https://api.beleqetjobs.com/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beleqetjobs.com
ARG NEXT_PUBLIC_SITE_URL=https://beleqetjobs.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# ── Prune stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS pruner

WORKDIR /repo/beleqet-jobs-nextjs
COPY packages/common /repo/packages/common
COPY beleqet-jobs-nextjs/package.json beleqet-jobs-nextjs/package-lock.json ./
RUN npm ci --omit=dev

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine3.21 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN rm -rf \
  /usr/local/lib/node_modules/npm \
  /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm \
  /usr/local/bin/npx \
  /usr/local/bin/corepack \
  /opt/yarn-v*

COPY --from=pruner --chown=node:node /repo/beleqet-jobs-nextjs/package.json ./
COPY --from=pruner --chown=node:node /repo/beleqet-jobs-nextjs/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/beleqet-jobs-nextjs/.next ./.next
COPY --from=builder --chown=node:node /repo/beleqet-jobs-nextjs/public ./public
COPY --from=builder --chown=node:node /repo/beleqet-jobs-nextjs/next.config.js ./next.config.js

USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start"]
