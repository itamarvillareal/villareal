import { describe, it, expect } from 'vitest';
import { formatarPartesLinha } from './manifestacoesProjudiDisplay.js';

describe('formatarPartesLinha', () => {
  it('vinculado: não confunde titular/cliente contratante com parte cliente', () => {
    const row = {
      statusVinculo: 'vinculado',
      titularNome: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      cliente: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      parteCliente: '',
      reu: 'RANDERSON AGUIAR PEREIRA',
    };
    expect(formatarPartesLinha(row)).toBe('RANDERSON AGUIAR PEREIRA');
  });

  it('vinculado: parte cliente × parte oposta (não nome do cliente contratante)', () => {
    const row = {
      statusVinculo: 'vinculado',
      cliente: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      parteCliente: 'MARÍLIA GABRIELA',
      reu: 'RANDERSON AGUIAR PEREIRA',
    };
    expect(formatarPartesLinha(row)).toBe('MARÍLIA GABRIELA × RANDERSON AGUIAR PEREIRA');
  });
});
