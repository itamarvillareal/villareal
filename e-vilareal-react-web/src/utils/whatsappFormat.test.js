import { describe, expect, it } from 'vitest';
import {
  aplicarNonoDigitoCelular,
  normalizePhoneForApi,
  formatRelativeConversationTime,
  formatDateSeparator,
  diffDaysBR,
} from './whatsappFormat.js';

/** Meio-dia em Brasília no dia civil indicado (UTC-3). */
function brNoonUtc(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d, 15, 0, 0)).toISOString();
}

describe('normalizePhoneForApi (canônico — espelha backend)', () => {
  it('celular GO sem nono dígito insere 9', () => {
    expect(normalizePhoneForApi('556292975894')).toBe('5562992975894');
  });

  it('celular GO com nono dígito permanece', () => {
    expect(normalizePhoneForApi('5562992975894')).toBe('5562992975894');
  });

  it('fixo GO não ganha nono dígito', () => {
    expect(normalizePhoneForApi('556232179999')).toBe('556232179999');
  });

  it('com máscara celular', () => {
    expect(normalizePhoneForApi('5562 9 8234-5000')).toBe('5562982345000');
  });

  it('sem DDI celular sem 9', () => {
    expect(normalizePhoneForApi('6292975894')).toBe('5562992975894');
  });

  it('entrada inválida retorna melhor esforço sem quebrar', () => {
    expect(normalizePhoneForApi('999')).toBe('55999');
  });

  it('vazio retorna string vazia', () => {
    expect(normalizePhoneForApi('')).toBe('');
  });
});

describe('sufixo feed — legado 12 vs canônico 13 (documentação)', () => {
  function suffix11(phone) {
    const d = String(phone).replace(/\D/g, '');
    return d.length >= 11 ? d.slice(-11) : d;
  }

  it('RIGHT(11) e fallback RIGHT(10) NÃO unem 12↔13 do mesmo celular', () => {
    const legado12 = '556292975894';
    const canonico13 = '5562992975894';
    const suffixFrom13 = suffix11(canonico13);

    expect(suffix11(legado12)).toBe('56292975894');
    expect(suffixFrom13).toBe('62992975894');
    expect(suffix11(legado12)).not.toBe(suffixFrom13);

    const right10Legado = legado12.slice(-10);
    const right10FromSuffix13 = suffixFrom13.slice(-10);
    expect(right10Legado).toBe('6292975894');
    expect(right10FromSuffix13).toBe('2992975894');
    expect(right10Legado).not.toBe(right10FromSuffix13);
  });
});

describe('aplicarNonoDigitoCelular', () => {
  it('extrai DDD e local após 55', () => {
    expect(aplicarNonoDigitoCelular('556292975894')).toBe('5562992975894');
  });
});

describe('diffDaysBR', () => {
  const ref = brNoonUtc(2026, 7, 4);

  it('mesmo dia civil em Brasília → 0', () => {
    expect(diffDaysBR(brNoonUtc(2026, 7, 4), ref)).toBe(0);
  });

  it('ontem civil → -1', () => {
    expect(diffDaysBR(brNoonUtc(2026, 7, 3), ref)).toBe(-1);
  });

  it('limítrofe UTC madrugada: msg ainda é dia anterior em Brasília', () => {
    const msgUtcEarly = '2026-07-04T02:30:00.000Z';
    const refUtcMidnightBr = '2026-07-04T03:00:00.000Z';
    expect(diffDaysBR(msgUtcEarly, refUtcMidnightBr)).toBe(-1);
  });
});

describe('formatRelativeConversationTime', () => {
  const ref = brNoonUtc(2026, 7, 4);

  it('hoje → hora em Brasília', () => {
    const msg = '2026-07-04T20:18:00.000Z';
    expect(formatRelativeConversationTime(msg, ref)).toBe('17:18');
  });

  it('ontem → "Ontem"', () => {
    expect(formatRelativeConversationTime(brNoonUtc(2026, 7, 3), ref)).toBe('Ontem');
  });

  it('3 dias atrás → dia da semana capitalizado', () => {
    expect(formatRelativeConversationTime(brNoonUtc(2026, 7, 1), ref)).toBe('Quarta');
  });

  it('10 dias atrás → dd/MM/yy', () => {
    expect(formatRelativeConversationTime(brNoonUtc(2026, 6, 24), ref)).toBe('24/06/26');
  });

  it('virada de ano → dd/MM/yy', () => {
    const refJan = brNoonUtc(2026, 1, 5);
    expect(formatRelativeConversationTime(brNoonUtc(2025, 12, 20), refJan)).toBe('20/12/25');
  });

  it('limítrofe fuso: UTC madrugada conta como ontem, não hora de hoje', () => {
    const refNow = '2026-07-04T03:00:00.000Z';
    const msgYesterdayBr = '2026-07-04T02:30:00.000Z';
    expect(formatRelativeConversationTime(msgYesterdayBr, refNow)).toBe('Ontem');
  });
});

describe('formatDateSeparator', () => {
  const ref = brNoonUtc(2026, 7, 4);

  it('hoje → "Hoje"', () => {
    expect(formatDateSeparator(brNoonUtc(2026, 7, 4), ref)).toBe('Hoje');
  });

  it('ontem → "Ontem"', () => {
    expect(formatDateSeparator(brNoonUtc(2026, 7, 3), ref)).toBe('Ontem');
  });

  it('mesmo ano → "28 de junho"', () => {
    expect(formatDateSeparator(brNoonUtc(2026, 6, 28), ref)).toBe('28 de junho');
  });

  it('ano diferente → "28 de junho de 2025"', () => {
    expect(formatDateSeparator(brNoonUtc(2025, 6, 28), ref)).toBe('28 de junho de 2025');
  });
});
