/** Validação e normalização alinhadas ao backend (NotificacaoDestinatarioValorValidator). */

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * @returns {{ whatsapp: string[], email: string[] }}
 */
export function destinatariosVazio() {
  return { whatsapp: [], email: [] };
}

/**
 * @param {unknown} dto
 * @returns {{ whatsapp: string[], email: string[] }}
 */
export function copiarDestinatariosCanais(dto) {
  return {
    whatsapp: Array.isArray(dto?.whatsapp) ? [...dto.whatsapp] : [],
    email: Array.isArray(dto?.email) ? [...dto.email] : [],
  };
}

/**
 * Normaliza para E.164 (+55…), ou null se inválido.
 * @param {string} input
 */
export function normalizarWhatsappE164(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) {
    digits = `55${digits.slice(1)}`;
  }
  if (!digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  if (digits.length !== 12 && digits.length !== 13) {
    return null;
  }
  return `+${digits}`;
}

/** @param {string} input */
export function isWhatsappE164Valido(input) {
  return normalizarWhatsappE164(input) != null;
}

/**
 * @param {string} input
 * @returns {string|null}
 */
export function normalizarEmail(input) {
  const email = String(input ?? '').trim().toLowerCase();
  if (!email || email.length > 255 || !EMAIL_RE.test(email)) {
    return null;
  }
  return email;
}

/** @param {string} input */
export function isEmailValido(input) {
  return normalizarEmail(input) != null;
}

/**
 * Normaliza listas (dedupe por valor normalizado).
 * @param {{ whatsapp?: string[], email?: string[] }} value
 */
export function normalizarDestinatariosParaSalvar(value) {
  const whatsapp = [];
  const vistosWa = new Set();
  for (const raw of value?.whatsapp ?? []) {
    const n = normalizarWhatsappE164(raw);
    if (n && !vistosWa.has(n)) {
      vistosWa.add(n);
      whatsapp.push(n);
    }
  }
  const email = [];
  const vistosEm = new Set();
  for (const raw of value?.email ?? []) {
    const n = normalizarEmail(raw);
    if (n && !vistosEm.has(n)) {
      vistosEm.add(n);
      email.push(n);
    }
  }
  return { whatsapp, email };
}

/**
 * @param {{ whatsapp?: string[], email?: string[] }} value
 * @returns {{ ok: boolean, erros: string[] }}
 */
export function validarDestinatariosAntesSalvar(value) {
  const erros = [];
  const waList = value?.whatsapp ?? [];
  const emList = value?.email ?? [];

  for (let i = 0; i < waList.length; i++) {
    const raw = String(waList[i] ?? '').trim();
    if (!raw) continue;
    if (!isWhatsappE164Valido(raw)) {
      erros.push(`WhatsApp inválido (use DDI +55): ${raw}`);
    }
  }
  for (let i = 0; i < emList.length; i++) {
    const raw = String(emList[i] ?? '').trim();
    if (!raw) continue;
    if (!isEmailValido(raw)) {
      erros.push(`E-mail inválido: ${raw}`);
    }
  }

  const norm = normalizarDestinatariosParaSalvar(value);
  const waInformados = waList.filter((x) => String(x ?? '').trim() !== '').length;
  const emInformados = emList.filter((x) => String(x ?? '').trim() !== '').length;
  if (waInformados > norm.whatsapp.length) {
    erros.push('Há números WhatsApp duplicados ou inválidos.');
  }
  if (emInformados > norm.email.length) {
    erros.push('Há e-mails duplicados ou inválidos.');
  }

  return { ok: erros.length === 0, erros };
}
