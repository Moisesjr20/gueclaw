# Build context: /opt/gueclaw-project/ (parent of dashboard/)
FROM node:20-alpine AS deps
WORKDIR /app
# Install root project deps (provides nodemailer, cron-parser, chokidar, etc.)
COPY package*.json ./
RUN npm ci --ignore-scripts
# Install dashboard deps
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# Root node_modules must be present for webpack module resolution
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
WORKDIR /app/dashboard
COPY --from=deps /app/dashboard/node_modules ./node_modules
COPY dashboard/ .
COPY dashboard/.env.production .env.production
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
