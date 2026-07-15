# Frontend HelpDesk-GMP (Next.js 14 + Tailwind)
FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias (cache layer)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Codigo fuente
COPY . ./

# Build de produccion (multi-stage)
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]