import type { RuntimeConfig } from '../config/runtime.js';

export type AppiumCapabilities = Readonly<Record<string, unknown>>;

export function buildCapabilities(config: RuntimeConfig): AppiumCapabilities {
  const capabilities: Record<string, unknown> = {
    platformName: config.platform === 'android' ? 'Android' : 'iOS',
    'appium:automationName': config.platform === 'android' ? 'UiAutomator2' : 'XCUITest',
    'appium:deviceName': config.deviceName,
    'appium:noReset': config.noReset,
    'appium:fullReset': config.fullReset,
    'appium:newCommandTimeout': config.newCommandTimeoutSec,
  };

  if (config.platformVersion) capabilities['appium:platformVersion'] = config.platformVersion;
  if (config.udid) capabilities['appium:udid'] = config.udid;
  if (config.appPath) capabilities['appium:app'] = config.appPath;

  if (config.platform === 'android') {
    if (config.appId || config.androidPackage) capabilities['appium:appPackage'] = config.androidPackage ?? config.appId;
    if (config.androidActivity) capabilities['appium:appActivity'] = config.androidActivity;
  } else if (config.appId) {
    capabilities['appium:bundleId'] = config.appId;
  }

  if (config.cloudVendorPrefix && config.cloudOptions) {
    capabilities[config.cloudVendorPrefix] = config.cloudOptions;
  }

  for (const key of Object.keys(capabilities)) {
    if (key !== 'platformName' && !key.includes(':')) {
      throw new Error(`Non-standard capability must be vendor-namespaced: ${key}`);
    }
  }
  return Object.freeze(capabilities);
}
