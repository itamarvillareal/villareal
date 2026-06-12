import { describe, expect, it } from 'vitest';
import {
  isInstituicaoBradescoExtratoPdf,
  parseBradescoPdfExtratoText,
  textoPareceExtratoBradescoCelular,
} from './bradescoPdfExtrato.js';

const AMOSTRA_BRADESCO = `
Bradesco Celular
Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)
11/04/2025 COD. LANC. 0 0,00 0,00
PIX RECEBIDO
16/04/2025 1025347 5.000,00 5.000,00
REM: ITAMAR ALEXANDRE F V 16/04
PIX ENVIADO
0945080 5.000,00 0,00
DES: ITAMAR ALEXANDRE F V 16/04
PIX RECEBIDO
24/04/2025 1347368 3.000,00 3.000,00
SAQUE DINHEIRO ATM
2385053 1.250,00 1.750,00
Ag03755maq062385seq0805324041342
TED-TRANSF ELET DISPON
11/08/2025 6321000 18.594,82 18.594,82
DEP DINHEIRO ATM
5285474 3.000,00 21.594,82
PIX ENVIADO
1717368 18.564,82 30,00
DEVOLUCAO PIX
1632338 10,00 300,00
Total 119.530,82 119.530,82 0,00
`;

describe('isInstituicaoBradescoExtratoPdf', () => {
  it('identifica Bradesco e Poupança Bradesco', () => {
    expect(isInstituicaoBradescoExtratoPdf('Bradesco')).toBe(true);
    expect(isInstituicaoBradescoExtratoPdf('Poupança Bradesco')).toBe(true);
    expect(isInstituicaoBradescoExtratoPdf('Itaú')).toBe(false);
  });
});

describe('textoPareceExtratoBradescoCelular', () => {
  it('detecta layout Bradesco Celular', () => {
    expect(textoPareceExtratoBradescoCelular(AMOSTRA_BRADESCO)).toBe(true);
  });
});

describe('parseBradescoPdfExtratoText', () => {
  it('extrai créditos, débitos e saques do extrato Bradesco Celular', () => {
    const rows = parseBradescoPdfExtratoText(AMOSTRA_BRADESCO);
    expect(rows.length).toBeGreaterThanOrEqual(8);

    const pixRecebido = rows.find((r) => r.data === '16/04/2025' && r.valor === 5000);
    expect(pixRecebido?.descricao).toMatch(/PIX RECEBIDO/i);

    const pixEnviado = rows.find((r) => r.numero.includes('0945080') || (r.valor === -5000 && r.data === '16/04/2025'));
    expect(pixEnviado?.valor).toBe(-5000);

    const saque = rows.find((r) => r.valor === -1250 && r.data === '24/04/2025');
    expect(saque?.descricao).toMatch(/SAQUE/i);

    const ted = rows.find((r) => r.data === '11/08/2025' && r.valor === 18594.82);
    expect(ted?.descricao).toMatch(/TED/i);

    const devolucao = rows.find((r) => r.valor === 10);
    expect(devolucao?.descricao).toMatch(/DEVOLUCAO/i);

    expect(rows.some((r) => String(r.descricaoDetalhada).includes('REM:'))).toBe(true);
    expect(rows.every((r) => String(r.numero).startsWith('BRAD-PDF-'))).toBe(true);
  });

  it('ignora saldo de abertura e linha Total', () => {
    const rows = parseBradescoPdfExtratoText(AMOSTRA_BRADESCO);
    expect(rows.some((r) => /COD\. LANC/i.test(String(r.descricao)))).toBe(false);
    expect(rows.some((r) => Math.abs(Number(r.valor)) === 119530.82)).toBe(false);
  });
});
