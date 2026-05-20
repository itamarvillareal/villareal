import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoFluxoMes,
  avaliarSituacaoRepasseMes,
  buildRelatorioFinanceiroImoveisMes,
  classificarLancamentoAdministracaoImovel,
  extrairTotaisFinanceirosMes,
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
