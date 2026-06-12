import { describe, expect, it } from 'vitest';
import { isInstituicaoBtgExtratoPdf, parseBtgPdfExtratoText, parseValorBtgPdfBr } from './btgPdfExtrato.js';

describe('isInstituicaoBtgExtratoPdf', () => {
  it('identifica contas BTG', () => {
    expect(isInstituicaoBtgExtratoPdf('BTG')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('BTG Banking')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('BTG JA')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('Itaú')).toBe(false);
    expect(isInstituicaoBtgExtratoPdf('CORA')).toBe(false);
  });
});

describe('parseValorBtgPdfBr', () => {
  it('interpreta formato BR com milhares e negativo', () => {
    expect(parseValorBtgPdfBr('49.999,99')).toBe(49999.99);
    expect(parseValorBtgPdfBr('-1.735,36')).toBe(-1735.36);
    expect(parseValorBtgPdfBr('0,00')).toBe(0);
    expect(parseValorBtgPdfBr('1 234 567,89')).toBe(1234567.89);
    expect(parseValorBtgPdfBr('1,234.56')).toBe(1234.56);
    expect(parseValorBtgPdfBr('R$ 2.500,00')).toBe(2500);
    expect(parseValorBtgPdfBr('-R$ 683,22')).toBe(-683.22);
  });
});

