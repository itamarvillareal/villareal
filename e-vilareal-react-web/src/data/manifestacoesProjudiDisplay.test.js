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

  it('vinculado requerido: réu primeiro (parte cliente do escritório)', () => {
    const row = {
      statusVinculo: 'vinculado',
      papelParte: 'requerido',
      parteCliente: 'ROBERTO SOARES DAS CHAGAS e ROBERTO SOARES DAS CHAGAS I ME',
      reu: 'FRANCISCO CESAR DA SILVA',
      parteOposta: 'FRANCISCO CESAR DA SILVA',
    };
    expect(formatarPartesLinha(row)).toBe(
      'ROBERTO SOARES DAS CHAGAS e ROBERTO SOARES DAS CHAGAS I ME × FRANCISCO CESAR DA SILVA'
    );
  });
});
