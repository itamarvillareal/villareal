import { describe, expect, it } from 'vitest';
import {
  avisoContratoNaoPersistido,
  contratoProntoParaPersistir,
  contratoTemDadosSignificativos,
} from './imoveisRepository.js';

describe('contratoProntoParaPersistir', () => {
  it('contrato existente: persiste mesmo sem datas', () => {
    expect(contratoProntoParaPersistir({ dataInicio: null, valorAluguel: null }, 42, {})).toBe(true);
  });

  it('contrato novo: exige data início (valor pode ser 0)', () => {
    expect(
      contratoProntoParaPersistir({ dataInicio: '2026-01-01', valorAluguel: 0 }, null, {
        dataInicioContrato: '01/01/2026',
      }),
    ).toBe(true);
  });

  it('contrato novo: só data fim sem início não persiste', () => {
    expect(
      contratoProntoParaPersistir({ dataInicio: null, dataFim: '2027-01-01', valorAluguel: null }, null, {
        dataFimContrato: '01/01/2027',
      }),
    ).toBe(false);
  });

  it('sem dados de contrato: não tenta persistir', () => {
    expect(contratoProntoParaPersistir({}, null, {})).toBe(false);
    expect(contratoTemDadosSignificativos({}, {})).toBe(false);
  });

  it('dia de repasse sem contrato exige data início', () => {
    expect(
      contratoTemDadosSignificativos({ diaRepasse: 5 }, { diaRepasse: '5' }),
    ).toBe(true);
    expect(
      avisoContratoNaoPersistido({ dataInicio: null, diaRepasse: 5, valorAluguel: null }, null, {
        diaRepasse: '5',
      }),
    ).toMatch(/data de início/i);
  });
});