describe('parseBtgPdfExtratoText', () => {
  it('extrai lançamentos do texto do extrato BTG (modelo compacto: movimento + saldo)', () => {
    const bloco = `
Movimentação - Conta Corrente
Data Descrição Débito Saldo Crédito
Saldo Inicial 0,00
10/03/2026 RECEBIMENTO TRANSFERÊNCIA - Itamar Alexandre 49.999,99	49.999,99
11/03/2026 COMPRA - CDB BANCO BMG S.A - Venc.: 27/09/2027 99.932,66	4.693,25
16/03/2026 TRANSFERÊNCIA A CRÉDITO VIA PIX - ITAMAR 51.000,00	50.000,00
25/03/2026 VENDA DE LFT -1.735,36	93.198,26
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(4);
    expect(rows[0].data).toBe('10/03/2026');
    expect(rows[0].descricao).toContain('RECEBIMENTO');
    expect(rows[0].valor).toBe(49999.99);
    expect(rows[0].saldo).toBeCloseTo(49999.99, 2);
    expect(rows[1].valor).toBe(-99932.66);
    expect(rows[1].saldo).toBeCloseTo(49999.99 - 99932.66, 2);
    expect(rows[2].valor).toBe(51000);
    expect(rows[2].saldo).toBeCloseTo(49999.99 - 99932.66 + 51000, 2);
    expect(rows[3].valor).toBe(-1735.36);
    expect(rows[3].saldo).toBeCloseTo(49999.99 - 99932.66 + 51000 - 1735.36, 2);
  });

  it('usa Débito, Crédito e Saldo (PDF) quando há três valores no fim da linha', () => {
    const bloco = `
06/02/2026 ENVIO TRANSFERÊNCIA - Itamar 15.084,48 0,00 57.094,77
07/02/2026 CUPOM - CDB BANCO BMG S.A 0,00 1.901,61 1.901,61
10/02/2026 LIQ BOLSA (Operacoes) 7.881,18 0,00 1.685.686,38
11/02/2026 RECEBIMENTO TRANSFERÊNCIA 0,00 125.000,00 125.000,00
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(4);
    const porDesc = (sub) => rows.find((r) => String(r.descricao).includes(sub));
    expect(porDesc('ENVIO TRANSFERÊNCIA')?.valor).toBeCloseTo(-15084.48, 2);
    expect(porDesc('CUPOM')?.valor).toBeCloseTo(1901.61, 2);
    expect(porDesc('LIQ BOLSA')?.valor).toBeCloseTo(-7881.18, 2);
    expect(porDesc('RECEBIMENTO TRANSFERÊNCIA')?.valor).toBeCloseTo(125000, 2);
    let s = 0;
    for (const r of rows) {
      s += r.valor;
      expect(r.saldo).toBeCloseTo(s, 2);
    }
  });

  it('com três valores, ignora saldo do PDF no valor do lançamento (crédito − débito)', () => {
    const bloco = `
01/02/2026 LANCAMENTO TESTE 100,00 0,00 9.999,99
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(1);
    expect(rows[0].valor).toBeCloseTo(-100, 2);
    expect(rows[0].saldo).toBeCloseTo(-100, 2);
  });

  it('interpreta extrato do app BTG (data+hora, valor único R$ / -R$)', () => {
    const bloco = `
21/07/2023 23h32 Investimentos Transferência recebida Itamar Alexandre Felix Villa Real Junior R$ 683,22
21/07/2023 23h33 Transferência Pix enviado Itamar Alexandre F V Real Jr -R$ 683,22
21/07/2023 23h59 Saldo Diário R$ 0,00
25/07/2023 18h00 Investimentos Transferência recebida Itamar Alexandre Felix Villa Real Junior R$ 1.599,95
25/07/2023 18h02 Transferência Pix enviado Itamar Alexandre Felix Villa Real Junior -R$ 1.599,95
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(4);
    expect(rows[0].valor).toBeCloseTo(683.22, 2);
    expect(rows[1].valor).toBeCloseTo(-683.22, 2);
    expect(rows[0].descricao).toContain('Transferência recebida');
    expect(rows[1].descricao).toContain('Pix enviado');
  });

  it('ignora "Saldo Final" e não cria lançamento com o saldo de fechamento', () => {
    const bloco = `
Movimentação - Conta Corrente
Saldo Inicial 0,00
30/12/2025 ENVIO TRANSFERÊNCIA - Itamar Alexandre Felix Villa 605.700,00 0,00 15.044.745,73
01/01/2026 Saldo Final 15.044.745,73
Total de Créditos 4.877.944,33
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(1);
    expect(rows[0].data).toBe('30/12/2025');
    expect(rows[0].valor).toBeCloseTo(-605700, 2);
    // O saldo de fechamento (~15 mi) não pode virar um lançamento.
    expect(rows.some((r) => /saldo\s+final/i.test(String(r.descricao)))).toBe(false);
    expect(rows.some((r) => Math.abs(Number(r.valor) - 15044745.73) < 0.01)).toBe(false);
  });

  it('descarta linha de Saldo Final mesmo com prefixo de data (vira movimento fantasma)', () => {
    const bloco = `
05/01/2026 TED ENVIADA - Itamar 1.234,56 0,00 8.765,44
06/01/2026 Saldo Final 8.765,44
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(1);
    expect(rows[0].descricao).toContain('TED ENVIADA');
    expect(rows.some((r) => /saldo/i.test(String(r.descricao)))).toBe(false);
  });

  it('reconstrói valores pela variação do saldo (CUPOM/VENCIMENTO = crédito) e ignora totais/Saldo Final', () => {
    // Trecho real e contíguo do Extrato (6).pdf (BTG RACHEL), layout: descrição <saldo> <valor>.
    const bloco = `
Movimentação - Conta Corrente
Data Descrição Débito Saldo	Crédito
Saldo Inicial 0,00
01/06/2026 TAXA EMOLUMENTOS - BTC BOVA11 -0,03	0,03
01/06/2026 TAXA REMUNERAÇÃO - BTC BOVA11 -0,12	0,09
01/06/2026 JUROS SOBRE SALDO NEGATIVO - BANCO BTG -11,21	11,09
01/06/2026 IOF SOBRE SALDO NEGATIVO - BANCO BTG PACTUAL -16,76	5,55
01/06/2026 TRANSFERÊNCIA A CRÉDITO VIA PIX - ITAMAR 52.983,24	53.000,00
01/06/2026 ENVIO TRANSFERÊNCIA - Itamar Alexandre Felix Villa 19.903,28	33.079,96
01/06/2026 COMPRA - CDB OMNI S/A CREDITO FINANCIAMENTO 346,57	19.556,71
01/06/2026 LIQ BOLSA (Operacoes)- Pregão:28/05/2026 0,00	346,57
10/06/2026 CUPOM - CDB BANCO BMG S.A - Venc.: 2026-06-10 48.365,05	48.365,05
10/06/2026 IRRF - CDB BANCO BMG S.A - Venc.: 2026-06-10 46.202,04	2.163,01
10/06/2026 VENCIMENTO - CDB BANCO BMG S.A - Venc.: 2026- 103.651,04	57.449,00
11/06/2026 ENVIO TRANSFERÊNCIA - Rachel Rocha Dos Reis Villa -0,05	103.651,09
11/06/2026 CONTA REMUNERADA - RESGATE REMUNERAÇÃO - 0,00	0,05
12/06/2026 RECEBIMENTO TRANSFERÊNCIA - Itamar Alexandre 215.000,00	215.000,00
12/06/2026 ENVIO TRANSFERÊNCIA - Itamar Alexandre Felix Villa 0,00	215.000,00
12/06/2026
Total de Créditos
511.452,58
523.115,22
Total de Débitos
0,00	Saldo Final
`;
    const rows = parseBtgPdfExtratoText(bloco);
    const porDesc = (sub) => rows.filter((r) => String(r.descricao).includes(sub));

    // CUPOM e VENCIMENTO são CRÉDITOS nesta conta (positivos), não débitos.
    expect(porDesc('CUPOM')[0]?.valor).toBeCloseTo(48365.05, 2);
    expect(porDesc('VENCIMENTO')[0]?.valor).toBeCloseTo(57449.0, 2);
    expect(porDesc('TRANSFERÊNCIA A CRÉDITO VIA PIX')[0]?.valor).toBeCloseTo(53000.0, 2);

    // Últimos movimentos: recebe 215 mil e envia 215 mil (líquido zero).
    expect(porDesc('RECEBIMENTO TRANSFERÊNCIA')[0]?.valor).toBeCloseTo(215000.0, 2);
    const envios12 = rows.filter((r) => r.data === '12/06/2026' && String(r.descricao).includes('ENVIO'));
    expect(envios12[0]?.valor).toBeCloseTo(-215000.0, 2);

    // Nenhum valor fantasma vindo de totais/saldo final.
    const proibidos = [523115.22, 511452.58, 215000000, 15044745.73];
    for (const p of proibidos) {
      expect(rows.some((r) => Math.abs(Number(r.valor) - p) < 0.01)).toBe(false);
    }
    expect(rows.some((r) => /total|saldo\s+final/i.test(String(r.descricao)))).toBe(false);

    // Sinais de débito conhecidos preservados.
    expect(porDesc('IRRF')[0]?.valor).toBeCloseTo(-2163.01, 2);
    expect(porDesc('IOF')[0]?.valor).toBeCloseTo(-5.55, 2);
  });

  it('layout real do pdf.js: data colada ao "Saldo Inicial", saldo na última coluna e números colados', () => {
    // Reproduz exatamente a extração do app (pdf.js): data grudada em "Saldo Inicial",
    // cabeçalho "Débito CréditoSaldo" (saldo por último) e amount+saldo grudados ("48.365,0548.365,05").
    // Cadeia CONTÍGUA a partir do saldo inicial 0,00 (a reconstrução é por variação de saldo).
    const bloco = `
Movimentação - Conta Corrente
Data Descrição Débito CréditoSaldo
01/06/2026Saldo Inicial 0,00
10/06/2026 CUPOM - CDB BANCO BMG S.A - Venc.: 2026-06-10 48.365,0548.365,05
10/06/2026 IRRF - CDB BANCO BMG S.A - Venc.: 2026-06-10 2.163,0146.202,04
10/06/2026 VENCIMENTO - CDB BANCO BMG S.A - Venc.: 2026- 57.449,00103.651,04
11/06/2026 ENVIO TRANSFERÊNCIA - Rachel Rocha Dos Reis Villa 103.651,09-0,05
12/06/2026 JUROS SOBRE SALDO NEGATIVO - BANCO BTG 11,16-11,21
12/06/2026 IOF SOBRE SALDO NEGATIVO - BANCO BTG PACTUAL 5,55-16,76
12/06/2026Saldo Final-16,76
Total de Créditos511.452,58
Total de Débitos523.115,22
`;
    const rows = parseBtgPdfExtratoText(bloco);
    const v = (sub) => rows.find((r) => String(r.descricao).includes(sub))?.valor;

    // CUPOM e VENCIMENTO são créditos (positivos), sem depender de palavra-chave.
    expect(v('CUPOM')).toBeCloseTo(48365.05, 2);
    expect(v('VENCIMENTO')).toBeCloseTo(57449.0, 2);
    // Débitos saem negativos (inclusive saldo negativo grudado "...-0,05" / "...-16,76").
    expect(v('IRRF')).toBeCloseTo(-2163.01, 2);
    expect(v('ENVIO TRANSFERÊNCIA')).toBeCloseTo(-103651.09, 2);
    expect(v('JUROS SOBRE SALDO')).toBeCloseTo(-11.16, 2);
    expect(v('IOF SOBRE SALDO')).toBeCloseTo(-5.55, 2);

    // A cadeia fecha no saldo final do extrato.
    const soma = rows.reduce((a, r) => a + Number(r.valor), 0);
    expect(soma).toBeCloseTo(-16.76, 2);

    // Nada de rodapé/totais virando lançamento.
    for (const p of [511452.58, 523115.22]) {
      expect(rows.some((r) => Math.abs(Number(r.valor) - p) < 0.01)).toBe(false);
    }
    expect(rows.some((r) => /total|saldo\s+(inicial|final)/i.test(String(r.descricao)))).toBe(false);
  });

  it('mescla linha seguinte quando o pdf.js coloca só os valores na linha de baixo', () => {
    const bloco = `
05/01/2026 TED ENVIADA - Itamar Alexandre Felix Villa Real
1.234,56 0,00 5.678,90
06/01/2026 TRANSFERÊNCIA A CRÉDITO VIA PIX - ITAMAR
0,00 2.500,00 8.178,90
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(2);
    expect(rows[0].valor).toBeCloseTo(-1234.56, 2);
    expect(rows[1].valor).toBeCloseTo(2500, 2);
    expect(rows[0].descricao).toContain('TED ENVIADA');
    expect(rows[1].descricao).toContain('TRANSFERÊNCIA A CRÉDITO');
  });
});
