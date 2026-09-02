import { access, readFile } from 'node:fs/promises';

const readme = await readFile('README.md', 'utf8');
const required = [
  '# Mobile Quality Engineering Framework — Appium + WebdriverIO',
  '## Capability map',
  '## Architecture',
  '## Execution model',
  '## Runtime contract',
  '## Android and iOS capability policy',
  '## Real-device smoke',
  '## Evidence and failure behavior',
  '## Repository map',
  '## CI and security',
  'Appium',
  'WebdriverIO',
  'Node',
  'npm',
  '`CI / ci-gate`',
  '`Security / security-gate`',
];

for (const fragment of required) {
  if (!readme.includes(fragment)) throw new Error(`README is missing required contract: ${fragment}`);
}

if (/portfolio/i.test(readme)) throw new Error('README must remain neutral technical documentation');

for (const workflow of ['ci.yml', 'security.yml', 'docs.yml']) {
  const badge = `actions/workflows/${workflow}/badge.svg`;
  if (!readme.includes(badge)) throw new Error(`README workflow badge is missing: ${workflow}`);
}

if (!readme.includes('https://img.shields.io/badge/Device%20Smoke-manual-8250DF') || !readme.includes('actions/workflows/device-smoke.yml')) {
  throw new Error('README must identify device-smoke as a manual workflow without implying continuous status');
}

const mermaid = readme.match(/```mermaid\s*\n([\s\S]*?)```/u)?.[1];
if (!mermaid || !/^flowchart\s+/mu.test(mermaid)) {
  throw new Error('README must include a Mermaid flowchart architecture diagram');
}
if (!mermaid.includes('classDef') || !mermaid.includes('linkStyle')) {
  throw new Error('README Mermaid architecture must retain polished class and link styling');
}

const map = readme.match(/## Repository map[\s\S]*?```text\n([\s\S]*?)```/u)?.[1];
if (!map) throw new Error('README repository map text block is missing');
for (const line of map.split(/\r?\n/u)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '.') continue;
  const entry = trimmed.replace(/^[│├└─\s]+/u, '');
  if (!entry.endsWith('/')) throw new Error(`Repository map must list folders only: ${entry}`);
}

for (const path of [
  'docs/architecture.md',
  'docs/device-execution.md',
  'docs/capability-policy.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
]) {
  await access(path);
}

console.log(
  'Documentation contract passed: required sections, workflow badges, styled Mermaid architecture, local references, and directory-only repository map are consistent.',
);