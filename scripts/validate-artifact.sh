#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"
require_hosting=0
if [[ "${1:-}" == "--require-hosting" ]]; then
  require_hosting=1
fi

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
if [[ "${require_hosting}" == "1" && ! -f "${hosting}" ]]; then
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
fi

node --input-type=module - "${worker}" "${hosting}" "${require_hosting}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath, requireHosting] = process.argv.slice(2);
if (requireHosting === "1") {
  JSON.parse(await readFile(hostingPath, "utf8"));
}

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

if [[ "${require_hosting}" == "1" ]]; then
  echo "Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present."
else
  echo "Validated production artifact: ESM Worker default.fetch is present."
fi
