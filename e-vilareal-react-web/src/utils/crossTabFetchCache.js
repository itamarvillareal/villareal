const BC_NAME = 'vilareal.cross-tab-cache';
const STORAGE_PREFIX = 'vilareal.xtab.cache.';
const LOCK_PREFIX = 'vilareal.xtab.lock.';

/** @type {BroadcastChannel | null} */
let bc = null;
/** @type {Map<string, Promise<unknown>>} */
const inFlight = new Map();

function getBc() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!bc) {
    bc = new BroadcastChannel(BC_NAME);
  }
  return bc;
}

function cacheStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

function lockStorageKey(key) {
  return `${LOCK_PREFIX}${key}`;
}

function readEntry(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || typeof parsed.ts !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(entry, ttlMs) {
  const ttl = entry?.ttlMs ?? ttlMs;
  return Boolean(entry && Date.now() - entry.ts < ttl);
}

function writeEntry(key, data, ttlMs) {
  if (typeof localStorage === 'undefined') return;
  const entry = { data, ts: Date.now(), ttlMs };
  localStorage.setItem(cacheStorageKey(key), JSON.stringify(entry));
  getBc()?.postMessage({ type: 'set', key, data });
}

function readLock(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lockStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function acquireLock(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(lockStorageKey(key), JSON.stringify({ ts: Date.now() }));
}

function releaseLock(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(lockStorageKey(key));
}

function isLockActive(key, maxAgeMs = 30_000) {
  const lock = readLock(key);
  return Boolean(lock && Date.now() - lock.ts < maxAgeMs);
}

function waitForCrossTabResult(key, ttlMs, timeoutMs) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(undefined);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      window.removeEventListener('storage', onStorage);
      channel?.removeEventListener('message', onBc);
      resolve(value);
    };

    const tryRead = () => {
      const entry = readEntry(key);
      if (isFresh(entry, ttlMs)) finish(entry.data);
    };

    const onStorage = (ev) => {
      if (ev.key === cacheStorageKey(key) && ev.newValue) tryRead();
    };

    const channel = getBc();
    const onBc = (ev) => {
      const msg = ev.data;
      if (msg?.type === 'set' && msg.key === key) finish(msg.data);
      if (msg?.type === 'invalidate' && msg.key === key) finish(undefined);
    };

    window.addEventListener('storage', onStorage);
    channel?.addEventListener('message', onBc);

    const pollTimer = window.setInterval(tryRead, 400);
    const timeoutTimer = window.setTimeout(() => finish(undefined), timeoutMs);

    tryRead();
  });
}

/**
 * Cache GET compartilhado entre abas (localStorage + dedupe in-flight).
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetchFn
 * @param {{ ttlMs?: number, force?: boolean }} [options]
 * @returns {Promise<T>}
 */
export async function fetchWithCrossTabCache(key, fetchFn, options = {}) {
  const ttlMs = options.ttlMs ?? 90_000;
  const force = options.force === true;

  if (!force) {
    const cached = readEntry(key);
    if (isFresh(cached, ttlMs)) return cached.data;
  }

  if (inFlight.has(key)) return inFlight.get(key);

  if (!force && isLockActive(key)) {
    const waited = await waitForCrossTabResult(key, ttlMs, 12_000);
    if (waited !== undefined) return waited;
  }

  const run = (async () => {
    acquireLock(key);
    try {
      const data = await fetchFn();
      writeEntry(key, data, ttlMs);
      return data;
    } finally {
      releaseLock(key);
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}

/** @param {string} key */
export function invalidateCrossTabCache(key) {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(cacheStorageKey(key));
    localStorage.removeItem(lockStorageKey(key));
  }
  inFlight.delete(key);
  getBc()?.postMessage({ type: 'invalidate', key });
}
