import { describe, expect, it } from 'vitest';
import { interpretarResultadoMonitoramento } from './monitoramentoProjudi.js';

describe('interpretarResultadoMonitoramento', () => {
  it('ERRO → banner', () => {
    expect(interpretarResultadoMonitoramento({ status: 'ERRO', erro: 'timeout' })).toEqual({
      erro: 'timeout',
      toast: null,
    });
  });

  it('PULADA_OCUPADO → toast de ocupado', () => {
    expect(interpretarResultadoMonitoramento({ status: 'PULADA_OCUPADO' })).toEqual({
      erro: null,
      toast: 'Consulta em andamento, tente em instantes',
    });
  });

  it('baseline → toast com totalListadas', () => {
    expect(
      interpretarResultadoMonitoramento({
        status: 'SUCESSO_SEM_NOVIDADE',
        baseline: true,
        totalListadas: 36,
        novas: 0,
      }),
    ).toEqual({
      erro: null,
      toast: 'Baseline registrado: 36 movimentações monitoradas a partir de agora',
    });
  });

  it('novas>0 → toast de novidade', () => {
    expect(
      interpretarResultadoMonitoramento({
        status: 'SUCESSO_COM_NOVIDADE',
        baseline: false,
        novas: 1,
      }),
    ).toEqual({
      erro: null,
      toast: '1 nova(s) movimentação(ões) detectada(s)',
    });
  });

  it('novas==0 sem baseline → sem novidade', () => {
    expect(
      interpretarResultadoMonitoramento({
        status: 'SUCESSO_SEM_NOVIDADE',
        baseline: false,
        novas: 0,
      }),
    ).toEqual({
      erro: null,
      toast: 'Nenhuma movimentação nova',
    });
  });
});
