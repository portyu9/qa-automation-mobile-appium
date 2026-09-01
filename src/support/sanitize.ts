const SECRET_KEY = /(token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)/i;

export function sanitizeForEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeForEvidence(item);
    }
    return out;
  }
  return value;
}

export function safeEvidenceName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 80) || 'session';
}
