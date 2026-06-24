import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoFluxoMes,
  avaliarSituacaoRepasseMes,
  buildRelatorioFinanceiroImoveisMes,
  calcularHonorariosValor,
  calcularRepasseEsperado,
  chaveParCodProc,
  classificarLancamentoAdministracaoImovel,
  construirIndiceImoveisPorCodProc,
  extrairTotaisFinanceirosMes,
  extrairTotaisFinanceirosMesComRepasseAnterior,
  formatarDataVencimentoFluxoNoMes,
  linhaRelatorioFinanceiroFromCadastro,
  mesAnteriorChaveYYYYMM,
  montarLinhasRelatorioFinanceiroImoveisExtrato,
  montarPainelAdministracaoImovelDeTransacoes,
  paresCodProcComLancamentosNoMes,
  resolverNumeroImovelParCodProc,
} from './imoveisAdministracaoFinanceiro.js';

describe('avaliarSituacaoFluxoMes', () => {
  it('marca ok quando há recebimento no mês', () => {
    const r = avaliarSituacaoFluxoMes({
      totalNoMes: 1500,
      dataPrimeiroNoMes: '05/05/2026',
      diaCadastro: '10',
      chaveMesYYYYMM: '2026-05',
      hoje: new Date(2026, 4, 15),
    });
    expect(r.status).toBe('ok');
  });

  it('marca pendente antes do dia de vencimento', () => {
    const r = avaliarSituacaoFluxoMes({
      totalNoMes: 0,
      diaCadastro: '20',
      chaveMesYYYYMM: '2026-05',
      hoje: new Date(2026, 4, 10),
    });
    expect(r.status).toBe('pendente');
  });

  it('marca aguarda_aluguel no repasse quando aluguel já entrou', () => {
    const r = avaliarSituacaoRepasseMes({
      totalRepasse: 0,
      totalAluguel: 2000,
      diaCadastro: '15',
      chaveMesYYYYMM: '2026-05',
      hoje: new Date(2026, 4, 20),
    });
    expect(r.status).toBe('aguarda_aluguel');
  });
});

describe('classificarLancamentoAdministracaoImovel / extrairTotaisFinanceirosMes', () => {
  it('classifica Pagamento recebido (OFX/planilha) como aluguel', () => {
    const t = {
      data: '01/06/2026',
      descricao: 'Pagamento recebido - Renato Mikhail Martins Atie Aji - 031.817.211-90',
      descricaoDetalhada:
        'ALOISIO SAVIO DA SILVA x RENATO MIKHAIL MARTINS ATIE AJI e NAIRA MARQUES DA SILVA MIKHAIL',
      valor: 2100,
    };
    const c = classificarLancamentoAdministracaoImovel(t, '793', 20);
    expect(c.papel).toBe('aluguel');
    const totais = extrairTotaisFinanceirosMes([t], '793', 20, '2026-06');
    expect(totais.totalAluguel).toBe(2100);
    expect(totais.dataPrimeiroAluguel).toBe('01/06/2026');
  });

  it('classifica Pagamento recebido com obs CREDIT (imóvel 4 / Fabricio) como aluguel', () => {
    const t = {
      data: '15/06/2026',
      descricao: 'Pagamento recebido - Fabricio Gonçalvez Martins - 844.925.111-72',
      descricaoDetalhada: 'CREDIT',
      valor: 2300,
    };
    const c = classificarLancamentoAdministracaoImovel(t, '856', 4);
    expect(c.papel).toBe('aluguel');
    const totais = extrairTotaisFinanceirosMes([t], '856', 4, '2026-06');
    expect(totais.totalAluguel).toBe(2300);
    expect(totais.dataPrimeiroAluguel).toBe('15/06/2026');
  });

  it('classifica crédito genérico sem sinal de aluguel como credito', () => {
    const c = classificarLancamentoAdministracaoImovel(
      { data: '10/02/2026', descricao: 'REEMBOLSO DIVERSO', valor: 2100 },
      '793',
      20,
    );
    expect(c.papel).toBe('credito');
  });

  it('classifica PIX do inquilino com valor próximo do aluguel como aluguel', () => {
    const c = classificarLancamentoAdministracaoImovel(
      {
        data: '10/06/2026',
        descricao: 'PIX TRANSF Neemias10 06',
        valor: 1707.83,
      },
      '1',
      '1',
      { valorAluguelReferencia: 1750, nomeInquilino: 'NEEMIAS RODRIGUES BORGES' },
    );
    expect(c.papel).toBe('aluguel');
  });

  it('segunda passagem usa valor modal de aluguéis já identificados no extrato', () => {
    const transacoes = [
      {
        data: '13/04/2026',
        descricao: 'Neemias Rodrigues Borges',
        valor: 1707.83,
      },
      {
        data: '10/06/2026',
        descricao: 'PIX TRANSF Neemias10 06',
        valor: 1707.83,
      },
    ];
    const painel = montarPainelAdministracaoImovelDeTransacoes(transacoes, '1', '1', {
      valorAluguelContrato: '1.750,00',
      nomeInquilino: 'NEEMIAS RODRIGUES BORGES',
    });
    const jun = painel.transacoes.find((t) => t.data === '10/06/2026');
    expect(jun?.classificacao?.papel).toBe('aluguel');
  });

  it('extrairTotaisFinanceirosMes reconhece PIX do inquilino com cadastro do imóvel (793/10)', () => {
    const transacoes = [
      {
        data: '13/04/2026',
        descricao: 'Neemias Rodrigues Borges',
        valor: 1707.83,
      },
      {
        data: '10/06/2026',
        descricao: 'PIX TRANSF Neemias10 06',
        valor: 1707.83,
      },
    ];
    const totais = extrairTotaisFinanceirosMes(transacoes, '793', 10, '2026-06', {
      valorAluguelContrato: '1.750,00',
      nomeInquilino: 'NEEMIAS RODRIGUES BORGES',
    });
    expect(totais.totalAluguel).toBe(1707.83);
    expect(totais.dataPrimeiroAluguel).toBe('10/06/2026');
  });

  it('classifica PIX TRANSF negativo como repasse (793/20)', () => {
    const t = {
      data: '05/02/2026',
      descricao: 'PIX TRANSF ALOISIO05/02',
      descricaoDetalhada:
        'ALOISIO SAVIO DA SILVA x RENATO MIKHAIL MARTINS ATIE AJI e NAIRA MARQUES DA SILVA MIKHAIL - 03/2026',
      valor: -1800,
    };
    const c = classificarLancamentoAdministracaoImovel(t, '793', 20);
    expect(c.papel).toBe('repasse');
    const totais = extrairTotaisFinanceirosMes([t], '793', 20, '2026-02');
    expect(totais.totalRepasse).toBe(1800);
    expect(totais.dataPrimeiroRepasse).toBeTruthy();
  });
});

