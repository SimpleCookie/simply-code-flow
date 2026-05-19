# syntax=docker/dockerfile:1

# ── Stage 1: Build client ─────────────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm install --legacy-peer-deps

COPY shared ./shared
COPY client ./client

RUN npm run build -w @scf/client

# ── Stage 2: Build server ─────────────────────────────────────────────────────
FROM node:22-alpine AS server-build
WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --legacy-peer-deps

COPY shared ./shared
COPY server ./server

RUN npm run build -w @scf/server

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --omit=dev --legacy-peer-deps

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=client-build /app/client/dist ./client/dist
COPY shared ./shared

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/flows.json

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
