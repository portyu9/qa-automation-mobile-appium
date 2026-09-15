import fs from 'node:fs';
import path from 'node:path';

const API_VERSION = '2026-03-10';
const PAGE_SIZE = 100;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
}

function positiveInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    return `${name} must be an integer from ${min} to ${max}`;
  }
  return null;
}

export function validateAutofixConfig(config) {
  const errors = [];
  if (config?.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (typeof config?.enabled !== 'boolean') errors.push('enabled must be boolean');
  if (config?.defaultBranch !== 'main') errors.push('defaultBranch must equal main');
  if (config?.toolName !== 'CodeQL') errors.push('toolName must equal CodeQL');
  if (!Array.isArray(config?.targetAlertNumbers) || config.targetAlertNumbers.length === 0) {
    errors.push('targetAlertNumbers must be a non-empty array');
  } else {
    if (config.targetAlertNumbers.some((value) => !Number.isInteger(value) || value < 1)) {
      errors.push('targetAlertNumbers must contain positive integers only');
    }
    if (new Set(config.targetAlertNumbers).size !== config.targetAlertNumbers.length) {
      errors.push('targetAlertNumbers must not contain duplicates');
    }
  }
  for (const error of [
    positiveInteger(config?.maxAlertsPerRun, 'maxAlertsPerRun', 1, 10),
    positiveInteger(config?.maxChangedFiles, 'maxChangedFiles', 1, 10),
    positiveInteger(config?.maxChangedLines, 'maxChangedLines', 1, 500),
    positiveInteger(config?.maxPollAttempts, 'maxPollAttempts', 1, 30),
    positiveInteger(config?.pollIntervalSeconds, 'pollIntervalSeconds', 1, 30),
  ]) {
    if (error) errors.push(error);
  }
  if (
    Array.isArray(config?.targetAlertNumbers) &&
    Number.isInteger(config?.maxAlertsPerRun) &&
    config.targetAlertNumbers.length > config.maxAlertsPerRun
  ) {
    errors.push('targetAlertNumbers exceeds maxAlertsPerRun');
  }
  if (typeof config?.branchPrefix !== 'string' || !/^security\/[a-z0-9-]+-$/u.test(config.branchPrefix)) {
    errors.push('branchPrefix must be a bounded security/* prefix ending in a hyphen');
  }
  if (!Array.isArray(config?.allowedExtensions) || config.allowedExtensions.length === 0) {
    errors.push('allowedExtensions must be a non-empty array');
  } else if (config.allowedExtensions.some((value) => typeof value !== 'string' || !/^\.[a-z0-9]+$/u.test(value))) {
    errors.push('allowedExtensions entries must be simple lowercase extensions');
  }
  if (!Array.isArray(config?.deniedPaths) || config.deniedPaths.length === 0) {
    errors.push('deniedPaths must be a non-empty array');
  }
  for (const required of [
    '.github/workflows/',
    '.github/codeql-autofix.json',
    'package.json',
    'package-lock.json',
  ]) {
    if (!config?.deniedPaths?.includes(required)) errors.push(`deniedPaths must include ${required}`);
  }
  if (!Array.isArray(config?.qualificationWorkflows) || config.qualificationWorkflows.length === 0) {
    errors.push('qualificationWorkflows must be a non-empty array');
  } else if (config.qualificationWorkflows.some((value) => typeof value !== 'string' || !/^[a-z0-9-]+\.ya?ml$/u.test(value))) {
    errors.push('qualificationWorkflows entries must be workflow filenames');
  }
  return unique(errors);
}

function deniedPath(filename, deniedPaths) {
  return deniedPaths.some((entry) => (entry.endsWith('/') ? filename.startsWith(entry) : filename === entry));
}

export function assessAlert(alert, config, baseSha) {
  const reasons = [];
  if (!alert || typeof alert !== 'object') return { eligible: false, reasons: ['alert payload is missing'] };
  if (!config.targetAlertNumbers.includes(alert.number)) reasons.push('alert number is not explicitly targeted');
  if (alert.state !== 'open') reasons.push(`alert state is ${alert.state || 'unknown'}, not open`);
  if (alert.tool?.name !== config.toolName) reasons.push(`alert tool is ${alert.tool?.name || 'unknown'}, not ${config.toolName}`);
  const instance = alert.most_recent_instance;
  if (!instance) reasons.push('alert has no most_recent_instance');
  if (instance?.ref !== `refs/heads/${config.defaultBranch}`) {
    reasons.push(`alert instance is not on refs/heads/${config.defaultBranch}`);
  }
  if (instance?.commit_sha !== baseSha) {
    reasons.push('alert instance is not attributed to the exact current default-branch head');
  }
  const locationPath = instance?.location?.path;
  if (typeof locationPath !== 'string' || locationPath.length === 0) {
    reasons.push('alert location path is missing');
  }
  return {
    eligible: reasons.length === 0,
    reasons,
    locationPath: locationPath || null,
    ruleId: alert.rule?.id || null,
    severity: alert.rule?.security_severity_level || alert.rule?.severity || null,
  };
}

export function validateAutofixDiff(compare, alertAssessment, config) {
  const reasons = [];
  const files = Array.isArray(compare?.files) ? compare.files : [];
  if (files.length === 0) reasons.push('autofix produced no changed files');
  if (files.length > config.maxChangedFiles) reasons.push(`autofix changes ${files.length} files, exceeding limit ${config.maxChangedFiles}`);
  const changedLines = files.reduce((sum, file) => sum + Number(file.changes || 0), 0);
  if (changedLines > config.maxChangedLines) reasons.push(`autofix changes ${changedLines} lines, exceeding limit ${config.maxChangedLines}`);
  const filenames = files.map((file) => file.filename);
  if (alertAssessment.locationPath && !filenames.includes(alertAssessment.locationPath)) {
    reasons.push('autofix does not modify the file that contains the targeted alert');
  }
  for (const file of files) {
    if (!file?.filename) {
      reasons.push('autofix contains a file without a filename');
      continue;
    }
    if (['removed', 'renamed'].includes(file.status)) reasons.push(`${file.filename} has forbidden status ${file.status}`);
    if (deniedPath(file.filename, config.deniedPaths)) reasons.push(`${file.filename} is denied from automated autofix commits`);
    const extension = path.extname(file.filename).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) reasons.push(`${file.filename} has non-allowlisted extension ${extension || '(none)'}`);
  }
  if (compare?.status && !['ahead', 'identical'].includes(compare.status)) {
    reasons.push(`autofix branch compare status is ${compare.status}`);
  }
  return { eligible: reasons.length === 0, reasons: unique(reasons), files: filenames, changedLines };
}

