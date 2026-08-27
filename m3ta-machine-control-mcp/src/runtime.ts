import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from './config.js';
import { PathGuard, redactSecrets, safeOutput } from './security.js';

const execFileAsync = promisify(execFile);
const guard = new PathGuard(config.root);

export type RuntimeProbeName =
  | 'claude'
  | 'codex'
  | 'grok'
  | 'opencode'
  | 't3'
  | 'hermes'
  | 'tasklet'
  | 'omlx'
  | 'ods';

async function run(command: string, args: string[], cwd = config.root): Promise<string> {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      timeout: config.commandTimeoutMs,
      maxBuffer: config.maxCommandBytes * 2,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    const stdout = String(result.stdout ?? '');
    const stderr = String(result.stderr ?? '');
    return safeOutput([stdout, stderr].filter(Boolean).join('\n').trim(), config.maxCommandBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(safeOutput(message, 16 * 1024));
  }
}

export function machineInfo(): Record<string, unknown> {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version,
    root: config.root,
    uptimeSeconds: Math.floor(os.uptime())
  };
}

export async function processList(): Promise<string> {
  // Use comm rather than full command arguments so tokens embedded in process args are never exposed.
  return run('ps', ['-axo', 'pid=,ppid=,comm=']);
}

export async function portList(): Promise<string> {
  if (process.platform === 'darwin') {
    return run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
  }
  return run('ss', ['-ltnp']);
}

export async function filesystemList(relativePath = '.'): Promise<Record<string, unknown>> {
  const resolved = guard.resolveExisting(relativePath);
  const entries = await fs.promises.readdir(resolved.absolute, { withFileTypes: true });
  return {
    path: resolved.relative,
    entries: entries.slice(0, 500).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : entry.isSymbolicLink() ? 'symlink' : 'other'
    })),
    truncated: entries.length > 500
  };
}

export async function filesystemRead(relativePath: string): Promise<Record<string, unknown>> {
  const resolved = guard.resolveExisting(relativePath);
  const stat = await fs.promises.stat(resolved.absolute);
  if (!stat.isFile()) throw new Error('Requested path is not a regular file');
  if (stat.size > config.maxReadBytes) {
    throw new Error(`File exceeds read limit of ${config.maxReadBytes} bytes`);
  }
  const raw = await fs.promises.readFile(resolved.absolute, 'utf8');
  return {
    path: resolved.relative,
    bytes: stat.size,
    content: safeOutput(raw, config.maxReadBytes)
  };
}

export async function gitStatus(): Promise<string> {
  return run('git', ['-C', config.root, 'status', '--short', '--branch']);
}

export async function gitHead(): Promise<Record<string, string>> {
  const branch = await run('git', ['-C', config.root, 'branch', '--show-current']);
  const commit = await run('git', ['-C', config.root, 'rev-parse', 'HEAD']);
  return { branch, commit };
}

export async function gitDiff(options: { staged?: boolean; path?: string }): Promise<string> {
  const args = ['-C', config.root, 'diff', '--no-ext-diff', '--no-color'];
  if (options.staged) args.push('--cached');
  if (options.path) {
    const resolved = guard.resolveExisting(options.path);
    args.push('--', resolved.relative);
  }
  return run('git', args);
}

export async function serviceStatus(label: string): Promise<string> {
  if (!/^[A-Za-z0-9_.@:-]{1,128}$/.test(label)) {
    throw new Error('Service label contains unsupported characters');
  }
  if (process.platform === 'darwin') {
    return run('launchctl', ['print', `gui/${process.getuid?.() ?? 0}/${label}`]);
  }
  return run('systemctl', ['--user', 'status', '--no-pager', label]);
}

const PROBES: Record<RuntimeProbeName, { command: string; args: string[] }> = {
  claude: { command: 'claude', args: ['--version'] },
  codex: { command: 'codex', args: ['--version'] },
  grok: { command: 'grok', args: ['--version'] },
  opencode: { command: 'opencode', args: ['--version'] },
  t3: { command: 't3', args: ['--version'] },
  hermes: { command: 'hermes', args: ['--version'] },
  tasklet: { command: 'tasklet', args: ['--version'] },
  omlx: { command: 'omlx', args: ['--version'] },
  ods: { command: 'ods', args: ['--version'] }
};

export async function runtimeProbe(name: RuntimeProbeName): Promise<Record<string, unknown>> {
  const probe = PROBES[name];
  try {
    const location = await run('which', [probe.command]);
    let version: string | null = null;
    try {
      version = await run(probe.command, probe.args);
    } catch (error) {
      version = `installed, version probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    return { name, status: 'INSTALLED', location, version };
  } catch {
    return { name, status: 'UNVERIFIED', location: null, version: null };
  }
}

export async function modelList(): Promise<Record<string, unknown>> {
  const response = await fetch(`${config.omlxBaseUrl}/models`, {
    signal: AbortSignal.timeout(config.commandTimeoutMs),
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`oMLX model endpoint returned HTTP ${response.status}`);
  }
  const body = await response.text();
  return {
    endpoint: `${config.omlxBaseUrl}/models`,
    response: JSON.parse(safeOutput(body, config.maxCommandBytes)) as unknown
  };
}

export async function modelHealth(): Promise<Record<string, unknown>> {
  try {
    const models = await modelList();
    return { status: 'LIVE', ...models };
  } catch (error) {
    return {
      status: 'UNVERIFIED',
      endpoint: config.omlxBaseUrl,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function qu3biiStatus(): Promise<Record<string, unknown>> {
  const candidate = path.join(config.root, '40-CODE', 'apps', 'qu3bii');
  if (!fs.existsSync(candidate)) {
    return { status: 'UNVERIFIED', path: '40-CODE/apps/qu3bii', exists: false };
  }
  const real = fs.realpathSync(candidate);
  const entries = await fs.promises.readdir(real);
  return {
    status: 'INSTALLED',
    path: path.relative(config.root, real),
    exists: true,
    topLevelEntries: entries.slice(0, 100)
  };
}

export async function auditWrite(filename: string, content: string, overwrite = false): Promise<Record<string, unknown>> {
  if (!config.enableAuditWrite) {
    throw new Error('Audit writing is disabled. Set M3TA_ENABLE_AUDIT_WRITE=1 and restart the server to enable it.');
  }
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9._-]*\.md$/i.test(filename)) {
    throw new Error('Audit filename must match YYYY-MM-DD-name.md');
  }
  if (Buffer.byteLength(content, 'utf8') > 512 * 1024) {
    throw new Error('Audit content exceeds 512 KiB');
  }
  if (redactSecrets(content) !== content) {
    throw new Error('Audit content appears to contain a secret or credential; refusing to write it');
  }

  const auditDir = path.join(config.root, '00-SYSTEM', 'audits');
  await fs.promises.mkdir(auditDir, { recursive: true });
  const realAuditDir = fs.realpathSync(auditDir);
  const realRoot = fs.realpathSync(config.root);
  const rel = path.relative(realRoot, realAuditDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Audit directory resolves outside M3TA_ROOT');
  }

  const destination = path.join(realAuditDir, filename);
  await fs.promises.writeFile(destination, content, {
    encoding: 'utf8',
    flag: overwrite ? 'w' : 'wx',
    mode: 0o600
  });
  return {
    status: 'written',
    path: path.relative(realRoot, destination),
    bytes: Buffer.byteLength(content, 'utf8')
  };
}
