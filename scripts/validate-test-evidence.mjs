import { readFile } from 'node:fs/promises';

const [path, expectedRaw] = process.argv.slice(2);
if (!path || !expectedRaw) throw new Error('Usage: validate-test-evidence <tap-path> <minimum-tests>');
const minimum = Number(expectedRaw);
if (!Number.isInteger(minimum) || minimum < 1) throw new Error('minimum-tests must be a positive integer');
const tap = await readFile(path, 'utf8');
if (!tap.startsWith('TAP version 13')) throw new Error('TAP evidence is missing its version header');
if (/^not ok\b/m.test(tap)) throw new Error('TAP evidence contains a failing test');
const plans = [...tap.matchAll(/^1\.\.(\d+)$/gm)].map((match) => Number(match[1]));
const executed = plans.reduce((sum, value) => sum + value, 0);
if (executed < minimum) throw new Error(`Expected at least ${minimum} executed tests, found ${executed}`);
if (!/# pass \d+/m.test(tap)) throw new Error('TAP evidence is missing pass-count summary');
console.log(`Validated ${executed} TAP test executions with zero failures.`);
