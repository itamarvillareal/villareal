import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders, emitApiUnauthorized } from './apiAuthHeaders.js';
import { postFormData, request } from './httpClient.js';

/**
 * @typedef {Object} ProjudiPeticaoArquivo
 * @property {number} [id]
 * @property {number} ordem
 * @property {number} idArquivoTipo
 * @property {string|null} nomeOriginal
 * @property {string} status
 * @property {string|null} [criadoEm]
 */

/**
 * @typedef {Object} ProjudiPeticao
 * @property {number} id
 * @property {number} credencialId
 * @property {string} numeroProcesso
 * @property {string|null} complemento
 * @property {string} status
 * @property {string|null} criadoEm
 * @property {string|null} protocoladoEm
 * @property {string|null} protocoloMensagem
 * @property {string|null} protocoloEtapa
 * @property {string|null} protocoloAgendadoPara
 * @property {ProjudiPeticaoArquivo[]} arquivos
 */

/** @param {FormData} formData */
export async function registrar(formData) {
  return postFormData('/api/projudi/peticoes', formData);
}

/** @param {FormData} formData */
export async function registrarAssinados(formData) {
  return postFormData('/api/projudi/peticoes/registrar-assinados', formData);
}

/**
 * @param {string} [status]
 * @returns {Promise<ProjudiPeticao[]>}
 */
export async function listar(status) {
  const query = status ? { status } : undefined;
  return request('/api/projudi/peticoes', { query });
}

const HISTORICO_PAGE_SIZE_PADRAO = 30;
const HISTORICO_DIAS_PADRAO = 7;

/**
 * Histórico paginado (PROTOCOLADA, ERRO, PENDENTE_ASSINATURA).
 * @param {{ page?: number, size?: number, dias?: number, numeroProcesso?: string }} [opts]
 */
export async function listarHistorico(opts = {}) {
  const page = Number(opts.page ?? 0);
  const size = Number(opts.size ?? HISTORICO_PAGE_SIZE_PADRAO);
  const dias = opts.dias ?? HISTORICO_DIAS_PADRAO;
  const query = { page, size, dias };
  if (opts.numeroProcesso) query.numeroProcesso = opts.numeroProcesso;
  return request('/api/projudi/peticoes/historico/page', { query });
}

/** @returns {Promise<{ blob: Blob, filename: string }>} */
export async function baixarZip(opts = {}) {
  const url = `${API_BASE_URL}/api/projudi/peticoes/lote-assinar.zip`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildDefaultApiHeaders(),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status} ao baixar ZIP.`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || 'lote-assinar.zip';
  return { blob, filename };
}

/** @param {FormData} formData — campos arquivosP7s (.p7s apenas, nunca PDF) */
export async function enviarAssinados(formData) {
  return postFormData('/api/projudi/peticoes/assinados', formData);
}

/**
 * Dispara o protocolo em segundo plano (responde 202 de imediato). Acompanhe pela fila (status).
 * @param {number[]} peticaoIds
 * @returns {Promise<{ peticaoIds: number[], total: number, status: string }>}
 */
export async function protocolarLote(peticaoIds) {
  return request('/api/projudi/peticoes/protocolar-lote', {
    method: 'POST',
    body: { peticaoIds, confirmar: true },
  });
}

/**
 * Agenda protocolo de uma petição para horário fixo.
 * @param {number} peticaoId
 * @param {string} agendadoPara ISO-8601
 */
export async function agendarProtocolo(peticaoId, agendadoPara) {
  return request(`/api/projudi/peticoes/${peticaoId}/agendar-protocolo`, {
    method: 'PUT',
    body: { agendadoPara },
  });
}

/**
 * Agenda protocolo para horário fixo (petições ASSINADA ou pendentes de assinatura).
 * @param {number[]} peticaoIds
 * @param {string} agendadoPara ISO-8601 (ex.: new Date(...).toISOString())
 */
export async function agendarProtocoloLote(peticaoIds, agendadoPara) {
  return request('/api/projudi/peticoes/agendar-protocolo-lote', {
    method: 'POST',
    body: { peticaoIds, agendadoPara },
  });
}

/** @param {number} peticaoId */
export async function cancelarAgendamentoProtocolo(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/agendamento-protocolo`, { method: 'DELETE' });
}

