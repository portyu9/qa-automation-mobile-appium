# Operations Guide

## Purpose

This guide owns the operating contract for the Appium + WebdriverIO mobile framework: deterministic qualification, runtime variables, real-device execution, evidence/privacy, CI/security, confidence boundaries, dependency maintenance, and failure triage.

Use [`architecture.md`](architecture.md) for ownership boundaries, [`capability-policy.md`](capability-policy.md) for Android/iOS W3C/Appium capability rules, and [`device-execution.md`](device-execution.md) for device-lab/environment guidance.

## Deterministic qualification

The repository-pinned Node/npm toolchain qualifies framework behavior without opening a device connection:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run quality
```

The framework test path builds, writes TAP evidence, and verifies a non-trivial execution floor:

```bash
npm run test:framework
npm run test:evidence:check
```

Deterministic tests inject session connectors and temporary evidence directories. They prove configuration, W3C capability construction, session ownership, synchronization rules, evidence precedence, sanitization, and teardown without pretending a Linux CI runner is an Android/iOS lab.

## Runtime configuration

Supply runtime values through a local secret-managed environment or device-provider secret mechanism. Do not commit environment files, provider credentials, signing material, application binaries, or tokens.

| Variable | Purpose |
| --- | --- |
| `APPIUM_SERVER_URL` | Absolute HTTP(S) Appium endpoint; credentials/query/fragment are rejected |
| `MOBILE_PLATFORM` | `android` or `ios` |
| `DEVICE_NAME` | Human-readable target device |
| `APP_PATH` / `APP_ID` | Application reference/identifier; at least one required |
| `PLATFORM_VERSION` | Optional OS version |
| `DEVICE_UDID` | Optional explicit device identifier |
| `CLOUD_OPTIONS_JSON` | Optional vendor-namespaced capabilities; secret-like keys rejected |

Android package/activity settings, reset policy, command timeout, and evidence-directory values are validated at the same boundary. `noReset` and `fullReset` cannot both be active.

A syntactically valid remote URL is not operational authorization. Device-cloud integrations should add environment-specific allowlists, ownership, secret, and data-handling rules around the reusable framework.

## Platform capability policy

Android uses **UiAutomator2** and iOS uses **XCUITest**. Appium extension capabilities are namespaced with `appium:` while shared W3C fields remain shared.

The framework does not invent device identity, OS version, app/package/bundle identity, provider options, credentials, or signing data. Those are deployment inputs owned by the environment supplying hardware.

See [`capability-policy.md`](capability-policy.md) for the detailed matrix.

## Real-device smoke

Real-device execution is manual by design. Shared hosted Linux CI is not trustworthy iOS hardware, and one automatically provisioned Android emulator would still represent only one narrow environment.

Local/device-lab execution:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run appium
# in another shell with validated runtime variables
npm run device:smoke
```

Install and pin the target environment's Appium platform driver before starting the server. Application binaries, signing configuration, device images, driver versions, and provider capabilities remain device-environment responsibilities.

A production device matrix should make OS line, device class, locale, permissions, orientation, network state, biometrics, push notifications, deep links, and hybrid contexts explicit according to risk.

## Session lifecycle and synchronization

The session manager owns:

1. validated configuration/capabilities;
2. remote connection;
3. test task execution;
4. failure evidence collection;
5. deterministic session deletion.

Evidence/teardown failures do not overwrite an earlier causal test failure. A teardown error becomes primary only when no earlier failure exists.

Screen abstractions use accessibility-oriented selectors and explicit WebDriver conditions. Fixed sleeps are prohibited because elapsed time is not a device/application readiness contract.

## Evidence and privacy

A failed session attempts to retain bounded:

- screenshot evidence;
- page-source evidence;
- sanitized capability/error metadata.

Evidence collection is best-effort. Session deletion remains in `finally`.

Screenshots and page source can contain visible or personally identifiable application data even when metadata is sanitized. Prefer synthetic accounts/data and apply retention/access controls to device-lab artifacts.

Success summaries retain non-secret platform/device/context/capability evidence so a green real-device run is attributable to the session that actually executed.

## CI and security

- `ci.yml` — repository quality, strict TypeScript, deterministic framework tests, TAP evidence validation, Node compatibility, stable `CI / ci-gate`.
- `docs.yml` — documentation/runtime/repository-map contracts.
- `security.yml` — immutable Action policy, CodeQL, HIGH/CRITICAL npm Audit, Trivy with development dependencies, conditional Dependency Review, stable `Security / security-gate`.
- `device-smoke.yml` — manually supplied hardware/provider execution boundary.

When GitHub Dependency graph is unavailable, npm Audit and Trivy remain active repository-wide controls; they are not represented as equivalent to dependency-diff review.

## Confidence boundaries

| Signal | Confidence gained | Deliberate limit |
| --- | --- | --- |
| Framework/session contracts | Config, capabilities, ownership, teardown, sanitization, evidence policy are deterministic | Does not prove any Appium server/driver/app/device/provider is reachable or compatible |
| Capability policy | Platform/target/reset/cloud-option structure is admissible before session creation | Does not prove provider acceptance or device existence |
| Screen abstractions | User-intent interaction has stable ownership | Cannot make unstable locators or unsupported behavior reliable |
| Evidence-before-teardown | Primary failures retain bounded diagnostics without cleanup masking them | Evidence may be incomplete after severe provider/session failure |
| Manual device smoke | Real session can connect, query meaningful app hierarchy/context, and close with evidence | One run is not universal device/OS/network/locale/permission/product coverage |
| Serialized device workflow | Repository does not intentionally compete for its shared lab slot | Does not create provider capacity or eliminate external queueing |
| Deterministic CI | Framework remains testable without paid/lab hardware | Cannot substitute for real-device qualification |
| Security controls | Independent source/advisory/repository/change-diff planes are inspected | Green scanners are scoped evidence, not proof of vulnerability absence |

Treat device coverage as a **risk matrix**, not a count of sessions.

## Dependency maintenance

Dependabot checks npm and GitHub Actions weekly. The repository pins WebdriverIO, Appium, TypeScript, and the Node/npm qualification envelope through machine-readable project configuration.

The lock currently overrides transitive dependency lines where required to satisfy the repository's HIGH/CRITICAL security gate. Such overrides remain temporary governed compatibility decisions and should be removed when upstream dependency ranges include equivalent fixes.

Device-environment drivers, application binaries, provider accounts, signing credentials, and device images intentionally remain outside the repository dependency graph.

## Failure triage

| Signal | First interpretation |
| --- | --- |
| Runtime config | Environment/target/capability input policy |
| Capability contract | W3C/Appium namespacing or platform policy |
| Session connect | Appium/provider/device availability/capability negotiation |
| Selector/wait | Application hierarchy/readiness |
| Device-only failure | Platform/OS/device/provider/product integration |
| Screenshot/page-source evidence | Secondary diagnostics/data-handling surface |
| Delete-session failure after pass | Teardown/infrastructure |
| TAP evidence floor | Framework discovery/report integrity |
| Node compatibility | Runtime/toolchain compatibility |
| CodeQL/npm Audit/Trivy/Dependency Review | Independent security control |
| Docs | Repository policy/governance |

## Extension boundaries

Add device/platform dimensions only when product risk requires them. New helpers should own durable capability, lifecycle, synchronization, safety, or evidence policy rather than merely rename WebdriverIO/Appium commands.
