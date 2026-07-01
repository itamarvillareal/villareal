import { formatPhoneDisplay, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';

/**
 * @typedef {{ numero?: string, waId?: string, tipo?: string }} TelefoneContato
 * @typedef {{ nome?: string, telefones?: TelefoneContato[], emails?: string[] }} ContatoCartao
 */

/**
 * @param {string|undefined|null} content
 * @returns {ContatoCartao[]|null}
 */
export function parseContactCardContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const data = JSON.parse(raw);
    const lista = data?.contatos ?? data?.contacts;
    if (!Array.isArray(lista) || lista.length === 0) return null;
    return lista.map(normalizarContatoCartao).filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} item
 * @returns {ContatoCartao|null}
 */
function normalizarContatoCartao(item) {
  if (!item || typeof item !== 'object') return null;
  const nome = String(item.nome ?? item.name ?? '').trim();
  const telefonesRaw = item.telefones ?? item.phones;
  const telefones = Array.isArray(telefonesRaw)
    ? telefonesRaw
        .map((t) => {
          if (!t || typeof t !== 'object') return null;
          const numero = String(t.numero ?? t.phone ?? '').trim();
          const waId = String(t.waId ?? t.wa_id ?? '').trim();
          if (!numero && !waId) return null;
          return {
            numero: numero || undefined,
            waId: waId || undefined,
            tipo: String(t.tipo ?? t.type ?? '').trim() || undefined,
          };
        })
        .filter(Boolean)
    : [];
  const emailsRaw = item.emails;
  const emails = Array.isArray(emailsRaw)
    ? emailsRaw.map((e) => String(typeof e === 'string' ? e : e?.email ?? '').trim()).filter(Boolean)
    : [];
  if (!nome && telefones.length === 0 && emails.length === 0) return null;
  return { nome: nome || undefined, telefones, emails };
}

/**
 * @param {ContatoCartao} contato
 * @returns {string}
 */
export function tituloContatoCartao(contato) {
  if (contato?.nome) return contato.nome;
  const tel = contato?.telefones?.[0];
  if (tel?.numero) return tel.numero;
  if (tel?.waId) return formatPhoneDisplay(tel.waId);
  return 'Contato';
}

/**
 * @param {TelefoneContato} telefone
 * @returns {string}
 */
export function telefoneCartaoParaApi(telefone) {
  const candidato = telefone?.waId || telefone?.numero || '';
  return normalizePhoneForApi(candidato);
}

/**
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function resumoContactCardContent(content) {
  const contatos = parseContactCardContent(content);
  if (!contatos?.length) return 'Cartão de contato';
  if (contatos.length === 1) return `Cartão de contato: ${tituloContatoCartao(contatos[0])}`;
  return `Cartão de contato: ${tituloContatoCartao(contatos[0])} (+${contatos.length - 1})`;
}
