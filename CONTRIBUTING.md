# Contributing

Use a focused branch and keep framework policy changes reviewable. Before opening a pull request run `npm run quality` against the committed lock graph.

Changes to runtime validation, capability generation, session lifecycle, evidence handling, workflow security, or dependency policy should include corresponding framework tests. Do not add fixed sleeps, hidden retries, skipped tests, hard-coded device identifiers, credentials, or committed application binaries.

A pull request that changes device behavior should explain which Android/iOS target was exercised outside deterministic CI and attach non-secret evidence when useful.
