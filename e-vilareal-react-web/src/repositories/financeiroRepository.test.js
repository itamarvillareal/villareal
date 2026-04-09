import { describe, expect, it } from 'vitest';
import { mergeUiLancamentoComRespostaApi } from './financeiroRepository.js';

describe('mergeUiLancamentoComRespostaApi', () => {
  it('com origem OFX e API devolvendo cliente/processo, não apaga o vínculo (modal Vincular)', () => {
    const row = {
      letra: 'A',
      numero: 'x',
      data: '29/12/2025',
      valor: 2500,
      codCliente: '00000938',
      proc: '17',
      origemImportacao: 'OFX',
      _financeiroMeta: { clienteId: 1, processoId: 2, contaContabilId: 3 },
    };
    const saved = {
      id: 99,
      origem: 'OFX',
      clienteId: 938,
      processoId: 17,
      codigoCliente: '00000938',
      numeroInternoProcesso: 17,
      contaContabilId: 3,
    };
    const out = mergeUiLancamentoComRespostaApi(row, saved);
    expect(out._financeiroMeta.clienteId).toBe(938);
    expect(out._financeiroMeta.processoId).toBe(17);
    expect(String(out.codCliente).replace(/\D/g, '')).toContain('938');
    expect(String(out.proc).trim()).not.toBe('');
  });
});