/** @param {number[]} peticaoIds */
export async function cancelarAgendamentoLote(peticaoIds) {
  return request('/api/projudi/peticoes/cancelar-agendamento-lote', {
    method: 'POST',
    body: { peticaoIds },
  });
}

/** Petição com agendamento ativo que ainda pode ser cancelado. */
export function podeCancelarAgendamentoProtocolo(peticao) {
  if (!peticao?.protocoloAgendadoPara) return false;
  const status = String(peticao.status || '').toUpperCase();
  return status !== 'PROTOCOLANDO' && status !== 'PROTOCOLADA';
}

export const AGENDAMENTO_ANTECEDENCIA_MINUTOS = 15;

function datetimeLocalParaIso(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isoParaDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** @returns {string|null} mensagem de erro ou null se válido */
export function validarAntecedenciaAgendamento(isoOrLocal) {
  if (!isoOrLocal) return 'Informe data e hora do agendamento.';
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) return 'Informe data e hora do agendamento.';
  const minimo = Date.now() + AGENDAMENTO_ANTECEDENCIA_MINUTOS * 60 * 1000;
  if (d.getTime() < minimo) {
    return `O agendamento deve ser com pelo menos ${AGENDAMENTO_ANTECEDENCIA_MINUTOS} minutos de antecedência.`;
  }
  return null;
}

/** Valor mínimo para input datetime-local (now + antecedência). */
export function minDatetimeLocalAgendamento() {
  return isoParaDatetimeLocal(new Date(Date.now() + AGENDAMENTO_ANTECEDENCIA_MINUTOS * 60 * 1000).toISOString());
}

export { datetimeLocalParaIso, isoParaDatetimeLocal };

/**
 * @param {string} numeroProcesso
 * @returns {Promise<ProjudiPeticao[]>}
 */
export async function listarPorProcesso(numeroProcesso) {
  return request('/api/projudi/peticoes/por-processo', {
    query: { numeroProcesso },
  });
}

export async function previaProtocoloLote(peticaoIds) {
  return request('/api/projudi/peticoes/previa-lote', {
    method: 'POST',
    body: { peticaoIds },
  });
}

export async function validarProtocoloLote(peticaoIds) {
  return request('/api/projudi/peticoes/validar-lote', {
    method: 'POST',
    body: { peticaoIds },
  });
}

export async function previaProtocolo(numeroProcesso) {
  return request('/api/projudi/peticoes/previa-protocolo', {
    query: { numeroProcesso },
  });
}

/** Valida no PROJUDI até passo 10 — não executa Concluir. */
export async function validarProtocolo(numeroProcesso) {
  return request('/api/projudi/peticoes/validar-protocolo', {
    method: 'POST',
    body: { numeroProcesso },
  });
}

/**
 * Dispara o protocolo de um processo em segundo plano (responde 202 de imediato).
 * @param {string} numeroProcesso
 * @returns {Promise<{ peticaoIds: number[], total: number, status: string }>}
 */
export async function protocolarProcesso(numeroProcesso) {
  return request('/api/projudi/peticoes/protocolar-processo', {
    method: 'POST',
    body: { numeroProcesso, confirmar: true },
  });
}

/**
 * Acompanha um protocolo disparado em segundo plano, consultando a fila periodicamente.
 * Resolve quando nenhuma petição segue "em andamento" (reivindicada/aguardando) ou no tempo limite.
 *
 * Regras de estado por petição despachada (todas começam em ASSINADA):
 * - PROTOCOLANDO → em andamento (marca como reivindicada);
 * - PROTOCOLADA → concluída com sucesso;
 * - ASSINADA já reivindicada antes → voltou por erro;
 * - ASSINADA ainda não reivindicada → aguardando o robô;
 * - sumiu da lista → tratada como concluída.
 *
 * @param {number[]} peticaoIds
 * @param {(rows: ProjudiPeticao[]) => void} [onUpdate] chamado a cada atualização da lista
 * @param {{ intervaloMs?: number, limiteMs?: number, fetcher?: () => Promise<ProjudiPeticao[]>,
 *           onProgress?: (statusPorId: Record<number,string>) => void }} [opts]
 * @returns {Promise<{ protocoladas: number[], comErro: number[], pendentes: number[], statusPorId: Record<number,string> }>}
 */
