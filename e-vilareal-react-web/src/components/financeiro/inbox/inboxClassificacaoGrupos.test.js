import { describe, expect, it } from 'vitest';
import {
  agruparLancamentosClassificacao,
  chaveGrupoClassificacao,
  filtrarSugestoesClassificacao,
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