export function autofixBranchName(config, alertNumber, baseSha) {
  if (!Number.isInteger(alertNumber) || alertNumber < 1) throw new Error('alert number must be a positive integer');
  if (!/^[0-9a-f]{40}$/u.test(baseSha)) throw new Error('base SHA must be a full lowercase commit SHA');
  return `${config.branchPrefix}${alertNumber}-${baseSha.slice(0, 12)}`;
}

function apiHeaders() {
  return {
    accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function getAlert(github, owner, repo, alertNumber) {
  const response = await github.request('GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}', {
    owner,
    repo,
    alert_number: alertNumber,
    headers: apiHeaders(),
  });
  return response.data;
}

async function requestAutofix(github, owner, repo, alertNumber) {
  const response = await github.request('POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix', {
    owner,
    repo,
    alert_number: alertNumber,
    headers: apiHeaders(),
  });
  return response.data;
}

async function getAutofix(github, owner, repo, alertNumber) {
  const response = await github.request('GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix', {
    owner,
    repo,
    alert_number: alertNumber,
    headers: apiHeaders(),
  });
  return response.data;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForAutofix(github, owner, repo, alertNumber, config) {
  for (let attempt = 1; attempt <= config.maxPollAttempts; attempt += 1) {
    const state = await getAutofix(github, owner, repo, alertNumber);
    if (state?.status === 'success') return state;
    if (['failure', 'failed', 'error'].includes(state?.status)) return state;
    if (attempt < config.maxPollAttempts) await sleep(config.pollIntervalSeconds * 1000);
  }
  return { status: 'timeout', description: 'bounded autofix polling window expired' };
}

async function refExists(github, owner, repo, branch) {
  try {
    await github.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return true;
  } catch (error) {
    if (error?.status === 404) return false;
    throw error;
  }
}

async function deleteOwnedRef(github, owner, repo, branch) {
  try {
    await github.rest.git.deleteRef({ owner, repo, ref: `heads/${branch}` });
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
}

async function currentBaseSha(github, owner, repo, branch) {
  const response = await github.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
  return response.data.object.sha;
}

async function commitAutofix(github, owner, repo, alertNumber, branch, ruleId) {
  const response = await github.request('POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits', {
    owner,
    repo,
    alert_number: alertNumber,
    target_ref: `refs/heads/${branch}`,
    message: `security: apply CodeQL autofix for alert #${alertNumber}${ruleId ? ` (${ruleId})` : ''}`,
    headers: apiHeaders(),
  });
  return response.data;
}

async function compareBranch(github, owner, repo, baseSha, branch) {
  const response = await github.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${baseSha}...${branch}`,
    per_page: PAGE_SIZE,
  });
  return response.data;
}

async function dispatchQualification(github, owner, repo, branch, workflows) {
  const outcomes = [];
  for (const workflowId of workflows) {
    try {
      await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: workflowId, ref: branch });
      outcomes.push({ workflow: workflowId, dispatched: true });
    } catch (error) {
      outcomes.push({ workflow: workflowId, dispatched: false, status: error?.status || null, message: error?.message || 'dispatch failed' });
    }
  }
  return outcomes;
}

async function createDraftPull(github, owner, repo, branch, alert, assessment, baseSha, fixSha, validation) {
  const marker = `<!-- codeql-autofix:alert-${alert.number}:${baseSha} -->`;
  const body = [
    marker,
    `GitHub CodeQL Autofix API generated this proposed remediation for alert #${alert.number}.`,
    '',
    `- Rule: \`${assessment.ruleId || 'unknown'}\``,
    `- Severity: \`${assessment.severity || 'unknown'}\``,
    `- Alert source SHA: \`${baseSha}\``,
    `- Autofix commit: \`${fixSha}\``,
    `- Changed files: ${validation.files.map((file) => `\`${file}\``).join(', ')}`,
    `- Changed lines: ${validation.changedLines}`,
    '',
    '**Review boundary:** this PR is intentionally draft and is never auto-merged by the autofix controller. Normal CI/security/docs qualification and human review remain required.',
  ].join('\n');
  const response = await github.rest.pulls.create({
    owner,
    repo,
    title: `security: CodeQL autofix alert #${alert.number}`,
    head: branch,
    base: 'main',
    body,
    draft: true,
    maintainer_can_modify: true,
  });
  return response.data;
}

