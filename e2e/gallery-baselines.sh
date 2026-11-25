#!/usr/bin/env bash
# Checks, or with --update remakes, the controls gallery's screenshot baselines inside
# Playwright's own Linux image, the same image family CI's Linux runners draw with.
#
#   bash e2e/gallery-baselines.sh            compare the gallery with the committed baselines
#   bash e2e/gallery-baselines.sh --update   remake the baselines and copy them into the checkout
#
# Run it after changing how a shared control looks, then look at every changed image before
# committing it. On macOS the gallery project skips its pixel tests (fonts draw differently
# there), so this script is how a Mac checks them.
#
# The images under e2e/tests/gallery/__screenshots__ are test baselines that CI compares
# against. They are not the review screenshots that docs/ui/README.md ("Evidence rule") keeps
# out of git; those still go in .ui-evidence/.
#
# The checkout is mounted read-only and copied into the container without node_modules, so the
# host's own installs are never used or touched. Dependencies come from the lockfiles with
# install scripts disabled. Only --update writes, and only the baseline folder.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baselines="e2e/tests/gallery/__screenshots__"

update=0
case "${1:-}" in
  '') ;;
  --update) update=1 ;;
  *)
    echo "usage: bash e2e/gallery-baselines.sh [--update]" >&2
    exit 2
    ;;
esac

# The image matches the pinned @playwright/test, so its browsers are the ones the tests expect
version="$(node -p 'const p = require(process.argv[1]); (p.devDependencies || {})["@playwright/test"] || (p.dependencies || {})["@playwright/test"] || ""' "$root/e2e/package.json")"
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "e2e/package.json must pin @playwright/test to an exact version (found '$version')" >&2
  exit 1
fi
image="mcr.microsoft.com/playwright:v${version}-noble"
# CI's runners are x86-64 (ubuntu-latest); drawing on the same architecture keeps the pixels equal
platform="linux/amd64"

docker pull --quiet --platform "$platform" "$image" >/dev/null
echo "Image: $image ($platform)"
echo "Digest: $(docker image inspect --format '{{index .RepoDigests 0}}' "$image")"

mounts=(--volume "$root:/src:ro")
if [[ $update == 1 ]]; then
  mkdir -p "$root/$baselines"
  mounts+=(--volume "$root/$baselines:/out")
fi

# Inside the container: copy the checkout without installs, builds or results, install from the
# lockfiles, run the gallery project. CI=1 when only comparing, so a missing baseline fails
# instead of being written (playwright.config.ts).
status=0
docker run --rm --init --ipc=host --platform "$platform" "${mounts[@]}" \
  --env UPDATE="$update" --env HOST_UID="$(id -u)" --env HOST_GID="$(id -g)" \
  --env npm_config_ignore_scripts=true \
  "$image" bash -euo pipefail -c '
    mkdir /work
    tar -C /src -cf - \
      --exclude=node_modules --exclude=.git --exclude=dist --exclude=test-results \
      --exclude=playwright-report --exclude=.ui-evidence --exclude=.planning --exclude=.claude . |
      tar -C /work -xf -
    npm ci --prefix /work/client --ignore-scripts --no-audit --no-fund --loglevel=error
    npm ci --prefix /work/e2e --ignore-scripts --no-audit --no-fund --loglevel=error
    cd /work/e2e
    args=(--project=gallery --reporter=list --retries=0)
    if [[ $UPDATE == 1 ]]; then
      E2E_GALLERY_ONLY=1 npx playwright test "${args[@]}" --update-snapshots=changed
      cp -R tests/gallery/__screenshots__/. /out/
      chown -R "$HOST_UID:$HOST_GID" /out
    else
      CI=1 E2E_GALLERY_ONLY=1 npx playwright test "${args[@]}"
    fi
  ' || status=$?

if [[ $update == 1 && $status == 0 ]]; then
  echo "Baselines written to $baselines; look at each changed image before committing it."
fi
exit "$status"
