import { describe, it, expect } from 'vitest';
import {
  formatarDataBrInput,
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

  it('dataNascimentoParaExibicaoBr formata valor compacto ao carregar', () => {
    expect(dataNascimentoParaExibicaoBr('29062026')).toBe('29/06/2026');
    expect(dataNascimentoParaExibicaoBr('2026-06-29')).toBe('29/06/2026');
  });
});
