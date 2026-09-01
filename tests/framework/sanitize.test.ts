import assert from 'node:assert/strict';
import test from 'node:test';
import { safeEvidenceName, sanitizeForEvidence } from '../../src/support/sanitize.js';

test('evidence sanitizer recursively redacts secret-like keys', () => {
  assert.deepEqual(
    sanitizeForEvidence({ token: 'x', nested: { apiKey: 'y', build: 'safe' }, list: [{ password: 'z' }] }),
    { token: '[REDACTED]', nested: { apiKey: '[REDACTED]', build: 'safe' }, list: [{ password: '[REDACTED]' }] },
  );
});

test('evidence names cannot traverse directories', () => {
  assert.equal(safeEvidenceName('../../device smoke'), '..-..-device-smoke');
  assert.ok(!safeEvidenceName('../../device smoke').includes('/'));
});
