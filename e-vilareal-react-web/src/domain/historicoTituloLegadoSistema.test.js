import { describe, expect, it } from 'vitest';
import {
  agruparConsultasRealizadasPorProcesso,
  agruparProcessosConsultadosPorProcesso,
  ehTituloHistoricoSistemaLegado,
} from './historicoTituloLegadoSistema.js';

describe('ehTituloHistoricoSistemaLegado', () => {
  it('exclui títulos automáticos do VB na pasta', () => {
    expect(
      ehTituloHistoricoSistemaLegado(
        'JUNTAR PETIÇÃO INSERIDA NA PASTA EM 15/05/2026 (NOVO ENDEREÇO PARA INTIMAR PROCURADOR)',
      ),
    ).toBe(true);
    expect(
      ehTituloHistoricoSistemaLegado('PETIÇÃO DA INFORMAÇÃO ANTERIOR JUNTADA EM 15/05/2026'),
    ).toBe(true);
    expect(ehTituloHistoricoSistemaLegado('PETIÇÃO DA INF. ANTERIOR JUNTADA EM 23/07/2021')).toBe(true);
  });

  it('mantém informações reais de histórico', () => {
    expect(ehTituloHistoricoSistemaLegado('AGRAVO INTERNO JUNTADO E PREPARADO')).toBe(false);
    expect(ehTituloHistoricoSistemaLegado('memoriais até 18/05/2026')).toBe(false);
    expect(ehTituloHistoricoSistemaLegado('teste')).toBe(false);
  });
});

describe('agruparConsultasRealizadasPorProcesso', () => {
  it('mantém uma linha por código + processo (andamento de maior id)', () => {
    const itens = agruparConsultasRealizadasPorProcesso([
      { codCliente: '00000728', proc: '973', info: 'Primeira nota', id: 10 },
      { codCliente: '00000728', proc: '973', info: 'Segunda nota', id: 99 },
      { codCliente: '00000560', proc: '100', info: 'Outro proc', id: 5 },
    ]);
    expect(itens).toHaveLength(2);
    const p973 = itens.find((x) => x.proc === '973');
    expect(p973?.info).toBe('Segunda nota');
    expect(p973?.id).toBe(99);
  });

  it('exclui títulos automáticos antes de agrupar', () => {
    const itens = agruparConsultasRealizadasPorProcesso([
      {
        codCliente: '00000600',
        proc: '79',
        info: 'JUNTAR PETIÇÃO INSERIDA NA PASTA EM 05/06/2026',
        id: 110,
      },
      { codCliente: '00000600', proc: '148', info: 'Nota real', id: 1 },
    ]);
    expect(itens).toHaveLength(1);
    expect(itens[0].proc).toBe('148');
  });
});

describe('agruparProcessosConsultadosPorProcesso', () => {
  it('inclui processo quando só há título automático no dia', () => {
    const itens = agruparProcessosConsultadosPorProcesso([
      {
        codCliente: '00000600',
        proc: 79,
        indice: 110,
        info: 'JUNTAR PETIÇÃO INSERIDA NA PASTA EM 05/06/2026',
      },
      {
        codCliente: '00000600',
        proc: 79,
        indice: 111,
        info: 'PETIÇÃO DA INF. ANTERIOR JUNTADA EM 05/06/2026',
      },
    ]);
    expect(itens).toHaveLength(1);
    expect(itens[0].proc).toBe(79);
    expect(itens[0].indice).toBe(111);
  });
});
