#!/usr/bin/env bash
# Redeploys Penny Duck in Coolify when CI has pushed new images for the watched
# tag. It only makes outbound requests (GHCR) and calls Coolify locally, so
# nothing outside needs to reach the homelab.
#
# Configuration comes from the environment (see penny-duck-deploy.env.example):
#   IMAGES         space-separated images; the last one is watched, and CI
#                  pushes it last
#   IMAGE_TAG      tag to follow; must match IMAGE_TAG in Coolify
#   COOLIFY_URL    Coolify on this host, e.g. http://localhost:8000
#   COOLIFY_TOKEN  Coolify API token with deploy permission
#   COOLIFY_UUID   the compose application's UUID
set -euo pipefail

: "${IMAGES:?IMAGES is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${COOLIFY_URL:?COOLIFY_URL is required}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is required}"
: "${COOLIFY_UUID:?COOLIFY_UUID is required}"

read -ra images <<< "$IMAGES"
watched=${images[${#images[@]} - 1]}
repo=${watched#ghcr.io/}
state="${STATE_DIRECTORY:-/var/lib/penny-duck-deploy}/$IMAGE_TAG.digest"

token=$(curl -fsS "https://ghcr.io/token?scope=repository:$repo:pull" \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
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

# Pulled here so the deploy uses them whether or not Coolify pulls itself.
for image in "${images[@]}"; do
  docker pull -q "$image:$IMAGE_TAG"
done

curl -fsS -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_UUID"
echo

mkdir -p "$(dirname "$state")"
echo "$digest" > "$state"
