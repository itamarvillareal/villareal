import { describe, expect, it } from 'vitest';
import { formatDataExtratoColuna, mapApiLancamentoToExtratoRow, textoObsExtrato } from './extratoMappers.js';

describe('extratoMappers', () => {
  it('formatDataExtratoColuna omite ano quando corrente', () => {
    const y = new Date().getFullYear();
    expect(formatDataExtratoColuna(`${y}-03-25`)).toBe('25/03');
    expect(formatDataExtratoColuna('2020-03-25')).toBe('25/03/2020');
  });

  it('textoObsExtrato prioriza cod/proc na conta A', () => {
    const row = {
      contaCodigo: 'A',
      codCliente: '123',
      proc: '45',
      clienteId: 1,
      observacao: 'detalhe',
    };
    expect(textoObsExtrato(row)).toBe('123/45');
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
