import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['src', 'tests', 'scripts'];
const forbidden = [
  [/\bTODO\b|\bFIXME\b|\bHACK\b/, 'unfinished marker'],
  [/\.pause\s*\(/, 'fixed WebDriver pause'],
  [/waitForTimeout\s*\(/, 'fixed browser timeout'],
  [/\.only\s*\(/, 'focused test'],
  [/\.skip\s*\(/, 'skipped test'],
  [/force\s*:\s*true/, 'forced interaction'],
];

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await files(path));
    else if (['.ts', '.mjs'].includes(extname(entry.name))) output.push(path);
  }
  return output;
}

const violations = [];
for (const root of roots) {
  for (const path of await files(root)) {
    const source = await readFile(path, 'utf8');
    for (const [pattern, label] of forbidden) {
      if (pattern.test(source)) violations.push(`${path}: ${label}`);
    }
    if (path.startsWith('src/') && /console\.(log|debug)\s*\(/.test(source)) {
      violations.push(`${path}: framework source must not log ad hoc output`);
    }
  }
}
if (violations.length) throw new Error(`Repository lint policy failed:\n${violations.join('\n')}`);
console.log('Repository lint policy passed.');
