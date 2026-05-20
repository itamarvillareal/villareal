import { describe, expect, it } from 'vitest';
import { filtrarParesCompensacao, parPassaFiltrosCompensacao } from './inboxMappers.js';

const par = (tipo, dataA, dataB) => ({
  tipo,
  lancamentoA: { dataLancamento: dataA },
  lancamentoB: { dataLancamento: dataB },
});

describe('parPassaFiltrosCompensacao', () => {
  it('mesmo dia exato exclui datas diferentes', () => {
    expect(
      parPassaFiltrosCompensacao(par('INTERBANCARIO', '2025-05-09', '2025-05-12'), {
        tipoPar: 'INTERBANCARIO',
        tipoDia: 'MESMO_DIA',
      }),
    ).toBe(false);
  });

  it('mesmo dia exato mantém datas iguais', () => {
    expect(
      parPassaFiltrosCompensacao(par('INTERBANCARIO', '2025-05-28', '2025-05-28'), {
        tipoPar: 'INTERBANCARIO',
        tipoDia: 'MESMO_DIA',
      }),
    ).toBe(true);
  });

  it('filtrarParesCompensacao respeita período (ano)', () => {
    const lista = [
      par('INTERBANCARIO', '2024-05-28', '2024-05-28'),
      par('INTERBANCARIO', '2023-05-28', '2023-05-28'),
    ];
    const out = filtrarParesCompensacao(lista, {
      tipoPar: 'TODOS',
      tipoDia: 'TODOS',
      periodo: '2024',
    });
    expect(out).toHaveLength(1);
    expect(out[0].lancamentoA.dataLancamento).toBe('2024-05-28');
  });

  it('filtrarParesCompensacao aplica ambos os filtros', () => {
    const lista = [
      par('INTERBANCARIO', '2025-05-28', '2025-05-28'),
      par('INTERBANCARIO', '2025-05-09', '2025-05-12'),
      par('MESMO_BANCO', '2025-05-28', '2025-05-28'),
    ];
    const out = filtrarParesCompensacao(lista, {
      tipoPar: 'INTERBANCARIO',
      tipoDia: 'MESMO_DIA',
    });
    expect(out).toHaveLength(1);
    expect(out[0].lancamentoA.dataLancamento).toBe('2025-05-28');
  });
});
