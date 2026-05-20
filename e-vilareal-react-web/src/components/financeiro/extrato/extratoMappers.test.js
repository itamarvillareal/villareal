import { describe, expect, it } from 'vitest';
import {
  formatDataExtratoColuna,
  mapApiLancamentoToExtratoRow,
  promoverContaEscritorioSeVinculado,
  textoObsExtrato,
} from './extratoMappers.js';
import { mesAnoFromDataLancamento } from './extratoMesUtils.js';

describe('extratoMesUtils', () => {
  it('mesAnoFromDataLancamento extrai YYYY-MM', () => {
    expect(mesAnoFromDataLancamento('2026-03-02')).toBe('2026-03');
    expect(mesAnoFromDataLancamento(null)).toBeNull();
    expect(mesAnoFromDataLancamento('')).toBeNull();
  });
});

describe('extratoMappers', () => {
  it('formatDataExtratoColuna omite ano quando corrente', () => {
    const y = new Date().getFullYear();
    expect(formatDataExtratoColuna(`${y}-03-25`)).toBe('25/03');
    expect(formatDataExtratoColuna('2020-03-25')).toBe('25/03/2020');
  });

  it('textoObsExtrato exibe cod/proc quando há vínculo (mesmo com conta N)', () => {
    const row = {
      contaCodigo: 'N',
      codCliente: '104',
      proc: '4',
      clienteId: 1,
      observacao: 'CREDIT - Pagamento',
    };
    expect(textoObsExtrato(row)).toBe('104/4');
  });

  it('promoverContaEscritorioSeVinculado altera N para A', () => {
    const row = { contaCodigo: 'N', codCliente: '104', proc: '4' };
    const out = promoverContaEscritorioSeVinculado(row, [{ id: 1, codigo: 'A', nome: 'Conta Escritório' }]);
    expect(out.contaCodigo).toBe('A');
    expect(out.contaContabilId).toBe(1);
  });

  it('mapApiLancamentoToExtratoRow mapeia etapa e natureza', () => {
    const row = mapApiLancamentoToExtratoRow(
      {
        id: 1,
        contaContabilNome: 'Conta Escritório',
        dataLancamento: '2026-05-10',
        descricao: 'PIX',
        valor: 100,
        natureza: 'CREDITO',
        etapa: 'IMPORTADO',
      },
      { 'Conta Escritório': 'A' },
    );
    expect(row.contaCodigo).toBe('A');
    expect(row.etapa).toBe('IMPORTADO');
    expect(row.natureza).toBe('CREDITO');
    expect(row.valor).toBe(100);
  });
});
