FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS prune
COPY . .
RUN npx -y turbo@2.8.21 prune web --docker

FROM base AS build
COPY --from=prune /app/out/json/ .
RUN corepack install && pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
ARG API_URL
RUN pnpm --filter web build

FROM oven/bun:1.3.14-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.output ./.output
CMD ["bun", ".output/server/index.mjs"]
