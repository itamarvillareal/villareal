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

/** Normaliza para envio à API (somente dígitos, prefixo 55). */
export function normalizePhoneForApi(input) {
  const cleaned = String(input ?? '').replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('55')) return cleaned;
  return `55${cleaned}`;
}

export function isValidBrazilPhone(input) {
  const cleaned = normalizePhoneForApi(input);
  return /^55\d{10,11}$/.test(cleaned);
}

/** Formatar data/hora para Brasília: ISO string → "15/06/2026 14:30" */
export function formatDateTimeBR(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatar só hora: ISO string → "14:30" */
export function formatTimeBR(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** datetime-local → ISO Instant para a API. */
export function datetimeLocalToIso(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function isFutureDatetimeLocal(localValue) {
  if (!localValue) return false;
  const t = new Date(localValue).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** Valor inicial para `datetime-local`: amanhã às HH:mm (horário local do navegador). */
export function defaultDatetimeLocalTomorrowAt(hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export {
  formatarDataExtenso,
  templateLabel,
  templateIconName as templateIcon,
  agruparPorData,
} from './whatsappScheduleUtils.js';
