# ─── Stage 1: Build the Vite SPA ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy everything (filtered by .dockerignore) and build the SPA
COPY . .
RUN npm run build

# ─── Stage 2: Production runtime ─────────────────────────────────────────
FROM node:22-alpine

RUN addgroup -g 1000 nodeapp && adduser -u 1000 -G nodeapp -D nodeapp

WORKDIR /app

# Copy only runtime deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built SPA from builder
COPY --from=builder /build/dist ./dist

# Copy everything needed at runtime (filtered by .dockerignore)
COPY . .

# Runtime data directory (Asterisk configs, audio uploads, etc.)
RUN mkdir -p data && chown -R nodeapp:nodeapp /app

USER nodeapp
EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server.cjs"]
