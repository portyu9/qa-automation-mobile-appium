import assert from 'node:assert/strict';
import test from 'node:test';
import { safeEvidenceName, sanitizeDiagnosticText, sanitizeForEvidence } from '../../src/support/sanitize.js';

test('evidence sanitizer recursively redacts secret-like keys', () => {
  assert.deepEqual(
    sanitizeForEvidence({ token: 'x', nested: { apiKey: 'y', build: 'safe' }, list: [{ password: 'z' }] }),
    { token: '[REDACTED]', nested: { apiKey: '[REDACTED]', build: 'safe' }, list: [{ password: '[REDACTED]' }] },
  );
});

test('diagnostic text redacts bearer tokens, secret assignments, and URL credentials', () => {
  const raw = 'provider failed Authorization=Bearer abc.def token="top-secret" at https://user:password@grid.example.test/wd/hub';
  const sanitized = sanitizeDiagnosticText(raw);

  assert.ok(!sanitized.includes('abc.def'));
  assert.ok(!sanitized.includes('top-secret'));
  assert.ok(!sanitized.includes('user:password'));
  assert.match(sanitized, /Authorization=\[REDACTED\]/i);
  assert.match(sanitized, /token=\[REDACTED\]/i);
  assert.match(sanitized, /https:\/\/\[REDACTED\]@grid\.example\.test/);
});

test('evidence names cannot traverse directories', () => {
  assert.equal(safeEvidenceName('../../device smoke'), '..-..-device-smoke');
  assert.ok(!safeEvidenceName('../../device smoke').includes('/'));
});
