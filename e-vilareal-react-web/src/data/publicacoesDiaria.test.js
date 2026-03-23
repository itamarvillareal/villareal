import { describe, it, expect } from 'vitest';
import { agruparPublicacoesPorDia, chaveOrdenacaoDia } from './publicacoesDiaria.js';

describe('publicacoesDiaria', () => {
  it('agrupa por data de publicação e ordena dias (mais recente primeiro)', () => {
    const itens = [
      { id: '1', dataPublicacao: '18/03/2026', dataDisponibilizacao: '17/03/2026', numeroCnj: 'A' },
      { id: '2', dataPublicacao: '20/03/2026', dataDisponibilizacao: '19/03/2026', numeroCnj: 'B' },
      { id: '3', dataPublicacao: '20/03/2026', dataDisponibilizacao: '19/03/2026', numeroCnj: 'C' },
    ];
    const g = agruparPublicacoesPorDia(itens, 'publicacao');
    expect(g.length).toBe(2);
    expect(g[0].dia).toBe('20/03/2026');
    expect(g[0].total).toBe(2);
    expect(g[1].dia).toBe('18/03/2026');
    expect(chaveOrdenacaoDia('20/03/2026')).toBe('2026-03-20');
  });

  it('agrupa por data de disponibilização quando solicitado', () => {
    const itens = [
      { id: '1', dataPublicacao: '20/03/2026', dataDisponibilizacao: '19/03/2026' },
      { id: '2', dataPublicacao: '21/03/2026', dataDisponibilizacao: '19/03/2026' },
    ];
    const g = agruparPublicacoesPorDia(itens, 'disponibilizacao');
    expect(g.length).toBe(1);
    expect(g[0].total).toBe(2);
    expect(g[0].dia).toBe('19/03/2026');
  });
});
