# Device Execution

## Local server

Install the platform driver appropriate to the environment, start Appium, export the runtime variables, then run `npm run device:smoke`. Driver versions should be pinned by the device environment because compatibility is coupled to Android SDK/Xcode versions.

## Device clouds

Point `APPIUM_SERVER_URL` at the provider endpoint and place non-secret provider metadata in `CLOUD_OPTIONS_JSON` under a vendor prefix such as `sauce:options`. Secret-like fields are rejected by the framework so access keys cannot accidentally enter capability evidence.

## Parallel execution

Use one process per device/session. Provide unique device identifiers and provider session metadata from the orchestrator. Do not share a WebDriver session across tests or workers. The session manager intentionally has no global singleton.

## Flake policy

Do not hide instability with unconditional retry loops or fixed sleeps. Retry only at the orchestration layer for classified infrastructure failures, preserve the first-attempt evidence, and report retry rate as an observable signal. Product assertion failures should not be auto-retried into green.
