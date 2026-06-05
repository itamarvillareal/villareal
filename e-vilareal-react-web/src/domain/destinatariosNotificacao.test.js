import { describe, expect, it } from 'vitest';
import {
  copiarDestinatariosCanais,
  isEmailValido,
  normalizarDestinatariosParaSalvar,
  normalizarEmail,
  normalizarWhatsappE164,
  validarDestinatariosAntesSalvar,
} from './destinatariosNotificacao.js';

describe('destinatariosNotificacao', () => {
  it('normalizarWhatsappE164 aceita formatos comuns', () => {
    expect(normalizarWhatsappE164('+55 62 98876-5432')).toBe('+5562988765432');
    expect(normalizarWhatsappE164('(62) 98876-5432')).toBe('+5562988765432');
  });

  it('normalizarWhatsappE164 rejeita número curto', () => {
    expect(normalizarWhatsappE164('62999')).toBeNull();
  });

  it('normalizarEmail lowercase', () => {
    expect(normalizarEmail('  Escritorio@VilaReal.COM ')).toBe('escritorio@vilareal.com');
    expect(isEmailValido('nao-email')).toBe(false);
  });

  it('normalizarDestinatariosParaSalvar deduplica', () => {
    const r = normalizarDestinatariosParaSalvar({
      whatsapp: ['62988765432', '+5562988765432'],
      email: ['a@b.com', 'A@B.COM'],
    });
    expect(r.whatsapp).toEqual(['+5562988765432']);
    expect(r.email).toEqual(['a@b.com']);
  });

  it('validarDestinatariosAntesSalvar detecta inválidos', () => {
    const { ok, erros } = validarDestinatariosAntesSalvar({
      whatsapp: ['123'],
      email: ['x'],
    });
    expect(ok).toBe(false);
    expect(erros.length).toBeGreaterThan(0);
  });

  it('copiarDestinatariosCanais tolera ausência', () => {
    expect(copiarDestinatariosCanais(null)).toEqual({ whatsapp: [], email: [] });
  });
});
