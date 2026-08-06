#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm ci before building." >&2
  exit 69
fi

hosting="${SITES_PROJECT_ROOT}/.openai/hosting.json"
if [[ "${SITES_REQUIRE_HOSTING:-0}" == "1" && ! -f "${hosting}" ]]; then
  echo "Sites build requires the ignored local file .openai/hosting.json." >&2
  exit 66
fi

echo "Running bounded vinext build..."
node "${script_dir}/run-with-timeout.mjs" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${SITES_BUILD_KILL_AFTER:-10s}" \
  -- "${vinext}" build

if [[ "${SITES_REQUIRE_HOSTING:-0}" == "1" ]]; then
  "${script_dir}/validate-artifact.sh" --require-hosting
else
  "${script_dir}/validate-artifact.sh"
fi
