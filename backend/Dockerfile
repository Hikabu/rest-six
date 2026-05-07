FROM node:20-slim AS deps
WORKDIR /app
ENV npm_config_update_notifier=false
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends ca-certificates openssl \
#   && rm -rf /var/lib/apt/lists/*
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     openssl \
     python3 \
     make \
     g++ \
     build-essential \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:20-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends ca-certificates openssl \
  # && rm -rf /var/lib/apt/lists/*
RUN apt-get update \
&& apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    python3 \
    make \
    g++ \
    build-essential \
&& rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_update_notifier=false
# RUN apt-get update \
#   && apt-get install -y --no-install-recommends ca-certificates openssl \
#   && rm -rf /var/lib/apt/lists/*
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     openssl \
     python3 \
     make \
     g++ \
     build-essential \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     openssl \
  && rm -rf /var/lib/apt/lists/*
RUN chown node:node /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["sh", "-c", "npx prisma@6 migrate deploy && node dist/main"]
