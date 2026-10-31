FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS prune
COPY . .
RUN npx -y turbo@2.11.9 prune web --docker

FROM base AS build
COPY --from=prune /app/out/json/ .
RUN corepack install && pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
RUN pnpm --filter web build

FROM oven/bun:1.4.3-alpine
WORKDIR /app
ARG GIT_COMMIT_SHA
ENV NODE_ENV=production GIT_COMMIT_SHA=$GIT_COMMIT_SHA
COPY --from=build /app/apps/web/.output ./.output
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/legal/privacy" || exit 1
CMD ["bun", ".output/server/index.mjs"]