describe('montarLinhasRelatorioFinanceiroImoveisExtrato', () => {
  it('só inclui par com lançamento no mês e nº de imóvel', () => {
    const itens = [
      {
        imovelId: 3,
        imovelOcupado: true,
        codigo: '793',
        proc: '20',
        unidade: 'Unidade 606 A',
        valorLocacao: '2.100,00',
      },
      {
        imovelId: 99,
        imovelOcupado: true,
        codigo: '100',
        proc: '1',
        valorLocacao: '1.000,00',
      },
    ];
    const indice = construirIndiceImoveisPorCodProc(itens);
    const par = { codigoNorm: '00000793', procNorm: '20', codigoNum: 793, procNum: 20 };
    expect(resolverNumeroImovelParCodProc(par, indice)).toBe(3);

    const linhas = montarLinhasRelatorioFinanceiroImoveisExtrato(itens, [par], '2026-05', {
      totaisPorPar: new Map([
        [
          chaveParCodProc('00000793', '20'),
          { totalAluguel: 2100, totalRepasse: 0, dataPrimeiroAluguel: '10/05/2026' },
        ],
      ]),
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].imovelId).toBe(3);
    expect(linhas[0].totalAluguel).toBe(2100);
  });

  it('exclui par sem número de imóvel', () => {
    const par = { codigoNorm: '00000500', procNorm: '1', codigoNum: 500, procNum: 1 };
    const linhas = montarLinhasRelatorioFinanceiroImoveisExtrato(
      [{ imovelId: 1, imovelOcupado: true, codigo: '999', proc: '9' }],
      [par],
      '2026-05',
    );
    expect(linhas).toHaveLength(0);
  });
});

describe('paresCodProcComLancamentosNoMes', () => {
  it('agrupa por cod.+proc. no mês', () => {
    const pares = paresCodProcComLancamentosNoMes(
      [
        { data: '05/05/2026', codCliente: '00000793', proc: '20', valor: 100 },
        { data: '10/05/2026', codCliente: '793', proc: '20', valor: -50 },
        { data: '01/05/2026', codCliente: '100', proc: '1', valor: 10 },
        { data: '01/04/2026', codCliente: '100', proc: '1', valor: 10 },
      ],
      '2026-05',
    );
    expect(pares).toHaveLength(2);
    expect(pares.map((p) => p.procNorm).sort()).toEqual(['1', '20']);
  });
});

describe('formatarDataVencimentoFluxoNoMes', () => {
  it('monta dd/mm/aaaa no mês de referência', () => {
    expect(formatarDataVencimentoFluxoNoMes('2026-06', '10')).toBe('10/06/2026');
    expect(formatarDataVencimentoFluxoNoMes('2026-06', '01')).toBe('01/06/2026');
  });

  it('ajusta dia 31 em fevereiro', () => {
    expect(formatarDataVencimentoFluxoNoMes('2026-02', '31')).toBe('28/02/2026');
  });

  it('retorna null sem dia cadastrado', () => {
    expect(formatarDataVencimentoFluxoNoMes('2026-06', '')).toBeNull();
  });
});

