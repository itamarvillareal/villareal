/**
 * Pré-preenchimento explícito para criação assistida de tarefas operacionais (contexto processo/publicação).
 * O usuário confirma/ajusta no modal; estes objetos descrevem o que veio do contexto (rastreável no código).
 * @see docs/frontend-phase-8-tarefas-contextual-actions.md
 * @see docs/frontend-phase-8-tarefas-contextual-stabilization.md
 */

/** Rótulos fixos para transparência no modal (origem da ação). */
export const TAREFA_CTX_SOURCE = {
  processo: 'Processos',
  processoPrazo: 'Processos (prazo fatal)',
  publicacao: 'Publicações',
};

/**
 * `processoPrazoId`: reservado — preencher quando a UI expuser prazo processual com id (GET lista de prazos).
 * Por ora permanece sempre null; o modal não exibe campo dedicado.
 */

/** Converte dd/mm/aaaa → yyyy-MM-dd (LocalDate na API). */
export function dataBrParaIsoLocalDate(dataBr) {
  const s = String(dataBr ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Contexto: tela de Processos (processo atual).
 * @param {object} p
 * @param {number|null} p.processoApiId — id nativo na API de processos
 * @param {number|null} [p.clienteIdNativo] — id do cliente vindo do GET `/api/processos/{id}` (preferência)
 * @param {string} p.codigoCliente
 * @param {number} p.processoNumero — proc. interno
 * @param {string} p.clienteNome
 * @param {string} p.numeroProcessoNovo — CNJ ou vazio
 */
export function buildContextFromProcesso(p) {
  const {
    processoApiId,
    clienteIdNativo,
    codigoCliente,
    processoNumero,
    clienteNome,
    numeroProcessoNovo,
  } = p;
  const cnj = String(numeroProcessoNovo ?? '').trim();
  const titulo = cnj
    ? `Acompanhamento — ${cnj}`
    : `Acompanhamento — Cliente ${codigoCliente} / proc. ${processoNumero}`;
  const descricao = [
    `Cliente: ${clienteNome} (cód. ${codigoCliente})`,
    `Processo interno: ${processoNumero}`,
    cnj ? `CNJ: ${cnj}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const clienteIdDireto =
    clienteIdNativo != null && Number.isFinite(Number(clienteIdNativo)) && Number(clienteIdNativo) > 0
      ? Number(clienteIdNativo)
      : null;

  return {
    kind: 'processo',
    sourceLabel: TAREFA_CTX_SOURCE.processo,
    processoId: processoApiId != null && Number.isFinite(Number(processoApiId)) ? Number(processoApiId) : null,
    clienteId: clienteIdDireto,
    codigoCliente: String(codigoCliente ?? ''),
    publicacaoId: null,
    processoPrazoId: null,
    tituloInicial: titulo,
    descricaoInicial: descricao,
    dataLimiteInicial: null,
    /** Texto opcional para o modal (ex.: falta id de processo na API). */
    aviso: null,
    apenasTextoContextual: false,
  };
}

/**
 * Mesmo contexto de processo, com data limite sugerida a partir do Prazo Fatal (dd/mm/aaaa).
 */
export function buildContextFromProcessoComPrazoFatal(base, prazoFatalBr) {
  const ctx = buildContextFromProcesso(base);
  ctx.kind = 'processo_prazo';
  ctx.sourceLabel = TAREFA_CTX_SOURCE.processoPrazo;
  const iso = dataBrParaIsoLocalDate(prazoFatalBr);
  ctx.dataLimiteInicial = iso;
  if (iso) {
    ctx.descricaoInicial = `${ctx.descricaoInicial}\n\nPrazo fatal (referência): ${String(prazoFatalBr ?? '').trim()}`;
  }
  return ctx;
}

/**
 * Contexto: linha de publicação (API ou legado).
 * @param {object} row — item da listagem (UI), com campos de `mapApiPublicacaoToUi` quando API.
 */
export function buildContextFromPublicacaoRow(row) {
  const pubId = Number(row?._apiId ?? row?.id);
  const processoId = row?._processoId != null ? Number(row._processoId) : null;
  const clienteId = row?._clienteId != null ? Number(row._clienteId) : null;
  const cnj = String(row?.numero_processo_cnj ?? '').trim();
  const tipo = String(row?.tipoPublicacao ?? '').trim() || 'Publicação';
  const titulo = cnj ? `Publicação — ${cnj} (${tipo})` : `Publicação — ${tipo}`;
  const resumo = String(row?.resumoPublicacao ?? '').trim();
  const descricao = [
    resumo ? resumo.slice(0, 1200) : '',
    row?.dataPublicacao ? `Data publicação: ${row.dataPublicacao}` : '',
    row?.dataDisponibilizacao ? `Data disponibilização: ${row.dataDisponibilizacao}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const pubOk = Number.isFinite(pubId) && pubId > 0;
  const procOk = processoId != null && Number.isFinite(processoId) && processoId > 0;
  const cliOk = clienteId != null && Number.isFinite(clienteId) && clienteId > 0;

  return {
    kind: 'publicacao',
    sourceLabel: TAREFA_CTX_SOURCE.publicacao,
    codigoCliente: '',
    processoId: procOk ? processoId : null,
    clienteId: cliOk ? clienteId : null,
    publicacaoId: pubOk ? pubId : null,
    processoPrazoId: null,
    tituloInicial: titulo,
    descricaoInicial: descricao || titulo,
    dataLimiteInicial: null,
    aviso: null,
    /** Nenhum id estruturado será enviado — só título/descrição como texto na API. */
    apenasTextoContextual: !pubOk && !procOk && !cliOk,
  };
}
