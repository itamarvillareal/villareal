import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  carregarSessaoRelatorioProcessos,
  limparSessaoRelatorioProcessos,
  salvarSessaoRelatorioProcessos,
} from './relatorioProcessosSessaoPersistencia.js';

function installSessionStorageMock() {
  const store = new Map();
  const sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  globalThis.sessionStorage = sessionStorage;
  globalThis.window = globalThis;
  return store;
}

describe('relatorioProcessosSessaoPersistencia', () => {
  beforeEach(() => {
    installSessionStorageMock();
    limparSessaoRelatorioProcessos();
  });

  afterEach(() => {
    limparSessaoRelatorioProcessos();
  });

  it('persiste e restaura emitido com baseRaw e ui', () => {
    salvarSessaoRelatorioProcessos({
      baseRaw: [{ codCliente: '00000001', proc: '1', cliente: 'TESTE' }],
      dados: [{ codCliente: '00000001', proc: '1', __relatorioIdx: 0 }],
      ui: { filtrosPorColuna: { unidade: '1201' }, ordenarPor: 'proc', ordemAsc: false },
    });

    const s = carregarSessaoRelatorioProcessos();
    expect(s.emitido).toBe(true);
    expect(s.baseRaw).toHaveLength(1);
    expect(s.dados).toHaveLength(1);
    expect(s.ui?.filtrosPorColuna?.unidade).toBe('1201');
    expect(s.ui?.ordenarPor).toBe('proc');
    expect(s.ui?.ordemAsc).toBe(false);
  });

  it('retorna emitido=false quando sessão vazia', () => {
    const s = carregarSessaoRelatorioProcessos();
    expect(s.emitido).toBe(false);
    expect(s.dados).toBeNull();
  });
});
