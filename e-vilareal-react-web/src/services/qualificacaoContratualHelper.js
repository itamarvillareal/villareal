/**
 * Base para qualificação contratual futura (contratos, petições, notificações).
 * Os textos completos dependerão de endereço, estado civil, etc. — aqui só o vínculo com responsável.
 */

/** @param {string|undefined} digits */
export function inferirTipoPessoaPorDocumento(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 14) return 'JURIDICA';
  if (d.length >= 11) return 'FISICA';
  return null;
}

/**
 * Formata CPF/CNPJ para exibição (mesma ideia do Cadastro de Clientes).
 * @param {string} digits
 */
export function formatarDocumentoBr(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d || '—';
}

/**
 * Linha única para listas e buscas: "Nome — CPF/CNPJ formatado".
 * @param {{ nome?: string, cpf?: string }} p
 */
export function rotuloPessoaComDocumento(p) {
  if (!p) return '';
  const nome = String(p.nome ?? '').trim() || '—';
  const doc = formatarDocumentoBr(p.cpf);
  return `${nome} — ${doc}`;
}

/**
 * Esboço de trecho para documentos quando houver responsável vinculado.
 * Ajuste fino (endereços, qualificação completa) virá com templates futuros.
 *
 * @param {{ nome?: string }} principal
 * @param {{ nome?: string, cpf?: string, tipoPessoa?: string } | null | undefined} responsavel
 * @returns {string|null}
 */
export function esbocoQualificacaoComResponsavel(principal, responsavel) {
  if (!responsavel || !String(responsavel.nome ?? '').trim()) return null;
  const p = String(principal?.nome ?? '').trim() || 'A parte';
  const r = String(responsavel.nome).trim();
  const doc = formatarDocumentoBr(responsavel.cpf);
  return `${p}, neste ato representada(o) por ${r}, documento ${doc}.`;
}
