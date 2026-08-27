#!/bin/sh
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "install-launchd.sh is for macOS only" >&2
  exit 1
fi

ROOT="${M3TA_ROOT:-$HOME/MetaHu3manOS}"
PACKAGE_DIR="$ROOT/40-CODE/packages/m3ta-machine-control-mcp"
NODE_BIN=$(command -v node || true)
LABEL="com.kingdomuvm3ta.machine-control"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$ROOT/logs"
AUDIT_WRITE="${M3TA_ENABLE_AUDIT_WRITE:-0}"
PORT="${M3TA_MCP_PORT:-7337}"
OMLX_URL="${M3TA_OMLX_BASE_URL:-http://127.0.0.1:8000/v1}"

if [ -z "$NODE_BIN" ]; then
  echo "node was not found on PATH" >&2
  exit 1
fi

if [ ! -f "$PACKAGE_DIR/dist/server.js" ]; then
  echo "Built connector not found at $PACKAGE_DIR/dist/server.js" >&2
  echo "Run scripts/install-local.sh first." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PACKAGE_DIR/dist/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PACKAGE_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>M3TA_ROOT</key>
    <string>$ROOT</string>
    <key>M3TA_MCP_PORT</key>
    <string>$PORT</string>
    <key>M3TA_OMLX_BASE_URL</key>
    <string>$OMLX_URL</string>
    <key>M3TA_ENABLE_AUDIT_WRITE</key>
    <string>$AUDIT_WRITE</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/m3ta-machine-control.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/m3ta-machine-control.err.log</string>
</dict>
</plist>
EOF

DOMAIN="gui/$(id -u)"
launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"

cat <<EOF
Installed launchd service: $LABEL
Plist: $PLIST
MCP: http://127.0.0.1:$PORT/mcp
WebMCP: http://127.0.0.1:$PORT/mission-control
Audit writer: $AUDIT_WRITE

Check service:
  launchctl print $DOMAIN/$LABEL
  curl http://127.0.0.1:$PORT/healthz
EOF
