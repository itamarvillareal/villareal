import { describe, expect, it } from 'vitest';
import { DATAJUD_CAMPO } from './datajudGlossario.js';
import {
  DATAJUD_LAB_TIPOS_PESQUISA,
  datajudLabCorpoDocumentoDigitos,
  datajudLabCorpoDslCampoValor,
  datajudLabCorpoExistsField,
  datajudLabCorpoIds,
  datajudLabCorpoMatchAll,
  datajudLabCorpoMatchAllComSortTimestampAsc,
  datajudLabCorpoMatchNumeroUnicoVinte,
  datajudLabCorpoNomeParte,
  datajudLabCorpoNumeroProcesso,
  datajudLabCorpoNivelSigilo,
  datajudLabCorpoQueryString,
  datajudLabCorpoRangeTimestamp,
  datajudLabCorpoTermKeywordNumeroProcesso,
} from './datajudBuscaBuilders.js';

describe('datajudBuscaBuilders', () => {
  it('datajudLabCorpoNumeroProcesso inclui bool should e size', () => {
    const b = datajudLabCorpoNumeroProcesso('0000000-00.2023.8.09.0001', { size: 5 });
    expect(b.size).toBe(5);
    expect(b.query.bool.minimum_should_match).toBe(1);
    expect(b.query.bool.should.some((x) => x.match?.[DATAJUD_CAMPO.numeroProcesso])).toBe(true);
  });

  it('datajudLabCorpoMatchNumeroUnicoVinte exige 20 dígitos', () => {
    expect(datajudLabCorpoMatchNumeroUnicoVinte('123')).toBeNull();
    const vinte = '0'.repeat(20);
    const b = datajudLabCorpoMatchNumeroUnicoVinte(vinte);
    expect(b.query.match[DATAJUD_CAMPO.numeroProcesso]).toBe(vinte);
  });

  it('datajudLabCorpoQueryString com fields', () => {
    const b = datajudLabCorpoQueryString('foo', ['a', 'b'], { size: 3 });
    expect(b.query.query_string.fields).toEqual(['a', 'b']);
    expect(b.size).toBe(3);
  });

  it('datajudLabCorpoNomeParte null se vazio', () => {
    expect(datajudLabCorpoNomeParte('  ')).toBeNull();
  });

  it('datajudLabCorpoDocumentoDigitos normaliza não-dígitos', () => {
    const b = datajudLabCorpoDocumentoDigitos('123.456.789-00');
    expect(b.query.bool.should.length).toBeGreaterThan(0);
  });

  it('datajudLabCorpoNivelSigilo vazio → null', () => {
    expect(datajudLabCorpoNivelSigilo('')).toBeNull();
    expect(datajudLabCorpoNivelSigilo('  ')).toBeNull();
  });

  it('datajudLabCorpoNivelSigilo numérico usa term', () => {
    const b = datajudLabCorpoNivelSigilo('0');
    expect(b.query.bool.should[0].term).toBeDefined();
  });

  it('datajudLabCorpoMatchAll', () => {
    const b = datajudLabCorpoMatchAll({ size: 2 });
    expect(b.query.match_all).toEqual({});
    expect(b.size).toBe(2);
  });

  it('datajudLabCorpoTermKeywordNumeroProcesso', () => {
    const b = datajudLabCorpoTermKeywordNumeroProcesso('0000000-00.2023.8.09.0001');
    expect(b.query.term).toBeDefined();
  });

  it('datajudLabCorpoDslCampoValor — term numérico', () => {
    const b = datajudLabCorpoDslCampoValor('term', 'classe.codigo', '7');
    expect(b.query.term['classe.codigo']).toBe(7);
  });

  it('datajudLabCorpoRangeTimestamp', () => {
    const b = datajudLabCorpoRangeTimestamp('2024-01-01', null);
    expect(b.query.range['@timestamp'].gte).toBe('2024-01-01');
  });

  it('datajudLabCorpoExistsField', () => {
    expect(datajudLabCorpoExistsField('movimentos')).toEqual(
      expect.objectContaining({ query: { exists: { field: 'movimentos' } } }),
    );
  });

  it('datajudLabCorpoIds', () => {
    const b = datajudLabCorpoIds('a1, b2');
    expect(b.query.ids.values).toEqual(['a1', 'b2']);
  });

  it('datajudLabCorpoMatchAllComSortTimestampAsc', () => {
    const b = datajudLabCorpoMatchAllComSortTimestampAsc({ size: 1 });
    expect(b.sort[0]['@timestamp'].order).toBe('asc');
  });

  it('DATAJUD_LAB_TIPOS_PESQUISA cobre modos do laboratório', () => {
    expect(DATAJUD_LAB_TIPOS_PESQUISA).toContain('query_string');
    expect(DATAJUD_LAB_TIPOS_PESQUISA).toContain('match_all_sort_timestamp');
    expect(DATAJUD_LAB_TIPOS_PESQUISA).toContain('dsl_campo_valor');
    expect(DATAJUD_LAB_TIPOS_PESQUISA.length).toBe(28);
  });
});
