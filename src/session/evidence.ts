import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sanitizeForEvidence, safeEvidenceName } from '../support/sanitize.js';
import type { MobileSession } from './session-types.js';

export interface FailureEvidenceInput {
  session: MobileSession;
  evidenceDir: string;
  testName: string;
  capabilities: Readonly<Record<string, unknown>>;
  error: unknown;
}

export async function captureFailureEvidence(input: FailureEvidenceInput): Promise<void> {
  const directory = join(input.evidenceDir, safeEvidenceName(input.testName));
  await mkdir(directory, { recursive: true });
  const failures: string[] = [];

  try {
    await input.session.saveScreenshot(join(directory, 'failure.png'));
  } catch (error) {
    failures.push(`screenshot: ${String(error)}`);
  }

  try {
    await writeFile(join(directory, 'page-source.xml'), await input.session.getPageSource(), 'utf8');
  } catch (error) {
    failures.push(`page-source: ${String(error)}`);
  }

  const payload = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    capabilities: sanitizeForEvidence(input.capabilities),
    error: sanitizeForEvidence(
      input.error instanceof Error
        ? { name: input.error.name, message: input.error.message }
        : { message: String(input.error) },
    ),
    evidenceCollectionWarnings: sanitizeForEvidence(failures),
  };
  await writeFile(join(directory, 'failure.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
