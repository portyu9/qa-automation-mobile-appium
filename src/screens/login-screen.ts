import { BaseScreen } from './base-screen.js';
import type { MobileSession } from '../session/session-types.js';

const selectors = Object.freeze({
  username: '~username',
  password: '~password',
  signIn: '~sign-in',
  message: '~login-message',
});

export class LoginScreen extends BaseScreen {
  constructor(session: MobileSession) {
    super(session);
  }

  async signIn(username: string, password: string): Promise<void> {
    await (await this.visible(selectors.username)).setValue(username);
    await (await this.visible(selectors.password)).setValue(password);
    await (await this.visible(selectors.signIn)).click();
  }

  async message(): Promise<string> {
    return (await this.visible(selectors.message)).getText();
  }
}

export const loginSelectors = selectors;
