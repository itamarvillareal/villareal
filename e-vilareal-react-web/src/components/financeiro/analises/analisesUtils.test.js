import { describe, expect, it } from 'vitest';
import {
  completarExato,
  contagemEscopoModo,
  filtrarLancamentosDivergentes,
  idsBotoesCard,
  novosExato,
  padraoAcionavel,
  padraoConfiancaPerfeita,
  padraoElegivelAprovarTodos,
  padraoElegivelLoteSelecionado,
  pctClassificado,
  pctConsistenciaConta,
  resolverAcaoCard,
  resolverAcaoLoteRecorrencia,
  resolverAcoesExtrasLoteRecorrencia,
  rotuloAlvoPadrao,
  rotuloBotaoPrincipal,
  rotuloDescricaoComData,
  limparVinculoSugeridoPadrao,
  somaAcionaveis,
  somaCandidatosExato,
  textoEscopoLancamentos,
  valorDivergeDoModal,
  valorFixoPadrao,
} from './analisesUtils.js';

describe('pctClassificado', () => {
  it('calcula percentual arredondado', () => {
    expect(pctClassificado(100, 25)).toBe(75);
    expect(pctClassificado(0, 0)).toBe(0);
  });
});

describe('somaAcionaveis', () => {
  it('usa qtdAcionaveis do backend quando presente', () => {
    expect(somaAcionaveis({ qtdAcionaveis: 5, qtdPendentesExato: 1 }, 'EXATO')).toBe(5);
  });

  it('soma exato, exato+aprox ou só nome conforme precisaoValor', () => {
    const p = {
      qtdPendentesExato: 2,
      qtdCompletarExato: 1,
      qtdPendentesAprox: 3,
      qtdCompletarAprox: 0,
      qtdDivergentes: 4,
    };
    expect(somaAcionaveis(p, 'EXATO')).toBe(3);
    expect(somaAcionaveis(p, 'TODOS')).toBe(6);
    expect(somaAcionaveis(p, 'IGNORAR_VALOR')).toBe(10);
  });
});

describe('valorFixoPadrao', () => {
  it('detecta valorFixo estrito', () => {
    expect(valorFixoPadrao({ valorFixo: true })).toBe(true);
    expect(valorFixoPadrao({ valorFixo: false })).toBe(false);
  });
});

describe('somaCandidatosExato', () => {
  it('soma pendentes e completar exatos', () => {
    expect(somaCandidatosExato({ qtdPendentesExato: 2, qtdCompletarExato: 3 })).toBe(5);
  });
});

describe('completarExato', () => {
  it('usa qtdParaCompletar como fallback legado', () => {
    expect(completarExato({ qtdCompletarExato: 0, qtdParaCompletar: 2 })).toBe(2);
  });
});

describe('padraoAcionavel', () => {
  it('exige ao menos um candidato no filtro atual', () => {
    expect(padraoAcionavel({ qtdAcionaveis: 0 }, 'EXATO')).toBe(false);
    expect(padraoAcionavel({ qtdAcionaveis: 2 }, 'EXATO')).toBe(true);
    expect(
      padraoAcionavel({ qtdPendentesExato: 0, qtdCompletarExato: 0, qtdPendentesAprox: 1 }, 'TODOS'),
    ).toBe(true);
  });
});

describe('contagemEscopoModo e textoEscopoLancamentos', () => {
  const padrao = {
    qtdPendentesExato: 1,
    qtdCompletarExato: 1,
    qtdPendentesAprox: 0,
    qtdCompletarAprox: 0,
    qtdDivergentes: 0,
  };

  it('agrega novos e completar no modo exato', () => {
    expect(contagemEscopoModo(padrao, 'EXATO')).toEqual({
      novos: 1,
      completar: 1,
      divergentes: 0,
      total: 2,
    });
    expect(textoEscopoLancamentos(padrao, 'EXATO')).toBe('2 lançamentos (1 novo · 1 a completar)');
  });

  it('muda total ao trocar para + aproximados', () => {
    const p = {
      qtdPendentesExato: 1,
      qtdCompletarExato: 0,
      qtdPendentesAprox: 2,
      qtdCompletarAprox: 1,
      qtdDivergentes: 0,
    };
    expect(somaAcionaveis(p, 'TODOS')).toBe(4);
    expect(textoEscopoLancamentos(p, 'TODOS')).toBe('4 lançamentos (3 novos · 1 a completar)');
  });

  it('inclui divergentes no modo só nome', () => {
    const p = {
      qtdPendentes: 2,
      qtdParaCompletar: 1,
      qtdDivergentes: 1,
      qtdAcionaveis: 3,
    };
    expect(textoEscopoLancamentos(p, 'IGNORAR_VALOR')).toBe('3 lançamentos (2 novos · 1 a completar · 1 divergente)');
  });
});

describe('rotuloAlvoPadrao e rotuloBotaoPrincipal', () => {
  const padrao = {
    contaCodigo: 'A',
    clienteNome: 'SE77E TELECOM EIRELI ME',
    processoNumero: '5315842-43.2022.8.09.0007',
    confianca: 'ALTA',
    qtdAcionaveis: 2,
    qtdPendentesExato: 1,
    qtdCompletarExato: 1,
  };

  it('formata alvo unificado', () => {
    expect(rotuloAlvoPadrao(padrao)).toBe(
      '→ A · SE77E TELECOM EIRELI ME · proc 5315842-43.2022.8.09.0007',
    );
  });

  it('usa Aplicar no modo exato e Confirmar no só nome', () => {
    expect(rotuloBotaoPrincipal(padrao, 'EXATO')).toBe('Aplicar (2)');
    expect(rotuloBotaoPrincipal(padrao, 'IGNORAR_VALOR')).toBe('Confirmar (2)');
  });
});

