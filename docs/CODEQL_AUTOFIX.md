# CodeQL Autofix Automation

This repository uses a review-only controller around GitHub's CodeQL Autofix REST API. The controller is designed to remove repetitive remediation mechanics without converting an AI-generated patch into trusted code.

## Trust model

The write-capable job runs only from trusted default-branch workflow code. Pull requests execute an unprivileged policy self-test only. The privileged job checks out `main` with credential persistence disabled and uses the repository-scoped `GITHUB_TOKEN` through a commit-SHA-pinned `actions/github-script` action.

The controller has four write capabilities and no others: request an Autofix for an explicitly targeted CodeQL alert, create a dedicated fix branch from the exact current `main` SHA, ask GitHub to commit the generated Autofix to that branch, and create a draft pull request. It can also dispatch the repository's existing CI, Security, and Docs workflows against the fix branch.

It does **not** merge pull requests, dismiss alerts, rewrite `main`, execute generated branch code inside the privileged job, or weaken CodeQL/security policy.

## Eligibility

A proposal is considered only when all of these conditions are true:

- the alert number is explicitly present in `.github/codeql-autofix.json`;
- the alert is still open;
- the producing tool is CodeQL;
- the most recent alert instance is on `refs/heads/main`;
- that instance is attributed to the exact current `main` SHA;
- GitHub Autofix reports a successful generated fix within a bounded polling window.

The current pilot allowlist is alerts `1` and `2`. If CodeQL has already marked either alert fixed, the controller records a skip and performs no write.

## Generated-diff validation

After GitHub commits an Autofix to the isolated branch, the controller compares that branch with the exact base SHA before opening a pull request. The generated patch is rejected and the controller-owned branch is deleted when any of these conditions occurs:

- the alert's own file is not modified;
- the patch exceeds four files or 200 changed lines;
- a file is removed or renamed;
- a changed extension is outside the reviewed JavaScript/TypeScript allowlist;
- the patch modifies workflow definitions, dependency manifests/lockfiles, Dockerfile, or Autofix/dependency-governance configuration;
- `main` advances at any protected point in the generation/commit/review sequence.

Protected repository scripts may be proposed because CodeQL can legitimately report findings in them, but the resulting pull request remains draft and requires the ordinary human/control-plane review path.

## Qualification

A successful proposal becomes a draft PR with the alert/rule/base/fix provenance embedded in its body. Because changes created with `GITHUB_TOKEN` do not reliably recurse into ordinary pull-request workflow triggers, the controller explicitly dispatches `ci.yml`, `security.yml`, and `docs.yml` on the generated branch.

Those workflow results are evidence for review, not an authorization to merge. The generated PR remains draft until a human verifies the code change, the CodeQL finding, and the normal repository gates.

## Failure behavior

All uncertainty fails closed. API errors, unsupported Autofix results, stale alert attribution, branch collisions, oversized patches, unexpected paths, unexpected file types, and base-branch movement prevent PR creation. Existing branches are never overwritten.

The kill switch is `enabled` in `.github/codeql-autofix.json`. The configuration, controller, self-tests, and workflow are dependency-governance manual-review paths.
