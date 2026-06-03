import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true },
}));

vi.mock('../api/httpClient.js', () => ({
  request: (...args) => requestMock(...args),
}));

import {
  devePararPaginacaoProcessosCliente,
  listarProcessosPorCodigoCliente,
} from './processosRepository.js';

describe('devePararPaginacaoProcessosCliente', () => {
  it('continua quando a página veio incompleta mas last=false', () => {
    expect(devePararPaginacaoProcessosCliente({ last: false, totalPages: 4 }, 20, 0, 100)).toBe(false);
  });

  it('para quando last=true mesmo com página cheia', () => {
    expect(devePararPaginacaoProcessosCliente({ last: true, totalPages: 1 }, 100, 0, 100)).toBe(true);
  });

  it('usa totalPages quando last não veio', () => {
    expect(devePararPaginacaoProcessosCliente({ totalPages: 3 }, 20, 1, 100)).toBe(false);
    expect(devePararPaginacaoProcessosCliente({ totalPages: 3 }, 15, 2, 100)).toBe(true);
  });

  it('para em chunk vazio ou página menor que pageSize sem metadados', () => {
    expect(devePararPaginacaoProcessosCliente({}, 0, 0, 100)).toBe(true);
    expect(devePararPaginacaoProcessosCliente({}, 65, 0, 100)).toBe(true);
  });
});

describe('listarProcessosPorCodigoCliente paginação', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('busca todas as páginas quando o backend limita a 20 itens por página', async () => {
    requestMock
      .mockResolvedValueOnce({
        content: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, numeroInterno: i + 1 })),
        last: false,
        totalPages: 4,
      })
      .mockResolvedValueOnce({
        content: Array.from({ length: 20 }, (_, i) => ({ id: i + 21, numeroInterno: i + 21 })),
        last: false,
        totalPages: 4,
      })
      .mockResolvedValueOnce({
        content: Array.from({ length: 20 }, (_, i) => ({ id: i + 41, numeroInterno: i + 41 })),
        last: false,
        totalPages: 4,
      })
      .mockResolvedValueOnce({
        content: [{ id: 61, numeroInterno: 61 }],
        last: true,
        totalPages: 4,
      });

    const todos = await listarProcessosPorCodigoCliente('00000257');
    expect(todos).toHaveLength(61);
    expect(requestMock).toHaveBeenCalledTimes(4);
    expect(todos.some((p) => Number(p.numeroInterno) === 42)).toBe(true);
  });
});
