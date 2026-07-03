import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithCrossTabCache,
  invalidateCrossTabCache,
} from './crossTabFetchCache.js';

describe('crossTabFetchCache', () => {
  /** @type {Record<string, string>} */
  let store;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
    });
    vi.stubGlobal('BroadcastChannel', class {
      postMessage() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('busca na rede quando não há cache', async () => {
    const fetchFn = vi.fn(async () => ({ rodadas: [{ chave: 'a' }] }));
    const data = await fetchWithCrossTabCache('test.resumo', fetchFn, { ttlMs: 60_000 });
    expect(data).toEqual({ rodadas: [{ chave: 'a' }] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reutiliza cache fresco sem nova rede', async () => {
    const fetchFn = vi.fn(async () => ({ n: 1 }));
    await fetchWithCrossTabCache('test.resumo', fetchFn, { ttlMs: 60_000 });
    const fetchFn2 = vi.fn(async () => ({ n: 2 }));
    const data = await fetchWithCrossTabCache('test.resumo', fetchFn2, { ttlMs: 60_000 });
    expect(data).toEqual({ n: 1 });
    expect(fetchFn2).not.toHaveBeenCalled();
  });

  it('deduplica chamadas simultâneas na mesma aba', async () => {
    let resolveFetch;
    const fetchFn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    const p1 = fetchWithCrossTabCache('test.dedupe', fetchFn, { ttlMs: 60_000 });
    const p2 = fetchWithCrossTabCache('test.dedupe', fetchFn, { ttlMs: 60_000 });
    resolveFetch?.({ ok: true });
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('invalida cache e força nova busca', async () => {
    const fetchFn = vi.fn(async () => ({ v: 1 }));
    await fetchWithCrossTabCache('test.invalidate', fetchFn, { ttlMs: 60_000 });
    invalidateCrossTabCache('test.invalidate');
    fetchFn.mockResolvedValueOnce({ v: 2 });
    const data = await fetchWithCrossTabCache('test.invalidate', fetchFn, { ttlMs: 60_000 });
    expect(data).toEqual({ v: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
