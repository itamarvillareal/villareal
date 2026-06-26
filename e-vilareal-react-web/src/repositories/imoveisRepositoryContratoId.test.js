import { describe, expect, it } from 'vitest';
import { alinharContratoIdAoImovel } from './imoveisRepository.js';

describe('alinharContratoIdAoImovel', () => {
  const contratosImovel60 = [
    { id: 101, status: 'VIGENTE', dataInicio: '2025-05-30', inquilinoPessoaId: 3113 },
    { id: 88, status: 'ENCERRADO', dataInicio: '2020-01-01', inquilinoPessoaId: 999 },
  ];

  it('mantém hint quando pertence ao imóvel', () => {
    expect(alinharContratoIdAoImovel(101, contratosImovel60)).toBe(101);
  });

  it('substitui hint de outro imóvel pelo contrato vigente', () => {
    expect(alinharContratoIdAoImovel(555, contratosImovel60)).toBe(101);
  });

  it('sem hint devolve vigente', () => {
    expect(alinharContratoIdAoImovel(null, contratosImovel60)).toBe(101);
  });

  it('lista vazia devolve null', () => {
    expect(alinharContratoIdAoImovel(101, [])).toBeNull();
  });
});
