import { describe, expect, it } from 'vitest';
import {
  mesclarProprietariosPlanilhaNaExtracao,
  montarPayloadDiagnosticoProprietarios,
} from './cobrancaMesclarProprietariosPlanilha.js';

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

  it('planilha sobrescreve proprietário legado do DB', () => {
    const extracao = {
      unidades: [
        {
          codigoUnidadeNormalizada: 'QD01-LT01',
          proprietarioNome: '',
          proprietarioDocDigitos: '',
          proprietarioLegadoNome: 'Dono Antigo',
          proprietarioLegadoDocDigitos: '11111111111',
          cobrancas: [],
        },
      ],
    };
    const planilha = {
      unidades: [
        {
          codigoUnidade: 'QD01-LT01',
          proprietario: { nome: 'Dono Planilha', cpfCnpjNormalizado: '22222222222' },
        },
      ],
    };
    const merged = mesclarProprietariosPlanilhaNaExtracao(extracao, planilha);
    expect(merged.unidades[0].proprietarioNome).toBe('Dono Planilha');
    expect(merged.unidades[0].proprietarioDocDigitos).toBe('22222222222');
    expect(merged.unidades[0].proprietarioLegadoNome).toBe('Dono Antigo');
  });

  it('lista unidades ainda sem proprietário após mesclagem', () => {
    const extracao = {
      unidades: [{ codigoUnidadeNormalizada: 'QD01-LT99', proprietarioNome: '', proprietarioDocDigitos: '' }],
    };
    const merged = mesclarProprietariosPlanilhaNaExtracao(extracao, { unidades: [] });
    expect(merged.unidadesSemProprietario).toEqual(['QD01-LT99']);
  });
});

describe('montarPayloadDiagnosticoProprietarios', () => {
  it('monta payload com legado e planilha', () => {
    const payload = montarPayloadDiagnosticoProprietarios(
      '928',
      {
        unidades: [
          {
            codigoUnidadeNormalizada: 'QD01-LT01',
            proprietarioNome: 'A',
            proprietarioDocDigitos: '12345678901',
            proprietarioLegadoNome: 'B',
            proprietarioLegadoDocDigitos: '98765432100',
            cobrancas: [],
          },
        ],
      },
      { unidades: [{ codigoUnidade: 'QD01-LT01' }] },
    );
    expect(payload.clienteCodigo).toBe('928');
    expect(payload.unidades[0].proprietarioLegadoNome).toBe('B');
    expect(payload.planilhaUnidades).toHaveLength(1);
  });
});
