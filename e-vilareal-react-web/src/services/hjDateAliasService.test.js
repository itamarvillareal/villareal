import { describe, it, expect } from 'vitest';
import {
  calcularPosicaoCursorDataBr,
  formatarDataBrInput,
  formatarDataBrInputComBarras,
  dataNascimentoParaExibicaoBr,
  mascararDigitosDataBr,
} from '../services/hjDateAliasService.js';

describe('hjDateAliasService — máscara dd/mm/aaaa', () => {
  it('mascararDigitosDataBr insere barras progressivamente', () => {
    expect(mascararDigitosDataBr('2')).toBe('2');
    expect(mascararDigitosDataBr('29')).toBe('29');
    expect(mascararDigitosDataBr('290')).toBe('29/0');
    expect(mascararDigitosDataBr('2906')).toBe('29/06');
    expect(mascararDigitosDataBr('29062026')).toBe('29/06/2026');
  });

  it('formatarDataBrInput aceita colar ddmmyyyy', () => {
    expect(formatarDataBrInput('29062026')).toBe('29/06/2026');
  });

  it('formatarDataBrInputComBarras preserva segmentos ao editar dia parcialmente', () => {
    expect(formatarDataBrInputComBarras('3/06/2026')).toBe('3/06/2026');
    expect(formatarDataBrInputComBarras('30/06/2026')).toBe('30/06/2026');
    expect(formatarDataBrInput('3/06/2026')).toBe('3/06/2026');
    expect(formatarDataBrInput('30/06/2026')).toBe('30/06/2026');
  });

  it('não deforma ao substituir dia 29 por 30 em data completa', () => {
    expect(formatarDataBrInput('3/06/2026')).not.toBe('30/62/0260');
    expect(formatarDataBrInput('30/06/2026')).toBe('30/06/2026');
  });

  it('calcularPosicaoCursorDataBr mantém cursor no segmento do dia', () => {
    expect(calcularPosicaoCursorDataBr('3/06/2026', '3/06/2026', 1)).toBe(1);
    expect(calcularPosicaoCursorDataBr('30/06/2026', '30/06/2026', 2)).toBe(2);
  });

  it('dataNascimentoParaExibicaoBr formata valor compacto ao carregar', () => {
    expect(dataNascimentoParaExibicaoBr('29062026')).toBe('29/06/2026');
    expect(dataNascimentoParaExibicaoBr('2026-06-29')).toBe('29/06/2026');
  });
});
