FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS prune
COPY . .
RUN npx -y turbo@2.11.9 prune api --docker

FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN corepack install && pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=prune /app/out/full/ .

FROM oven/bun:1.4.3-alpine
WORKDIR /app
ARG GIT_COMMIT_SHA
ENV NODE_ENV=production GIT_COMMIT_SHA=$GIT_COMMIT_SHA
COPY --from=deps /app ./
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-3030}/healthz" || exit 1
# Migrations run before the API starts; if one fails the container exits and
# the previous one keeps serving.
CMD ["sh", "-c", "bun --cwd packages/db src/migrate.ts && exec bun apps/api/src/main.ts"]
