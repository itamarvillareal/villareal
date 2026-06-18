import { describe, expect, it } from 'vitest';
import {
  UPLOAD_P7S_LIMITE_BYTES,
  formatBytesCompact,
  validarTamanhoLoteP7s,
} from './uploadP7sLimits.js';

describe('uploadP7sLimits', () => {
  it('formatBytesCompact exibe MB', () => {
    expect(formatBytesCompact(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('validarTamanhoLoteP7s aceita lote dentro do limite', () => {
    const files = [{ size: 10 * 1024 * 1024 }, { size: 20 * 1024 * 1024 }];
    expect(validarTamanhoLoteP7s(files)).toBe('');
  });

  it('validarTamanhoLoteP7s rejeita lote acima de 250 MB', () => {
    const files = [{ size: UPLOAD_P7S_LIMITE_BYTES + 1 }];
    expect(validarTamanhoLoteP7s(files)).toMatch(/excede o limite/i);
  });
});
