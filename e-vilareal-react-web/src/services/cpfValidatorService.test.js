import { describe, it, expect } from 'vitest';
import {
  validateCPF,
  validateCNPJ,
  validarFormatarCpfCnpjAoSair,
} from './cpfValidatorService.js';

describe('validateCPF', () => {
  it('aceita CPF válido e normaliza', () => {
    const r = validateCPF('52998224725');
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe('529.982.247-25');
  });

  it('rejeita sequência repetida', () => {
    expect(validateCPF('11111111111').valido).toBe(false);
  });
});

describe('validateCNPJ', () => {
  it('aceita CNPJ válido e normaliza', () => {
    const r = validateCNPJ('04252011000110');
    expect(r.valido).toBe(true);
    expect(r.normalizado).toBe('04.252.011/0001-10');
  });

  it('rejeita dígitos errados', () => {
    expect(validateCNPJ('04252011000111').valido).toBe(false);
  });
});

describe('validarFormatarCpfCnpjAoSair', () => {
  it('sem dígitos preserva texto', () => {
    const r = validarFormatarCpfCnpjAoSair('—');
    expect(r.ok).toBe(true);
    expect(r.valor).toBe('—');
    expect(r.aviso).toBeNull();
  });

  it('formata CPF ao sair', () => {
    const r = validarFormatarCpfCnpjAoSair('02266290150');
    expect(r.ok).toBe(true);
    expect(r.valor).toBe('022.662.901-50');
    expect(r.aviso).toBeNull();
  });

  it('avisa CPF inválido', () => {
    const r = validarFormatarCpfCnpjAoSair('02266290151');
    expect(r.ok).toBe(false);
    expect(r.aviso).toMatch(/CPF inválido/i);
  });
});
