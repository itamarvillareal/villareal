/**
 * Cadastros criados em modo demonstração (mock PDF) — persistidos só no navegador.
 */
import { getCadastroPessoasMock, getPessoaPorId as getPessoaPorIdEstatico } from './cadastroPessoasMock.js';

const STORAGE_KEY = 'vilareal:cadastro-pessoas:mock-novos:v1';

export function readNovosCadastrosMockLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeNovos(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* quota / modo privado */
  }
}

export function appendNovoCadastroMockLocal(pessoa) {
  const arr = readNovosCadastrosMockLocal();
  arr.push(pessoa);
  writeNovos(arr);
}

/** @returns {boolean} true se o id existia nos extras locais */
export function updateNovoCadastroMockLocal(id, patch) {
  const arr = readNovosCadastrosMockLocal();
  const i = arr.findIndex((p) => Number(p.id) === Number(id));
  if (i < 0) return false;
  arr[i] = { ...arr[i], ...patch };
  writeNovos(arr);
  return true;
}

export function maxIdCadastroMockIncluindoNovos() {
  const base = getCadastroPessoasMock(false);
  const novos = readNovosCadastrosMockLocal();
  let max = 0;
  for (const p of [...base, ...novos]) {
    const id = Number(p.id);
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max;
}

/**
 * Lista PDF + cadastros criados localmente no mock, ordenada por id.
 */
export function getCadastroPessoasMockComNovosLocais(apenasAtivos) {
  const base = getCadastroPessoasMock(apenasAtivos);
  const novos = readNovosCadastrosMockLocal();
  const novosFiltrados = apenasAtivos ? novos.filter((p) => p.ativo !== false) : novos;
  return [...base, ...novosFiltrados].sort((a, b) => Number(a.id) - Number(b.id));
}

export function getPessoaMockLocalPorId(id) {
  return readNovosCadastrosMockLocal().find((p) => Number(p.id) === Number(id)) ?? null;
}

/**
 * Mesmo contrato que `getPessoaPorId` do PDF + cadastros criados no mock (localStorage).
 * Usado em Clientes e fluxos que antes só viam o mock estático.
 */
export function getPessoaPorIdIncluindoNovosLocais(id) {
  const est = getPessoaPorIdEstatico(id);
  if (est) return est;
  const loc = getPessoaMockLocalPorId(id);
  if (!loc) return null;
  const cpf = String(loc.cpf ?? '').replace(/\D/g, '').slice(0, 14);
  return {
    id: Number(loc.id),
    nome: loc.nome ?? '',
    cpf,
    email: loc.email ?? undefined,
    telefone: loc.telefone ?? undefined,
    ativo: loc.ativo !== false,
    marcadoMonitoramento: loc.marcadoMonitoramento === true,
    responsavelId: loc.responsavelId ?? null,
    responsavel: loc.responsavel ?? null,
  };
}
