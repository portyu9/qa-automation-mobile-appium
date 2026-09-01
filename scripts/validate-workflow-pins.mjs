import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = '.github/workflows';
const workflowFiles = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
const violations = [];
for (const name of workflowFiles) {
  const source = await readFile(join(directory, name), 'utf8');
  for (const match of source.matchAll(/^\s*uses:\s*([^#\s]+)(?:\s+#.*)?$/gm)) {
    const reference = match[1];
    if (!reference) continue;
    if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
    if (!/@[0-9a-f]{40}$/.test(reference)) violations.push(`${name}: mutable action reference ${reference}`);
  }
}
if (violations.length) throw new Error(`Immutable workflow policy failed:\n${violations.join('\n')}`);
console.log(`Validated immutable action references in ${workflowFiles.length} workflows.`);
