import { formatarResumoCnjParaLinhaAgenda } from './cnjAgendaResolucao.js';

/**
 * Padrão alinhado ao formulário Processos / clientes (exibição na agenda de todos os usuários).
 * Ex.: SESSÃO DE JULGAMENTO (A x B) Autos nº 5717034.38.2025, no 1º JUIZADO ESPECIAL CIVEL de ANÁPOLIS
 *
 * @param {{
 *   audienciaTipo?: string,
 *   numeroProcessoNovo?: string,
 *   parteCliente?: string,
 *   parteOposta?: string,
 *   competencia?: string,
 * }} p
 */
export function montarDescricaoAgendaAudienciaProcesso(p) {
  const tipo = String(p?.audienciaTipo ?? '').trim() || 'Audiência';
  const cli = String(p?.parteCliente ?? '').trim() || 'CLIENTE';
  const reu = String(p?.parteOposta ?? '').trim() || 'PARTE OPOSTA';
  const autos = formatarResumoCnjParaLinhaAgenda(p?.numeroProcessoNovo ?? '');
  let corpo = `${tipo} (${cli} x ${reu}) Autos nº ${autos}`;
  const comp = String(p?.competencia ?? '').trim();
  if (comp) {
    const no = /^no\s+/i.test(comp) ? comp : `no ${comp}`;
    corpo += `, ${no}`;
  }
  return corpo;
}
