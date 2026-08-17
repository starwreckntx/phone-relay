# syntax=docker/dockerfile:1

# ---- Builder: install all deps and compile TypeScript -> dist ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runner: production deps + compiled output only ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Seed contact map (ContactsService reads/writes ./contacts.json at runtime;
# bind-mount it via docker-compose to persist changes across restarts).
COPY --from=builder /app/contacts.json ./contacts.json
# The app listens on $PORT (default 3000) and binds all interfaces.
EXPOSE 3000
CMD ["node", "dist/main"]
