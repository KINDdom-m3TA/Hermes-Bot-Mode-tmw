# M3ta Machine Control MCP

Permissioned machine-control bridge for **MetaHuman OS / M3ta-OS**.

This package exposes one authoritative machine-control tool registry through two surfaces:

1. **MCP** at `http://127.0.0.1:7337/mcp` for Secure MCP Tunnel / ChatGPT / MCP clients.
2. **WebMCP Mission Control** at `http://127.0.0.1:7337/mission-control`, which proxies the same MCP server instead of defining duplicate tools.

## Authority model

v0.1 is deliberately **audit-first**. It supports the `QU3BII-RUNTIME-RECONCILE.v1 / M0` truth audit without exposing a general-purpose remote shell.

Read-only tools:

- `machine_info`
- `process_list`
- `port_list`
- `filesystem_list`
- `filesystem_read`
- `git_status`
- `git_head`
- `git_diff`
- `service_status`
- `runtime_probe`
- `model_list`
- `model_health`
- `qu3bii_status`

Narrow write tool:

- `audit_write` — writes only `00-SYSTEM/audits/YYYY-MM-DD-name.md`; disabled by default and rejects content matching common secret/token patterns.

Not exposed in v0.1:

- arbitrary shell execution
- unrestricted filesystem writes
- Git commit/push
- package installation
- service start/stop/restart
- unattended external actions

Those belong in the next capability tier after M0 verifies the connector and policy boundary.

## Security boundary

- HTTP binds only to `127.0.0.1`.
- MCP requests pass localhost Host and Origin validation.
- Filesystem paths must be relative to `M3TA_ROOT`.
- Real paths are checked after symlink resolution to prevent root escape.
- Known sensitive paths such as `.env`, `.git`, `.ssh`, `.aws`, credentials and private-key names are denied.
- Process inspection uses executable names rather than full command arguments.
- Tool output is size-limited and common credential formats are redacted.
- `audit_write` is annotated as a destructive/write action so MCP hosts can require approval.
- No secret belongs in source control or an MCP manifest.

## Requirements

- Node.js 22.16+
- macOS is the primary M0 target; Linux read-only support is included for Omarchy/ODS worker nodes.
- Canonical MetaHuman OS root at `~/MetaHu3manOS`, or set `M3TA_ROOT`.

## Install on the MetaHuman OS machine

```bash
cd ~/MetaHu3manOS/40-CODE/packages
# Move or copy this package here when the mission branch is reconciled with the live OS.
cd m3ta-machine-control-mcp
npm install
npm run build
npm test
```

Run read-only mode:

```bash
npm start
```

Run with the tightly scoped M0 audit writer enabled:

```bash
M3TA_ENABLE_AUDIT_WRITE=1 npm start
```

Health check:

```bash
curl http://127.0.0.1:7337/healthz
```

Open the local WebMCP Mission Control page:

```text
http://127.0.0.1:7337/mission-control
```

## oMLX

The default OpenAI-compatible endpoint is:

```text
http://127.0.0.1:8000/v1
```

Override it when needed:

```bash
M3TA_OMLX_BASE_URL=http://127.0.0.1:8000/v1 npm start
```

`model_list` queries `/models`; the connector does not assume which Qwen3-8B Abliterated build is installed.

## Secure MCP Tunnel

Keep this server private on loopback and run OpenAI's `tunnel-client` on the same machine. The tunnel makes the outbound connection; no public inbound MCP port is required.

Start with the version-matched operator flow:

```bash
tunnel-client help quickstart
```

Configure the resulting tunnel runtime to forward to:

```text
http://127.0.0.1:7337/mcp
```

The tunnel must be scoped to the ChatGPT workspace that should discover the connector. Use a restricted runtime key with only the tunnel permissions required by the OpenAI tunnel operator guide; never store literal keys in this repository.

## WebMCP

Mission Control loads the `@mcp-use/webmcp` browser bridge and points it back to this server's `/mcp` endpoint. The bridge registers the remote MCP tools with the page's WebMCP model context when the browser supports it.

The architectural rule is:

```text
ChatGPT custom MCP app ─┐
                       ├─> m3ta-machine-control MCP ─> MetaHuman OS
WebMCP Mission Control ─┘
```

There is one permission model and one implementation of each machine action.

## M0 success condition

After Secure MCP Tunnel exposes this server to ChatGPT, run:

```text
QU3BII-RUNTIME-RECONCILE.v1 / M0 Runtime Truth Audit
```

The connector should be able to inspect the canonical root, Qu3bii, Hermes/runtime services, T3/Claude/Codex/Grok/OpenCode, oMLX and the local model inventory, then—only with explicit write approval—create the single M0 audit under `00-SYSTEM/audits/`.
