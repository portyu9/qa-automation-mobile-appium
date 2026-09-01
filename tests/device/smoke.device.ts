import assert from 'node:assert/strict';
import { loadRuntimeConfig } from '../../src/config/runtime.js';
import { SessionManager } from '../../src/session/session-manager.js';
import { sanitizeForEvidence } from '../../src/support/sanitize.js';

const config = loadRuntimeConfig(process.env);
const manager = new SessionManager(config);

await manager.withSession('device-smoke', async (session) => {
  const source = await session.getPageSource();
  assert.ok(source.length > 40, 'Application hierarchy should be non-trivial');
  const contexts = session.getContexts ? await session.getContexts() : [];
  const summary = {
    schemaVersion: 1,
    platform: config.platform,
    deviceName: config.deviceName,
    contexts,
    capabilities: sanitizeForEvidence(session.capabilities ?? {}),
    pageSourceLength: source.length,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
});
