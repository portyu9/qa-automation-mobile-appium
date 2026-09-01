# Device Execution

## Local server

Install the platform driver appropriate to the environment, start Appium, export the runtime variables, then run `npm run device:smoke`. Driver versions should be pinned by the device environment because compatibility is coupled to Android SDK/Xcode versions.

## Device clouds

Point `APPIUM_SERVER_URL` at the provider endpoint and place non-secret provider metadata in `CLOUD_OPTIONS_JSON` under a vendor prefix such as `sauce:options`. Secret-like fields are rejected by the framework so access keys cannot accidentally enter capability evidence.

## Evidence contract

A successful device smoke writes `device-smoke-summary.json` beneath the configured evidence directory. The summary records the platform, device name, contexts, sanitized capabilities, page-source size, and explicit success outcome; the same sanitized payload is emitted to the workflow log. Failure-path screenshot, page-source, and metadata evidence remains best-effort so an evidence-collection defect cannot replace the original product/session failure.

The manual workflow treats missing device evidence as an error and retains the evidence artifact for seven days. This prevents a green device-smoke conclusion from existing without a retained success artifact. Screenshots and page source can still contain application-visible or personal data, so the device environment must own test-data, access, and retention policy.

## Parallel execution

Use one process per device/session. Provide unique device identifiers and provider session metadata from the orchestrator. Do not share a WebDriver session across tests or workers. The session manager intentionally has no global singleton.

The repository's manual `device-smoke` workflow is serialized with a single concurrency group because its configured environment may represent scarce physical or provider-managed capacity. Environment-specific orchestrators that intentionally own multiple independent devices can fan out above this repository boundary while preserving one session per process.

## Flake policy

Do not hide instability with unconditional retry loops or fixed sleeps. Retry only at the orchestration layer for classified infrastructure failures, preserve the first-attempt evidence, and report retry rate as an observable signal. Product assertion failures should not be auto-retried into green.
