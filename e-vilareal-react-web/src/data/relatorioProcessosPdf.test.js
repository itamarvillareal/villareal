import { describe, expect, it } from 'vitest';
import {
  construirRelatorioProcessosPdf,
  descreverFiltrosRelatorioProcessos,
  rotuloCampoColunaRelatorio,
} from './relatorioProcessosPdf.js';
import { MODOS_FILTRO_COLUNA } from './relatorioFiltroColuna.js';

describe('descreverFiltrosRelatorioProcessos', () => {
  it('inclui filtro ativo e filtros por coluna', () => {
    const linhas = descreverFiltrosRelatorioProcessos({
      filtroProcessoAtivo: 'ativos',
      filtrosPorColuna: { codCliente: '985' },
      modoFiltroPorColuna: { codCliente: MODOS_FILTRO_COLUNA.contem },
      colunas: [{ id: 'codCliente', label: 'Cod. Cliente' }],
      totalLinhas: 7042,
      linhasFiltradas: 108,
    });
    expect(linhas[0]).toContain('ativos');
    expect(linhas.some((l) => l.includes('985'))).toBe(true);
    expect(linhas.some((l) => l.includes('108 de 7042'))).toBe(true);
  });
});

describe('construirRelatorioProcessosPdf', () => {
  it('gera documento com linhas filtradas', () => {
    const doc = construirRelatorioProcessosPdf({
      linhas: [{ codCliente: '985', cliente: 'CLINICA SSMA LTDA', proc: '105' }],
      colunasAtivas: [
        { id: 'codCliente', label: 'Cod. Cliente' },
        { id: 'cliente', label: 'Cliente' },
        { id: 'proc', label: 'Proc.' },
      ],
      filtrosDescricao: ['Somente processos ativos', 'Cod. Cliente: contém «985»'],
    });
    expect(doc).toBeTruthy();
    expect(typeof doc.output).toBe('function');
  });

  it('suporta muitas colunas sem erro (quebra horizontal)', () => {
    const cols = Array.from({ length: 18 }, (_, i) => ({ id: `c${i}`, label: `Col ${i}` }));
    const linha = Object.fromEntries(cols.map((c) => [c.id, 'valor']));
    const doc = construirRelatorioProcessosPdf({
      linhas: [linha, linha],
      colunasAtivas: cols,
      filtrosDescricao: ['Somente processos ativos'],
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

describe('rotuloCampoColunaRelatorio', () => {
  it('usa label do campo dinâmico quando mapeado', () => {
    const label = rotuloCampoColunaRelatorio(
      { id: 'ultimoAndamento', label: 'Último andamento' },
      { ultimoAndamento: 'parteCliente' },
    );
    expect(label).toBe('Parte Cliente');
  });
});
