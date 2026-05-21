import { describe, expect, it } from 'vitest';
import { filtrarProcessosGradeCliente } from './buscaProcessosGradeCliente.js';

describe('filtrarProcessosGradeCliente', () => {
  const grade = [
    {
      procNumero: 12,
      processoNovo: '',
      parteOposta: 'DANIELA DOS SANTOS TAVARES',
      descricao: 'ADMINISTRAÇÃO DE IMÓVEL',
    },
    {
      procNumero: 5,
      processoNovo: '5711534-77.2024.8.09.0007',
      parteOposta: 'OUTRA PARTE',
      descricao: 'OUTRA AÇÃO',
    },
  ];

  it('sem termo devolve a lista inteira', () => {
    expect(filtrarProcessosGradeCliente(grade, '')).toHaveLength(2);
  });

  it('filtra por trecho da parte oposta como na grade de clientes', () => {
    expect(filtrarProcessosGradeCliente(grade, 'tavar')).toHaveLength(1);
    expect(filtrarProcessosGradeCliente(grade, 'tavar')[0].procNumero).toBe(12);
  });

  it('sem parte oposta na grade o filtro por nome da ré não encontra (modal usa filtro vinculo após enriquecer)', () => {
    const semReu = [{ procNumero: 12, parteOposta: '', descricao: 'ADMINISTRAÇÃO DE IMÓVEL' }];
    expect(filtrarProcessosGradeCliente(semReu, 'tavares')).toHaveLength(0);
  });
});
