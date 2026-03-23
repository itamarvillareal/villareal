/**
 * Adaptadores entre o contrato `/api/tarefas` e o formato de cards do Board (Pendências).
 * @see docs/frontend-phase-8-tarefas-implementation.md
 * @see docs/frontend-phase-8-tarefas-stabilization.md
 */

/** Id sintético da coluna “Sem responsável” (não é id de usuário). */
export const COLUNA_SEM_RESPONSAVEL_ID = '__sem_responsavel__';

export function isColunaSemResponsavel(colunaId) {
  return String(colunaId ?? '') === COLUNA_SEM_RESPONSAVEL_ID;
}

/** Primeira linha = título; demais = descrição (compatível com textarea único). */
export function parseTextoParaTituloDescricao(texto) {
  const raw = String(texto ?? '');
  const lines = raw.split(/\r?\n/);
  const titulo = (lines[0] ?? '').trim() || 'Sem título';
  const rest = lines.slice(1).join('\n').trim();
  return { titulo, descricao: rest || null };
}

export function textoVisivelFromApi(t) {
  const tit = String(t?.titulo ?? '').trim();
  const desc = String(t?.descricao ?? '').trim();
  if (!tit && !desc) return '';
  return desc ? `${tit}\n\n${desc}` : tit;
}

/** Item no estado do board (API ou legado estendido). */
export function itemFromApi(t) {
  return {
    id: String(t.id),
    apiId: t.id,
    texto: textoVisivelFromApi(t),
    criadoEm: t.createdAt ?? null,
    finalizadoEm: t.dataConclusao ?? null,
    status: t.status ?? null,
    prioridade: t.prioridade ?? null,
    dataLimite: t.dataLimite ?? null,
  };
}

export function pendenciaVaziaApi() {
  return {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    apiId: null,
    texto: '',
    criadoEm: null,
    finalizadoEm: null,
    status: null,
    prioridade: null,
    dataLimite: null,
  };
}

export function appendEmptySlot(lista) {
  const arr = Array.isArray(lista) ? [...lista] : [];
  const ult = arr[arr.length - 1];
  if (!ult || String(ult.texto ?? '').trim() !== '' || ult.apiId != null) {
    arr.push(pendenciaVaziaApi());
  }
  return arr;
}

/**
 * Corpo POST mínimo: titulo (obrigatório no backend), descrição, responsável opcional.
 * Coluna `COLUNA_SEM_RESPONSAVEL_ID`: não envia `responsavelUsuarioId` (null no servidor).
 */
export function buildCriarTarefaBody(usuarioColunaId, texto) {
  const { titulo, descricao } = parseTextoParaTituloDescricao(texto);
  const body = {
    titulo,
    descricao: descricao || null,
  };
  if (!isColunaSemResponsavel(usuarioColunaId)) {
    body.responsavelUsuarioId = Number(usuarioColunaId);
  }
  return body;
}

/**
 * PUT: reenvia campos editáveis e preserva status/prioridade/dataLimite já carregados no item.
 */
export function buildAtualizarTarefaBody(usuarioColunaId, texto, itemExistente) {
  const { titulo, descricao } = parseTextoParaTituloDescricao(texto);
  const body = {
    titulo,
    descricao: descricao || null,
  };
  if (isColunaSemResponsavel(usuarioColunaId)) {
    body.responsavelUsuarioId = null;
  } else {
    body.responsavelUsuarioId = Number(usuarioColunaId);
  }
  if (itemExistente?.status != null) body.status = itemExistente.status;
  if (itemExistente?.prioridade != null) body.prioridade = itemExistente.prioridade;
  if (itemExistente?.dataLimite != null) body.dataLimite = itemExistente.dataLimite;
  return body;
}

/**
 * Colunas do board = usuários ativos + opcionalmente coluna sintética “Sem responsável”.
 */
export function colunasBoardComSemResponsavel(colunasUsuarios, incluirSemResponsavel) {
  if (!incluirSemResponsavel) return colunasUsuarios;
  return [...colunasUsuarios, { id: COLUNA_SEM_RESPONSAVEL_ID, name: 'Sem responsável' }];
}

/**
 * Agrupa tarefas da API por `responsavelUsuarioId` alinhado aos ids das colunas.
 * - Sem responsável → bucket `COLUNA_SEM_RESPONSAVEL_ID` (se existir em `colunas`).
 * - Responsável fora das colunas de usuário → mesmo bucket “Sem responsável” (visível no board).
 */
export function agruparTarefasPorColunas(apiLista, colunas) {
  const map = {};
  for (const col of colunas) {
    map[col.id] = [];
  }
  const temBucketOrfaos = Object.prototype.hasOwnProperty.call(map, COLUNA_SEM_RESPONSAVEL_ID);
  for (const t of apiLista || []) {
    const rid = t.responsavelUsuarioId != null ? String(t.responsavelUsuarioId) : null;
    if (rid && Object.prototype.hasOwnProperty.call(map, rid)) {
      map[rid].push(itemFromApi(t));
    } else if (temBucketOrfaos) {
      map[COLUNA_SEM_RESPONSAVEL_ID].push(itemFromApi(t));
    }
  }
  const out = {};
  for (const col of colunas) {
    out[col.id] = appendEmptySlot(map[col.id] || []);
  }
  return out;
}
