import { describe, expect, it } from 'vitest';
import {
  diaDoMesAmanha,
  linhaPassaFiltrosRelatorioImoveis,
  parseDiaCampo,
} from './relatorioImoveisFiltros.js';

describe('relatorioImoveisFiltros', () => {
  const linha = {
    ocupado: 'Sim',
    codigoPadded: '00000728',
    proc: '12',
    diaRepasse: '20',
    diaPagAluguel: '5',
    condominio: 'Veredas',
    unidade: '604 B',
    inquilino: 'Maria',
    id: '34',
  };

  it('parseDiaCampo aceita dia válido', () => {
    expect(parseDiaCampo('20')).toBe(20);
    expect(parseDiaCampo('')).toBe(null);
  });

  it('filtra por dia de repasse', () => {
    expect(
      linhaPassaFiltrosRelatorioImoveis(linha, {
        busca: '',
        diaRepasse: '20',
        diaPagAluguel: '',
        soOcupados: false,
        somenteComVinculo: false,
      }),
    ).toBe(true);
    expect(
      linhaPassaFiltrosRelatorioImoveis(linha, {
        busca: '',
        diaRepasse: '15',
        diaPagAluguel: '',
        soOcupados: false,
        somenteComVinculo: false,
      }),
    ).toBe(false);
  });

  it('diaDoMesAmanha', () => {
    expect(diaDoMesAmanha(new Date(2026, 4, 19))).toBe(20);
  });
});
