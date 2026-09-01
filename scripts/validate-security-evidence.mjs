import { readFile } from 'node:fs/promises';

const [kind, path] = process.argv.slice(2);
if (!kind || !path) throw new Error('Usage: validate-security-evidence <npm-audit|trivy> <path>');
const payload = JSON.parse(await readFile(path, 'utf8'));
if (kind === 'npm-audit') {
  const dependencies = payload?.metadata?.dependencies;
  const vulnerabilities = payload?.metadata?.vulnerabilities;
  if (!dependencies || Number(dependencies.total) < 3) throw new Error('npm Audit evidence lacks a substantive dependency graph');
  if (!vulnerabilities) throw new Error('npm Audit evidence lacks vulnerability metadata');
  if ((vulnerabilities.high ?? 0) !== 0 || (vulnerabilities.critical ?? 0) !== 0) {
    throw new Error('npm Audit evidence contains gated HIGH/CRITICAL advisories');
  }
  console.log(`Validated npm Audit graph with ${dependencies.total} dependencies.`);
} else if (kind === 'trivy') {
  if (!Array.isArray(payload.Results) || payload.Results.length === 0) throw new Error('Trivy evidence has no scan results');

  const npmResults = payload.Results.filter(
    (result) => result.Type === 'npm' && typeof result.Target === 'string' && result.Target.endsWith('package-lock.json'),
  );
  if (npmResults.length === 0) throw new Error('Trivy evidence lacks npm package-lock attribution');

  const npmPackages = npmResults
    .flatMap((result) => result.Packages ?? [])
    .filter((pkg) => typeof pkg.Name === 'string' && pkg.Name.length > 0 && typeof pkg.Version === 'string' && pkg.Version.length > 0);
  if (npmPackages.length < 3) throw new Error('Trivy evidence lacks substantive package attribution');

  const gated = payload.Results.flatMap((result) => [
    ...(result.Vulnerabilities ?? []).filter((item) => ['HIGH', 'CRITICAL'].includes(item.Severity)),
    ...(result.Misconfigurations ?? []),
    ...(result.Secrets ?? []),
  ]);
  if (gated.length !== 0) throw new Error(`Trivy evidence contains ${gated.length} gated findings`);
  console.log(`Validated Trivy attribution for ${npmPackages.length} npm packages with zero gated findings.`);
} else {
  throw new Error(`Unsupported evidence kind: ${kind}`);
}
