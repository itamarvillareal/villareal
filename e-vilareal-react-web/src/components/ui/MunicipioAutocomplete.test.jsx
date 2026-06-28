import { describe, expect, it } from 'vitest';
import { formatMunicipioLabel } from './MunicipioAutocomplete.jsx';

describe('formatMunicipioLabel', () => {
  it('inclui UF no rótulo', () => {
    expect(formatMunicipioLabel({ nome: 'Anápolis', uf: 'GO' })).toBe('Anápolis (GO)');
  });
});
