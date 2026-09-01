export type MobilePlatform = 'android' | 'ios';

export interface RuntimeConfig {
  serverUrl: URL;
  platform: MobilePlatform;
  deviceName: string;
  platformVersion?: string;
  udid?: string;
  appPath?: string;
  appId?: string;
  androidPackage?: string;
  androidActivity?: string;
  noReset: boolean;
  fullReset: boolean;
  newCommandTimeoutSec: number;
  evidenceDir: string;
  cloudVendorPrefix?: string;
  cloudOptions?: Readonly<Record<string, unknown>>;
}

const SECRET_KEY = /(token|secret|password|credential|authorization|api[_-]?key|access[_-]?key)/i;

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function booleanValue(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = optional(env, key);
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function integerValue(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = optional(env, key);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${key} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 30 || value > 1800) {
    throw new Error(`${key} must be between 30 and 1800 seconds`);
  }
  return value;
}

function serverUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APPIUM_SERVER_URL must use HTTP(S)');
  if (url.username || url.password) throw new Error('APPIUM_SERVER_URL must not embed credentials');
  if (url.search || url.hash) throw new Error('APPIUM_SERVER_URL must not contain query or fragment data');
  return url;
}

function cloudOptions(env: NodeJS.ProcessEnv): {
  cloudVendorPrefix?: string;
  cloudOptions?: Readonly<Record<string, unknown>>;
} {
  const prefix = optional(env, 'CLOUD_VENDOR_PREFIX');
  const raw = optional(env, 'CLOUD_OPTIONS_JSON');
  if (!prefix && !raw) return {};
  if (!prefix || !raw) throw new Error('CLOUD_VENDOR_PREFIX and CLOUD_OPTIONS_JSON must be supplied together');
  if (!/^[a-z][a-z0-9-]*:options$/.test(prefix)) {
    throw new Error('CLOUD_VENDOR_PREFIX must be a vendor-qualified capability such as sauce:options');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CLOUD_OPTIONS_JSON must be valid JSON');
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('CLOUD_OPTIONS_JSON must contain a JSON object');
  }
  for (const key of Object.keys(parsed)) {
    if (SECRET_KEY.test(key)) throw new Error(`CLOUD_OPTIONS_JSON must not contain secret-like key: ${key}`);
  }
  return { cloudVendorPrefix: prefix, cloudOptions: Object.freeze({ ...(parsed as Record<string, unknown>) }) };
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { requireAppTarget?: boolean } = {},
): RuntimeConfig {
  const platformRaw = required(env, 'MOBILE_PLATFORM').toLowerCase();
  if (platformRaw !== 'android' && platformRaw !== 'ios') {
    throw new Error('MOBILE_PLATFORM must be android or ios');
  }
  const noReset = booleanValue(env, 'NO_RESET', false);
  const fullReset = booleanValue(env, 'FULL_RESET', false);
  if (noReset && fullReset) throw new Error('NO_RESET and FULL_RESET cannot both be true');

  const appPath = optional(env, 'APP_PATH');
  const appId = optional(env, 'APP_ID');
  if ((options.requireAppTarget ?? true) && !appPath && !appId) {
    throw new Error('APP_PATH or APP_ID is required for a device session');
  }

  const cloud = cloudOptions(env);
  return {
    serverUrl: serverUrl(required(env, 'APPIUM_SERVER_URL')),
    platform: platformRaw,
    deviceName: required(env, 'DEVICE_NAME'),
    ...(optional(env, 'PLATFORM_VERSION') ? { platformVersion: optional(env, 'PLATFORM_VERSION') } : {}),
    ...(optional(env, 'DEVICE_UDID') ? { udid: optional(env, 'DEVICE_UDID') } : {}),
    ...(appPath ? { appPath } : {}),
    ...(appId ? { appId } : {}),
    ...(optional(env, 'ANDROID_APP_PACKAGE') ? { androidPackage: optional(env, 'ANDROID_APP_PACKAGE') } : {}),
    ...(optional(env, 'ANDROID_APP_ACTIVITY') ? { androidActivity: optional(env, 'ANDROID_APP_ACTIVITY') } : {}),
    noReset,
    fullReset,
    newCommandTimeoutSec: integerValue(env, 'NEW_COMMAND_TIMEOUT_SEC', 120),
    evidenceDir: optional(env, 'EVIDENCE_DIR') ?? 'reports/device',
    ...cloud,
  } as RuntimeConfig;
}
