import { pesquisarCadastroPessoasPorNomeOuCpf } from '../../../api/clientesService.js';
import { getTelefonesIniciarConversa, searchWhatsAppConversations } from '../../../repositories/whatsappRepository.js';
import { formatPhoneDisplay, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';

/** Conversa casa com texto livre (nome, telefone formatado ou dígitos). */
export function conversationMatchesQuery(conv, rawQuery) {
  const q = String(rawQuery ?? '').trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const name = String(conv?.contactName ?? '').toLowerCase();
  const phone = formatPhoneDisplay(conv?.phoneNumber).toLowerCase();
  const phoneRaw = String(conv?.phoneNumber ?? '').replace(/\D/g, '');
  return (
    (name && name.includes(q)) ||
    phone.includes(q) ||
    (digits.length >= 4 && (phoneRaw.includes(digits) || phone.replace(/\D/g, '').includes(digits)))
  );
}

function uniqPhones(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const phone = normalizePhoneForApi(e.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ phone, name: e.name || '' });
  }
  return out;
}

async function telefonesPorPessoaCadastro(pessoa) {
  const found = [];
  try {
    const res = await getTelefonesIniciarConversa({ pessoaId: pessoa.id });
    for (const t of res?.telefones ?? []) {
      const phone = normalizePhoneForApi(t.numeroCanonico);
      if (phone) found.push({ phone, name: pessoa.nome || res.contactName || '' });
    }
  } catch {
    /* sem cliente vinculado — usa telefone da ficha */
  }
  if (!found.length && pessoa.telefone) {
    const phone = normalizePhoneForApi(pessoa.telefone);
    if (phone) found.push({ phone, name: pessoa.nome || '' });
  }
  return found;
}

/**
 * Busca conversas por nome quando não estão na página carregada da inbox.
 * Ordem: API (histórico WhatsApp + cadastro) → cadastro local.
 */
export async function buscarConversasPorNome(term, signal) {
  const trimmed = String(term ?? '').trim();
  if (trimmed.length < 2) return [];

  try {
    const apiRows = await searchWhatsAppConversations(trimmed, signal);
    if (Array.isArray(apiRows) && apiRows.length) {
      return uniqPhones(
        apiRows.map((r) => ({
          phone: r.phoneNumber,
          name: r.contactName || '',
        })),
      );
    }
  } catch {
    /* fallback cadastro */
  }

  const pessoas = await pesquisarCadastroPessoasPorNomeOuCpf(trimmed, { limite: 10 });
  const qLower = trimmed.toLowerCase();
  const entries = [];
  for (const p of pessoas) {
    const nome = String(p.nome ?? '').toLowerCase();
    if (!nome.includes(qLower)) continue;
    entries.push(...(await telefonesPorPessoaCadastro(p)));
  }
  return uniqPhones(entries);
}
