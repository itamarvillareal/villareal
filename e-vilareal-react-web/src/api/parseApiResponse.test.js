import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getAccessTokenMock, emitApiUnauthorizedMock } = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn(() => ''),
  emitApiUnauthorizedMock: vi.fn(),
}));

vi.mock('./authTokenStorage.js', () => ({
  getAccessToken: (...args) => getAccessTokenMock(...args),
}));

vi.mock('./apiAuthHeaders.js', () => ({
  emitApiUnauthorized: (...args) => emitApiUnauthorizedMock(...args),
}));

import { parseApiJsonResponse } from './parseApiResponse.js';

describe('parseApiJsonResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessTokenMock.mockReturnValue('');
  });

  it('anexa path da API à mensagem em erro', async () => {
    const r = {
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({
          message: 'Erro interno.',
          path: '/api/publicacoes',
        }),
    };
    await expect(parseApiJsonResponse(r)).rejects.toThrow('Erro interno. — /api/publicacoes');
  });

  it('em 401 com snapshot do token: chama emit só se o token atual ainda for o mesmo', async () => {
    const r = {
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    };
    getAccessTokenMock.mockReturnValue('TOKEN_NOVO');
    await expect(
      parseApiJsonResponse(r, { authTokenSnapshotAtRequest: 'TOKEN_VELHO' }),
    ).rejects.toThrow();
    expect(emitApiUnauthorizedMock).not.toHaveBeenCalled();
  });

  it('em 401 com snapshot igual ao token atual: chama emit', async () => {
    const r = {
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    };
    getAccessTokenMock.mockReturnValue('MESMO');
    await expect(
      parseApiJsonResponse(r, { authTokenSnapshotAtRequest: 'MESMO' }),
    ).rejects.toThrow();
    expect(emitApiUnauthorizedMock).toHaveBeenCalledTimes(1);
  });

  it('em 401 sem snapshot (uso legado): chama emit', async () => {
    const r = {
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    };
    await expect(parseApiJsonResponse(r)).rejects.toThrow();
    expect(emitApiUnauthorizedMock).toHaveBeenCalledTimes(1);
  });
});
