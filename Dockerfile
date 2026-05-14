# Stage 1: Install all dependencies (shared across build stages)
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./

# Copy all workspace package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install all dependencies (including devDependencies needed for builds)
RUN npm ci

# Stage 2: Build the Vite frontend
FROM deps AS web-build
WORKDIR /app

# Copy package source files needed for the web build
COPY packages/shared/ ./packages/shared/
COPY packages/contracts/ ./packages/contracts/
COPY web/ ./web/

# Build Vite app — outputs to server/static (per vite.config.ts outDir)
RUN npm run build --workspace=web

# Stage 3: Build the TypeScript server
FROM deps AS server-build
WORKDIR /app

# Copy package source files needed for the server build
COPY packages/shared/ ./packages/shared/
COPY packages/contracts/ ./packages/contracts/
COPY server/ ./server/
COPY tsconfig.base.json ./

# Build TypeScript server — outputs to server/dist
RUN npm run build --workspace=server

# Stage 4: Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built packages (source needed at runtime for shared/contracts)
COPY packages/shared/ ./packages/shared/
COPY packages/contracts/ ./packages/contracts/

# Copy compiled server
COPY --from=server-build /app/server/dist ./server/dist

# Copy built frontend (served as static files)
COPY --from=web-build /app/server/static ./server/static

EXPOSE 8001

CMD ["node", "server/dist/index.js"]
