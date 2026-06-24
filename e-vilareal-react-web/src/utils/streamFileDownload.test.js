import { describe, expect, it } from 'vitest';
import { extrairFilenameDaResponse } from './streamFileDownload.js';

describe('extrairFilenameDaResponse', () => {
  it('lê filename do Content-Disposition', () => {
    const res = {
      headers: {
        get: (k) =>
          k === 'Content-Disposition' ? 'attachment; filename="lote-assinar.zip"' : null,
      },
    };
    expect(extrairFilenameDaResponse(res, 'fallback.zip')).toBe('lote-assinar.zip');
  });

  it('usa fallback quando header ausente', () => {
    const res = { headers: { get: () => null } };
    expect(extrairFilenameDaResponse(res, 'x.pdf')).toBe('x.pdf');
  });
});
