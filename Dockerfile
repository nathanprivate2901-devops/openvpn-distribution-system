# Multi-stage build for OpenVPN Distribution System
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Stage 2: Production stage
FROM node:18-alpine

# Install dumb-init and Docker CLI for OpenVPN profile generation
RUN apk add --no-cache dumb-init docker-cli

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY src ./src

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
