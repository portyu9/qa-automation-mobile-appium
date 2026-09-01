import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadRuntimeConfig } from '../../src/config/runtime.js';
import { SessionManager } from '../../src/session/session-manager.js';
import { sanitizeForEvidence } from '../../src/support/sanitize.js';

const config = loadRuntimeConfig(process.env);
const manager = new SessionManager(config);

await mkdir(config.evidenceDir, { recursive: true });

await manager.withSession('device-smoke', async (session) => {
  const source = await session.getPageSource();
  assert.ok(source.length > 40, 'Application hierarchy should be non-trivial');
  const contexts = session.getContexts ? await session.getContexts() : [];
  const summary = sanitizeForEvidence({
    schemaVersion: 1,
    outcome: 'success',
    platform: config.platform,
    deviceName: config.deviceName,
    contexts,
    capabilities: session.capabilities ?? {},
    pageSourceLength: source.length,
  });
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  await writeFile(join(config.evidenceDir, 'device-smoke-summary.json'), serialized, {
    encoding: 'utf8',
    mode: 0o600,
  });
  process.stdout.write(serialized);
});
