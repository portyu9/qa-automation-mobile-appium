import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginScreen, loginSelectors } from '../../src/screens/login-screen.js';
import type { MobileElement, MobileSession } from '../../src/session/session-types.js';

test('login screen uses accessibility identifiers and explicit visibility waits', async () => {
  const values: string[] = [];
  const clicked: string[] = [];
  const elementFor = (selector: string): MobileElement => ({
    click: async () => { clicked.push(selector); },
    setValue: async (value) => { values.push(`${selector}:${value}`); },
    getText: async () => 'Signed in',
    isDisplayed: async () => true,
  });
  const session: MobileSession = {
    $: async (selector) => elementFor(selector),
    waitUntil: async (condition) => { assert.equal(await condition(), true); return true; },
    saveScreenshot: async () => undefined,
    getPageSource: async () => '<hierarchy/>',
    deleteSession: async () => undefined,
  };
  const screen = new LoginScreen(session);
  await screen.signIn('alice', 'secret-from-fixture');
  assert.deepEqual(values, [`${loginSelectors.username}:alice`, `${loginSelectors.password}:secret-from-fixture`]);
  assert.deepEqual(clicked, [loginSelectors.signIn]);
  assert.equal(await screen.message(), 'Signed in');
  assert.ok(Object.values(loginSelectors).every((selector) => selector.startsWith('~')));
});
