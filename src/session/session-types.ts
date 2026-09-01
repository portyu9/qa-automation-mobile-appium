export interface MobileElement {
  click(): Promise<void>;
  setValue(value: string): Promise<void>;
  getText(): Promise<string>;
  isDisplayed(): Promise<boolean>;
}

export interface MobileSession {
  $(selector: string): Promise<MobileElement>;
  waitUntil(
    condition: () => Promise<boolean>,
    options: { timeout: number; interval?: number; timeoutMsg: string },
  ): Promise<boolean>;
  saveScreenshot(path: string): Promise<void>;
  getPageSource(): Promise<string>;
  deleteSession(): Promise<void>;
  getContexts?(): Promise<readonly string[]>;
  capabilities?: Record<string, unknown>;
}
