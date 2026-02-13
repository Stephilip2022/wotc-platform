FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY attached_assets ./attached_assets

COPY drizzle.config.ts ./

EXPOSE 5000

CMD ["node", "dist/index.js"]
