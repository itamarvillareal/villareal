import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../scripts/import-real.mjs';

describe('import-real substituir historico', () => {
  it('dry-run não substitui historico por defeito', () => {
    const o = parseArgs(['--dry-run', '--cliente=938']);
    expect(o.substituirHistorico).toBe(false);
  });

  it('--aplicar mantém "apenas novos" por defeito (não substitui)', () => {
    const o = parseArgs(['--aplicar', '--cliente=938']);
    expect(o.substituirHistorico).toBe(false);
  });

  it('--substituir-historico liga a substituição explicitamente', () => {
    const o = parseArgs(['--aplicar', '--substituir-historico', '--cliente=938']);
    expect(o.substituirHistorico).toBe(true);
  });

  it('--apenas-novos-historico desliga substituir', () => {
    const o = parseArgs(['--aplicar', '--apenas-novos-historico', '--cliente=938']);
    expect(o.substituirHistorico).toBe(false);
  });

  it('--sem-calculos desliga importação de cálculos', () => {
    const o = parseArgs(['--aplicar', '--sem-calculos', '--cliente=938']);
    expect(o.semCalculos).toBe(true);
  });

  it('--sem-zerar desliga limpeza prévia na base', () => {
    const o = parseArgs(['--aplicar', '--sem-zerar', '--cliente=854']);
    expect(o.semZerar).toBe(true);
  });
});
