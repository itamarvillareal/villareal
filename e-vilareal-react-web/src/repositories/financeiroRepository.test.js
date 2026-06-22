import { describe, expect, it } from 'vitest';
import { clampFinanceiroPageSize } from '../components/financeiro/constants/financeiroConstants.js';
import {
  lancamentoBateContaCorrenteProcesso,
  mergeUiLancamentoComRespostaApi,
  pessoaIdDesdeCodigoClienteFinanceiro,
} from './financeiroRepository.js';

describe('clampFinanceiroPageSize', () => {
  it('preserva opções válidas do extrato', () => {
    expect(clampFinanceiroPageSize(200)).toBe(200);
    expect(clampFinanceiroPageSize(500)).toBe(500);
    expect(clampFinanceiroPageSize(1000)).toBe(1000);
  });

  it('limita valores inválidos entre 50 e 1000', () => {
    expect(clampFinanceiroPageSize(9999)).toBe(1000);
    expect(clampFinanceiroPageSize(10)).toBe(50);
  });
});

describe('pessoaIdDesdeCodigoClienteFinanceiro', () => {
  it('extrai pessoa id dos dígitos do código', () => {
    expect(pessoaIdDesdeCodigoClienteFinanceiro('00000938')).toBe(938);
    expect(pessoaIdDesdeCodigoClienteFinanceiro(938)).toBe(938);
  });
});

describe('lancamentoBateContaCorrenteProcesso', () => {
  it('aceita lançamento pelo nº interno na pessoa do código, não só processoId oficial', () => {
    const ok = lancamentoBateContaCorrenteProcesso(
      {
        clienteId: 938,
        processoId: 51853,
        codigoCliente: '00000938',
        numeroInternoProcesso: 4,
      },
      { codigoNorm: '938', procNorm: '4', resolvedProcessoId: 7448 },
    );
    expect(ok).toBe(true);
  });

  it('rejeita quando o código do lançamento não bate', () => {
    const ok = lancamentoBateContaCorrenteProcesso(
      { clienteId: 100, codigoCliente: '00000100', numeroInternoProcesso: 4 },
      { codigoNorm: '938', procNorm: '4', resolvedProcessoId: null },
    );
    expect(ok).toBe(false);
  });

  it('aceita proc 0 mensalista pelo marcador grupoCompensacao', () => {
    const ok = lancamentoBateContaCorrenteProcesso(
      { codigoCliente: '00000473', grupoCompensacao: '0', numeroInternoProcesso: null },
      { codigoNorm: '473', procNorm: '0', resolvedProcessoId: null },
    );
    expect(ok).toBe(true);
  });

  it('aceita legado sem processoId quando grupoCompensacao bate o proc da N:N', () => {
    const ok = lancamentoBateContaCorrenteProcesso(
      {
        codigoCliente: '00000793',
        processoId: null,
        grupoCompensacao: '17',
        numeroInternoProcesso: null,
      },
      { codigoNorm: '793', procNorm: '17', resolvedProcessoId: 13058 },
    );
    expect(ok).toBe(true);
  });

  it('exclui proc errado dos extras quando a chave veio da N:N', () => {
    const ok = lancamentoBateContaCorrenteProcesso(
      {
        codigoCliente: '00000793',
        processoId: 13061,
        numeroInternoProcesso: 20,
      },
      { codigoNorm: '793', procNorm: '17', resolvedProcessoId: 13058 },
    );
    expect(ok).toBe(false);
  });
});

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
