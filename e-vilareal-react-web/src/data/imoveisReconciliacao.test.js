import { describe, it, expect } from 'vitest';
import {
  PAPEIS_RECONCILIACAO,
  rotuloPapelReconciliacao,
  confiancaInfo,
  statusRepasseInfo,
  repasseEsperado,
  linhasReconciliacaoFromSugestoes,
  montarPayloadVinculos,
  competenciaAtual,
  competenciaValida,
  ehLinhaAdocao,
  agruparLinhasReconciliacao,
  descricaoAdocao,
} from './imoveisReconciliacao.js';

describe('imoveisReconciliacao', () => {
  it('expõe os três papéis na ordem aluguel/repasse/despesa', () => {
    expect(PAPEIS_RECONCILIACAO).toEqual(['ALUGUEL', 'REPASSE', 'DESPESA']);
  });

  it('rotula papéis e trata desconhecido', () => {
    expect(rotuloPapelReconciliacao('ALUGUEL')).toBe('Aluguel');
    expect(rotuloPapelReconciliacao('REPASSE')).toBe('Repasse');
    expect(rotuloPapelReconciliacao('DESPESA')).toBe('Despesa');
    expect(rotuloPapelReconciliacao('xpto')).toBe('—');
  });

  it('mapeia confiança (case-insensitive)', () => {
    expect(confiancaInfo('alta').label).toBe('Alta');
    expect(confiancaInfo('MEDIA').label).toBe('Média');
    expect(confiancaInfo('Baixa').label).toBe('Baixa');
    expect(confiancaInfo(null).label).toBe('—');
  });

  it('status do repasse: FEITO verde, PENDENTE cinza, DIVERGENTE âmbar', () => {
    expect(statusRepasseInfo('FEITO').tone).toBe('verde');
    expect(statusRepasseInfo('PENDENTE').tone).toBe('cinza');
    expect(statusRepasseInfo('DIVERGENTE').tone).toBe('ambar');
    // default cai em pendente/cinza
    expect(statusRepasseInfo(undefined).tone).toBe('cinza');
  });

  it('repasseEsperado = recebido − taxa nominal − despesas', () => {
    const r = repasseEsperado({ aluguelRecebido: 1000, despesas: 50, taxaEsperadaPercent: 10 });
    expect(r).toBe(850); // 1000 - 100 - 50
    expect(repasseEsperado(null)).toBeNull();
  });

  it('linhasReconciliacaoFromSugestoes normaliza os campos', () => {
    const linhas = linhasReconciliacaoFromSugestoes([
      {
        lancamentoFinanceiroId: 10,
        data: '2026-03-10',
        descricao: 'ALUGUEL',
        valor: '1000.00',
        natureza: 'CREDITO',
        papelSugerido: 'ALUGUEL',
        confianca: 'ALTA',
        competenciaSugerida: '2026-03',
        jaVinculado: true,
        papelVinculado: 'ALUGUEL',
        vinculoId: 77,
      },
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      lancamentoFinanceiroId: 10,
      valor: 1000,
      jaVinculado: true,
      papelVinculado: 'ALUGUEL',
      vinculoId: 77,
    });
  });

  it('montarPayloadVinculos descarta itens sem papel e normaliza', () => {
    const payload = montarPayloadVinculos([
      { lancamentoFinanceiroId: '5', papel: 'aluguel', competenciaMes: '2026-03' },
      { lancamentoFinanceiroId: 6, papel: null, competenciaMes: '2026-03' },
      { lancamentoFinanceiroId: null, papel: 'REPASSE' },
    ]);
    expect(payload).toEqual([{ lancamentoFinanceiroId: 5, papel: 'ALUGUEL', competenciaMes: '2026-03' }]);
  });

  it('competenciaAtual formata AAAA-MM e competenciaValida valida', () => {
    expect(competenciaAtual(new Date('2026-03-15T12:00:00'))).toBe('2026-03');
    expect(competenciaValida('2026-03')).toBe(true);
    expect(competenciaValida('2026-13')).toBe(false);
    expect(competenciaValida('2026/03')).toBe(false);
  });

  it('linhasReconciliacaoFromSugestoes carrega origem/adoção dos órfãos', () => {
    const [linha] = linhasReconciliacaoFromSugestoes([
      {
        lancamentoFinanceiroId: 50,
        valor: '1700.00',
        papelSugerido: 'ALUGUEL',
        origem: 'ORFAO',
        classificaAoConfirmar: true,
        codigoClienteAlvo: '00000938',
        processoIdAlvo: 16042,
      },
    ]);
    expect(linha.origem).toBe('ORFAO');
    expect(linha.classificaAoConfirmar).toBe(true);
    expect(linha.codigoClienteAlvo).toBe('00000938');
    expect(linha.processoIdAlvo).toBe(16042);
  });

  it('ehLinhaAdocao e agruparLinhasReconciliacao separam os dois grupos', () => {
    const linhas = linhasReconciliacaoFromSugestoes([
      { lancamentoFinanceiroId: 1, papelSugerido: 'ALUGUEL', origem: 'PROCESSO' },
      { lancamentoFinanceiroId: 50, papelSugerido: 'ALUGUEL', origem: 'ORFAO', classificaAoConfirmar: true },
    ]);
    expect(ehLinhaAdocao(linhas[0])).toBe(false);
    expect(ehLinhaAdocao(linhas[1])).toBe(true);
    const { doImovel, aAdotar } = agruparLinhasReconciliacao(linhas);
    expect(doImovel.map((l) => l.lancamentoFinanceiroId)).toEqual([1]);
    expect(aAdotar.map((l) => l.lancamentoFinanceiroId)).toEqual([50]);
  });

  it('descricaoAdocao mostra o alvo A · cliente · proc · papel', () => {
    const linha = { codigoClienteAlvo: '00000938', processoIdAlvo: 16042, papelSugerido: 'ALUGUEL' };
    expect(descricaoAdocao(linha)).toBe('ao confirmar, classifica em A · cliente 00000938 · proc 16042 como Aluguel');
    expect(descricaoAdocao(null)).toBe('');
  });
});
