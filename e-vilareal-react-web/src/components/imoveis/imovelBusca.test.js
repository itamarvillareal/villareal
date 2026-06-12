import { describe, expect, it } from 'vitest';
import { imovelCorrespondeBusca, textoCorrespondeBusca } from './imovelBusca.js';

describe('imovelCorrespondeBusca', () => {
  const imovel = {
    id: 41,
    numeroPlanilha: 56,
    condominio: 'Jardim Ana Paula',
    unidade: '',
    enderecoCompleto: 'Rua Pérola, loteamento Jardim Ana Paula, Anápolis',
  };

  it('encontra por condomínio com várias palavras', () => {
    expect(imovelCorrespondeBusca(imovel, 'ana paula')).toBe(true);
    expect(imovelCorrespondeBusca(imovel, 'Ana  Paula')).toBe(true);
  });

  it('encontra por endereço quando unidade vazia', () => {
    expect(imovelCorrespondeBusca({ ...imovel, condominio: '' }, 'jardim ana')).toBe(true);
  });

  it('encontra por número da planilha', () => {
    expect(imovelCorrespondeBusca(imovel, '56')).toBe(true);
  });

  it('ignora acentos na busca', () => {
    expect(textoCorrespondeBusca('Anápolis', 'anapolis')).toBe(true);
  });
});
