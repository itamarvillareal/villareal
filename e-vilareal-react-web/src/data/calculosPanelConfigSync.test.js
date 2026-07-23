import { describe, expect, it } from 'vitest';
import {
  extrairPanelConfig,
  listarChavesRodadasClienteProc,
  propagarPanelConfigEmRodadas,
  resolverPanelConfigAoMesclarRodadaApi,
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

  it('resolverPanelConfigAoMesclarRodadaApi preserva edição local divergente do GET', () => {
    const merged = resolverPanelConfigAoMesclarRodadaApi(
      { juros: '2 %', multa: '1 %', indice: 'INPC' },
      { juros: '1 %', multa: '0 %', indice: 'INPC' },
    );
    expect(merged.juros).toBe('2 %');
    expect(merged.multa).toBe('1 %');
  });

  it('resolverPanelConfigAoMesclarRodadaApi usa API quando não há local', () => {
    const merged = resolverPanelConfigAoMesclarRodadaApi(undefined, {
      juros: '1,5 %',
      multa: '2 %',
      indice: 'IPCA',
    });
    expect(merged.juros).toBe('1,5 %');
    expect(merged.indice).toBe('IPCA');
  });

  it('resolverPanelConfigAoMesclarRodadaApi preserva local quando API manda null', () => {
    const merged = resolverPanelConfigAoMesclarRodadaApi(
      { juros: '2 %', multa: '2 %', honorariosValor: '20 %' },
      null,
    );
    expect(merged.juros).toBe('2 %');
    expect(merged.multa).toBe('2 %');
    expect(merged.honorariosValor).toBe('20 %');
  });
});
