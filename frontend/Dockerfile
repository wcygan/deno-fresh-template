# Build stage
FROM denoland/deno:latest AS builder

WORKDIR /app

# Copy dependency files first for better layer caching
COPY deno.json* deno.lock* ./
COPY main.ts dev.ts ./

# Pre-cache dependencies
RUN deno cache --lock=deno.lock main.ts dev.ts

# Copy source code
COPY . .

# Cache runtime dependencies after build files exist
RUN deno task build && \
    deno cache _fresh/server.js && \
    deno install --allow-scripts=npm:@tailwindcss/oxide@4.1.12 --node-modules-dir=auto

# Production stage
FROM denoland/deno:latest

WORKDIR /app

# Copy application from builder
COPY --from=builder /app .

# Copy Deno cache from the correct location
COPY --from=builder /deno-dir /deno-dir

# Set proper permissions
RUN chown -R deno:deno /app

USER deno

EXPOSE 8000

CMD ["deno", "task", "start"]