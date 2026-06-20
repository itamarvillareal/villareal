import { describe, expect, it } from 'vitest';
import {
  conferirTotalFatura,
  ehLinhaPagamentoFatura,
  extrairFinalCartaoFatura,
  extrairResumoFaturaItauMatrix,
  gerarIdEstavelFaturaCartao,
  mensagemResultadoConferenciaFatura,
  parseFaturaCartaoItauPdfText,
  parseLinhaTextoFaturaItau,
  parseMatrixFaturaItau,
  parseValorFaturaCelula,
  somarLancamentosFatura,
} from './faturaCartaoItauImport.js';

describe('faturaCartaoItauImport', () => {
  it('parseValorFaturaCelula aceita negativo e formato BR', () => {
    expect(parseValorFaturaCelula(-7190.71)).toBe(-7190.71);
    expect(parseValorFaturaCelula('294,00')).toBe(294);
    expect(parseValorFaturaCelula('-1.234,56')).toBe(-1234.56);
    expect(parseValorFaturaCelula('R$ 6.097,78')).toBe(6097.78);
  });

  it('extrairFinalCartaoFatura', () => {
    expect(extrairFinalCartaoFatura('****2947')).toBe('2947');
  });

  it('ignora pagamento efetuado', () => {
    expect(ehLinhaPagamentoFatura('Pagamento Efetuado')).toBe(true);
    expect(ehLinhaPagamentoFatura('Google Gsuite')).toBe(false);
  });

  it('parseLinhaTextoFaturaItau', () => {
    const p = parseLinhaTextoFaturaItau('01/07/2025 Google Gsuite_villarea 294,00');
    expect(p?.dataIso).toBe('2025-07-01');
    expect(p?.descricao).toBe('Google Gsuite_villarea');
    expect(p?.valor).toBe(294);
  });

  it('parseLinhaTextoFaturaItau com parcelamento', () => {
    const p = parseLinhaTextoFaturaItau('24/06/2025 Irmaossoaressaem Parcela 1 de 6 208,28');
    expect(p?.parcelamento).toBe('Parcela 1 de 6');
    expect(p?.valor).toBe(208.28);
  });

  it('parseMatrixFaturaItau estilo export Itaú', () => {
    const matrix = [
      [null, 'Fatura Paga - Julho/2025'],
      [null, 'Cartão', null, null, null, null, 'Valor', null, 'Vencimento'],
      [null, 'Person Black - final 2947', null, 'Você pagou R$ 502,28', null, null, 'R$ 502,28', null, '10/07/2025'],
      [null, 'Data', 'Lançamento', 'Parcelamento', 'Valor', null, null, null, null, 'Número do cartão'],
      [null, '2025-06-10', 'Pagamento Efetuado', null, -7190.71, null, null, null, null, '****0607'],
      [null, '2025-07-01', 'Google Gsuite_villarea', null, 294, null, null, null, null, '****2947'],
      [null, '2025-06-24', 'Irmaossoaressaem', 'Parcela 1 de 6', 208.28, null, null, null, null, '****2947'],
    ];
    const { rows, meta } = parseMatrixFaturaItau(matrix);
    expect(meta.ignoradosPagamento).toBe(1);
    expect(rows).toHaveLength(2);
    expect(meta.dataVencimento).toBe('2025-07-10');
    expect(meta.valorTotalBanco).toBe(502.28);
    expect(meta.somaCalculada).toBe(502.28);
    expect(meta.conferenciaTotal?.ok).toBe(true);
    expect(rows[0].descricao).toBe('Google Gsuite_villarea');
    expect(rows[1].parcelamento).toBe('Parcela 1 de 6');
  });

  it('extrairResumoFaturaItauMatrix e conferirTotalFatura', () => {
    const matrix = [
      [null, 'Fatura Paga - Julho/2025'],
      [null, 'Cartão', null, null, null, null, 'Valor', null, 'Vencimento'],
      [null, 'Cartão', null, null, null, null, 'R$ 6.097,78', null, '10/07/2025'],
    ];
    const resumo = extrairResumoFaturaItauMatrix(matrix);
    expect(resumo.dataVencimento).toBe('2025-07-10');
    expect(resumo.valorTotalFatura).toBe(6097.78);
    const conf = conferirTotalFatura({ somaCalculada: 6097.78, valorTotalBanco: 6097.78 });
    expect(conf.ok).toBe(true);
    const confBad = conferirTotalFatura({ somaCalculada: 6000, valorTotalBanco: 6097.78 });
    expect(confBad.ok).toBe(false);
  });

  it('somarLancamentosFatura', () => {
    expect(somarLancamentosFatura([{ valor: 10 }, { valor: 20.5 }])).toBe(30.5);
  });

  it('mensagemResultadoConferenciaFatura', () => {
    expect(
      mensagemResultadoConferenciaFatura(
        conferirTotalFatura({ somaCalculada: 6097.78, valorTotalBanco: 6097.78 }),
      ),
    ).toContain('confere');
    expect(
      mensagemResultadoConferenciaFatura(
        conferirTotalFatura({ somaCalculada: 6000, valorTotalBanco: 6097.78 }),
      ),
    ).toContain('divergência');
    expect(mensagemResultadoConferenciaFatura(null)).toContain('Não foi possível');
  });

  it('parseFaturaCartaoItauPdfText', () => {
    const texto = `
Fatura Paga
Lançamentos
01/07/2025 Google Gsuite_villarea 294,00
10/06/2025 Pagamento Efetuado -7.190,71
24/06/2025 Irmaossoaressaem Parcela 1 de 6 208,28
`;
    const { rows, meta } = parseFaturaCartaoItauPdfText(texto);
    expect(meta.ignoradosPagamento).toBe(1);
    expect(rows).toHaveLength(2);
  });

  it('gerarIdEstavelFaturaCartao é determinístico', () => {
    const a = gerarIdEstavelFaturaCartao({
      dataIso: '2025-07-01',
      valor: 294,
      descricao: 'Teste',
      linha: 1,
      origem: 'XLSX',
    });
    const b = gerarIdEstavelFaturaCartao({
      dataIso: '2025-07-01',
      valor: 294,
      descricao: 'Teste',
      linha: 1,
      origem: 'XLSX',
    });
    expect(a).toBe(b);
    expect(a.startsWith('FAT-')).toBe(true);
  });
});
