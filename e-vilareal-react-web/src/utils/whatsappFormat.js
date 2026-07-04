/** Formatar telefone para exibição: 5562999991234 → (62) 99999-1234 */
export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    const ddd = cleaned.slice(2, 4);
    const rest = cleaned.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return String(phone);
}

/**
 * Espelha {@code TelefoneBrasilUtil.aplicarNonoDigitoCelular} (backend).
 * {@code digits} deve conter só dígitos, prefixo 55, comprimento 12 ou 13.
 */
export function aplicarNonoDigitoCelular(digits) {
  if (digits.length !== 12 && digits.length !== 13) {
    return digits;
  }
  const ddd = digits.slice(2, 4);
  let local = digits.slice(4);
  if (local.length === 8 && local[0] >= '6' && local[0] <= '9') {
    local = `9${local}`;
    return `55${ddd}${local}`;
  }
  return digits;
}

/**
 * Normaliza para envio/comparação na API (somente dígitos, prefixo 55, formato canônico).
 * <p>
 * Regra do nono dígito (celular BR): após {@code 55}+DDD, se a parte local tem 8 dígitos e o
 * primeiro é 6–9, insere {@code 9} (13 total). Fixo (2–5) permanece com 12.
 * <p>
 * Ex.: {@code 556292975894} → {@code 5562992975894}; {@code 556232179999} inalterado.
 * <p>
 * Entrada inválida (comprimento ≠ 12/13 após regra): retorna melhor esforço (55 + dígitos
 * limpos) para não travar a UI — o backend rejeita na validação estrita.
 */
export function normalizePhoneForApi(input) {
  let cleaned = String(input ?? '').replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('0')) {
    cleaned = `55${cleaned.slice(1)}`;
  }
  if (!cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`;
  }
  const canonical = aplicarNonoDigitoCelular(cleaned);
  if (canonical.length === 12 || canonical.length === 13) {
    return canonical;
  }
  return cleaned;
}

export function isValidBrazilPhone(input) {
  const cleaned = normalizePhoneForApi(input);
  return /^55\d{10,11}$/.test(cleaned);
}

const TZ_BR = 'America/Sao_Paulo';
/** Brasília é UTC−3 (sem horário de verão). */
const BRASILIA_OFFSET_MINUTES = 180;

/**
 * Interpreta `datetime-local` (yyyy-MM-ddTHH:mm) como horário de **Brasília**
 * e retorna ISO UTC para a API.
 */
export function datetimeLocalToIso(localValue) {
  if (!localValue) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(localValue).trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0) + BRASILIA_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

/** ISO UTC → valor para input `datetime-local` em horário de Brasília. */
export function isoToDatetimeLocalBR(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ_BR,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Formatar data/hora para Brasília: ISO string → "15/06/2026 14:30" */
export function formatDateTimeBR(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatar só hora: ISO string → "14:30" (Brasília) */
export function formatTimeBR(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function isFutureDatetimeLocal(localValue) {
  const iso = datetimeLocalToIso(localValue);
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

/** Amanhã às HH:mm em Brasília, para `datetime-local`. */
export function defaultDatetimeLocalTomorrowAt(hour = 9, minute = 0) {
  const hojeBr = isoToDatetimeLocalBR(new Date().toISOString()).slice(0, 10);
  const [y, mo, d] = hojeBr.split('-').map(Number);
  const amanha = new Date(Date.UTC(y, mo - 1, d + 1, 12, 0, 0));
  const amanhaBr = isoToDatetimeLocalBR(amanha.toISOString()).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${amanhaBr}T${pad(hour)}:${pad(minute)}`;
}

export {
  formatarDataExtenso,
  templateLabel,
  templateIconName as templateIcon,
  agruparPorData,
} from './whatsappScheduleUtils.js';
