# -----------------------------------------------------------------------------
#   Stage 1: Build the React/Vite frontend
#   Install ALL build-time dependencies and compile / bundle the application.
#   Nothing from this stage leaks into the runtime image except the artefacts
#   copied explicitly with COPY --from=builder.
# -----------------------------------------------------------------------------

FROM node:25-alpine AS builder

ARG APP_VERSION=1.0.0
ARG BUILD_ENV=production

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

# -----------------------------------------------------------------------------
#   Stage 2: Production image
#   Minimal image containing only what the application needs to run.
# -----------------------------------------------------------------------------

FROM node:25-alpine AS production

# Metadata labels
LABEL maintainer="iamjairo"
LABEL org.opencontainers.image.title="rtsp-web-player"
LABEL org.opencontainers.image.description="Stream multiple RTSP feeds in browser"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.url="https://github.com"
LABEL org.opencontainers.image.source="https://github.com"
LABEL org.opencontainers.image.licenses="MIT"

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

# Create a non-root user and switch to it
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

# Ensure the app directory is owned by the non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose both ports
EXPOSE 80 3001

# Runtime environment defaults (override via docker-compose or -e flags)
ENV PORT=3001 \
    STATIC_PORT=80 \
    NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Start the backend (also serves the static frontend)
CMD ["node", "server/index.js"]
