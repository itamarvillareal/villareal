import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  diagnosticarExtratoComOfxCore,
  diagnosticarExtratoComArquivoCore,
  extrairMetadadosOfx,
  extrairMetadadosDeRows,
  extratoAlinhadoComOfx,
  extratoFielComOfx,
  precisaReparoExtratoComOfx,
  saldoLedgerDesalinhadoComOfx,
  calcularDeltasAlinhamentoSaldo,
  alinhamentoSaldoCoerenteComOfx,
  podeContinuarImportacaoExtratoComOfx,
  prepararExclusaoReparoExtrato,
  prepararImportacaoReparoExtrato,
} from './extratoRepararDiagnosticoCore.js';
import { analisarLancamentosNovosDedupe, parseOfxToExtrato } from '../../../utils/ofx.js';

const ofxJunhoPath = '/Users/itamar/Downloads/vrv-solucoes_01062026_a_30062026_d1037e1a.ofx';
const ofxHistoricoPath = '/Users/itamar/Downloads/vrv-solucoes_01012020_a_21062026_58fea81a.ofx';

describe('extratoRepararDiagnostico', () => {
  it('extrairMetadadosOfx lê período e saldo zero Cora (junho)', () => {
    if (!fs.existsSync(ofxJunhoPath)) return;
    const txt = fs.readFileSync(ofxJunhoPath, 'utf8');
    const meta = extrairMetadadosOfx(txt);
    expect(meta.dataInicio).toBe('2026-06-01');
    expect(meta.dataFim).toBe('2026-06-30');
    expect(meta.saldoLedger).toBe(0);
    expect(parseOfxToExtrato(txt)).toHaveLength(99);
  });

  it('extrairMetadadosOfx lê histórico 2020–2026 com saldo zero', () => {
    if (!fs.existsSync(ofxHistoricoPath)) return;
    const txt = fs.readFileSync(ofxHistoricoPath, 'utf8');
    const meta = extrairMetadadosOfx(txt);
    expect(meta.dataInicio).toBe('2020-01-01');
    expect(meta.dataFim).toBe('2026-06-21');
    expect(meta.saldoLedger).toBe(0);
    expect(parseOfxToExtrato(txt)).toHaveLength(2272);
  });

  it('OFX Cora junho — banco vazio teria 99 lançamentos novos', () => {
    if (!fs.existsSync(ofxJunhoPath)) return;
    const txt = fs.readFileSync(ofxJunhoPath, 'utf8');
    const ofxRows = parseOfxToExtrato(txt);
    const { novos } = analisarLancamentosNovosDedupe([], ofxRows);
    expect(novos).toHaveLength(99);
  });

  it('OFX histórico — soma dos movimentos é zero', () => {
    if (!fs.existsSync(ofxHistoricoPath)) return;
    const txt = fs.readFileSync(ofxHistoricoPath, 'utf8');
    const ofxRows = parseOfxToExtrato(txt);
    const soma = ofxRows.reduce((s, r) => s + Number(r.valor), 0);
    expect(Math.abs(soma)).toBeLessThan(0.02);
  });

  it('prepararExclusaoReparoExtrato filtra apiId', () => {
    const prep = prepararExclusaoReparoExtrato([
      { apiId: 10, valor: -100, data: '01/06/2026' },
      { apiId: null, valor: 50, data: '02/06/2026' },
    ]);
    expect(prep.apiIds).toEqual([10]);
    expect(prep.soma).toBe(-100);
    expect(prep.semId).toHaveLength(1);
  });

  it('prepararImportacaoReparoExtrato sanitiza linhas OFX', () => {
    const prep = prepararImportacaoReparoExtrato(
      [{ numero: 'abc', data: '01/06/2026', valor: 10, descricao: 'x' }],
      'CORA',
      26,
    );
    expect(prep.linhas).toHaveLength(1);
    expect(prep.linhas[0].nomeBanco).toBe('CORA');
    expect(prep.linhas[0].numeroBanco).toBe(26);
    expect(prep.linhas[0].origemImportacao).toBe('OFX');
  });

  it('extrairMetadadosDeRows infere período e saldo final do PDF', () => {
    const rows = [
      { data: '01/07/2026', valor: 100, saldo: 100, numero: 'a' },
      { data: '15/07/2026', valor: -50, saldo: 50, numero: 'b' },
      { data: '30/07/2026', valor: 25, saldo: 75, numero: 'c' },
    ];
    const meta = extrairMetadadosDeRows(rows);
    expect(meta.dataInicio).toBe('2026-07-01');
    expect(meta.dataFim).toBe('2026-07-30');
    expect(meta.saldoLedger).toBe(75);
  });

  it('diagnosticarExtratoComArquivoCore compara PDF com sistema', () => {
    const arquivoRows = [
      { data: '15/07/2026', valor: -10, saldo: 90, numero: 'BTG-1', descricao: 'Pix' },
    ];
    const existenteAll = [];
    const diag = diagnosticarExtratoComArquivoCore({
      arquivoRows,
      meta: extrairMetadadosDeRows(arquivoRows),
      existenteAll,
      saldoApi: null,
      origemImportacao: 'PDF',
    });
    expect(diag.faltamNoSistema).toHaveLength(1);
    expect(diag.faltamNoSistema[0].origemImportacao).toBe('PDF');
    expect(diag.meta.dataInicio).toBe('2026-07-15');
  });

  it('precisaReparoExtratoComOfx detecta faltam e sobram no período', () => {
    expect(precisaReparoExtratoComOfx(null)).toBe(false);
    expect(
      precisaReparoExtratoComOfx({
        faltamNoSistema: [{ valor: 1 }],
        sobramNoSistema: [],
        meta: { saldoLedger: 0 },
        totais: { saldoSistema: 0 },
      }),
    ).toBe(true);
    expect(
      precisaReparoExtratoComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [{ valor: 1 }],
        meta: { saldoLedger: 0 },
        totais: { saldoSistema: 0 },
      }),
    ).toBe(true);
    expect(
      precisaReparoExtratoComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [],
        meta: { saldoLedger: 0 },
        totais: { saldoSistema: 10 },
      }),
    ).toBe(false);
    expect(
      extratoAlinhadoComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [],
        meta: { saldoLedger: 0 },
        totais: { saldoSistema: 10 },
      }),
    ).toBe(true);
    expect(saldoLedgerDesalinhadoComOfx({
      faltamNoSistema: [],
      sobramNoSistema: [],
      meta: { saldoLedger: 0 },
      totais: { saldoSistema: 10 },
    })).toBe(true);
  });

  it('OFX parcial não sugere exclusão de lançamentos anteriores ao período', () => {
    const ofxText = [
      'OFXHEADER:100',
      'DATA:OFXSGML',
      'OFXSGML',
      '<OFX>',
      '<BANKMSGSRSV1><STMTTRNRS><STMTRS>',
      '<BANKTRANLIST>',
      '<DTSTART>20260422000000',
      '<DTEND>20260621000000',
      '<STMTTRN>',
      '<TRNTYPE>DEBIT',
      '<DTPOSTED>20260515000000',
      '<TRNAMT>-10.00',
      '<FITID>parcial-1',
      '<NAME>Teste periodo',
      '</STMTTRN>',
      '</BANKTRANLIST>',
      '<LEDGERBAL><BALAMT>0.00</LEDGERBAL>',
      '</STMTRS></STMTTRNRS></BANKMSGSRSV1>',
      '</OFX>',
    ].join('\n');

    const existenteAll = [
      { apiId: 1, data: '15/01/2024', valor: -500, numero: 'antigo-1', descricao: 'Antes do OFX' },
      { apiId: 2, data: '15/05/2026', valor: -10, numero: 'dup', descricao: 'Teste periodo' },
    ];

    const diag = diagnosticarExtratoComOfxCore({ ofxText, existenteAll, saldoApi: null });

    expect(diag.meta.dataInicio).toBe('2026-04-22');
    expect(diag.meta.dataFim).toBe('2026-06-21');
    expect(diag.totais.existenteIgnoradosForaPeriodo).toBe(1);
    expect(diag.sobramNoSistema.some((t) => Number(t.apiId) === 1)).toBe(false);
    expect(diag.faltamNoSistema).toHaveLength(0);
  });

  it('diagnosticarExtratoComOfxCore com overrides não sugere exclusão fora do período', () => {
    const ofxText = [
      'OFXHEADER:100',
      'DATA:OFXSGML',
      'OFXSGML',
      '<OFX>',
      '<BANKMSGSRSV1><STMTTRNRS><STMTRS>',
      '<BANKTRANLIST>',
      '<DTSTART>20260422000000',
      '<DTEND>20260621000000',
      '<STMTTRN>',
      '<TRNTYPE>DEBIT',
      '<DTPOSTED>20260515000000',
      '<TRNAMT>-10.00',
      '<FITID>parcial-1',
      '<NAME>Teste periodo',
      '</STMTTRN>',
      '</BANKTRANLIST>',
      '<LEDGERBAL><BALAMT>0.00</LEDGERBAL>',
      '</STMTRS></STMTTRNRS></BANKMSGSRSV1>',
      '</OFX>',
    ].join('\n');

    const existentePeriodo = [
      { apiId: 2, data: '15/05/2026', valor: -10, numero: 'dup', descricao: 'Teste periodo' },
    ];

    const diag = diagnosticarExtratoComOfxCore({
      ofxText,
      existenteAll: existentePeriodo,
      saldoApi: null,
      sistemaTotalOverride: 2,
      existenteIgnoradosForaPeriodoOverride: 1,
    });

    expect(diag.totais.existenteIgnoradosForaPeriodo).toBe(1);
    expect(diag.totais.sistemaTotal).toBe(2);
    expect(diag.sobramNoSistema.some((t) => Number(t.apiId) === 1)).toBe(false);
    expect(diag.faltamNoSistema).toHaveLength(0);
  });

  it('parseOfxAmount lê BALAMT com ponto decimal (formato Cora)', () => {
    const txt = ['<LEDGERBAL><BALAMT>-5743.46</BALAMT></LEDGERBAL>'].join('');
    expect(extrairMetadadosOfx(txt).saldoLedger).toBe(-5743.46);
  });

  it('bloqueia alinhamento quando efeito do reparo não fecha diferença de saldo', () => {
    const diag = {
      meta: { saldoLedger: -5743.46 },
      totais: {
        saldoSistema: -3530,
        somaFaltam: -5743.46,
        somaSobram: 0,
      },
      faltamNoSistema: [{ valor: -100 }],
      sobramNoSistema: [],
    };
    const { deltaEsperado, deltaReparo, coerente } = calcularDeltasAlinhamentoSaldo(diag);
    expect(deltaEsperado).toBeCloseTo(-2213.46, 2);
    expect(deltaReparo).toBeCloseTo(-5743.46, 2);
    expect(coerente).toBe(false);
    expect(alinhamentoSaldoCoerenteComOfx(diag)).toBe(false);
  });

  it('podeContinuarImportacaoExtratoComOfx com faltam incoerentes (Itaú parcial)', () => {
    const diag = {
      meta: { saldoLedger: -5743.46 },
      totais: { saldoSistema: -3530, somaFaltam: -12894.36, somaSobram: 0 },
      faltamNoSistema: [{ valor: -1 }],
      sobramNoSistema: [],
    };
    expect(podeContinuarImportacaoExtratoComOfx(diag)).toBe(true);
  });

  it('podeContinuarImportacaoExtratoComOfx bloqueia quando sobram no período', () => {
    expect(
      podeContinuarImportacaoExtratoComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [{ valor: 1 }],
        totais: { somaFaltam: 0, somaSobram: 1 },
      }),
    ).toBe(false);
  });

  it('extratoFielComOfx exige saldo além dos lançamentos do período', () => {
    expect(
      extratoFielComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [],
        meta: { saldoLedger: 10000 },
        totais: { saldoSistema: 22509.45 },
      }),
    ).toBe(false);
    expect(
      extratoFielComOfx({
        faltamNoSistema: [],
        sobramNoSistema: [],
        meta: { saldoLedger: 10000 },
        totais: { saldoSistema: 10000 },
      }),
    ).toBe(true);
  });

  it('podeContinuarImportacaoExtratoComOfx bloqueia faltam coerentes sem alinhar', () => {
    expect(
      podeContinuarImportacaoExtratoComOfx({
        meta: { saldoLedger: -100 },
        totais: { saldoSistema: 0, somaFaltam: -100, somaSobram: 0 },
        faltamNoSistema: [{ valor: -100 }],
        sobramNoSistema: [],
      }),
    ).toBe(false);
  });

  it('valorAssinadoParaSoma via somaFaltam trata natureza DEBITO', () => {
    const ofxText = [
      'OFXHEADER:100',
      '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>',
      '<BANKTRANLIST><DTSTART>20260601000000<DTEND>20260630000000',
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260615000000<TRNAMT>-10.00<FITID>x1<NAME>Teste</STMTTRN>',
      '</BANKTRANLIST><LEDGERBAL><BALAMT>-10.00</LEDGERBAL>',
      '</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
    ].join('');
    const existenteAll = [
      {
        apiId: 1,
        data: '15/06/2026',
        valor: 10,
        natureza: 'DEBITO',
        numero: 'dup',
        descricao: 'Teste',
      },
    ];
    const diag = diagnosticarExtratoComOfxCore({
      ofxText,
      existenteAll,
      saldoApi: { saldo: -20, saldoInicial: 0 },
    });
    expect(diag.totais.somaSistemaNoPeriodo).toBeCloseTo(-10, 2);
  });
});
