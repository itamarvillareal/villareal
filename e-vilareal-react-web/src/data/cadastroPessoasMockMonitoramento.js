/**
 * Persistência local do flag marcadoMonitoramento quando o cadastro roda em mock (PDF).
 * Permite testar o fluxo sem API; não substitui gravação real no servidor.
 */
const STORAGE_KEY = 'vilareal:cadastro-pessoas:mock-marcado-monitoramento:v1';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === 'object' && o !== null ? o : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns {boolean|undefined} undefined se nunca foi definido no mock */
export function getMockMarcadoMonitoramento(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return undefined;
  const m = readMap();
  const key = String(n);
  if (!Object.prototype.hasOwnProperty.call(m, key)) return undefined;
  return Boolean(m[key]);
}

export function setMockMarcadoMonitoramento(id, value) {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  const m = readMap();
  m[String(n)] = Boolean(value);
  writeMap(m);
}

export function mergeMarcadoMonitoramentoMock(pessoa) {
  if (!pessoa || pessoa.id == null) return pessoa;
  const overlay = getMockMarcadoMonitoramento(pessoa.id);
  if (overlay === undefined) return pessoa;
  return { ...pessoa, marcadoMonitoramento: overlay };
}

export function mergeListaMarcadoMonitoramentoMock(lista) {
  if (!Array.isArray(lista)) return lista;
  return lista.map(mergeMarcadoMonitoramentoMock);
}

/**
 * Lista pessoas marcadas no mock no formato usado na tela de monitoramento.
 * @param {Array<{id:number,nome:string,cpf?:string,marcadoMonitoramento?:boolean}>} listaBase
 */
export function listarMonitoramentoLocalMock(listaBase) {
  const lista = mergeListaMarcadoMonitoramentoMock(listaBase);
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((p) => p && p.id != null && p.marcadoMonitoramento === true)
    .map((p) => ({
      id: null,
      personId: Number(p.id),
      nome: p.nome || `Pessoa ${p.id}`,
      documentoPrincipal: p.cpf || null,
      enabled: true,
      frequencyType: 'HOURS_6',
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: 'MOCK_LOCAL',
      totalHits: 0,
      pendingReviewHits: 0,
      recentFailureCount: 0,
    }));
}
