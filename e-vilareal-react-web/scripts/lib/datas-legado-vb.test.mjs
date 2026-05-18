import { describe, expect, it } from 'vitest';
import {
  audienciaStorageParaExibicaoVB,
  parseDataAudienciaLegadoIso,
  parseDataCabecalhoProcessoIso,
} from './datas-legado-vb.mjs';

describe('parseDataCabecalhoProcessoIso', () => {
  it('interpreta dd/mm/aaaa (protocolo)', () => {
    expect(parseDataCabecalhoProcessoIso('17/08/2017')).toBe('2017-08-17');
    expect(parseDataCabecalhoProcessoIso('05/08/2017')).toBe('2017-08-05');
  });
});

describe('parseDataAudienciaLegadoIso', () => {
  it('aplica Mid VB e interpreta exibição dd/mm', () => {
    expect(audienciaStorageParaExibicaoVB('07/18/2022')).toBe('18/07/2022');
    expect(parseDataAudienciaLegadoIso('07/18/2022')).toBe('2022-07-18');
    expect(audienciaStorageParaExibicaoVB('09/04/2026')).toBe('04/09/2026');
    expect(parseDataAudienciaLegadoIso('09/04/2026')).toBe('2026-09-04');
  });
});
