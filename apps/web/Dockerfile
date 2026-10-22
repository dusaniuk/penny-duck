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
ARG API_URL
RUN pnpm --filter web build

FROM oven/bun:1.4.3-alpine
WORKDIR /app
ARG GIT_COMMIT_SHA
ENV NODE_ENV=production GIT_COMMIT_SHA=$GIT_COMMIT_SHA
COPY --from=build /app/apps/web/.output ./.output
CMD ["bun", ".output/server/index.mjs"]
