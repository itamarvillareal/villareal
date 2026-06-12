import { describe, it, expect } from 'vitest';
import { cnjEhTrt18, levenshtein, termoDigitosCorrespondeCnjCampo } from './cnjFuzzyBusca.js';

describe('levenshtein', () => {
  it('distância 1 entre 5482633 e 5402633', () => {
    expect(levenshtein('5482633', '5402633')).toBe(1);
  });
});

describe('termoDigitosCorrespondeCnjCampo', () => {
  it('substring exacta continua a funcionar', () => {
    expect(termoDigitosCorrespondeCnjCampo('782017', '5402633-78.2017.8.09.0006')).toBe(true);
  });

  it('1 dígito trocado no 1.º segmento (7 dígitos) casa com CNJ completo', () => {
    expect(termoDigitosCorrespondeCnjCampo('5482633', '5402633-78.2017.8.09.0006')).toBe(true);
  });

  it('1 dígito no prefixo de 9 dígitos (número+DV do segmento)', () => {
    expect(termoDigitosCorrespondeCnjCampo('540263378', '5402633-78.2017.8.09.0006')).toBe(true);
    expect(termoDigitosCorrespondeCnjCampo('9999999', '5402633-78.2017.8.09.0006')).toBe(false);
  });

  it('não casa quando o primeiro segmento difere em mais de um dígito', () => {
    expect(termoDigitosCorrespondeCnjCampo('0000000', '5402633-78.2017.8.09.0006')).toBe(false);
  });

  it('Projudi interno (email): exige prefixo exato — 5500622.97 ≠ 5505622-97 (Vânia)', () => {
    const vania = '5505622-97.2025.8.09.0006';
    expect(termoDigitosCorrespondeCnjCampo('550062297', vania)).toBe(true); // fuzzy legado (busca manual)
    expect(termoDigitosCorrespondeCnjCampo('550062297', vania, { projudiInternoExato: true })).toBe(false);
    expect(termoDigitosCorrespondeCnjCampo('550562297', vania, { projudiInternoExato: true })).toBe(true);
  });
});

describe('cnjEhTrt18', () => {
  it('reconhece segmento .5.18. do TRT18', () => {
    expect(cnjEhTrt18('0000105-21.2025.5.18.0051')).toBe(true);
  });

  it('rejeita CNJ TJGO', () => {
    expect(cnjEhTrt18('5402633-78.2017.8.09.0006')).toBe(false);
  });
});
