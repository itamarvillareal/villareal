import { describe, expect, it } from 'vitest';
import {
  extrairPanelConfig,
  listarChavesRodadasClienteProc,
  propagarPanelConfigEmRodadas,
} from './calculosPanelConfigSync.js';

describe('calculosPanelConfigSync', () => {
  it('propaga panelConfig para todas as dimensões do mesmo proc.', () => {
    const map = {
      '00000491:418:0': { titulos: [], panelConfig: { juros: '1 %', multa: '0 %', indice: 'INPC' } },
      '00000491:418:1': { titulos: [], panelConfig: { juros: '2 %', multa: '0 %', indice: 'IPCA' } },
      '00000491:419:0': { titulos: [], panelConfig: { juros: '3 %', multa: '0 %', indice: 'INPC' } },
    };
    const chaves = listarChavesRodadasClienteProc(map, '491', 418);
    expect(chaves.sort()).toEqual(['00000491:418:0', '00000491:418:1']);

    const { nextMap, chavesAlteradas } = propagarPanelConfigEmRodadas(map, chaves, {
      juros: '1,5 %',
      multa: '2 %',
      indice: 'INPC',
    });
    expect(chavesAlteradas.sort()).toEqual(['00000491:418:0', '00000491:418:1']);
    expect(nextMap['00000491:418:0'].panelConfig.juros).toBe('1,5 %');
    expect(nextMap['00000491:418:1'].panelConfig.juros).toBe('1,5 %');
    expect(nextMap['00000491:418:1'].panelConfig.indice).toBe('INPC');
    expect(nextMap['00000491:419:0'].panelConfig.juros).toBe('3 %');
  });

  it('extrairPanelConfig ignora campos fora do painel', () => {
    const p = extrairPanelConfig({ juros: '1 %', regraInicioCobrancaDias: 61, foo: 'bar' });
    expect(p.juros).toBe('1 %');
    expect(p.foo).toBeUndefined();
  });
});
