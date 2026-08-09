# syntax=docker/dockerfile:1

# =============================================================================
# Spending Tracker — Next.js standalone build
# =============================================================================

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Env validation is skipped at build time; real values are provided at runtime.
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL="file:./prisma/build.db"
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# -----------------------------------------------------------------------------
# Migrator — one-shot `prisma migrate deploy` container (full node_modules,
# because the standalone trace does not include the Prisma CLI)
# -----------------------------------------------------------------------------
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
# Invoke the Prisma CLI directly: no pnpm/corepack (which would try to
# download into a root-owned /app when running as a non-root user).
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# -----------------------------------------------------------------------------
# Runner
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# SQLite database lives on a named volume
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
