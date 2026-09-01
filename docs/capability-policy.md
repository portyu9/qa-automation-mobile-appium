# Capability Policy

| Concern | Android | iOS |
| --- | --- | --- |
| Automation engine | `UiAutomator2` | `XCUITest` |
| App identifier | `appium:appPackage` | `appium:bundleId` |
| Optional launch target | `appium:appActivity` | provider/application-defined |
| Device identity | `appium:udid` when explicitly supplied | `appium:udid` when explicitly supplied |
| App artifact | `appium:app` | `appium:app` |

All Appium extension capabilities are namespaced. Reset behavior is explicit, command timeout is bounded, and cloud options require a vendor-qualified `*:options` capability. The evidence sanitizer recursively redacts keys containing `token`, `secret`, `password`, `key`, `credential`, or `authorization`.
