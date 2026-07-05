import { describe, expect, it } from 'vitest';
import { parseLembreteAudienciaParamProcesso } from './lembreteAudienciaUtils.js';

describe('parseLembreteAudienciaParamProcesso', () => {
  it('extrai cliente e parte autora do param processo', () => {
    const parsed = parseLembreteAudienciaParamProcesso(
      '5009686-73.2026.8.09.0007 — Cliente: Condomínio Solar; Parte autora: João Silva',
    );
    expect(parsed.numeroProcesso).toBe('5009686-73.2026.8.09.0007');
    expect(parsed.parteCliente).toBe('Condomínio Solar');
    expect(parsed.parteAutora).toBe('João Silva');
  });

  it('aceita formato legado só com CNJ', () => {
    const parsed = parseLembreteAudienciaParamProcesso('5009686-73.2026.8.09.0007');
    expect(parsed.numeroProcesso).toBe('5009686-73.2026.8.09.0007');
    expect(parsed.parteCliente).toBeNull();
    expect(parsed.parteAutora).toBeNull();
  });
});