export async function acompanharProtocolo(peticaoIds, onUpdate, opts = {}) {
  const ids = Array.isArray(peticaoIds) ? [...peticaoIds] : [];
  if (ids.length === 0)
    return { protocoladas: [], comErro: [], pendentes: [], statusPorId: {}, mensagensPorId: {} };
  const intervaloMs = opts.intervaloMs ?? 3000;
  const limiteMs = opts.limiteMs ?? 8 * 60 * 1000;
  const fetcher = typeof opts.fetcher === 'function' ? opts.fetcher : listar;
  const reivindicadas = new Set();
  const inicio = Date.now();

  const classificar = (rows) => {
    const porId = new Map((rows || []).map((p) => [p.id, p]));
    const protocoladas = [];
    const comErro = [];
    const pendentes = [];
    const statusPorId = {};
    const mensagensPorId = {};
    for (const id of ids) {
      const p = porId.get(id);
      const status = p?.status;
      if (p?.protocoloMensagem) mensagensPorId[id] = p.protocoloMensagem;
      if (status === 'PROTOCOLANDO') {
        reivindicadas.add(id);
        pendentes.push(id);
        statusPorId[id] = 'PROTOCOLANDO';
      } else if (status === 'PROTOCOLADA') {
        protocoladas.push(id);
        statusPorId[id] = 'PROTOCOLADA';
      } else if (status === 'ASSINADA') {
        // Estado é limpo no disparo; mensagem aqui = esta tentativa falhou (claim→erro,
        // ou robô ocupado/timeout) mesmo que o polling não tenha pego o PROTOCOLANDO.
        if (reivindicadas.has(id) || p?.protocoloMensagem) {
          comErro.push(id);
          statusPorId[id] = 'ERRO';
        } else {
          pendentes.push(id);
          statusPorId[id] = 'AGUARDANDO';
        }
      } else if (!p) {
        protocoladas.push(id);
        statusPorId[id] = 'PROTOCOLADA';
      } else {
        comErro.push(id);
        statusPorId[id] = 'ERRO';
      }
    }
    return { protocoladas, comErro, pendentes, statusPorId, mensagensPorId };
  };

  let resultado = {
    protocoladas: [],
    comErro: [],
    pendentes: ids,
    statusPorId: Object.fromEntries(ids.map((id) => [id, 'AGUARDANDO'])),
    mensagensPorId: {},
  };
  while (Date.now() - inicio < limiteMs) {
    await new Promise((r) => setTimeout(r, intervaloMs));
    let rows;
    try {
      rows = await fetcher();
    } catch {
      continue;
    }
    if (typeof onUpdate === 'function') onUpdate(Array.isArray(rows) ? rows : []);
    resultado = classificar(rows);
    if (typeof opts.onProgress === 'function') opts.onProgress(resultado.statusPorId);
    if (resultado.pendentes.length === 0) break;
  }
  return resultado;
}

export async function listarCredenciais() {
  return request('/api/projudi/peticoes/credenciais');
}

/** @param {number} peticaoId */
export async function reabrirProtocolo(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/reabrir-protocolo`, { method: 'POST' });
}

/** Reenfileira petição PENDENTE_ASSINATURA para o assinador Windows (sem re-baixar PDFs). */
export async function reenfileirarAssinaturaAutomatica(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/reenfileirar-assinatura-automatica`, {
    method: 'POST',
  });
}

/** @param {number} peticaoId @param {number} credencialId */
export async function atualizarCredencialPeticao(peticaoId, credencialId) {
  return request(`/api/projudi/peticoes/${peticaoId}/credencial`, {
    method: 'POST',
    body: { credencialId },
  });
}

/** @param {number} peticaoId */
export async function excluirPeticao(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}`, { method: 'DELETE' });
}

/** @param {number} peticaoId @param {number} arquivoId */
export async function excluirArquivo(peticaoId, arquivoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/arquivos/${arquivoId}`, { method: 'DELETE' });
}
