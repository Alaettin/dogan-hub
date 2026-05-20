# ─── Build stage ─────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ─── Runtime stage ───────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
