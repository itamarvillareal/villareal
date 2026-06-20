import { describe, expect, it } from 'vitest';
import { filtrarParesCompensacao, mapLancamentoInbox, parPassaFiltrosCompensacao } from './inboxMappers.js';

const par = (tipo, dataA, dataB) => ({
  tipo,
  lancamentoA: { dataLancamento: dataA },
  lancamentoB: { dataLancamento: dataB },
});

describe('mapLancamentoInbox', () => {
  it('marca lançamento de cartão do inbox para deep link no extrato de cartão', () => {
    const row = mapLancamentoInbox({
      id: 16906,
      dataLancamento: '2026-12-30',
      dataCompetencia: '2026-01-10',
      descricao: 'Doce Delicia (3/3)',
      bancoNome: 'BTG Cartão',
      numeroBanco: 20,
      valor: 25,
      natureza: 'DEBITO',
      contaContabilNome: 'Conta Pessoal',
      origem: 'FATURA_XLSX_BTG',
    });
    expect(row.origemExtrato).toBe('cartao');
    expect(row.numeroCartao).toBe(20);
    expect(row.dataExibicao).toBe('30/12/2025');
  });
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
