import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { config } from './config.js';
import {
  auditWrite,
  filesystemList,
  filesystemRead,
  gitDiff,
  gitHead,
  gitStatus,
  machineInfo,
  modelHealth,
  modelList,
  portList,
  processList,
  qu3biiStatus,
  runtimeProbe,
  serviceStatus,
  type RuntimeProbeName
} from './runtime.js';

function text(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }]
  };
}

async function safeCall(fn: () => Promise<unknown> | unknown) {
  try {
    return text(await fn());
  } catch (error) {
    return errorResult(error);
  }
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: 'm3ta-machine-control', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    'machine_info',
    {
      title: 'Machine information',
      description: 'Return non-secret operating-system and MetaHuman OS root information.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(machineInfo)
  );

  server.registerTool(
    'process_list',
    {
      title: 'Process list',
      description: 'List process IDs, parent IDs, and executable names without exposing command-line arguments.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(processList)
  );

  server.registerTool(
    'port_list',
    {
      title: 'Listening ports',
      description: 'List locally listening TCP ports and owning processes.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(portList)
  );

  server.registerTool(
    'filesystem_list',
    {
      title: 'List MetaHuman OS files',
      description: 'List one directory inside M3TA_ROOT. Absolute paths, symlink escapes, and sensitive paths are rejected.',
      inputSchema: z.object({
        path: z.string().max(512).default('.').describe('Path relative to M3TA_ROOT')
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ path }) => safeCall(() => filesystemList(path))
  );

  server.registerTool(
    'filesystem_read',
    {
      title: 'Read a MetaHuman OS file',
      description: 'Read a small UTF-8 file inside M3TA_ROOT with secret redaction and sensitive-path blocking.',
      inputSchema: z.object({
        path: z.string().min(1).max(512).describe('File path relative to M3TA_ROOT')
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ path }) => safeCall(() => filesystemRead(path))
  );

  server.registerTool(
    'git_status',
    {
      title: 'Git status',
      description: 'Return short Git status for the canonical MetaHuman OS root without exposing remote credentials.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(gitStatus)
  );

  server.registerTool(
    'git_head',
    {
      title: 'Git branch and commit',
      description: 'Return the current branch and HEAD commit for M3TA_ROOT.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(gitHead)
  );

  server.registerTool(
    'git_diff',
    {
      title: 'Git diff',
      description: 'Return a redacted Git diff from M3TA_ROOT. Optionally limit it to one in-root path or staged changes.',
      inputSchema: z.object({
        staged: z.boolean().default(false),
        path: z.string().max(512).optional()
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ staged, path }) => safeCall(() => gitDiff({ staged, path }))
  );

  server.registerTool(
    'service_status',
    {
      title: 'Service status',
      description: 'Inspect a launchd service on macOS or a user systemd service on Linux. This never starts, stops, or restarts it.',
      inputSchema: z.object({
        label: z.string().min(1).max(128)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ label }) => safeCall(() => serviceStatus(label))
  );

  const runtimeNames = ['claude', 'codex', 'grok', 'opencode', 't3', 'hermes', 'tasklet', 'omlx', 'ods'] as const;
  server.registerTool(
    'runtime_probe',
    {
      title: 'Runtime probe',
      description: 'Check whether a known MetaHuman OS executor/runtime CLI is installed and report its version when available.',
      inputSchema: z.object({
        name: z.enum(runtimeNames)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ name }) => safeCall(() => runtimeProbe(name as RuntimeProbeName))
  );

  server.registerTool(
    'model_list',
    {
      title: 'oMLX model list',
      description: `Query the configured OpenAI-compatible model endpoint (${config.omlxBaseUrl}/models).`,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(modelList)
  );

  server.registerTool(
    'model_health',
    {
      title: 'Model fabric health',
      description: 'Check whether the configured oMLX/OpenAI-compatible model endpoint is responding.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(modelHealth)
  );

  server.registerTool(
    'qu3bii_status',
    {
      title: 'Qu3bii status',
      description: 'Inspect whether the canonical 40-CODE/apps/qu3bii application exists and list its top-level structure.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async () => safeCall(qu3biiStatus)
  );

  server.registerTool(
    'audit_write',
    {
      title: 'Write MetaHuman OS audit artifact',
      description: 'Write one Markdown audit under 00-SYSTEM/audits. Disabled unless M3TA_ENABLE_AUDIT_WRITE=1. Refuses detected secrets.',
      inputSchema: z.object({
        filename: z.string().min(1).max(180).describe('Filename in YYYY-MM-DD-name.md format'),
        content: z.string().min(1).max(512 * 1024),
        overwrite: z.boolean().default(false)
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
    },
    async ({ filename, content, overwrite }) => safeCall(() => auditWrite(filename, content, overwrite))
  );

  return server;
}
