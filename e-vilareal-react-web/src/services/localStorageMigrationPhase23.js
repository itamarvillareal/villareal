import { featureFlags } from '../config/featureFlags.js';
import { listarUsuarios, salvarUsuario } from '../repositories/usuariosRepository.js';
import { salvarClienteCadastro } from '../repositories/clientesRepository.js';
import { listarEventosPorDataUsuario, salvarCamposEvento } from '../repositories/agendaRepository.js';

const IMPORT_DONE_KEY = 'vilareal:migration:phase2-3:done:v1';

export const LOCALSTORAGE_KEYS_PHASE23 = [
  'vilareal:agenda-usuarios:v2',
  'vilareal.usuarios.permissoes.v1',
  'vilareal:cadastro-clientes-dados:v1',
  'vilareal:agenda-eventos:v1',
];

function loadJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function migrarUsuarios() {
  const local = loadJson('vilareal:agenda-usuarios:v2');
  if (!Array.isArray(local) || local.length === 0) return 0;
  const atuais = await listarUsuarios();
  const ids = new Set((atuais || []).map((u) => String(u.id)));
  let inseridos = 0;
  for (const u of local) {
    if (ids.has(String(u.id))) continue;
    await salvarUsuario(u);
    inseridos += 1;
  }
  return inseridos;
}

async function migrarClientes() {
  const bag = loadJson('vilareal:cadastro-clientes-dados:v1');
  if (!bag || typeof bag !== 'object') return 0;
  let total = 0;
  for (const [codigo, d] of Object.entries(bag)) {
    await salvarClienteCadastro({
      codigo,
      pessoa: d?.pessoa ?? '',
      nomeRazao: d?.nomeRazao ?? '',
      cnpjCpf: d?.cnpjCpf ?? '',
      observacao: d?.observacao ?? '',
      clienteInativo: d?.clienteInativo === true,
    });
    total += 1;
  }
  return total;
}

async function migrarAgenda() {
  const bag = loadJson('vilareal:agenda-eventos:v1');
  if (!bag || typeof bag !== 'object') return 0;
  let total = 0;
  for (const [dataBr, eventos] of Object.entries(bag)) {
    if (!Array.isArray(eventos)) continue;
    for (const ev of eventos) {
      const userId = ev?.usuarioId;
      if (!Number.isFinite(Number(userId))) continue;
      const existentes = await listarEventosPorDataUsuario(dataBr, userId);
      const jaExiste = (existentes || []).some(
        (x) => String(x.hora || '') === String(ev.hora || '') && String(x.descricao || '') === String(ev.descricao || '')
      );
      if (jaExiste) continue;
      await salvarCamposEvento(dataBr, { usuarioId: String(userId), id: null }, ev);
      total += 1;
    }
  }
  return total;
}

export async function executarMigracaoAssistidaPhase23() {
  if (typeof window === 'undefined') return null;
  if (window.localStorage.getItem(IMPORT_DONE_KEY) === '1') return null;

  const habilitada = import.meta.env.VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23 === 'true';
  if (!habilitada) return null;

  const resumo = { usuarios: 0, clientes: 0, agenda: 0 };
  if (featureFlags.useApiUsuarios) resumo.usuarios = await migrarUsuarios();
  if (featureFlags.useApiClientes) resumo.clientes = await migrarClientes();
  if (featureFlags.useApiAgenda) resumo.agenda = await migrarAgenda();

  window.localStorage.setItem(IMPORT_DONE_KEY, '1');
  return resumo;
}
