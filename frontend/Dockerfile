# ─── Build stage ─────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# VITE-Vars müssen zur Build-Zeit vorliegen (werden ins Bundle gebacken).
# Werden via docker-compose build.args aus der .env durchgereicht.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ─── Runtime stage ───────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
