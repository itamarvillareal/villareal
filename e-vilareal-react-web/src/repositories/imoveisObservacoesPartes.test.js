import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/clientesService.js', () => ({
  buscarCliente: vi.fn(),
}));

import { buscarCliente } from '../api/clientesService.js';
import { enriquecerNomesPartesImovelUi, resolverObservacoesImovelParaUi } from './imoveisRepository.js';

describe('resolverObservacoesImovelParaUi', () => {
  it('prioriza imovel.observacoes, depois contrato, depois extras', () => {
    expect(
      resolverObservacoesImovelParaUi(
        { observacoes: 'Coluna imóvel' },
        { observacoes: 'Contrato' },
        { observacoesInquilino: 'Extras' },
      ),
    ).toBe('Coluna imóvel');
    expect(
      resolverObservacoesImovelParaUi(
        { observacoes: '' },
        { observacoes: 'Contrato' },
        { observacoesInquilino: 'Extras' },
      ),
    ).toBe('Contrato');
    expect(
      resolverObservacoesImovelParaUi(
        null,
        null,
        { obsInquilino: 'Legado extras' },
      ),
    ).toBe('Legado extras');
  });
});

describe('enriquecerNomesPartesImovelUi', () => {
  beforeEach(() => {
    vi.mocked(buscarCliente).mockReset();
  });

  it('prefere FK sobre nome legado nos extras', async () => {
    vi.mocked(buscarCliente).mockResolvedValueOnce({
      nome: 'Maria Locadora',
      cpf: '12345678901',
      telefone: '62999998888',
    });
    const item = await enriquecerNomesPartesImovelUi({
      proprietario: 'Nome desatualizado no JSON',
      proprietarioCpf: '000.000.000-00',
      proprietarioNumeroPessoa: '42',
    });
    expect(item.proprietario).toBe('Maria Locadora');
    expect(item.proprietarioCpf).toBe('123.456.789-01');
    expect(item.proprietarioContato).toBe('62999998888');
  });

  it('usa extras quando não há FK', async () => {
    const item = await enriquecerNomesPartesImovelUi({
      inquilino: 'João Inquilino',
      inquilinoCpf: '111.222.333-44',
      inquilinoNumeroPessoa: '',
    });
    expect(buscarCliente).not.toHaveBeenCalled();
    expect(item.inquilino).toBe('João Inquilino');
    expect(item.inquilinoCpf).toBe('111.222.333-44');
  });
});
