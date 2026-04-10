import { describe, expect, it, vi, beforeEach } from 'vitest';

const { parseApiJsonResponseMock } = vi.hoisted(() => ({
  parseApiJsonResponseMock: vi.fn(async () => ({ parsed: true })),
}));

vi.mock('./config.js', () => ({ API_BASE_URL: 'http://api.test' }));
vi.mock('./apiAuthHeaders.js', () => ({ buildDefaultApiHeaders: () => ({ 'X-Test': '1' }) }));
vi.mock('./parseApiResponse.js', () => ({
  parseApiJsonResponse: (r) => parseApiJsonResponseMock(r),
}));

import { request } from './httpClient.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  parseApiJsonResponseMock.mockReset();
  parseApiJsonResponseMock.mockImplementation(async () => ({ parsed: true }));
});

describe('httpClient.request', () => {
  it('repassa signal ao fetch e devolve o resultado de parseApiJsonResponse', async () => {
    const ac = new AbortController();
    const fakeResponse = { ok: true, status: 200, text: async () => '{}' };
    globalThis.fetch.mockResolvedValue(fakeResponse);

    const out = await request('/foo', { signal: ac.signal });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/foo',
      expect.objectContaining({
        method: 'GET',
        signal: ac.signal,
        headers: expect.objectContaining({ 'X-Test': '1' }),
      }),
    );
    expect(parseApiJsonResponseMock).toHaveBeenCalledWith(fakeResponse);
    expect(out).toEqual({ parsed: true });
  });

  it('propaga erro quando fetch falha (ex.: pedido abortado)', async () => {
    const err = new DOMException('The user aborted a request.', 'AbortError');
    globalThis.fetch.mockRejectedValue(err);
    const ac = new AbortController();

    await expect(request('/foo', { signal: ac.signal })).rejects.toBe(err);
    expect(parseApiJsonResponseMock).not.toHaveBeenCalled();
  });
});
