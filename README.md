# Mobile Automation with Appium

A cross-platform mobile test framework built around Appium 3 and WebdriverIO 9. The repository separates deterministic framework qualification from hardware-dependent execution so CI can prove configuration, capability, lifecycle, evidence, and synchronization contracts without pretending that a Linux runner is an Android or iOS device lab.

## What this framework governs

- W3C/Appium capability construction for Android and iOS.
- Fail-fast environment validation before a remote session is created.
- Explicit session ownership and guaranteed teardown through `try/finally` semantics.
- Failure evidence collection for screenshots, page source, sanitized capabilities, and error metadata.
- Accessibility-id-first screen abstractions and explicit wait behavior; fixed sleeps are prohibited by repository policy.
- Local Appium, emulator/simulator, physical-device, and remote device-cloud endpoints through the same runtime contract.
- Deterministic CI framework tests plus an opt-in real-device smoke workflow.
- Immutable GitHub Action references, dependency automation, CodeQL, npm advisory checks, and filesystem scanning.

## Execution model

`npm run quality` is the deterministic qualification gate. It performs repository policy checks, strict TypeScript validation, documentation validation, immutable workflow validation, framework tests, and TAP evidence validation. These tests use injected session doubles and temporary evidence directories; they do not claim device coverage.

`npm run device:smoke` is the hardware-dependent path. It establishes a real Appium session using environment-supplied capabilities, proves that the application hierarchy is queryable, records non-secret session evidence, and always deletes the session. Run it only when an Appium endpoint and application target are available.

## Runtime contract

Copy `.env.example` into your own secret-managed environment. Do not commit environment files, tokens, cloud credentials, application binaries, or signing material.

The required settings are:

| Variable | Purpose |
| --- | --- |
| `APPIUM_SERVER_URL` | Absolute HTTP(S) Appium endpoint. Credentials, query strings, and fragments are rejected. |
| `MOBILE_PLATFORM` | `android` or `ios`. |
| `DEVICE_NAME` | Human-readable target device name. |
| `APP_PATH` / `APP_ID` | At least one application target: local/remote app reference or platform application identifier. |

Optional platform settings include `PLATFORM_VERSION`, `DEVICE_UDID`, Android package/activity values, reset policy, command timeout, evidence directory, and a vendor-namespaced cloud options object. Secret-like keys are rejected from `CLOUD_OPTIONS_JSON`; credentials belong in the provider's secret-managed authentication mechanism instead.

## Android and iOS capability policy

Android sessions use `UiAutomator2`; iOS sessions use `XCUITest`. Appium extension capabilities are always namespaced with `appium:`. `noReset` and `fullReset` cannot both be enabled. The framework never invents a device UDID, platform version, app identifier, or cloud credential.

See `docs/` for the capability matrix, device execution guidance, and lifecycle architecture.

## Real-device smoke

The `device-smoke` workflow is intentionally manual. Configure repository/environment secrets and variables for the target device provider, then dispatch the workflow with a platform. The job does not run as a merge gate because shared GitHub-hosted Linux runners do not provide trustworthy iOS hardware and an Android emulator would still not represent the full device matrix.

For local execution:

```bash
npm ci
npm run build
npm run appium
# in another shell with the runtime variables exported
npm run device:smoke
```

Install and version the Appium platform driver required by your environment before starting the server. Device-lab driver and application versions are deployment inputs and should be pinned by the environment that owns the hardware.

## Evidence and failure behavior

A failed session task attempts to collect:

1. screenshot evidence;
2. page-source evidence;
3. sanitized capability and error metadata.

Evidence collection is best-effort and cannot replace the original test failure. Session deletion is attempted in `finally`; a teardown failure is surfaced only when it is the sole failure, preserving the original failure as the primary signal.

## Repository map

- `.github/`
- `docs/`
- `scripts/`
- `src/`
- `tests/`

## CI and security

CI uses Node 24.20.0 and npm 11.19.1, runs on Ubuntu 24.04, publishes TAP evidence, and exposes a stable `ci-gate`. Security runs immutable-action validation, CodeQL, npm Audit at HIGH/CRITICAL severity, Trivy with development dependencies, and change-aware Dependency Review when GitHub Dependency graph is available. A stable `security-gate` aggregates those results.

Dependabot checks npm and GitHub Actions weekly. Application binaries and provider credentials are deliberately outside the repository dependency graph.

## Design boundaries

This framework does not claim that a passing unit/contract suite proves an application works on real hardware. Device behavior, permissions, OS versions, OEM customizations, signing, network conditions, biometrics, deep links, push notifications, and hybrid-context transitions require explicit device-lab scenarios. The deterministic layer exists to make those expensive tests start from a known-good framework contract.
