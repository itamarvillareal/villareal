import { findWhatsAppTemplate } from '../data/whatsappTemplates.js';

const TZ = 'America/Sao_Paulo';

/** Chave yyyy-mm-dd no fuso de Brasília. */
export function dateKeyBR(isoOrDate) {
  if (!isoOrDate) return '';
  return new Date(isoOrDate).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Formato extenso: "terça-feira, 15 de junho" (primeira letra maiúscula). */
export function formatarDataExtenso(isoOrDate) {
  if (!isoOrDate) return '';
  const raw = new Date(isoOrDate).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Label amigável para header de grupo (Hoje — terça, 15 de junho). */
export function formatarHeaderGrupoData(groupKey, isoOrDate) {
  const extenso = formatarDataExtenso(isoOrDate);
  if (groupKey === 'Hoje') return `Hoje — ${extenso}`;
  if (groupKey === 'Amanhã') return `Amanhã — ${extenso}`;
  if (groupKey === 'Ontem') return `Ontem — ${extenso}`;
  if (groupKey === 'Anteriores') return 'Datas anteriores';
  return extenso;
}

export function templateLabel(templateName) {
  return findWhatsAppTemplate(templateName)?.label ?? templateName ?? '—';
}

/** Nomes de ícones Lucide por template. */
export function templateIconName(templateName) {
  const icons = {
    lembrete_audiencia: 'Bell',
    lembrete_audiencia_link: 'Video',
    atualizacao_processo: 'FileText',
    boas_vindas_cliente: 'UserPlus',
    cobranca_pagamento: 'Banknote',
  };
  return icons[templateName] || 'MessageCircle';
}

/**
 * Agrupa agendamentos por data de envio (scheduledAt) em Brasília.
 * @param {Array} agendamentos
 * @param {{ useSentAt?: boolean }} opts — para filtro "Enviados", agrupar por sentAt
 */
export function agruparPorData(agendamentos, opts = {}) {
  const { useSentAt = false } = opts;
  const hojeKey = dateKeyBR(new Date());

  const map = new Map();

  for (const item of agendamentos ?? []) {
    const ref = useSentAt && item.sentAt ? item.sentAt : item.scheduledAt;
    if (!ref) continue;

    const itemKey = dateKeyBR(ref);
    const hoje = new Date(`${hojeKey}T12:00:00`);
    const itemDate = new Date(`${itemKey}T12:00:00`);
    const diffDays = Math.round((itemDate - hoje) / (1000 * 60 * 60 * 24));

    let groupKey;
    if (diffDays === 0) groupKey = 'Hoje';
    else if (diffDays === 1) groupKey = 'Amanhã';
    else if (diffDays === -1) groupKey = 'Ontem';
    else if (diffDays < -1) groupKey = 'Anteriores';
    else groupKey = itemKey;

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        groupKey,
        sortDate: itemDate.getTime(),
        refIso: ref,
        items: [],
      });
    }
    map.get(groupKey).items.push(item);
  }

  const order = (a, b) => {
    const rank = (g) => {
      if (g.groupKey === 'Hoje') return 0;
      if (g.groupKey === 'Amanhã') return 1;
      if (g.groupKey === 'Ontem') return 900;
      if (g.groupKey === 'Anteriores') return 1000;
      return 100 + g.sortDate;
    };
    return rank(a) - rank(b);
  };

  return [...map.values()]
    .map((g) => ({
      ...g,
      label: formatarHeaderGrupoData(g.groupKey, g.refIso),
      items: g.items.sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ),
    }))
    .sort(order);
}

export function resumirParams(params, max = 60) {
  const list = Array.isArray(params) ? params : [];
  const text = list.filter(Boolean).join(', ');
  if (!text) return '—';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function resumirTexto(text, max = 60) {
  const s = String(text ?? '').trim();
  if (!s) return '—';
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
}
