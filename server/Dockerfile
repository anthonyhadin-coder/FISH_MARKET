# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for caching
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy build output
COPY --from=builder /app/dist ./dist

# Use non-root user for security
USER node

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
