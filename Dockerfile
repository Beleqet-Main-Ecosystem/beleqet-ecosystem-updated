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
  apk add --no-cache openssl ffmpeg gcompat libstdc++ libc6-compat wget ca-certificates \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-v*

COPY --from=pruner --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=10s --start-period=180s --retries=15 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]