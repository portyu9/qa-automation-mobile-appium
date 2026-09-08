import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const packageLock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const nvmrc = (await readFile('.nvmrc', 'utf8')).trim();
const workflows = Object.fromEntries(
  await Promise.all(
    ['ci.yml', 'security.yml', 'docs.yml', 'device-smoke.yml'].map(async (name) => [
      name,
      await readFile(`.github/workflows/${name}`, 'utf8'),
    ]),
  ),
);

const failures = [];
const fail = (message) => failures.push(message);
const expectedNodeEngine = '>=22.0.0 <23.0.0 || >=24.0.0 <25.0.0';
const expectedNpm = '11.19.1';
const nvmMatch = /^(\d+)\.(\d+)\.(\d+)$/u.exec(nvmrc);
const rootLock = packageLock.packages?.[''] ?? {};

if (packageJson.engines?.node !== expectedNodeEngine) {
  fail(`package.json engines.node must expose only qualified Node 22 and Node 24 lines: ${expectedNodeEngine}`);
}
if (packageJson.engines?.npm !== expectedNpm) {
  fail(`package.json engines.npm must pin ${expectedNpm}`);
}
if (rootLock.engines?.node !== packageJson.engines?.node) {
  fail('package-lock.json root Node engine must match package.json exactly');
}
if (rootLock.engines?.npm !== packageJson.engines?.npm) {
  fail('package-lock.json root npm engine must match package.json exactly');
}
if (!nvmMatch || Number(nvmMatch[1]) !== 24) {
  fail('.nvmrc must pin an exact Node 24 primary runtime');
}

const ci = workflows['ci.yml'];
if (!ci.includes(`NPM_VERSION: ${expectedNpm}`)) {
  fail(`ci.yml must bind NPM_VERSION to ${expectedNpm}`);
}
if (!ci.includes('node-version-file: .nvmrc')) {
  fail('ci.yml primary quality job must use .nvmrc');
}
if (!/node-version:\s*22\s*$/mu.test(ci)) {
  fail('ci.yml must retain an explicit Node 22 compatibility job');
}
if (/node-version:\s*23(?:\D|$)/mu.test(ci)) {
  fail('ci.yml must not qualify unsupported Node 23');
}

for (const name of ['security.yml', 'docs.yml', 'device-smoke.yml']) {
  const workflow = workflows[name];
  const setupNodeCount = [...workflow.matchAll(/uses: actions\/setup-node@/gu)].length;
  const nvmrcCount = [...workflow.matchAll(/node-version-file:\s*\.nvmrc/gu)].length;
  if (setupNodeCount !== nvmrcCount) {
    fail(
      `${name} must route every actions/setup-node invocation through .nvmrc; ` +
        `setup-node=${setupNodeCount}, nvmrc=${nvmrcCount}`,
    );
  }
}

for (const name of ['ci.yml', 'security.yml', 'device-smoke.yml']) {
  if (!workflows[name].includes(`NPM_VERSION: ${expectedNpm}`)) {
    fail(`${name} must bind NPM_VERSION to package.json engines.npm (${expectedNpm})`);
  }
}

const scripts = packageJson.scripts ?? {};
if (scripts['runtime-policy:check'] !== 'node scripts/validate-runtime-policy.mjs') {
  fail('package.json must expose runtime-policy:check');
}
if (!String(scripts.quality ?? '').includes('npm run runtime-policy:check')) {
  fail('package.json quality must execute runtime-policy:check');
}

if (failures.length) {
  console.error('Runtime policy contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Runtime policy contract passed: primary=${nvmrc}, qualified=Node22+Node24, npm=${expectedNpm}, lock=aligned`,
);
