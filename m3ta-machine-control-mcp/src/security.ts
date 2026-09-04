import fs from 'node:fs';
import path from 'node:path';

const SENSITIVE_SEGMENTS = new Set([
  '.env',
  '.git',
  '.ssh',
  '.aws',
  '.gnupg',
  '.npmrc',
  '.pypirc',
  'credentials',
  'secrets',
  'id_rsa',
  'id_ed25519'
]);

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertNotSensitive(relativePath: string): void {
  const segments = relativePath.split(path.sep).filter(Boolean);
  for (const segment of segments) {
    if (SENSITIVE_SEGMENTS.has(segment.toLowerCase())) {
      throw new Error(`Access denied for sensitive path segment: ${segment}`);
    }
  }
}

export class PathGuard {
  readonly root: string;

  constructor(root: string) {
    this.root = fs.realpathSync(root);
  }

  resolveExisting(relativePath = '.'): { absolute: string; relative: string } {
    if (path.isAbsolute(relativePath)) {
      throw new Error('Paths must be relative to M3TA_ROOT');
    }

    const lexical = path.resolve(this.root, relativePath);
    if (!isInside(this.root, lexical)) {
      throw new Error('Path escapes M3TA_ROOT');
    }

    const real = fs.realpathSync(lexical);
    if (!isInside(this.root, real)) {
      throw new Error('Resolved path escapes M3TA_ROOT through a symlink');
    }

    const relative = path.relative(this.root, real) || '.';
    assertNotSensitive(relative);
    return { absolute: real, relative };
  }
}

export function redactSecrets(input: string): string {
  return input
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[REDACTED]'
    );
}

export function truncate(input: string, maxBytes: number): string {
  const bytes = Buffer.from(input, 'utf8');
  if (bytes.byteLength <= maxBytes) return input;
  return `${bytes.subarray(0, maxBytes).toString('utf8')}\n...[TRUNCATED]`;
}

export function safeOutput(input: string, maxBytes: number): string {
  return truncate(redactSecrets(input), maxBytes);
}