export async function runCodeqlAutofix({
  github,
  context,
  core,
  configPath = '.github/codeql-autofix.json',
}) {
  const config = loadJson(configPath);
  const configErrors = validateAutofixConfig(config);
  if (configErrors.length > 0) throw new Error(`Invalid CodeQL autofix config:\n- ${configErrors.join('\n- ')}`);
  if (!config.enabled) {
    core.info('CodeQL autofix kill switch is disabled.');
    return [];
  }

  const { owner, repo } = context.repo;
  const baseSha = await currentBaseSha(github, owner, repo, config.defaultBranch);
  if (context.eventName === 'workflow_run') {
    const run = context.payload.workflow_run;
    if (run?.name !== 'security' || run?.conclusion !== 'success' || run?.head_branch !== config.defaultBranch || run?.head_sha !== baseSha) {
      core.info('Ignoring workflow_run because it is not a successful security run for the exact current default-branch head.');
      return [];
    }
  } else if (context.eventName === 'workflow_dispatch') {
    if (context.ref !== `refs/heads/${config.defaultBranch}`) {
      throw new Error('workflow_dispatch is permitted only from the default branch');
    }
  } else if (context.eventName !== 'schedule') {
    core.info(`Ignoring unsupported trusted event ${context.eventName}.`);
    return [];
  }

  const results = [];
  for (const alertNumber of config.targetAlertNumbers.slice(0, config.maxAlertsPerRun)) {
    const result = { alertNumber, baseSha };
    try {
      const alert = await getAlert(github, owner, repo, alertNumber);
      const assessment = assessAlert(alert, config, baseSha);
      result.alert = {
        state: alert.state,
        ruleId: assessment.ruleId,
        severity: assessment.severity,
        locationPath: assessment.locationPath,
      };
      if (!assessment.eligible) {
        result.state = 'skipped';
        result.reasons = assessment.reasons;
        results.push(result);
        continue;
      }

      const branch = autofixBranchName(config, alertNumber, baseSha);
      result.branch = branch;
      if (await refExists(github, owner, repo, branch)) {
        result.state = 'skipped';
        result.reasons = ['deterministic autofix branch already exists; refusing to overwrite it'];
        results.push(result);
        continue;
      }

      const initialAutofix = await requestAutofix(github, owner, repo, alertNumber);
      const autofix = initialAutofix?.status === 'success'
        ? initialAutofix
        : await waitForAutofix(github, owner, repo, alertNumber, config);
      result.autofixStatus = autofix?.status || 'unknown';
      if (autofix?.status !== 'success') {
        result.state = 'skipped';
        result.reasons = [`GitHub Autofix did not reach success: ${autofix?.status || 'unknown'}`];
        results.push(result);
        continue;
      }

      const beforeCreateSha = await currentBaseSha(github, owner, repo, config.defaultBranch);
      if (beforeCreateSha !== baseSha) {
        result.state = 'skipped';
        result.reasons = ['default branch advanced while autofix was being generated'];
        results.push(result);
        continue;
      }

      await github.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
      const beforeCommitSha = await currentBaseSha(github, owner, repo, config.defaultBranch);
      if (beforeCommitSha !== baseSha) {
        await deleteOwnedRef(github, owner, repo, branch);
        result.state = 'skipped';
        result.reasons = ['default branch advanced before autofix commit'];
        results.push(result);
        continue;
      }

      const commit = await commitAutofix(github, owner, repo, alertNumber, branch, assessment.ruleId);
      const fixSha = commit?.sha;
      if (typeof fixSha !== 'string' || !/^[0-9a-f]{40}$/u.test(fixSha)) {
        await deleteOwnedRef(github, owner, repo, branch);
        throw new Error('Autofix commit endpoint did not return a full commit SHA');
      }
      result.fixSha = fixSha;

      const compare = await compareBranch(github, owner, repo, baseSha, branch);
      const validation = validateAutofixDiff(compare, assessment, config);
      result.validation = validation;
      if (!validation.eligible) {
        await deleteOwnedRef(github, owner, repo, branch);
        result.state = 'rejected';
        result.reasons = validation.reasons;
        results.push(result);
        continue;
      }

      const currentSha = await currentBaseSha(github, owner, repo, config.defaultBranch);
      if (currentSha !== baseSha) {
        await deleteOwnedRef(github, owner, repo, branch);
        result.state = 'rejected';
        result.reasons = ['default branch advanced before pull-request creation'];
        results.push(result);
        continue;
      }

      const pull = await createDraftPull(github, owner, repo, branch, alert, assessment, baseSha, fixSha, validation);
      result.pullRequest = pull.number;
      result.qualification = await dispatchQualification(github, owner, repo, branch, config.qualificationWorkflows);
      result.state = 'draft-pr-created';
      results.push(result);
    } catch (error) {
      result.state = 'error';
      result.error = error?.message || String(error);
      result.status = error?.status || null;
      results.push(result);
    }
  }

  core.info(JSON.stringify({ codeqlAutofix: results }, null, 2));
  if (results.some((item) => item.state === 'error')) {
    throw new Error('CodeQL autofix controller encountered one or more API/controller errors');
  }
  return results;
}
