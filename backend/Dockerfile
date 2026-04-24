FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && npm cache clean --force

FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY backend ./backend

RUN npm run build --prefix /app/backend

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=builder /app/backend ./backend

EXPOSE 3001

CMD ["sh", "-lc", "npm run start --prefix /app/backend"]
