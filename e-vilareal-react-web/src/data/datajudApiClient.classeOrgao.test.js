import { describe, expect, it } from 'vitest';
import { datajudCorpoComPaginacaoTimestamp, datajudCorpoPesquisaClasseEOrgaoJulgador } from './datajudApiClient.js';

describe('DataJud Ex. 2 — classe + órgão julgador', () => {
  it('corpo mínimo igual ao exemplo wiki (TJDFT 1116 / 13597)', () => {
    const body = datajudCorpoPesquisaClasseEOrgaoJulgador(1116, 13597);
    expect(body).toEqual({
      query: {
        bool: {
          must: [
            { match: { 'classe.codigo': 1116 } },
            { match: { 'orgaoJulgador.codigo': 13597 } },
          ],
        },
      },
    });
  });

  it('aceita código de órgão como string (comum em _source TJGO)', () => {
    const body = datajudCorpoPesquisaClasseEOrgaoJulgador(7, '11400', { size: 5 });
    expect(body.size).toBe(5);
    expect(body.query.bool.must[1]).toEqual({ match: { 'orgaoJulgador.codigo': '11400' } });
  });

  it('opcionais size e track_total_hits', () => {
    const body = datajudCorpoPesquisaClasseEOrgaoJulgador(1116, 13597, {
      size: 100,
      trackTotalHits: true,
    });
    expect(body.size).toBe(100);
    expect(body.track_total_hits).toBe(true);
  });

  it('componível com paginação Ex. 3', () => {
    const base = datajudCorpoPesquisaClasseEOrgaoJulgador(1116, 13597, { size: 100 });
    const paginated = datajudCorpoComPaginacaoTimestamp(base, [1681366085550]);
    expect(paginated.search_after).toEqual([1681366085550]);
    expect(paginated.query.bool.must).toHaveLength(2);
  });
});