describe('idsBotoesCard', () => {
  it('expõe só botão principal + descartar', () => {
    expect(idsBotoesCard('EXATO')).toEqual(['aplicar', 'descartar']);
    expect(idsBotoesCard('IGNORAR_VALOR')).toEqual(['confirmar', 'descartar']);
  });
});

describe('resolverAcaoCard', () => {
  it('sempre usa escopo TODOS alinhado ao modo global', () => {
    expect(resolverAcaoCard('EXATO')).toEqual({ escopo: 'TODOS', precisaoValor: 'EXATO' });
    expect(resolverAcaoCard('TODOS')).toEqual({ escopo: 'TODOS', precisaoValor: 'TODOS' });
    expect(resolverAcaoCard('IGNORAR_VALOR')).toEqual({
      escopo: 'TODOS',
      precisaoValor: 'IGNORAR_VALOR',
    });
  });

  it('lote usa a mesma ação unificada', () => {
    expect(resolverAcaoLoteRecorrencia({}, 'TODOS')).toEqual({
      escopo: 'TODOS',
      precisaoValor: 'TODOS',
    });
    expect(resolverAcoesExtrasLoteRecorrencia()).toEqual([]);
  });
});

describe('padraoElegivelAprovarTodos e padraoElegivelLoteSelecionado', () => {
  const padrao = { confianca: 'ALTA', qtdAcionaveis: 2 };

  it('exclui modo só nome do aprovar todos automático', () => {
    expect(padraoElegivelAprovarTodos(padrao, 'IGNORAR_VALOR')).toBe(false);
    expect(padraoElegivelAprovarTodos(padrao, 'EXATO')).toBe(true);
  });

  it('permite lote manual no modo só nome', () => {
    expect(padraoElegivelLoteSelecionado(padrao, 'IGNORAR_VALOR')).toBe(true);
    expect(padraoElegivelLoteSelecionado({ confianca: 'MEDIA', qtdAcionaveis: 1 }, 'EXATO')).toBe(
      false,
    );
    expect(padraoElegivelLoteSelecionado(padrao, 'EXATO')).toBe(true);
  });
});

describe('valorDivergeDoModal', () => {
  it('detecta valor fora do modal e tolerância', () => {
    expect(valorDivergeDoModal(100, 100)).toBe(false);
    expect(valorDivergeDoModal(103, 100)).toBe(false);
    expect(valorDivergeDoModal(50, 100)).toBe(true);
  });

  it('filtra preview divergente', () => {
    const itens = filtrarLancamentosDivergentes(
      [
        { valor: 98.28, descricao: 'OK' },
        { valor: 50, descricao: 'Diverge' },
      ],
      98.28,
    );
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe('Diverge');
  });
});

describe('padraoConfiancaPerfeita', () => {
  it('exige confiança alta e consistência total', () => {
    expect(
      padraoConfiancaPerfeita({
        confianca: 'ALTA',
        consistenciaConta: 1,
        consistenciaVinculo: 1,
      }),
    ).toBe(true);
    expect(
      padraoConfiancaPerfeita({
        confianca: 'MEDIA',
        consistenciaConta: 1,
      }),
    ).toBe(false);
    expect(
      padraoConfiancaPerfeita({
        confianca: 'ALTA',
        consistenciaConta: 0.94,
      }),
    ).toBe(false);
  });

  it('calcula percentual de consistência arredondado', () => {
    expect(pctConsistenciaConta({ consistenciaConta: 1 })).toBe(100);
    expect(pctConsistenciaConta({ consistenciaConta: 0.9996 })).toBe(100);
  });
});

describe('rotuloDescricaoComData', () => {
  it('inclui ano completo ao lado da descrição', () => {
    expect(
      rotuloDescricaoComData(
        { descricaoExemplo: 'PIX TRANSF AVELAR 21/12', dataExemplo: '2025-12-21' },
        (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`,
      ),
    ).toBe('PIX TRANSF AVELAR 21/12 · 21/12/2025');
  });
});

describe('limparVinculoSugeridoPadrao', () => {
  it('remove campos de vínculo mantendo o restante', () => {
    const out = limparVinculoSugeridoPadrao({
      descricaoNorm: 'X',
      clienteId: 1,
      clienteNome: 'A',
      processoId: 2,
      processoNumero: '123',
      parteCliente: 'B',
      parteOposta: 'C',
      consistenciaVinculo: 0.9,
    });
    expect(out).toMatchObject({
      descricaoNorm: 'X',
      clienteId: null,
      clienteNome: null,
      processoId: null,
      processoNumero: null,
      parteCliente: null,
      parteOposta: null,
      consistenciaVinculo: null,
    });
  });
});

describe('formatDataBrCompleta', () => {
  it('sempre inclui ano em ISO', async () => {
    const { formatDataBrCompleta } = await import('../shared/financeiroFormat.js');
    expect(formatDataBrCompleta('2025-12-21')).toBe('21/12/2025');
    expect(formatDataBrCompleta('21/12/2025')).toBe('21/12/2025');
  });
});
