import { describe, expect, it, vi } from 'vitest';
import { vincularNumeroImovelLancamentosEmLote } from './consolidadoVinculoImovelLote.js';

vi.mock('../../../repositories/financeiroRepository.js', () => ({
  salvarOuAtualizarLancamentoFinanceiroApi: vi.fn(),
}));

import { salvarOuAtualizarLancamentoFinanceiroApi } from '../../../repositories/financeiroRepository.js';

describe('vincularNumeroImovelLancamentosEmLote', () => {
  it('rejeita nº de imóvel inválido', async () => {
    await expect(vincularNumeroImovelLancamentosEmLote([{ id: 1 }], '')).rejects.toThrow(
      /nº de imóvel válido/i,
    );
  });

  it('grava vínculo em cada linha selecionada', async () => {
    salvarOuAtualizarLancamentoFinanceiroApi.mockImplementation(async (ui) => ({
      id: ui.apiId,
      contaContabilNome: 'Conta Imóveis',
      grupoCompensacao: '42',
      valor: 100,
      natureza: 'DEBITO',
      dataLancamento: '2026-06-01',
      descricao: 'PIX',
      numeroLancamento: '1',
      etapa: 'CLASSIFICADO',
    }));

    const rows = [
      { id: 10, contaCodigo: 'I', valor: 100, natureza: 'DEBITO', numeroLancamento: '1' },
      { id: 11, contaCodigo: 'I', valor: 200, natureza: 'DEBITO', numeroLancamento: '2' },
    ];
    const r = await vincularNumeroImovelLancamentosEmLote(rows, 42, {
      contaContabilId: 5,
      contaToLetra: { 'Conta Imóveis': 'I' },
    });
    expect(r.aplicados).toBe(2);
    expect(r.erros).toEqual([]);
    expect(r.mergedById.get(10)?.numeroImovel).toBe('42');
    expect(salvarOuAtualizarLancamentoFinanceiroApi).toHaveBeenCalledTimes(2);
  });
});
