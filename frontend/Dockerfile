FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && npm cache clean --force

FROM deps AS development

WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY frontend ./

EXPOSE 3000

CMD ["sh", "-c", "npx next dev --webpack -H 0.0.0.0 -p ${FRONTEND_PORT:-3000}"]

FROM node:20-bookworm-slim AS prebuilt

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY frontend/public ./public
COPY frontend/.next/standalone ./
COPY frontend/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]

FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1024
ENV CIRCLE_NODE_TOTAL=1

COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./

RUN npm run build -- --webpack

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
