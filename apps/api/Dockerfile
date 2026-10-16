FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS prune
COPY . .
RUN npx -y turbo@2.8.21 prune api --docker

FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN corepack install && pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=prune /app/out/full/ .

FROM oven/bun:1.3.14-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app ./
CMD ["bun", "apps/api/src/main.ts"]
