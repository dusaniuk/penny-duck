#!/usr/bin/env bash
# Redeploys Penny Duck in Coolify when CI has pushed new images for the watched
# tag: api first, then web once api's deployment has finished, so new web code
# never talks to an old API. It only makes outbound requests (GHCR) and calls
# Coolify locally, so nothing outside needs to reach the homelab.
#
# Configuration comes from the environment (see penny-duck-deploy.env.example):
#   IMAGES            space-separated images; the last one is watched, and CI
#                     pushes it last
#   IMAGE_TAG         tag to follow; must match the tag the Coolify apps use
#   COOLIFY_URL       Coolify on this host, e.g. http://localhost:8000
#   COOLIFY_TOKEN     Coolify API token with deploy permission
#   COOLIFY_API_UUID  the api application's UUID
#   COOLIFY_WEB_UUID  the web application's UUID
set -euo pipefail

: "${IMAGES:?IMAGES is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${COOLIFY_URL:?COOLIFY_URL is required}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is required}"
: "${COOLIFY_API_UUID:?COOLIFY_API_UUID is required}"
: "${COOLIFY_WEB_UUID:?COOLIFY_WEB_UUID is required}"
POLL_SECONDS=${POLL_SECONDS:-10}

read -ra images <<< "$IMAGES"
watched=${images[${#images[@]} - 1]}
repo=${watched#ghcr.io/}
state="${STATE_DIRECTORY:-/var/lib/penny-duck-deploy}/$IMAGE_TAG.digest"

coolify() {
  curl -fsS -H "Authorization: Bearer $COOLIFY_TOKEN" "$@"
}

# Field values are read with sed so the host needs no jq; the deployment's
# logs are a JSON string whose escaped quotes don't match these patterns.
json_field() {
  sed -nE "s/.*\"$1\":[[:space:]]*\"([^\"]+)\".*/\1/p"
}

deploy() {
  local uuid=$1 deployment status=""
  deployment=$(coolify -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$uuid" \
    | json_field deployment_uuid)
  if [[ -z "$deployment" ]]; then
    echo "Coolify didn't queue a deployment for $uuid" >&2
    return 1
  fi
  for _ in $(seq $((900 / POLL_SECONDS))); do
    sleep "$POLL_SECONDS"
    status=$(coolify "$COOLIFY_URL/api/v1/deployments/$deployment" \
      | json_field status)
    case "$status" in
      finished)
        echo "Deployed $uuid"
        return 0
        ;;
      failed | cancelled*)
        echo "Deployment of $uuid $status" >&2
        return 1
        ;;
    esac
  done
  echo "Deployment of $uuid still ${status:-unknown} after 15 minutes" >&2
  return 1
}

token=$(curl -fsS "https://ghcr.io/token?scope=repository:$repo:pull" \
  | json_field token)
digest=$(curl -fsS -I \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json" \
  "https://ghcr.io/v2/$repo/manifests/$IMAGE_TAG" \
  | tr -d '\r' | awk -F': ' 'tolower($1) == "docker-content-digest" { print $2 }')

if [[ -z "$digest" ]]; then
  echo "No digest for $watched:$IMAGE_TAG" >&2
  exit 1
fi
if [[ -f "$state" && "$(cat "$state")" == "$digest" ]]; then
  exit 0
fi

echo "New $watched:$IMAGE_TAG ($digest), deploying"

# Pulled here so the deploys use them whether or not Coolify pulls itself.
for image in "${images[@]}"; do
  docker pull -q "$image:$IMAGE_TAG"
done

# Recorded before deploying: a failed deploy is reported once instead of being
# retried every few minutes; the next image (or a manual deploy) tries again.
mkdir -p "$(dirname "$state")"
echo "$digest" > "$state"

deploy "$COOLIFY_API_UUID"
deploy "$COOLIFY_WEB_UUID"
