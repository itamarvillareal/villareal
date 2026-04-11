import { describe, expect, it } from 'vitest';
import {
  DATAJUD_SORT_TIMESTAMP_ASC,
  datajudCorpoComPaginacaoTimestamp,
  extrairSortUltimoHitParaSearchAfter,
} from './datajudApiClient.js';

describe('DataJud Ex. 3 — paginação (search_after)', () => {
  it('DATAJUD_SORT_TIMESTAMP_ASC segue o padrão wiki (@timestamp asc)', () => {
    expect(DATAJUD_SORT_TIMESTAMP_ASC).toEqual([{ '@timestamp': { order: 'asc' } }]);
  });

  it('datajudCorpoComPaginacaoTimestamp — primeira página só com sort', () => {
    const base = { size: 100, query: { match_all: {} } };
    const body = datajudCorpoComPaginacaoTimestamp(base);
    expect(body.sort).toEqual(DATAJUD_SORT_TIMESTAMP_ASC);
    expect(body.search_after).toBeUndefined();
    expect(body.size).toBe(100);
    expect(body.query).toEqual({ match_all: {} });
  });

  it('datajudCorpoComPaginacaoTimestamp — páginas seguintes com search_after', () => {
    const base = { size: 100, query: { bool: { must: [] } } };
    const cursor = [1681366085550];
    const body = datajudCorpoComPaginacaoTimestamp(base, cursor);
    expect(body.sort).toEqual(DATAJUD_SORT_TIMESTAMP_ASC);
    expect(body.search_after).toEqual(cursor);
  });

  it('extrairSortUltimoHitParaSearchAfter lê o último hit', () => {
    const json = {
      hits: {
        hits: [
          { _id: 'a', sort: [1] },
          { _id: 'b', sort: [1681366085550] },
        ],
      },
    };
    expect(extrairSortUltimoHitParaSearchAfter(json)).toEqual([1681366085550]);
  });

  it('extrairSortUltimoHitParaSearchAfter devolve null sem hits ou sem sort', () => {
    expect(extrairSortUltimoHitParaSearchAfter({ hits: { hits: [] } })).toBeNull();
    expect(extrairSortUltimoHitParaSearchAfter({ hits: { hits: [{ _id: 'x' }] } })).toBeNull();
  });
});
