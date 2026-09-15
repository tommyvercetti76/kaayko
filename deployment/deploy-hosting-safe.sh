#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

node "$ROOT_DIR/scripts/check-static-asset-refs.js"
node "$ROOT_DIR/scripts/build-link-site.js"
firebase deploy --config "$ROOT_DIR/firebase.json" --only hosting
