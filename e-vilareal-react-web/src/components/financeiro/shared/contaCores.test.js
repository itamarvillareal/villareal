import { describe, expect, it } from 'vitest';
import { varsCorConta } from './contaCores.js';

describe('varsCorConta', () => {
  it('mapeia letra para variáveis CSS do token', () => {
    expect(varsCorConta('E')).toEqual({
      '--fin-btn-conta-bg': 'var(--fin-conta-e, var(--fin-conta-n))',
      '--fin-borda-conta': 'var(--fin-conta-e, var(--fin-conta-n))',
    });
  });

  it('fallback para N quando vazio', () => {
    expect(varsCorConta('')).toEqual({
      '--fin-btn-conta-bg': 'var(--fin-conta-n, var(--fin-conta-n))',
      '--fin-borda-conta': 'var(--fin-conta-n, var(--fin-conta-n))',
    });
  });
});
