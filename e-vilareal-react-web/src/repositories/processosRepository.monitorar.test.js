import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

import { request } from '../api/httpClient.js';
import { monitorarProcesso } from './processosRepository.js';

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue({
    processoId: 1076,
    status: 'SUCESSO_SEM_NOVIDADE',
    baseline: false,
    novas: 0,
    totalListadas: 36,
  });
});

describe('monitorarProcesso', () => {
  it('chama POST /api/processos/{id}/projudi/monitorar', async () => {
    await monitorarProcesso(1076);
    expect(request).toHaveBeenCalledWith('/api/processos/1076/projudi/monitorar', { method: 'POST' });
  });

  it('rejeita id inválido', async () => {
    await expect(monitorarProcesso(0)).rejects.toThrow(/salve o cadastro/i);
    expect(request).not.toHaveBeenCalled();
  });
});
