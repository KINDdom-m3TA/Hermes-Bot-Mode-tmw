import os from 'node:os';
import path from 'node:path';

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? '7337');
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
    throw new Error('M3TA_MCP_PORT must be an integer between 1024 and 65535');
  }
  return parsed;
}

export const config = Object.freeze({
  host: '127.0.0.1',
  port: parsePort(process.env.M3TA_MCP_PORT),
  root: path.resolve(process.env.M3TA_ROOT ?? path.join(os.homedir(), 'MetaHu3manOS')),
  omlxBaseUrl: (process.env.M3TA_OMLX_BASE_URL ?? 'http://127.0.0.1:8000/v1').replace(/\/$/, ''),
  enableAuditWrite: process.env.M3TA_ENABLE_AUDIT_WRITE === '1',
  maxReadBytes: 256 * 1024,
  maxCommandBytes: 256 * 1024,
  commandTimeoutMs: 15_000
});
