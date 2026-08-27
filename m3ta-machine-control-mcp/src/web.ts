export function renderMissionControl(origin: string): string {
  const endpoint = `${origin}/mcp`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>M3ta Machine Control</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { max-width: 780px; margin: 0 auto; padding: 48px 24px; line-height: 1.5; }
    code { padding: .15rem .35rem; border: 1px solid currentColor; border-radius: .35rem; }
    .status { padding: 16px; border: 1px solid currentColor; border-radius: 12px; margin: 24px 0; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>M3ta Machine Control</h1>
  <p>MetaHuman OS machine-control MCP with a WebMCP bridge. The page proxies the same MCP tool registry; it does not define a second control plane.</p>
  <div class="status">
    <strong>MCP endpoint:</strong> <code>${endpoint}</code><br />
    <strong>Mode:</strong> audit-first / constrained
  </div>
  <h2>Current authority</h2>
  <ul>
    <li>Machine, process, port, service and runtime inspection</li>
    <li>MetaHuman OS scoped file listing and reads</li>
    <li>Git status, HEAD and diff inspection</li>
    <li>oMLX model discovery and health</li>
    <li>Qu3bii installation inspection</li>
    <li>Optional audit-only Markdown writer</li>
  </ul>
  <p>Arbitrary shell execution, service mutation and unrestricted filesystem writes are intentionally not exposed in v0.1.</p>

  <script
    type="module"
    src="https://cdn.mcp-use.com/webmcp/latest/webmcp.js"
    data-mcp-url="${endpoint}"
  ></script>
</body>
</html>`;
}
