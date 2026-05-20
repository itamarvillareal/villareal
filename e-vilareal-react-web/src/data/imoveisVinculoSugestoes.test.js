import { describe, expect, it } from 'vitest';
import {
  classificarCoincidenciaNomeExtratoVinculo,
  construirPerfilHistoricoImovel,
  gerarSugestoesVinculoImoveis,
  lancamentoApiCreditoBanco,
  lancamentoApiDebitoBanco,
  lancamentoApiExtratoBanco,
  lancamentoApiSemVinculoProcesso,
  pontuarSugestaoVinculoImovel,
} from './imoveisVinculoSugestoes.js';

describe('imoveisVinculoSugestoes', () => {
  const imovel793_20 = {
    imovelId: 3,
    imovelOcupado: true,
    codigo: '793',
    proc: '20',
    _apiProcessoId: 7248,
    _apiClienteId: 1985,
    unidade: 'Unidade 606 A',
    inquilino: 'RENATO MIKHAIL MARTINS ATIE AJI',
    valorLocacao: '2.100,00',
    diaPagAluguel: '30',
  };

  it('detecta crédito e débito bancário sem proc', () => {
    expect(
      lancamentoApiCreditoBanco({ natureza: 'CREDITO', valor: 2100, bancoNome: 'CORA' }),
    ).toBe(true);
    expect(
      lancamentoApiDebitoBanco({ natureza: 'DEBITO', valor: -1800, bancoNome: 'CORA' }),
    ).toBe(true);
    expect(
      lancamentoApiExtratoBanco({ natureza: 'DEBITO', valor: -1800, bancoNome: 'CORA' }),
    ).toBe(true);
    expect(lancamentoApiSemVinculoProcesso({ processoId: null, numeroInternoProcesso: null })).toBe(true);
  });

  it('pontua alto pagamento Renato 2100 próximo ao aluguel', () => {
    const lanc = {
      id: 99,
      dataLancamento: '2026-05-01',
      natureza: 'CREDITO',
      valor: 2100,
      bancoNome: 'CORA',
      descricao: 'PIX RENATO MIKHAIL',
      descricaoDetalhada: 'Depósito locatário',
    };
    const hist = construirPerfilHistoricoImovel([]);
    const p = pontuarSugestaoVinculoImovel(lanc, imovel793_20, hist, { inquilinoUnico: true });
    expect(p.score).toBeGreaterThanOrEqual(70);
    expect(p.confianca).toBe('alta');
    expect(p.motivos.some((m) => m.includes('Valor'))).toBe(true);
  });

  it('gera sugestão para candidato compatível', () => {
    const candidatos = [
      {
        id: 1001,
        dataLancamento: '2026-05-01',
        natureza: 'CREDITO',
        valor: 2100,
        bancoNome: 'CORA',
        descricao: 'PIX RENATO MIKHAIL MARTINS',
        descricaoDetalhada: '',
        processoId: null,
        numeroInternoProcesso: null,
      },
    ];
    const historicos = new Map([['793|20', construirPerfilHistoricoImovel([])]]);
    const sugestoes = gerarSugestoesVinculoImoveis(candidatos, [imovel793_20], historicos, {
      scoreMinimo: 48,
    });
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].codigoCliente).toBe('793');
    expect(sugestoes[0].proc).toBe('20');
    expect(sugestoes[0].imovelId).toBe(3);
    expect(sugestoes[0].processoIdApi).toBe(7248);
    expect(sugestoes[0].clienteIdApi).toBe(1985);
  });

  it('modo geral gera várias sugestões para o mesmo lançamento', () => {
    const renato = {
      imovelId: 3,
      imovelOcupado: true,
      codigo: '793',
      proc: '20',
      inquilino: 'RENATO MIKHAIL',
      valorLocacao: '2.100,00',
      diaPagAluguel: '30',
    };
    const queren = {
      imovelId: 44,
      imovelOcupado: true,
      codigo: '100',
      proc: '8',
      inquilino: 'QUEREN DA SILVA',
      valorLocacao: '2.100,00',
      diaPagAluguel: '05',
    };
    const candidatos = [
      {
        id: 3000,
        dataLancamento: '2026-04-10',
        natureza: 'CREDITO',
        valor: 2100,
        bancoNome: 'CORA',
        descricao: 'PIX QUEREN DA SILVA',
        processoId: null,
        numeroInternoProcesso: null,
      },
    ];
    const historicos = new Map([
      ['793|20', construirPerfilHistoricoImovel([])],
      ['100|8', construirPerfilHistoricoImovel([])],
    ]);
    const sugestoes = gerarSugestoesVinculoImoveis(candidatos, [renato, queren], historicos, {
      estrategia: 'todosParesQualificados',
      scoreMinimo: 38,
      limite: 20,
    });
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].imovelId).toBe(44);
    expect(sugestoes[0].locatario).toContain('QUEREN');
  });

  it('modo geral: PIX Maria da Consolação não sugere Judiel nem Maria José', () => {
    const mariaConsolacao = {
      imovelId: 10,
      imovelOcupado: true,
      codigo: '500',
      proc: '11',
      inquilino: 'MARIA DA CONSOLACAO BARBOSA',
      valorLocacao: '1.780,00',
      diaPagAluguel: '09',
    };
    const judiel = {
      imovelId: 29,
      imovelOcupado: true,
      codigo: '938',
      proc: '22',
      inquilino: 'JUDIEL BATISTA FARIA',
      valorLocacao: '1.780,00',
      diaPagAluguel: '09',
    };
    const mariaJose = {
      imovelId: 27,
      imovelOcupado: true,
      codigo: '655',
      proc: '9',
      inquilino: 'MARIA JOSE TEODORO',
      valorLocacao: '1.780,00',
      diaPagAluguel: '09',
    };
    const lanc = {
      id: 68972,
      dataLancamento: '2026-03-09',
      natureza: 'CREDITO',
      valor: 1780,
      bancoNome: 'CORA',
      descricao: 'Pagamento recebido - Maria Da Consolação Barbosa - 319.171.351-49',
      processoId: null,
      numeroInternoProcesso: null,
    };
    const historicos = new Map([
      ['500|11', construirPerfilHistoricoImovel([])],
      ['938|22', construirPerfilHistoricoImovel([])],
      ['655|9', construirPerfilHistoricoImovel([])],
    ]);
    const sugestoes = gerarSugestoesVinculoImoveis(
      [lanc],
      [mariaConsolacao, judiel, mariaJose],
      historicos,
      { estrategia: 'todosParesQualificados', scoreMinimo: 38, limite: 10 },
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].imovelId).toBe(10);
    expect(sugestoes[0].locatario).toContain('CONSOLACAO');
  });

  it('modo geral: PIX Mariana Rodrigues prioriza imóvel da Mariana', () => {
    const mariana = {
      imovelId: 23,
      imovelOcupado: true,
      codigo: '400',
      proc: '15',
      inquilino: 'MARIANA RODRIGUES SANTANA',
      valorLocacao: '1.600,00',
      diaPagAluguel: '09',
    };
    const shardson = {
      imovelId: 13,
      imovelOcupado: true,
      codigo: '300',
      proc: '12',
      inquilino: 'SHARDSON DIEGO PIRES MANO',
      valorLocacao: '1.600,00',
      diaPagAluguel: '09',
    };
    const lanc = {
      id: 70000,
      dataLancamento: '2026-03-09',
      natureza: 'CREDITO',
      valor: 1600,
      descricao: 'Pagamento recebido - Mariana Rodrigues Santana - 039.728.661-94',
      processoId: null,
      numeroInternoProcesso: null,
    };
    const sugestoes = gerarSugestoesVinculoImoveis([lanc], [mariana, shardson], new Map(), {
      estrategia: 'todosParesQualificados',
      scoreMinimo: 38,
    });
    expect(sugestoes.some((s) => s.imovelId === 23)).toBe(true);
    expect(sugestoes.filter((s) => s.imovelId === 13)).toHaveLength(0);
  });

  it('repasse débito: mesmo locador, valor histórico escolhe o Proc. certo', () => {
    const aloisio793 = {
      imovelId: 3,
      imovelOcupado: true,
      codigo: '793',
      proc: '20',
      proprietario: 'ALOISIO SAVIO DA SILVA',
      inquilino: 'RENATO MIKHAIL',
      valorLocacao: '2.100,00',
      diaRepasse: '05',
    };
    const aloisio100 = {
      imovelId: 44,
      imovelOcupado: true,
      codigo: '100',
      proc: '8',
      proprietario: 'ALOISIO SAVIO DA SILVA',
      inquilino: 'QUEREN DA SILVA',
      valorLocacao: '1.500,00',
      diaRepasse: '05',
    };
    const hist793 = construirPerfilHistoricoImovel([
      {
        dataLancamento: '2026-02-05',
        natureza: 'DEBITO',
        valor: -1800,
        bancoNome: 'CORA',
        descricao: 'PIX TRANSF ALOISIO',
        processoId: 1,
        numeroInternoProcesso: 20,
      },
    ]);
    const hist100 = construirPerfilHistoricoImovel([
      {
        dataLancamento: '2026-02-10',
        natureza: 'DEBITO',
        valor: -1500,
        bancoNome: 'CORA',
        descricao: 'PIX TRANSF ALOISIO',
        processoId: 1,
        numeroInternoProcesso: 8,
      },
    ]);
    const lanc = {
      id: 8000,
      dataLancamento: '2026-03-05',
      natureza: 'DEBITO',
      valor: -1800,
      bancoNome: 'CORA',
      descricao: 'PIX TRANSF ALOISIO05/03',
      descricaoDetalhada: 'ALOISIO SAVIO DA SILVA x RENATO',
      processoId: null,
      numeroInternoProcesso: null,
    };
    const sugestoes = gerarSugestoesVinculoImoveis([lanc], [aloisio793, aloisio100], new Map([
      ['793|20', hist793],
      ['100|8', hist100],
    ]), {
      estrategia: 'todosParesQualificados',
      scoreMinimo: 38,
      limite: 10,
    });
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].imovelId).toBe(3);
    expect(sugestoes[0].proc).toBe('20');
    expect(sugestoes[0].tipo).toBe('repasse');
    expect(sugestoes[0].natureza).toBe('DEBITO');
  });

  it('classifica cor da linha: coincide vs diferente', () => {
    expect(
      classificarCoincidenciaNomeExtratoVinculo(
        'Pagamento recebido - Josue Ribeiro Montalvao - 700.964.391-14',
        'JOSUE RIBEIRO MONTALVAO',
      ),
    ).toBe('coincide');
    expect(
      classificarCoincidenciaNomeExtratoVinculo(
        'Pagamento recebido - Thor Terraplanagem - 000.000.000-00',
        'ANA PAULA DE SOUSA',
      ),
    ).toBe('diferente');
    expect(
      classificarCoincidenciaNomeExtratoVinculo(
        'Pagamento recebido - Larissa Aparecida Silva De Oliveira - 108.295.946-47',
        'ANA CLÁUDIA DE OLIVEIRA E SILVA',
      ),
    ).toBe('diferente');
    expect(
      classificarCoincidenciaNomeExtratoVinculo(
        'Pagamento recebido - Maria Da Consolação Barbosa - 000.000.000-00',
        'MARIA DA CONSOLAÇÃO BARBOSA',
      ),
    ).toBe('coincide');
  });
});
