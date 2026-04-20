import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseApiJsonResponse } from './parseApiResponse.js';

vi.mock('./apiAuthHeaders.js', () => ({ emitApiUnauthorized: vi.fn() }));

describe('parseApiJsonResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
