#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${ROOT_DIR}/exports"
STAMP="$(date +%Y%m%d-%H%M%S)"

GITHUB_DIR="${EXPORT_DIR}/teamwork-legacy-github-ready-${STAMP}"
RAW_DIR="${EXPORT_DIR}/teamwork-legacy-raw-folder-${STAMP}"
GITHUB_ZIP="${EXPORT_DIR}/teamwork-legacy-github-ready-${STAMP}.zip"
RAW_ZIP="${EXPORT_DIR}/teamwork-legacy-raw-folder-${STAMP}.zip"

mkdir -p "${EXPORT_DIR}"
rm -rf "${GITHUB_DIR}" "${RAW_DIR}"
mkdir -p "${GITHUB_DIR}" "${RAW_DIR}"

# GitHub-ready snapshot: excludes dependencies, build artifacts, and local-only files.
rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.env.local' \
  --exclude 'exports/' \
  --exclude '.DS_Store' \
  "${ROOT_DIR}/" "${GITHUB_DIR}/"

# Raw snapshot: includes build outputs/data, excludes local secrets and dependencies.
rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env.local' \
  --exclude 'exports/' \
  --exclude '.DS_Store' \
  "${ROOT_DIR}/" "${RAW_DIR}/"

(
  cd "${EXPORT_DIR}"
  zip -qry "$(basename "${GITHUB_ZIP}")" "$(basename "${GITHUB_DIR}")"
  zip -qry "$(basename "${RAW_ZIP}")" "$(basename "${RAW_DIR}")"
)

echo "Done."
echo "GitHub-ready folder: ${GITHUB_DIR}"
echo "GitHub-ready zip:    ${GITHUB_ZIP}"
echo "Raw folder:          ${RAW_DIR}"
echo "Raw folder zip:      ${RAW_ZIP}"
