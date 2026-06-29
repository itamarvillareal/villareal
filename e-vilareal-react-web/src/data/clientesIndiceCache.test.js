import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  readIndiceClientesCache,
  writeIndiceClientesCache,
  clearIndiceClientesCache,
} from './clientesIndiceCache.js';

describe('clientesIndiceCache', () => {
  beforeEach(() => {
    clearIndiceClientesCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T12:00:00Z'));
  });

  it('persiste e relê dados com etag', () => {
    const rows = [{ codigo: '00000001', nomeRazao: 'Teste' }];
    writeIndiceClientesCache(rows, '"1-0"');
    const cached = readIndiceClientesCache();
    expect(cached?.data).toEqual(rows);
    expect(cached?.etag).toBe('"1-0"');
  });

  it('expira após TTL de 15 minutos', () => {
    writeIndiceClientesCache([{ codigo: '00000002' }], null);
    vi.setSystemTime(new Date('2026-06-28T12:16:00Z'));
    expect(readIndiceClientesCache()).toBeNull();
  });
});
