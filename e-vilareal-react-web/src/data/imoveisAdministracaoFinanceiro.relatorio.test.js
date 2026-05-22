import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoFluxoMes,
  avaliarSituacaoRepasseMes,
  buildRelatorioFinanceiroImoveisMes,
  chaveParCodProc,
  classificarLancamentoAdministracaoImovel,
  construirIndiceImoveisPorCodProc,
  extrairTotaisFinanceirosMes,
  montarLinhasRelatorioFinanceiroImoveisExtrato,
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
  it('classifica crédito genérico como credito (classificar)', () => {
    const c = classificarLancamentoAdministracaoImovel(
      { data: '10/02/2026', descricao: 'DEPOSITO INQUILINO', valor: 2100 },
      '793',
      20,
    );
    expect(c.papel).toBe('credito');
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
});
