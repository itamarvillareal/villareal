import { describe, expect, it } from 'vitest';
import { mesclarProprietariosPlanilhaNaExtracao } from './cobrancaMesclarProprietariosPlanilha.js';

describe('mesclarProprietariosPlanilhaNaExtracao', () => {
  it('preenche proprietário das unidades do PDF a partir da planilha', () => {
    const extracao = {
      unidades: [
        {
          codigoUnidadeNormalizada: 'QD01-LT01',
          proprietarioNome: '',
          proprietarioDocDigitos: '',
          cobrancas: [{ valorCentavos: 10000 }],
        },
      ],
      unidadesSemProprietario: ['QD01-LT01'],
    };
    const planilha = {
      unidades: [
        {
          codigoUnidade: 'qd01-lt01',
          proprietario: { nome: 'João Silva', cpfCnpjNormalizado: '12345678901' },
        },
      ],
    };
    const merged = mesclarProprietariosPlanilhaNaExtracao(extracao, planilha);
    expect(merged.unidadesSemProprietario).toEqual([]);
    expect(merged.unidades[0].proprietarioNome).toBe('João Silva');
    expect(merged.unidades[0].proprietarioDocDigitos).toBe('12345678901');
    expect(merged.totais.pf).toBe(1);
  });

  it('lista unidades ainda sem proprietário após mesclagem', () => {
    const extracao = {
      unidades: [{ codigoUnidadeNormalizada: 'QD01-LT99', proprietarioNome: '', proprietarioDocDigitos: '' }],
    };
    const merged = mesclarProprietariosPlanilhaNaExtracao(extracao, { unidades: [] });
    expect(merged.unidadesSemProprietario).toEqual(['QD01-LT99']);
  });
});
