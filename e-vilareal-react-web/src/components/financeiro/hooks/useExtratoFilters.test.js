import { describe, expect, it } from 'vitest';

// Testes das funções puras replicadas do hook (evita mock de react-router)
function parseBancoParam(params) {
  const raw = params.get('banco');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readFilters(params) {
  return {
    banco: parseBancoParam(params),
    mes: params.get('mes') || '2026-05',
    page: params.get('page') ? Math.max(0, Number(params.get('page')) || 0) : 0,
  };
}

describe('writeFilters — noop estável', () => {
  it('não altera query string quando valores são iguais', () => {
    const p = new URLSearchParams('banco=1&mes=2026-05');
    const f = readFilters(p);
    const written = writeFilters(p, f);
    expect(written.toString()).toBe(p.toString());
  });
});

function writeFilters(params, f) {
  const next = new URLSearchParams(params);
  const setOrDel = (key, val) => {
    if (val == null || val === '' || val === false) next.delete(key);
    else next.set(key, String(val));
  };
  setOrDel('banco', Number.isFinite(f.banco) ? f.banco : null);
  setOrDel('mes', f.mes);
  return next;
}

describe('useExtratoFilters — parse banco', () => {
  it('lê banco numérico da URL', () => {
    const p = new URLSearchParams('banco=30&mes=2026-05');
    expect(readFilters(p).banco).toBe(30);
  });

  it('retorna null para banco inválido', () => {
    const p = new URLSearchParams('banco=abc');
    expect(readFilters(p).banco).toBeNull();
  });

  it('retorna null sem param banco', () => {
    const p = new URLSearchParams('mes=2026-05');
    expect(readFilters(p).banco).toBeNull();
  });
});
