import { describe, it, expect } from 'vitest';
import {
  ajustarPartesPublicacaoUi,
  textosPartesFromListaPartesApi,
} from './partesLadoEscritorio.js';

describe('partesLadoEscritorio', () => {
  it('REQUERIDO: parte cliente no polo jurídico REU (Lana ré, Randerson oposta)', () => {
    const partes = [
      { polo: 'REU', qualificacao: 'Parte cliente', nomeExibicao: 'LANA RAIANE MARÇAL MONTALVÃO' },
      { polo: 'AUTOR', qualificacao: 'Parte oposta', nomeExibicao: 'RANDERSON AGUIAR PEREIRA' },
    ];
    const { parteCliente, parteOposta } = textosPartesFromListaPartesApi(partes, 'requerido');
    expect(parteCliente).toContain('LANA');
    expect(parteOposta).toContain('RANDERSON');
  });

  it('REQUERIDO + import invertido: marcador endereco fora do REU → parte cliente = marcador', () => {
    const partes = [
      { polo: 'AUTOR', qualificacao: 'endereco:1', nomeExibicao: 'LANA RAIANE MARÇAL MONTALVÃO' },
      { polo: 'REU', nomeExibicao: 'RANDERSON AGUIAR PEREIRA' },
    ];
    const { parteCliente, parteOposta } = textosPartesFromListaPartesApi(partes, 'requerido');
    expect(parteCliente).toContain('LANA');
    expect(parteOposta).toContain('RANDERSON');
  });

  it('REQUERIDO padrão: parte cliente agregada do polo REU', () => {
    const partes = [
      { polo: 'AUTOR', nomeExibicao: 'FRANCISCO CESAR DA SILVA' },
      { polo: 'REU', nomeExibicao: 'ROBERTO SOARES DAS CHAGAS' },
    ];
    const { parteCliente, parteOposta } = textosPartesFromListaPartesApi(partes, 'requerido');
    expect(parteCliente).toContain('ROBERTO');
    expect(parteOposta).toContain('FRANCISCO');
  });

  it('ajustarPartesPublicacaoUi: pelo Requerido, parte cliente (Lana) antes da oposta', () => {
    const ui = {
      statusVinculo: 'vinculado',
      papelParte: 'requerido',
      parteCliente: 'RANDERSON AGUIAR PEREIRA',
      parteOposta: 'LANA RAIANE MARÇAL MONTALVÃO',
      reu: 'LANA RAIANE MARÇAL MONTALVÃO',
      jsonCnjBruto: JSON.stringify({
        projudi: {
          parteAutor: 'LANA RAIANE MARÇAL MONTALVÃO',
          parteReu: 'RANDERSON AGUIAR PEREIRA',
        },
      }),
    };
    const out = ajustarPartesPublicacaoUi(ui);
    expect(out.parteCliente).toContain('LANA');
    expect(out.parteOposta).toContain('RANDERSON');
    expect(out.papelParte).toBe('requerido');
  });
});
