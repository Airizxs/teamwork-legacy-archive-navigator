#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DB="${1:-${ROOT_DIR}/archive.db}"
OUTPUT_SQL="${2:-${ROOT_DIR}/cloudflare/d1-seed.sql}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required to export D1 seed SQL." >&2
  exit 1
fi

if [[ ! -f "${SOURCE_DB}" ]]; then
  echo "Source DB not found: ${SOURCE_DB}" >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT_SQL}")"

# Export only the core archive tables used by the app API.
sqlite3 "${SOURCE_DB}" ".dump projects tasks messages milestones" \
  | awk '!/^BEGIN TRANSACTION;$/ && !/^COMMIT;$/' \
  > "${OUTPUT_SQL}"

echo "D1 seed SQL exported:"
echo "  ${OUTPUT_SQL}"
