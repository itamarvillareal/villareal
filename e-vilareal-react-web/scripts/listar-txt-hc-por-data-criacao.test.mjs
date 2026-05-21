import { describe, expect, it } from 'vitest';
import {
  arquivoCriadoNoDia,
  intervaloDiaLocal,
  parseDataArg,
} from './listar-txt-hc-por-data-criacao.mjs';

describe('listar-txt-hc-por-data-criacao', () => {
  it('parseDataArg aceita DD/MM/AAAA e ISO', () => {
    expect(parseDataArg('25/05/2022')).toEqual({ dia: 25, mes: 5, ano: 2022 });
    expect(parseDataArg('2022-05-25')).toEqual({ dia: 25, mes: 5, ano: 2022 });
  });

  it('intervaloDiaLocal cobre o dia inteiro', () => {
    const { inicio, fim } = intervaloDiaLocal({ dia: 25, mes: 5, ano: 2022 });
    expect(inicio.getFullYear()).toBe(2022);
    expect(fim.getTime() - inicio.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('arquivoCriadoNoDia usa birthtime por padrão', () => {
    const { inicio, fim } = intervaloDiaLocal({ dia: 25, mes: 5, ano: 2022 });
    const dentro = new Date(2022, 4, 25, 12, 0, 0);
    const fora = new Date(2022, 4, 26, 0, 0, 0);
    const stDentro = { birthtime: dentro, birthtimeMs: dentro.getTime(), mtime: dentro, mtimeMs: dentro.getTime() };
    const stFora = { birthtime: fora, birthtimeMs: fora.getTime(), mtime: fora, mtimeMs: fora.getTime() };
    expect(arquivoCriadoNoDia(stDentro, inicio, fim, false)).toBe(true);
    expect(arquivoCriadoNoDia(stFora, inicio, fim, false)).toBe(false);
  });
});
