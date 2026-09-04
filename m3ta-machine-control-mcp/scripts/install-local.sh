#!/bin/sh
set -eu

ROOT="${M3TA_ROOT:-$HOME/MetaHu3manOS}"
DEST="$ROOT/40-CODE/packages/m3ta-machine-control-mcp"
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -d "$ROOT" ]; then
  echo "MetaHuman OS root not found: $ROOT" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"

if [ "$SOURCE_DIR" != "$DEST" ]; then
  mkdir -p "$DEST"
  rsync -a \
    --exclude node_modules \
    --exclude dist \
    "$SOURCE_DIR/" "$DEST/"
fi

cd "$DEST"

npm install --no-audit --no-fund
npm run build
npm test

cat <<EOF

M3ta Machine Control installed and verified at:
  $DEST

Start read-only mode:
  cd "$DEST" && npm start

Start M0 mode with audit-only write enabled:
  cd "$DEST" && M3TA_ENABLE_AUDIT_WRITE=1 npm start

Health check:
  curl http://127.0.0.1:7337/healthz

WebMCP Mission Control:
  http://127.0.0.1:7337/mission-control
EOF
