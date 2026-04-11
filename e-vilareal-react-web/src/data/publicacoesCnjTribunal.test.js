import { describe, expect, it } from 'vitest';
import { cnjParaNumeroUnicoVinteDigitos, parseSegmentosCnj } from './publicacoesCnjTribunal.js';

describe('cnjParaNumeroUnicoVinteDigitos (DataJud)', () => {
  it('converte CNJ TJGO para 20 dígitos contínuos', () => {
    const cnj = '5404096-92.2022.8.09.0006';
    expect(parseSegmentosCnj(cnj)).toMatchObject({
      sequencial: '5404096',
      dv: '92',
      ano: '2022',
      segmentoJ: '8',
      tribunalTR: '09',
      origem: '0006',
    });
    expect(cnjParaNumeroUnicoVinteDigitos(cnj)).toBe('54040969220228090006');
    expect(cnjParaNumeroUnicoVinteDigitos(cnj).length).toBe(20);
  });
});
