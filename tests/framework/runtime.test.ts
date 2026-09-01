import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRuntimeConfig } from '../../src/config/runtime.js';

const baseEnv = (): NodeJS.ProcessEnv => ({
  APPIUM_SERVER_URL: 'http://127.0.0.1:4723',
  MOBILE_PLATFORM: 'android',
  DEVICE_NAME: 'Pixel contract device',
  APP_ID: 'com.example.reference',
});

test('runtime accepts a deterministic Android contract', () => {
  const config = loadRuntimeConfig(baseEnv());
  assert.equal(config.platform, 'android');
  assert.equal(config.newCommandTimeoutSec, 120);
  assert.equal(config.serverUrl.href, 'http://127.0.0.1:4723/');
});

test('runtime accepts iOS with bundle identifier', () => {
  const env = { ...baseEnv(), MOBILE_PLATFORM: 'ios', APP_ID: 'com.example.reference.ios' };
  assert.equal(loadRuntimeConfig(env).platform, 'ios');
});

test('runtime rejects unsupported platform', () => {
  assert.throws(() => loadRuntimeConfig({ ...baseEnv(), MOBILE_PLATFORM: 'windows' }), /android or ios/);
});

test('runtime rejects embedded Appium credentials', () => {
  assert.throws(() => loadRuntimeConfig({ ...baseEnv(), APPIUM_SERVER_URL: 'https://user:pass@example.test' }), /credentials/);
});

test('runtime rejects ambiguous reset policy', () => {
  assert.throws(() => loadRuntimeConfig({ ...baseEnv(), NO_RESET: 'true', FULL_RESET: 'true' }), /cannot both/);
});

test('runtime rejects missing application target by default', () => {
  const env = baseEnv();
  delete env.APP_ID;
  assert.throws(() => loadRuntimeConfig(env), /APP_PATH or APP_ID/);
});

test('runtime allows app-less config for framework-only validation', () => {
  const env = baseEnv();
  delete env.APP_ID;
  assert.equal(loadRuntimeConfig(env, { requireAppTarget: false }).deviceName, 'Pixel contract device');
});

test('runtime rejects secret-like cloud option keys', () => {
  assert.throws(
    () => loadRuntimeConfig({ ...baseEnv(), CLOUD_VENDOR_PREFIX: 'sauce:options', CLOUD_OPTIONS_JSON: '{"accessKey":"nope"}' }),
    /secret-like key/,
  );
});
