import { describe, expect, it } from 'vitest';

import {
  extrairYmdParaPastasAno,
  parseDataDdMmYyyy,
  parseDataHistoricoLocalMmDdYyyy,
  ymdComLinhaEPastaAno,
} from '../../scripts/lib/historico-local-txt-paths.mjs';
import { parseDataCabecalhoProcessoIso } from '../../scripts/lib/datas-legado-vb.mjs';
import { movimentoEmFromHistoricoLocal } from '../../scripts/lib/historico-movimento-em.mjs';

describe('parseDataHistoricoLocalMmDdYyyy (tipo 16 VB)', () => {
  it('cliente 938 proc 4 — datas dos txt em mm/dd/aaaa', () => {
    expect(parseDataHistoricoLocalMmDdYyyy('01/13/2025')).toMatchObject({ mo: 1, dd: 13, yyyy: 2025 });
    expect(parseDataHistoricoLocalMmDdYyyy('02/24/2025')).toMatchObject({ mo: 2, dd: 24, yyyy: 2025 });
    expect(parseDataHistoricoLocalMmDdYyyy('03/07/2025')).toMatchObject({ mo: 3, dd: 7, yyyy: 2025 });
    expect(parseDataHistoricoLocalMmDdYyyy('03/05/2026')).toMatchObject({ mo: 3, dd: 5, yyyy: 2026 });
  });

  it('cabecalho 3.1 continua dd/mm/aaaa brasileiro', () => {
    expect(parseDataDdMmYyyy('17/08/2017')).toMatchObject({ dd: 17, mo: 8, yyyy: 2017 });
    expect(parseDataCabecalhoProcessoIso('17/08/2017')).toBe('2017-08-17');
  });
});

describe('ymdComLinhaEPastaAno', () => {
  it('usa mês da pasta com mm/dd na linha', () => {
    expect(ymdComLinhaEPastaAno('03/07/2025', 2025, 3)).toBe('2025-03-07');
    expect(ymdComLinhaEPastaAno('03/05/2026', 2026, 3)).toBe('2026-03-05');
  });
});

describe('movimentoEmFromHistoricoLocal', () => {
  it('938/4 — 03/07/2025 no txt → 07/03/2025 no sistema', () => {
    expect(movimentoEmFromHistoricoLocal('03/07/2025', null, null)).toBe('2025-03-07T12:00:00.000Z');
  });
});

describe('extrairYmdParaPastasAno', () => {
  it('localiza pasta Ano a partir de mm/dd', () => {
    expect(extrairYmdParaPastasAno('03/05/2026')).toMatchObject({ yyyy: 2026, mo: 3, dd: 5 });
  });
});
