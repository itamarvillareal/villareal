import { describe, it, expect } from 'vitest';
import { buscarHitIndiceCnjPorCnj } from './publicacoesVinculoProcessos.js';

describe('buscarHitIndiceCnjPorCnj', () => {
  it('encontra no cadastro após remover zeros à esquerda do 1º segmento', () => {
    const map = new Map();
    const cadastro = { codCliente: '00000766', proc: '8', cliente: 'X', reu: 'Y' };
    map.set('356280-15.2016.8.09.0006'.toUpperCase(), cadastro);

    const r = buscarHitIndiceCnjPorCnj(map, '0356280-15.2016.8.09.0006');
    expect(r?.hit).toEqual(cadastro);
    expect(r?.chaveUsada).toBe('356280-15.2016.8.09.0006');
  });

  it('aceita chave canônica de 7 dígitos quando é a que está no mapa', () => {
    const map = new Map();
    const cadastro = { codCliente: '1', proc: '1', cliente: 'Z', reu: '' };
    map.set('0356280-15.2016.8.09.0006', cadastro);
    expect(buscarHitIndiceCnjPorCnj(map, '0356280-15.2016.8.09.0006')?.hit).toEqual(cadastro);
  });

  it('remove mais de um zero inicial se necessário', () => {
    const map = new Map();
    const cadastro = { codCliente: '1', proc: '2', cliente: 'A', reu: '' };
    map.set('56280-15.2016.8.09.0006'.toUpperCase(), cadastro);
    const r = buscarHitIndiceCnjPorCnj(map, '0056280-15.2016.8.09.0006');
    expect(r?.hit).toEqual(cadastro);
    expect(r?.chaveUsada).toBe('56280-15.2016.8.09.0006');
  });
});
