import { remote } from 'webdriverio';
import type { RuntimeConfig } from '../config/runtime.js';
import { buildCapabilities } from '../capabilities/factory.js';
import { captureFailureEvidence } from './evidence.js';
import type { MobileSession } from './session-types.js';

export type SessionConnector = (config: RuntimeConfig, capabilities: Readonly<Record<string, unknown>>) => Promise<MobileSession>;
export type EvidenceCollector = typeof captureFailureEvidence;

const defaultConnector: SessionConnector = async (config, capabilities) => {
  const url = config.serverUrl;
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  const session = await remote({
    protocol: url.protocol.slice(0, -1) as 'http' | 'https',
    hostname: url.hostname,
    port,
    path: url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, ''),
    connectionRetryCount: 0,
    connectionRetryTimeout: 30_000,
    capabilities: capabilities as never,
    logLevel: 'warn',
  });
  return session as unknown as MobileSession;
};

export class SessionManager {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly connector: SessionConnector = defaultConnector,
    private readonly collectEvidence: EvidenceCollector = captureFailureEvidence,
  ) {}

  async withSession<T>(testName: string, task: (session: MobileSession) => Promise<T>): Promise<T> {
    const capabilities = buildCapabilities(this.config);
    const session = await this.connector(this.config, capabilities);
    let primaryError: unknown;
    try {
      return await task(session);
    } catch (error) {
      primaryError = error;
      try {
        await this.collectEvidence({
          session,
          evidenceDir: this.config.evidenceDir,
          testName,
          capabilities,
          error,
        });
      } catch {
        // Evidence failure must never replace the primary test failure.
      }
      throw error;
    } finally {
      try {
        await session.deleteSession();
      } catch (teardownError) {
        if (primaryError === undefined) throw teardownError;
      }
    }
  }
}
