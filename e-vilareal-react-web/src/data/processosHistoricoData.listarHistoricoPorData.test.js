import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateProcessosHistoricoStoreCache,
  listarHistoricoPorData,
} from './processosHistoricoData.js';

const STORAGE_KEY = 'vilareal:processos-historico:v1';

function mockLocalStorage() {
  const bag = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
  });
  vi.stubGlobal('window', { localStorage: globalThis.localStorage });
}

describe('listarHistoricoPorData', () => {
  beforeEach(() => {
    mockLocalStorage();
    localStorage.setItem('vilareal:demo-persistence:schema', '3');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        '00000927:8': {
          codCliente: '927',
          proc: '8',
          historico: [{ id: 1, info: 'Atualização 927', data: '15/05/2026', numero: '2' }],
        },
        '00000922:6': {
          codCliente: '922',
          proc: '6',
          historico: [{ id: 2, info: 'teste', data: '15/5/2026', numero: '1' }],
        },
      }),
    );
    invalidateProcessosHistoricoStoreCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateProcessosHistoricoStoreCache();
  });

  it('retorna todas as linhas de histórico na data, com datas normalizadas', () => {
    const itens = listarHistoricoPorData('15/05/2026');
    expect(itens).toHaveLength(2);
    const procs = itens.map((i) => `${i.codCliente}/${i.proc}`);
    expect(procs).toContain('00000927/8');
    expect(procs).toContain('00000922/6');
  });

  it('ignora linhas sem texto de informação', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        '00000001:1': {
          codCliente: '1',
          proc: '1',
          historico: [{ id: 3, info: '', data: '15/05/2026', numero: '1' }],
        },
      }),
    );
    invalidateProcessosHistoricoStoreCache();
    expect(listarHistoricoPorData('15/05/2026')).toHaveLength(0);
  });
});
