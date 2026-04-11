import { describe, expect, it } from 'vitest';
import {
  DATAJUD_BOLETIM_2025_12_EXEMPLOS,
  DATAJUD_URL_PARAMETRIZACAO,
  datajudBoletimLegendaMovimento,
} from './datajudParametrizacaoCnj.js';

describe('datajudParametrizacaoCnj', () => {
  it('URL oficial parametrização CNJ', () => {
    expect(DATAJUD_URL_PARAMETRIZACAO).toContain('cnj.jus.br');
    expect(DATAJUD_URL_PARAMETRIZACAO).toContain('parametrizacao');
  });

  it('exemplos boletim dez/2025', () => {
    expect(DATAJUD_BOLETIM_2025_12_EXEMPLOS.situacaoDistribuido).toBe(24);
    expect(DATAJUD_BOLETIM_2025_12_EXEMPLOS.movimentoDistribuicao).toBe(26);
    expect(DATAJUD_BOLETIM_2025_12_EXEMPLOS.movimentoRecebimento1).toBe(132);
  });

  it('datajudBoletimLegendaMovimento', () => {
    expect(datajudBoletimLegendaMovimento(26)).toContain('Distribuído');
    expect(datajudBoletimLegendaMovimento(132)).toContain('Recebido');
    expect(datajudBoletimLegendaMovimento(981)).toContain('Recebido');
    expect(datajudBoletimLegendaMovimento(999)).toBeNull();
    expect(datajudBoletimLegendaMovimento('26')).toContain('Distribuído');
  });
});
