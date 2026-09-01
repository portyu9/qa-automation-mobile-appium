import type { MobileElement, MobileSession } from '../session/session-types.js';

export abstract class BaseScreen {
  protected constructor(
    protected readonly session: MobileSession,
    private readonly defaultTimeoutMs = 10_000,
  ) {}

  protected async visible(selector: string, timeoutMs = this.defaultTimeoutMs): Promise<MobileElement> {
    let element: MobileElement | undefined;
    await this.session.waitUntil(
      async () => {
        element = await this.session.$(selector);
        return element.isDisplayed();
      },
      { timeout: timeoutMs, interval: 200, timeoutMsg: `Element did not become visible: ${selector}` },
    );
    if (!element) throw new Error(`Element lookup did not resolve: ${selector}`);
    return element;
  }
}
