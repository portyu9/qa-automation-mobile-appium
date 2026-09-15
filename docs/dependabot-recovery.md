# Dependabot recovery contract

Routine Dependabot updates use two separate automation responsibilities. Dependency governance decides whether an update may merge. Dependency recovery may only re-run a failed qualification workflow when the failure is proven to be transient infrastructure noise. Recovery never merges a pull request and never mutates a Dependabot branch.

A recovery candidate must still satisfy the repository's canonical provenance rules: one GitHub-verified Dependabot commit, directly based on the current `main`, with signed minor/patch metadata and an allowlisted dependency-only file set. A stale branch waits for Dependabot's native `rebase-strategy: auto`; the controller does not call GitHub's update-branch endpoint and does not add companion commits.

Automatic recovery is capped at one failed-job rerun. The controller requires exactly one failed step in each failed leaf job, an allowlisted infrastructure step name, a timestamp-bounded log window attributable to that step, and a narrow network/service signature such as `EAI_AGAIN`, `ECONNRESET`, `ETIMEDOUT`, or an HTTP 502/503/504 response. Deterministic evidence such as dependency resolution errors, lockfile mismatches, permission failures, disk exhaustion, or HTTP client/policy failures blocks recovery even when transient words also appear.

For this Appium repository, only npm bootstrap/install work and framework-evidence upload are eligible infrastructure boundaries. Appium framework contracts, session/capability behavior, Node 22 TypeScript API binding, type checking, tests, audit findings, Trivy/CodeQL/Dependency Review, evidence validators, aggregate gates, ambiguous job states, and control-plane changes remain non-retryable.

Every retry produces a fresh workflow attempt. The original failure remains visible in GitHub Actions, the retry budget is enforced from `run_attempt`, and the existing exact-head CI/Security/Docs gates must become genuinely successful before dependency governance can consider a merge. Recovery therefore restores qualification opportunity; it never turns a red semantic result into an accepted result by weakening or bypassing a gate.
