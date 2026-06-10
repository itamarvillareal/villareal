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
 * Sufixo padrão para PJ com administrador vinculado.
 * @param {string} qualificacaoAdministrador — qualificação completa (sem HTML ou com, conforme origem)
 */
export function suffixAdministradorPj(qualificacaoAdministrador) {
  const q = String(qualificacaoAdministrador ?? '').trim();
  if (!q) return '';
  return `, neste ato representada por seu administrador ${q}`;
}

/**
 * Remove trecho de administrador PJ já concatenado (ex.: resposta anterior da API).
 * Tolerante a gênero: o backend flexiona "representad{o|a}", "seu/sua" e "administrador(a)"
 * conforme o gênero da PJ e do representante.
 */
export function stripSuffixAdministradorPj(texto) {
  const t = String(texto ?? '');
  const re = /, neste ato representad[oa] por (?:seu|sua) administrador(?:a)? /;
  const m = t.match(re);
  if (m && m.index >= 0) return t.slice(0, m.index).trim();
  return t.trim();
}

/**
 * Esboço de trecho para documentos quando houver responsável vinculado.
 *
 * @param {{ nome?: string, cpf?: string, tipoPessoa?: string }} principal
 * @param {{ nome?: string, cpf?: string, tipoPessoa?: string } | null | undefined} responsavel
 * @param {{ isPj?: boolean, qualificacaoPrincipal?: string, qualificacaoResponsavel?: string }} [options]
 * @returns {string|null}
 */
export function esbocoQualificacaoComResponsavel(principal, responsavel, options = {}) {
  if (!responsavel || !String(responsavel.nome ?? '').trim()) return null;

  const docPrincipal = String(principal?.cpf ?? '').replace(/\D/g, '');
  const isPj =
    options.isPj === true
    || principal?.tipoPessoa === 'JURIDICA'
    || docPrincipal.length === 14;

  if (isPj) {
    const base =
      String(options.qualificacaoPrincipal ?? '').trim()
      || `${String(principal?.nome ?? '').trim() || 'A parte'}, pessoa jurídica de direito privado`;
    const adminQual =
      String(options.qualificacaoResponsavel ?? '').trim()
      || `${String(responsavel.nome).trim()}, documento ${formatarDocumentoBr(responsavel.cpf)}`;
    return `${base}${suffixAdministradorPj(adminQual)}`;
  }

  const p = String(principal?.nome ?? '').trim() || 'A parte';
  const r = String(responsavel.nome).trim();
  const doc = formatarDocumentoBr(responsavel.cpf);
  return `${p}, neste ato representada(o) por ${r}, documento ${doc}.`;
}
