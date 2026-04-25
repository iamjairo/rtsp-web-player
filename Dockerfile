# ── Stage 1: Build the React/Vite frontend ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install root dependencies (frontend + build tools)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source files needed for the build
COPY index.html tsconfig*.json vite.config.ts postcss.config.js tailwind.config.js ./
COPY src ./src
COPY public ./public

# Build the frontend
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install FFmpeg (required for RTSP → HLS / WebSocket transcoding)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend server and install its dependencies
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts

COPY server ./server

# Serve the static frontend with a tiny static file server bundled with the
# backend on port 80 — see server/index.js for the /static route.
# Backend API runs on port 3001; frontend is served on port 80.
COPY --from=builder /app/dist ./server/public_dist

# Expose both ports
EXPOSE 80 3001

# Runtime environment defaults (override via docker-compose or -e flags)
ENV PORT=3001 \
    STATIC_PORT=80 \
    NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

# Start the backend (also serves the static frontend)
CMD ["node", "server/index.js"]
