import { describe, expect, it } from 'vitest';
import {
  agruparLancamentosClassificacao,
  chaveGrupoClassificacao,
  coletarIdsClassificacaoVisivel,
  contagemPorLetraSugestao,
  filtrarClassificacaoPorLetra,
  filtrarClassificacaoPorConfianca,
  filtrarSugestoesClassificacao,
  LETRA_SUGESTAO_SEM,
  LETRA_SUGESTAO_TODAS,
  melhorSugestao,
} from './inboxClassificacaoGrupos.js';

describe('agruparLancamentosClassificacao', () => {
  const sugF = { contaContabilId: 6, contaCodigo: 'F', confianca: 'ALTA', origem: 'REGRA' };
  const sugE = { contaContabilId: 5, contaCodigo: 'E', confianca: 'ALTA', origem: 'REGRA' };

  it('agrupa lançamentos com mesma descrição, banco e sugestão', () => {
    const lancamentos = [
      { id: 1, descricao: 'Lucro', numeroBanco: 30, bancoNome: '99 Pay', dataLancamento: '2026-05-17' },
      { id: 2, descricao: 'lucro', numeroBanco: 30, bancoNome: '99 Pay', dataLancamento: '2026-05-16' },
      { id: 3, descricao: 'Lucro', numeroBanco: 30, bancoNome: '99 Pay', dataLancamento: '2026-05-15' },
    ];
    const sugestoes = { 1: [sugF], 2: [sugF], 3: [sugF] };
    const { grupos, individuais, semSugestao } = agruparLancamentosClassificacao(lancamentos, sugestoes);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].lancamentos).toHaveLength(3);
    expect(individuais).toHaveLength(0);
    expect(semSugestao).toHaveLength(0);
  });

  it('não agrupa descrições diferentes', () => {
    const lancamentos = [
      { id: 1, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-17' },
      { id: 2, descricao: 'Pagamento com Pix recebido', numeroBanco: 30, dataLancamento: '2026-05-16' },
    ];
    const sugestoes = { 1: [sugF], 2: [sugF] };
    const { grupos, individuais } = agruparLancamentosClassificacao(lancamentos, sugestoes);
    expect(grupos).toHaveLength(0);
    expect(individuais).toHaveLength(2);
  });

  it('não agrupa sugestões de conta diferentes', () => {
    const lancamentos = [
      { id: 1, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-17' },
      { id: 2, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-16' },
    ];
    const sugestoes = { 1: [sugF], 2: [sugE] };
    const { grupos, individuais } = agruparLancamentosClassificacao(lancamentos, sugestoes);
    expect(grupos).toHaveLength(0);
    expect(individuais).toHaveLength(2);
  });

  it('lançamentos sem sugestão ficam em semSugestao', () => {
    const lancamentos = [{ id: 1, descricao: 'X', numeroBanco: 1, dataLancamento: '2026-05-17' }];
    const { semSugestao, grupos } = agruparLancamentosClassificacao(lancamentos, {});
    expect(semSugestao).toHaveLength(1);
    expect(grupos).toHaveLength(0);
  });

  it('ignora sugestão em conta N (desconhecido)', () => {
    const lancamentos = [{ id: 1, descricao: 'PIX', numeroBanco: 1, dataLancamento: '2026-05-17' }];
    const { semSugestao, individuais, grupos } = agruparLancamentosClassificacao(lancamentos, {
      1: [{ contaContabilId: 5, contaCodigo: 'N', confianca: 'ALTA' }],
    });
    expect(semSugestao).toHaveLength(1);
    expect(individuais).toHaveLength(0);
    expect(grupos).toHaveLength(0);
  });
});

describe('filtrarSugestoesClassificacao', () => {
  it('remove conta N', () => {
    expect(
      filtrarSugestoesClassificacao([
        { contaContabilId: 1, contaCodigo: 'N' },
        { contaContabilId: 2, contaCodigo: 'A' },
      ]),
    ).toHaveLength(1);
  });
});

describe('melhorSugestao', () => {
  it('prefere confiança ALTA', () => {
    const s = melhorSugestao([
      { confianca: 'BAIXA', contaContabilId: 1 },
      { confianca: 'ALTA', contaContabilId: 2 },
    ]);
    expect(s.contaContabilId).toBe(2);
  });
});

describe('chaveGrupoClassificacao', () => {
  it('normaliza descrição', () => {
    const k1 = chaveGrupoClassificacao({ descricao: 'Lucro', numeroBanco: 30 }, { contaContabilId: 6 });
    const k2 = chaveGrupoClassificacao({ descricao: 'lucro', numeroBanco: 30 }, { contaContabilId: 6 });
    expect(k1).toBe(k2);
  });
});

describe('filtrarClassificacaoPorLetra', () => {
  const sugF = { contaContabilId: 6, contaCodigo: 'F', confianca: 'ALTA' };
  const sugE = { contaContabilId: 5, contaCodigo: 'E', confianca: 'ALTA' };
  const lancF1 = { id: 1, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-17' };
  const lancF2 = { id: 2, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-16' };
  const lancE = { id: 3, descricao: 'Pix', numeroBanco: 30, dataLancamento: '2026-05-15' };
  const lancSem = { id: 4, descricao: 'X', numeroBanco: 1, dataLancamento: '2026-05-14' };
  const sugestoes = { 1: [sugF], 2: [sugF], 3: [sugE] };

  it('retorna tudo quando filtro é TODAS', () => {
    const agrupada = agruparLancamentosClassificacao([lancF1, lancF2, lancE, lancSem], sugestoes);
    const out = filtrarClassificacaoPorLetra(agrupada, LETRA_SUGESTAO_TODAS, sugestoes);
    expect(out.grupos).toHaveLength(agrupada.grupos.length);
    expect(out.individuais).toHaveLength(agrupada.individuais.length);
    expect(out.semSugestao).toHaveLength(agrupada.semSugestao.length);
  });

  it('filtra apenas sugestão F', () => {
    const agrupada = agruparLancamentosClassificacao([lancF1, lancF2, lancE], sugestoes);
    const out = filtrarClassificacaoPorLetra(agrupada, 'F', sugestoes);
    expect(out.grupos).toHaveLength(1);
    expect(out.grupos[0].lancamentos).toHaveLength(2);
    expect(out.individuais).toHaveLength(0);
    expect(out.semSugestao).toHaveLength(0);
  });

  it('filtra apenas sem sugestão', () => {
    const agrupada = agruparLancamentosClassificacao([lancF1, lancSem], sugestoes);
    const out = filtrarClassificacaoPorLetra(agrupada, LETRA_SUGESTAO_SEM, sugestoes);
    expect(out.grupos).toHaveLength(0);
    expect(out.individuais).toHaveLength(0);
    expect(out.semSugestao).toHaveLength(1);
  });
});

describe('contagemPorLetraSugestao', () => {
  it('conta por letra e sem sugestão', () => {
    const lancamentos = [
      { id: 1, descricao: 'A' },
      { id: 2, descricao: 'B' },
      { id: 3, descricao: 'C' },
    ];
    const sugestoes = {
      1: [{ contaContabilId: 1, contaCodigo: 'F' }],
      2: [{ contaContabilId: 2, contaCodigo: 'F' }],
      3: [{ contaContabilId: 3, contaCodigo: 'E' }],
    };
    expect(contagemPorLetraSugestao(lancamentos, sugestoes)).toEqual({
      porLetra: { F: 2, E: 1 },
      sem: 0,
    });
  });
});

describe('coletarIdsClassificacaoVisivel', () => {
  it('reúne ids de grupos, individuais e sem sugestão', () => {
    const agrupada = {
      grupos: [{ lancamentos: [{ id: 1 }, { id: 2 }] }],
      individuais: [{ id: 3 }],
      semSugestao: [{ id: 4 }],
    };
    expect(coletarIdsClassificacaoVisivel(agrupada)).toEqual([1, 2, 3, 4]);
  });
});

describe('filtrarClassificacaoPorConfianca', () => {
  const sugAlta = { contaContabilId: 6, contaCodigo: 'F', confianca: 'ALTA' };
  const sugBaixa = { contaContabilId: 5, contaCodigo: 'E', confianca: 'BAIXA' };
  const lancAlta = { id: 1, descricao: 'Lucro', numeroBanco: 30, dataLancamento: '2026-05-17' };
  const lancBaixa = { id: 2, descricao: 'Pix', numeroBanco: 30, dataLancamento: '2026-05-16' };
  const sugestoes = { 1: [sugAlta], 2: [sugBaixa] };

  it('filtra pela confiança da melhor sugestão', () => {
    const agrupada = agruparLancamentosClassificacao([lancAlta, lancBaixa], sugestoes);
    const out = filtrarClassificacaoPorConfianca(agrupada, 'ALTA', sugestoes);
    expect(out.individuais).toHaveLength(1);
    expect(out.individuais[0].id).toBe(1);
    expect(out.grupos).toHaveLength(0);
  });
});
