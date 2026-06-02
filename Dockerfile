# ── AMASS Energy Console — imagine Docker (Next.js 14 standalone + Prisma/SQLite) ──
# Build:  docker build -t amass-console .
# Rulare: docker compose up -d   (vezi docker-compose.yml)
# Datele (SQLite) trăiesc într-un VOLUM montat la /app/prisma → independent + local per deployment.

# 1) Dependențe
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2) Build
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Secrete „de unică folosință" DOAR pentru build (next build evaluează modulele de auth la „Collecting page data").
# NU ajung în imaginea finală (stage separat) și NU se folosesc la runtime — acolo vin din docker-compose.
ENV NEXTAUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV CRYPTO_KEY="YnVpbGQtdGltZS1wbGFjZWhvbGRlci0zMmJ5dGVzLWtleQ=="
ENV DATABASE_URL="file:/tmp/build.db"
RUN npm run build

# 3) Runtime (mic, standalone)
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Output standalone Next + assets statice + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma: schema + clientul generat + CLI (pentru db push la pornire)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
# Normalizează CRLF→LF (dacă repo-ul a fost clonat pe Windows, git poate pune CRLF →
# linia „#!/bin/sh" devine invalidă în container → „exec ... no such file or directory") + exec bit.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
EXPOSE 3000
# La pornire: asigură schema în DB-ul din volum, apoi pornește serverul standalone (+ auto-sync).
# Rulat prin „sh" explicit → robust chiar dacă lipsește bitul de execuție (checkout Windows).
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
