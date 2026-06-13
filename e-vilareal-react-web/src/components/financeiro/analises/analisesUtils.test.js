import { describe, expect, it } from 'vitest';
import { pctClassificado } from './analisesUtils.js';

describe('pctClassificado', () => {
  it('calcula percentual arredondado', () => {
    expect(pctClassificado(100, 25)).toBe(75);
    expect(pctClassificado(0, 0)).toBe(0);
  });
});
