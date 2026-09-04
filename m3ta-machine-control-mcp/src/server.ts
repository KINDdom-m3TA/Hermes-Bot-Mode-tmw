import { createServer } from 'node:http';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { config } from './config.js';
import { buildServer } from './tools.js';
import { renderMissionControl } from './web.js';

const handler = createMcpHandler(buildServer);
const nodeHandler = toNodeHandler(handler);
const validateHost = localhostHostValidation();
const validateOrigin = localhostOriginValidation();
const origin = `http://${config.host}:${config.port}`;

const httpServer = createServer((req, res) => {
  if (!validateHost(req, res)) return;

  const url = new URL(req.url ?? '/', origin);

  if (url.pathname === '/mcp') {
    if (!validateOrigin(req, res)) return;
    void nodeHandler(req, res);
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/readyz')) {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end(JSON.stringify({ status: 'ok', service: 'm3ta-machine-control', version: '0.1.0' }));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/mission-control')) {
    const html = renderMissionControl(origin);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'permissions-policy': 'tools=(self)',
      'content-security-policy': [
        "default-src 'self'",
        "script-src 'self' https://cdn.mcp-use.com",
        "connect-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:"
      ].join('; ')
    });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

httpServer.listen(config.port, config.host, () => {
  console.error(`[m3ta-machine-control] root=${config.root}`);
  console.error(`[m3ta-machine-control] mcp=${origin}/mcp`);
  console.error(`[m3ta-machine-control] webmcp=${origin}/mission-control`);
  console.error(`[m3ta-machine-control] audit_write=${config.enableAuditWrite ? 'enabled' : 'disabled'}`);
});

async function shutdown(signal: string) {
  console.error(`[m3ta-machine-control] ${signal}: shutting down`);
  await handler.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal).finally(() => process.exit(0));
  });
}
