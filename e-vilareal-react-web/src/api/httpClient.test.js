import { describe, expect, it, vi, beforeEach } from 'vitest';

const { parseApiJsonResponseMock } = vi.hoisted(() => ({
  parseApiJsonResponseMock: vi.fn(async () => ({ parsed: true })),
}));

vi.mock('./config.js', () => ({ API_BASE_URL: 'http://api.test' }));
vi.mock('./authTokenStorage.js', () => ({
  getAccessToken: () => 'token-test',
}));
vi.mock('../services/auditoriaCliente.js', () => ({
  buildAuditoriaHeaders: () => ({ 'X-Audit': '1' }),
}));
vi.mock('./apiAuthHeaders.js', () => ({
  buildDefaultApiHeaders: () => ({ 'X-Test': '1' }),
  emitApiUnauthorized: vi.fn(),
}));
vi.mock('./parseApiResponse.js', () => ({
  parseApiJsonResponse: (r, opts) => parseApiJsonResponseMock(r, opts),
}));

import { request, requestBlob } from './httpClient.js';
import { emitApiUnauthorized } from './apiAuthHeaders.js';

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
    expect(parseApiJsonResponseMock).toHaveBeenCalledWith(fakeResponse, {
      authTokenSnapshotAtRequest: 'token-test',
    });
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

describe('httpClient.requestBlob', () => {
  it('monta query com fileId repetido para consolidação selecionada', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['pdf']),
      headers: { get: (k) => (k === 'Content-Disposition' ? 'filename="x.pdf"' : null) },
    });

    await requestBlob('/proc/1/consolidar', {
      query: { fileId: ['a', 'b'] },
      fallbackFilename: 'f.pdf',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://api.test/proc/1/consolidar?fileId=a&fileId=b',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-test',
          Accept: 'application/pdf',
        }),
      }),
    );
  });

  it('em 401 não desloga por padrão', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"message":"Não autenticado."}',
    });

    await expect(requestBlob('/pdf')).rejects.toThrow(/Não autenticado ao baixar/);
    expect(emitApiUnauthorized).not.toHaveBeenCalled();
  });
});
