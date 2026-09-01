# Security Policy

## Scope

Security reporting covers framework source, dependency and workflow supply chain, evidence handling, and examples that could expose device or provider secrets.

## Reporting

Use GitHub private vulnerability reporting when enabled. Do not open a public issue containing credentials, access tokens, signing certificates, private application binaries, device identifiers that are sensitive in your environment, or exploitable details before coordinated disclosure.

## Repository controls

- GitHub Actions are referenced by immutable commit SHA.
- CI installs from the committed lock graph with lifecycle scripts disabled for deterministic framework qualification.
- npm Audit and Trivy gate HIGH/CRITICAL findings.
- CodeQL analyzes JavaScript/TypeScript paths.
- Dependency Review runs on pull requests when the GitHub Dependency graph is available.
- Failure evidence sanitizes secret-like capability keys before persistence.

Application signing material and device-cloud credentials must stay in the deployment environment; they are not repository fixtures.
