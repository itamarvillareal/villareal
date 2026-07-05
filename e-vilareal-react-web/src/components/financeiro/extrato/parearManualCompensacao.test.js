import { describe, expect, it } from 'vitest';
import {
  dataLancamentoParaIso,
  filtrarCandidatosPareamento,
  naturezaOposta,
  valorAbsolutoParaPesquisaApi,
} from './parearManualCompensacao.js';

describe('parearManualCompensacao', () => {
  it('dataLancamentoParaIso aceita ISO e BR', () => {
    expect(dataLancamentoParaIso('2026-06-18')).toBe('2026-06-18');
    expect(dataLancamentoParaIso('18/06/2026')).toBe('2026-06-18');
  });

  it('valorAbsolutoParaPesquisaApi formata valor absoluto', () => {
    expect(valorAbsolutoParaPesquisaApi(-10028.2)).toBe('10028,20');
    expect(valorAbsolutoParaPesquisaApi(0)).toBe('');
  });

  it('filtrarCandidatosPareamento exclui self e prioriza natureza oposta + conta E', () => {
    const atual = { id: 1, natureza: 'DEBITO', contaCodigo: 'E' };
    const candidatos = [
      { id: 1, natureza: 'CREDITO', contaCodigo: 'E' },
      { id: 2, natureza: 'DEBITO', contaCodigo: 'A' },
      { id: 3, natureza: 'CREDITO', contaCodigo: 'E' },
      { id: 4, natureza: 'CREDITO', contaCodigo: 'A' },
    ];
    const filtrados = filtrarCandidatosPareamento(candidatos, atual);
    expect(filtrados.map((c) => c.id)).toEqual([3, 4, 2]);
    expect(naturezaOposta('DEBITO')).toBe('CREDITO');
  });
});
