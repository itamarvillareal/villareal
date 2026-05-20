import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/clientesService.js', () => ({
  buscarCliente: vi.fn(),
}));

import { buscarCliente } from '../api/clientesService.js';
import { enriquecerNomesPartesImovelUi } from './imoveisRepository.js';

describe('enriquecerNomesPartesImovelUi', () => {
  beforeEach(() => {
    vi.mocked(buscarCliente).mockReset();
  });

  it('resolve inquilino pelo inquilinoNumeroPessoa quando extras.inquilino está vazio', async () => {
    vi.mocked(buscarCliente).mockResolvedValueOnce({ nome: 'Renato Mikhail Martins' });
    const item = await enriquecerNomesPartesImovelUi({
      inquilino: '',
      inquilinoNumeroPessoa: '6881',
    });
    expect(buscarCliente).toHaveBeenCalledWith(6881);
    expect(item.inquilino).toBe('Renato Mikhail Martins');
  });

  it('não chama API se o nome já veio nos extras', async () => {
    const item = await enriquecerNomesPartesImovelUi({
      inquilino: 'Maria Silva',
      inquilinoNumeroPessoa: '6881',
    });
    expect(buscarCliente).not.toHaveBeenCalled();
    expect(item.inquilino).toBe('Maria Silva');
  });
});
