# =============================================================================
# Stage 1: Base — install deps and generate Prisma client
# =============================================================================
FROM node:20 AS base

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run prisma:generate

# =============================================================================
# Stage 2: Build — compile TypeScript
# =============================================================================
FROM base AS builder

RUN npm run build

# =============================================================================
# Stage 3: Test — run unit + integration tests (requires DB at runtime)
# Used by: docker-compose run --rm backend-test
# =============================================================================
FROM base AS test

# Default: run unit tests only (no DB required)
# Override CMD to run E2E: docker-compose run --rm backend-test npm run test src/modules/advanced-search/advanced-search.e2e.spec.ts
CMD ["npm", "run", "test", "src/modules/advanced-search/advanced-search.service.spec.ts"]

# =============================================================================
# Stage 4: Production — minimal image, only compiled output
# =============================================================================
FROM node:20 AS production

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npm ci --only=production

EXPOSE 4000

CMD sh -c "npx prisma db push && npm run start:prod"
