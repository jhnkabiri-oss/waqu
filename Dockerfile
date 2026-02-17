# ============================
# Stage 1: Dependencies
# ============================
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --production=false

# ============================
# Stage 2: Build
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Need dummy env vars for build (Next.js validates at build time)
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""

RUN npm run build

# ============================
# Stage 3: Production Runner
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV USE_FILE_STORE=true

# Install runtime deps
RUN apk add --no-cache libc6-compat curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create sessions directory with proper permissions
# This will be mounted as a persistent volume in Coolify
RUN mkdir -p /app/sessions && chown -R nextjs:nodejs /app/sessions

# Create store directory for file-based message store
RUN mkdir -p /app/store && chown -R nextjs:nodejs /app/store

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/wa/status || exit 1

CMD ["node", "server.js"]
