import { describe, expect, it } from 'vitest';
import { aplicarNonoDigitoCelular, normalizePhoneForApi } from './whatsappFormat.js';

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
