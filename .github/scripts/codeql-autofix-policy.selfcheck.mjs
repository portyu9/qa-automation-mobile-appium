import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  assessAlert,
  autofixBranchName,
  validateAutofixConfig,
  validateAutofixDiff,
} from './codeql-autofix-policy.mjs';

const config = JSON.parse(fs.readFileSync('.github/codeql-autofix.json', 'utf8'));
const BASE = 'a'.repeat(40);

function alert(overrides = {}) {
  return {
    number: 1,
    state: 'open',
    tool: { name: 'CodeQL' },
    rule: { id: 'js/redos', security_severity_level: 'high' },
    most_recent_instance: {
      ref: 'refs/heads/main',
      commit_sha: BASE,
      location: { path: '.github/scripts/dependency-recovery-policy.mjs' },
    },
    ...overrides,
  };
}

function compare(files) {
  return { status: 'ahead', files };
}

test('production autofix config is valid and bounded', () => {
  assert.deepEqual(validateAutofixConfig(config), []);
  assert.deepEqual(config.targetAlertNumbers, [1, 2]);
  assert.equal(config.maxAlertsPerRun, 2);
  assert.ok(config.maxChangedFiles <= 4);
  assert.ok(config.maxChangedLines <= 200);
  assert.ok(config.maxPollAttempts <= 12);
  assert.ok(config.pollIntervalSeconds <= 10);
});

test('config rejects unbounded or weakened safety controls', () => {
  assert.ok(validateAutofixConfig({ ...config, maxAlertsPerRun: 11 }).length > 0);
  assert.ok(validateAutofixConfig({ ...config, maxChangedFiles: 11 }).length > 0);
  assert.ok(validateAutofixConfig({ ...config, maxChangedLines: 501 }).length > 0);
  assert.ok(validateAutofixConfig({ ...config, targetAlertNumbers: [] }).length > 0);
  assert.ok(validateAutofixConfig({ ...config, branchPrefix: 'feature/autofix-' }).length > 0);
  assert.ok(
    validateAutofixConfig({
      ...config,
      deniedPaths: config.deniedPaths.filter((entry) => entry !== '.github/workflows/'),
    }).length > 0,
  );
});

test('only exact-current-main open CodeQL alerts are eligible', () => {
  assert.equal(assessAlert(alert(), config, BASE).eligible, true);
  assert.equal(assessAlert(alert({ state: 'fixed' }), config, BASE).eligible, false);
  assert.equal(assessAlert(alert({ tool: { name: 'ESLint' } }), config, BASE).eligible, false);
  assert.equal(assessAlert(alert({ number: 999 }), config, BASE).eligible, false);
  assert.equal(
    assessAlert(
      alert({ most_recent_instance: { ref: 'refs/heads/main', commit_sha: 'b'.repeat(40), location: { path: 'src/x.ts' } } }),
      config,
      BASE,
    ).eligible,
    false,
  );
  assert.equal(
    assessAlert(
      alert({ most_recent_instance: { ref: 'refs/pull/1/merge', commit_sha: BASE, location: { path: 'src/x.ts' } } }),
      config,
      BASE,
    ).eligible,
    false,
  );
});

test('autofix diff must touch the alert file and stay inside narrow source bounds', () => {
  const assessment = assessAlert(alert(), config, BASE);
  const good = validateAutofixDiff(
    compare([
      {
        filename: '.github/scripts/dependency-recovery-policy.mjs',
        status: 'modified',
        changes: 24,
      },
    ]),
    assessment,
    config,
  );
  assert.equal(good.eligible, true);

  const wrongFile = validateAutofixDiff(
    compare([{ filename: 'src/unrelated.ts', status: 'modified', changes: 4 }]),
    assessment,
    config,
  );
  assert.equal(wrongFile.eligible, false);

  const workflow = validateAutofixDiff(
    compare([
      { filename: '.github/scripts/dependency-recovery-policy.mjs', status: 'modified', changes: 2 },
      { filename: '.github/workflows/security.yml', status: 'modified', changes: 2 },
    ]),
    assessment,
    config,
  );
  assert.equal(workflow.eligible, false);

  const dependency = validateAutofixDiff(
    compare([
      { filename: '.github/scripts/dependency-recovery-policy.mjs', status: 'modified', changes: 2 },
      { filename: 'package-lock.json', status: 'modified', changes: 2 },
    ]),
    assessment,
    config,
  );
  assert.equal(dependency.eligible, false);
});

test('structural, extension, and size ambiguity stays fail closed', () => {
  const assessment = assessAlert(alert(), config, BASE);
  assert.equal(
    validateAutofixDiff(
      compare([{ filename: '.github/scripts/dependency-recovery-policy.mjs', status: 'renamed', changes: 2 }]),
      assessment,
      config,
    ).eligible,
    false,
  );
  assert.equal(
    validateAutofixDiff(
      compare([{ filename: '.github/scripts/dependency-recovery-policy.mjs', status: 'modified', changes: 201 }]),
      assessment,
      config,
    ).eligible,
    false,
  );
  assert.equal(
    validateAutofixDiff(
      compare([{ filename: '.github/scripts/dependency-recovery-policy.txt', status: 'modified', changes: 2 }]),
      { ...assessment, locationPath: '.github/scripts/dependency-recovery-policy.txt' },
      config,
    ).eligible,
    false,
  );
  assert.equal(validateAutofixDiff({ status: 'diverged', files: [] }, assessment, config).eligible, false);
});

test('autofix branch identity is deterministic and base-bound', () => {
  assert.equal(
    autofixBranchName(config, 2, BASE),
    `security/codeql-autofix-2-${BASE.slice(0, 12)}`,
  );
  assert.throws(() => autofixBranchName(config, 0, BASE));
  assert.throws(() => autofixBranchName(config, 1, 'abc'));
});

test('workflow and governance wiring preserve the trust boundary', () => {
  const workflow = fs.readFileSync('.github/workflows/codeql-autofix.yml', 'utf8');
  const governance = JSON.parse(fs.readFileSync('.github/dependency-governance.json', 'utf8'));
  for (const path of [
    '.github/codeql-autofix.json',
    '.github/scripts/codeql-autofix-policy.mjs',
    '.github/scripts/codeql-autofix-policy.selfcheck.mjs',
    '.github/workflows/codeql-autofix.yml',
  ]) {
    assert.ok(governance.manualReviewPaths.includes(path), `${path} must require manual review`);
  }
  assert.match(workflow, /pull_request:/u);
  assert.match(workflow, /workflow_run:/u);
  assert.match(workflow, /workflows: \[security\]/u);
  assert.match(workflow, /security-events: write/u);
  assert.match(workflow, /contents: write/u);
  assert.match(workflow, /pull-requests: write/u);
  assert.match(workflow, /actions: write/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/u);
  assert.match(workflow, /actions\/github-script@[0-9a-f]{40}/u);
  assert.match(workflow, /runCodeqlAutofix/u);
});

test('controller contains no autonomous merge or alert dismissal path', () => {
  const source = fs.readFileSync('.github/scripts/codeql-autofix-policy.mjs', 'utf8');
  assert.doesNotMatch(source, /pulls\.merge|mergePull|enableAutoMerge|dismissed_reason|state:\s*['"]dismissed['"]/u);
  assert.match(source, /draft:\s*true/u);
  assert.match(source, /createWorkflowDispatch/u);
  assert.match(source, /autofix\/commits/u);
});