describe('buildRelatorioFinanceiroImoveisMes', () => {
  it('filtra imóveis desocupados quando soOcupados', () => {
    const linhas = buildRelatorioFinanceiroImoveisMes(
      [
        { imovelId: 1, imovelOcupado: true, codigo: '100', proc: '1', valorLocacao: '1.000,00' },
        { imovelId: 2, imovelOcupado: false, codigo: '200', proc: '2', valorLocacao: '2.000,00' },
      ],
      '2026-05',
      { soOcupados: true },
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].imovelId).toBe(1);
  });

  it('inclui nome do locatário do cadastro', () => {
    const [linha] = buildRelatorioFinanceiroImoveisMes(
      [
        {
          imovelId: 1,
          imovelOcupado: true,
          codigo: '100',
          proc: '1',
          inquilino: 'Maria Silva',
          valorLocacao: '1.000,00',
        },
      ],
      '2026-05',
      { soOcupados: false },
    );
    expect(linha.locatario).toBe('Maria Silva');
  });

  it('inclui data de vencimento do aluguel a partir do dia do contrato', () => {
    const [linha] = buildRelatorioFinanceiroImoveisMes(
      [
        {
          imovelId: 1,
          imovelOcupado: true,
          codigo: '100',
          proc: '1',
          diaPagAluguel: '15',
          valorLocacao: '1.000,00',
        },
      ],
      '2026-06',
      { soOcupados: false },
    );
    expect(linha.dataVencimentoAluguel).toBe('15/06/2026');
  });

  it('inclui nome do locador (proprietário) do cadastro', () => {
    const [linha] = buildRelatorioFinanceiroImoveisMes(
      [
        {
          imovelId: 1,
          imovelOcupado: true,
          codigo: '100',
          proc: '1',
          proprietario: 'João Proprietário',
          valorLocacao: '1.000,00',
        },
      ],
      '2026-05',
      { soOcupados: false },
    );
    expect(linha.locador).toBe('João Proprietário');
  });
});

describe('honorários e repasse previsto', () => {
  it('calcula 10% sobre aluguel recebido no mês', () => {
    expect(calcularHonorariosValor(2300, 10)).toBe(230);
    expect(calcularRepasseEsperado(2300, 10)).toBe(2070);
  });

  it('usa valor de referência quando aluguel do mês é zero', () => {
    const linha = linhaRelatorioFinanceiroFromCadastro(
      {
        imovelId: 4,
        codigo: '856',
        proc: '4',
        valorLocacao: '2.300,00',
        taxaAdministracaoPercent: '10',
        diaPagAluguel: '15',
        diaRepasse: '20',
      },
      '2026-06',
      { totalAluguel: 0, totalRepasse: 0 },
    );
    expect(linha.honorariosValor).toBe(230);
    expect(linha.repasseEsperado).toBe(2070);
  });

  it('prioriza aluguel recebido no mês para o cálculo', () => {
    const linha = linhaRelatorioFinanceiroFromCadastro(
      {
        imovelId: 3,
        codigo: '793',
        proc: '20',
        valorLocacao: '2.100,00',
        taxaAdministracaoPercent: '10',
        diaPagAluguel: '01',
        diaRepasse: '05',
      },
      '2026-06',
      { totalAluguel: 2100, totalRepasse: 0, dataPrimeiroAluguel: '01/06/2026' },
    );
    expect(linha.honorariosValor).toBe(210);
    expect(linha.repasseEsperado).toBe(1890);
  });
});

describe('repasse do mês anterior', () => {
  it('mesAnteriorChaveYYYYMM decrementa mês e ano', () => {
    expect(mesAnteriorChaveYYYYMM('2026-06')).toBe('2026-05');
    expect(mesAnteriorChaveYYYYMM('2026-01')).toBe('2025-12');
  });

  it('extrai totalRepasseAnterior dos lançamentos', () => {
    const lancs = [
      { data: '20/05/2026', valor: -2070, descricao: '[ADM_IMOVEL:REPASSE]' },
      { data: '20/06/2026', valor: -1890, descricao: '[ADM_IMOVEL:REPASSE]' },
    ];
    const totais = extrairTotaisFinanceirosMesComRepasseAnterior(lancs, 856, 4, '2026-06');
    expect(totais.totalRepasse).toBe(1890);
    expect(totais.totalRepasseAnterior).toBe(2070);
    expect(totais.dataPrimeiroRepasseAnterior).toBe('20/05/2026');
    expect(totais.chaveMesAnterior).toBe('2026-05');
  });

  it('expõe repasse anterior na linha do relatório', () => {
    const linha = linhaRelatorioFinanceiroFromCadastro(
      { imovelId: 4, codigo: '856', proc: '4', valorLocacao: '2.300,00', diaPagAluguel: '15', diaRepasse: '20' },
      '2026-06',
      { totalAluguel: 2300, totalRepasse: 2070, totalRepasseAnterior: 1890, chaveMesAnterior: '2026-05' },
    );
    expect(linha.totalRepasseAnterior).toBe(1890);
    expect(linha.chaveMesAnterior).toBe('2026-05');
  });
});
