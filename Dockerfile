# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl python3 python3-pip ffmpeg \
    && python3 -m pip install --no-cache-dir --break-system-packages faster-whisper \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 4000

CMD sh -c "npx prisma db push && npm run start:prod"
