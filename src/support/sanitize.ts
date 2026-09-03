const SECRET_KEY = /(token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)/i;
const SECRET_ASSIGNMENT = /((?:token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_TOKEN = /\b(Bearer)\s+[^\s,;]+/gi;
const URL_CREDENTIALS = /\b(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi;

export function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(URL_CREDENTIALS, '$1[REDACTED]@')
    .replace(BEARER_TOKEN, '$1 [REDACTED]')
    .replace(SECRET_ASSIGNMENT, '$1[REDACTED]');
}

export function sanitizeForEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeForEvidence(item);
    }
    return out;
  }
  return typeof value === 'string' ? sanitizeDiagnosticText(value) : value;
}

export function safeEvidenceName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 80) || 'session';
}
