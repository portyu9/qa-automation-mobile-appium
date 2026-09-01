import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRuntimeConfig } from '../../src/config/runtime.js';
import { SessionManager } from '../../src/session/session-manager.js';
import type { MobileElement, MobileSession } from '../../src/session/session-types.js';

function runtime() {
  return loadRuntimeConfig({
    APPIUM_SERVER_URL: 'http://127.0.0.1:4723',
    MOBILE_PLATFORM: 'android',
    DEVICE_NAME: 'contract-device',
    APP_ID: 'com.example.android',
  });
}

function fakeSession(deleteSession: () => Promise<void>): MobileSession {
  const element: MobileElement = {
    click: async () => undefined,
    setValue: async () => undefined,
    getText: async () => 'ok',
    isDisplayed: async () => true,
  };
  return {
    $: async () => element,
    waitUntil: async (condition) => {
      assert.equal(await condition(), true);
      return true;
    },
    saveScreenshot: async () => undefined,
    getPageSource: async () => '<hierarchy/>',
    deleteSession,
    capabilities: { platformName: 'Android' },
  };
}

test('session manager returns task result and deletes the session', async () => {
  let deleted = 0;
  const session = fakeSession(async () => { deleted += 1; });
  const manager = new SessionManager(runtime(), async () => session);
  assert.equal(await manager.withSession('success', async () => 42), 42);
  assert.equal(deleted, 1);
});

test('session manager preserves primary failure and collects evidence', async () => {
  let deleted = 0;
  let evidence = 0;
  const session = fakeSession(async () => { deleted += 1; });
  const manager = new SessionManager(runtime(), async () => session, async () => { evidence += 1; });
  await assert.rejects(() => manager.withSession('failure', async () => { throw new Error('product assertion'); }), /product assertion/);
  assert.equal(evidence, 1);
  assert.equal(deleted, 1);
});

test('evidence collector failure never masks primary failure', async () => {
  const session = fakeSession(async () => undefined);
  const manager = new SessionManager(runtime(), async () => session, async () => { throw new Error('evidence failed'); });
  await assert.rejects(() => manager.withSession('failure', async () => { throw new Error('primary'); }), /primary/);
});

test('teardown failure surfaces when it is the only failure', async () => {
  const session = fakeSession(async () => { throw new Error('teardown'); });
  const manager = new SessionManager(runtime(), async () => session);
  await assert.rejects(() => manager.withSession('teardown', async () => 'ok'), /teardown/);
});
