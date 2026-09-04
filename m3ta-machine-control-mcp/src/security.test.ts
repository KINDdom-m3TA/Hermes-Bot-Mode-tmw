import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PathGuard, redactSecrets } from './security.js';

test('PathGuard permits normal files and rejects traversal, sensitive paths, and symlink escapes', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'm3ta-guard-'));
  const root = path.join(base, 'root');
  const outside = path.join(base, 'outside');
  await fs.promises.mkdir(root);
  await fs.promises.mkdir(outside);
  await fs.promises.writeFile(path.join(root, 'DNA.yaml'), 'mission: test\n');
  await fs.promises.writeFile(path.join(root, '.env'), 'TOKEN=secret\n');
  await fs.promises.writeFile(path.join(outside, 'outside.txt'), 'outside\n');
  await fs.promises.symlink(outside, path.join(root, 'escape'));

  const guard = new PathGuard(root);
  assert.equal(guard.resolveExisting('DNA.yaml').relative, 'DNA.yaml');
  assert.throws(() => guard.resolveExisting('../outside/outside.txt'));
  assert.throws(() => guard.resolveExisting('.env'));
  assert.throws(() => guard.resolveExisting('escape/outside.txt'));

  await fs.promises.rm(base, { recursive: true, force: true });
});

test('redactSecrets removes common bearer and API token shapes', () => {
  const input = 'Authorization: Bearer abc.def.ghi api_key=supersecretvalue sk-abcdefghijklmnop';
  const output = redactSecrets(input);
  assert.doesNotMatch(output, /abc\.def\.ghi/);
  assert.doesNotMatch(output, /supersecretvalue/);
  assert.doesNotMatch(output, /sk-abcdefghijklmnop/);
});
