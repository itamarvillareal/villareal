import { describe, expect, it } from 'vitest';
import { haystackBuscaPublicacaoUi } from './publicacoesRepository.js';

describe('haystackBuscaPublicacaoUi', () => {
  it('inclui parteAutor/parteReu do jsonReferencia Projudi', () => {
    const row = {
      numero_processo_cnj: '5917577.60',
      jsonCnjBruto: JSON.stringify({
        projudi: {
          parteAutor: 'ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR',
          parteReu: 'G S PRODUTOS ALIMENTICIOS LTDA',
        },
      }),
    };
    const h = haystackBuscaPublicacaoUi(row);
    expect(h).toContain('g s produtos alimenticios ltda');
    expect(h).toContain('itamar alexandre');
  });

  it('inclui partes do cadastro vinculado', () => {
    const row = {
      statusVinculo: 'vinculado',
      parteCliente: 'CONDOMINIO RESIDENCIAL TORRES',
      parteOposta: 'G S PRODUTOS ALIMENTICIOS LTDA',
    };
    expect(haystackBuscaPublicacaoUi(row)).toContain('g s produtos alimenticios ltda');
  });
});
