import { access, readFile } from 'node:fs/promises';

const readme = await readFile('README.md', 'utf8');
const required = [
  '# Mobile Automation with Appium',
  '## Execution model',
  '## Runtime contract',
  '## Android and iOS capability policy',
  '## Real-device smoke',
  '## Evidence and failure behavior',
  '## Repository map',
  '## CI and security',
  'Appium 3',
  'WebdriverIO 9',
  'Node 24.20.0',
  'npm 11.19.1',
];
for (const fragment of required) {
  if (!readme.includes(fragment)) throw new Error(`README is missing required contract: ${fragment}`);
}
if (/portfolio/i.test(readme)) throw new Error('README must remain neutral technical documentation');
const map = readme.split('## Repository map')[1]?.split('\n## ')[0] ?? '';
for (const match of map.matchAll(/`([^`]+)`/g)) {
  if (!match[1]?.endsWith('/')) throw new Error(`Repository map must list folders only: ${match[1]}`);
}
for (const path of ['docs/architecture.md', 'docs/device-execution.md', 'docs/capability-policy.md', 'SECURITY.md', 'CONTRIBUTING.md']) {
  await access(path);
}
console.log('Documentation contract passed.');
