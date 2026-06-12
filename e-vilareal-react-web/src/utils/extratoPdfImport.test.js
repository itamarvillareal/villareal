import { describe, expect, it } from 'vitest';
import { mensagemFalhaExtratoPdf, parseExtratoPdfText } from './extratoPdfImport.js';

const EXTRATO_BTG_VAZIO = `
Olá Itamar!
Extrato de conta corrente 12/06/2026 12h06
Período do extrato: 01/01/2020 a 01/01/2023
Lançamentos: Saldo final R$ 0,00
`;

describe('mensagemFalhaExtratoPdf', () => {
  it('identifica extrato BTG sem lançamentos no período', () => {
    const msg = mensagemFalhaExtratoPdf(EXTRATO_BTG_VAZIO, 'BTG');
    expect(msg).toContain('01/01/2020');
    expect(msg).toContain('01/01/2023');
    expect(msg).toContain('saldo final R$ 0,00');
  });
});

describe('parseExtratoPdfText BTG', () => {
  it('interpreta valores com prefixo R$', () => {
    const bloco = `
10/03/2026 RECEBIMENTO TRANSFERÊNCIA R$ 0,00 R$ 1.234,56 R$ 1.234,56
`;
    const rows = parseExtratoPdfText(bloco, 'BTG');
    expect(rows.length).toBe(1);
    expect(rows[0].valor).toBeCloseTo(1234.56, 2);
  });

  it('não gera lançamento para extrato vazio do BTG', () => {
    expect(parseExtratoPdfText(EXTRATO_BTG_VAZIO, 'BTG')).toEqual([]);
  });
});
