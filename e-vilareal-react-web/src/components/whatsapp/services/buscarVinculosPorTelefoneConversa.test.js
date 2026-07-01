import { describe, expect, it } from 'vitest';
import { montarVinculosCodProc } from './buscarVinculosPorTelefoneConversa.js';

describe('montarVinculosCodProc', () => {
  it('deduplica e ordena pares código + proc.', () => {
    const rows = montarVinculosCodProc([
      { codCliente: '928', proc: '244', papeis: 'Réu' },
      { codCliente: '00000928', proc: 244, papeis: 'Réu duplicado' },
      { codCliente: '299', proc: '12', papeis: 'Cliente' },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ codigoCliente: '00000299', numeroInterno: 12, papeis: 'Cliente' });
    expect(rows[1]).toMatchObject({ codigoCliente: '00000928', numeroInterno: 244, papeis: 'Réu' });
  });

  it('ignora linhas sem proc. válido', () => {
    expect(montarVinculosCodProc([{ codCliente: '928', proc: '0' }])).toEqual([]);
    expect(montarVinculosCodProc([{ codCliente: '928', proc: '' }])).toEqual([]);
  });
});
