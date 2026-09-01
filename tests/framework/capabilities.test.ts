import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCapabilities } from '../../src/capabilities/factory.js';
import { loadRuntimeConfig } from '../../src/config/runtime.js';

function config(platform: 'android' | 'ios') {
  return loadRuntimeConfig({
    APPIUM_SERVER_URL: 'http://127.0.0.1:4723',
    MOBILE_PLATFORM: platform,
    DEVICE_NAME: 'contract-device',
    APP_ID: platform === 'android' ? 'com.example.android' : 'com.example.ios',
    PLATFORM_VERSION: '18.0',
    DEVICE_UDID: 'explicit-udid',
    NEW_COMMAND_TIMEOUT_SEC: '90',
  });
}

test('Android capabilities use UiAutomator2 and namespaced extensions', () => {
  const capabilities = buildCapabilities(config('android'));
  assert.equal(capabilities.platformName, 'Android');
  assert.equal(capabilities['appium:automationName'], 'UiAutomator2');
  assert.equal(capabilities['appium:appPackage'], 'com.example.android');
  assert.equal(capabilities['appium:newCommandTimeout'], 90);
});

test('iOS capabilities use XCUITest and bundleId', () => {
  const capabilities = buildCapabilities(config('ios'));
  assert.equal(capabilities.platformName, 'iOS');
  assert.equal(capabilities['appium:automationName'], 'XCUITest');
  assert.equal(capabilities['appium:bundleId'], 'com.example.ios');
});

test('cloud options remain vendor namespaced', () => {
  const cfg = loadRuntimeConfig({
    APPIUM_SERVER_URL: 'https://ondemand.example.test/wd/hub',
    MOBILE_PLATFORM: 'android',
    DEVICE_NAME: 'cloud-device',
    APP_ID: 'com.example.android',
    CLOUD_VENDOR_PREFIX: 'vendor:options',
    CLOUD_OPTIONS_JSON: '{"build":"contract-build","name":"smoke"}',
  });
  const capabilities = buildCapabilities(cfg);
  assert.deepEqual(capabilities['vendor:options'], { build: 'contract-build', name: 'smoke' });
});
