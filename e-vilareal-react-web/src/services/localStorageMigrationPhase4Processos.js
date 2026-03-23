import { featureFlags } from '../config/featureFlags.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  salvarCabecalhoProcesso,
  sincronizarPartesIncremental,
  sincronizarAndamentosIncremental,
  upsertPrazoFatalProcesso,
} from '../repositories/processosRepository.js';

const PROCESSOS_STORAGE_KEY = 'vilareal:processos-historico:v1';
const PROCESSOS_EDICAO_STORAGE_KEY = 'vilareal:processos:edicao-desabilitada-ao-sair:v1';
const PROCESSOS_SEED_KEY = 'vilareal:processos-historico:demo-seed-version';
const IMPORT_DONE_KEY = 'vilareal:migration:phase4-processos:done:v1';

export const LOCALSTORAGE_KEYS_PHASE4_PROCESSOS = [
  PROCESSOS_STORAGE_KEY,
  PROCESSOS_EDICAO_STORAGE_KEY,
  PROCESSOS_SEED_KEY,
];

function loadStore() {
  try {
    const raw = window.localStorage.getItem(PROCESSOS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toProcessRows(store) {
  return Object.values(store || {}).filter((x) => x && typeof x === 'object');
}

function parseValorMonetarioBr(valor) {
  const cleaned = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function executarMigracaoAssistidaPhase4Processos() {
  if (typeof window === 'undefined') return null;
  if (window.localStorage.getItem(IMPORT_DONE_KEY) === '1') return null;
  if (import.meta.env.VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS !== 'true') return null;
  if (!featureFlags.useApiProcessos) return null;

  const store = loadStore();
  const rows = toProcessRows(store);
  let cabecalhos = 0;
  let partes = 0;
  let andamentos = 0;
  let prazos = 0;

  for (const row of rows) {
    const codigo = String(row.codCliente ?? '').replace(/\D/g, '').padStart(8, '0');
    const procNum = Number(String(row.proc ?? '').replace(/\D/g, ''));
    if (!codigo || !Number.isFinite(procNum) || procNum < 1) continue;
    const cliente = await buscarClientePorCodigo(codigo);
    if (!cliente?.id) continue;
    const existente = await buscarProcessoPorChaveNatural(codigo, procNum);
    const saved = await salvarCabecalhoProcesso({
      clienteId: cliente.id,
      codigoCliente: codigo,
      numeroInterno: procNum,
      numeroProcessoNovo: row.numeroProcessoNovo || '',
      numeroProcessoVelho: row.numeroProcessoVelho || '',
      naturezaAcao: row.naturezaAcao || '',
      competencia: row.competencia || '',
      faseSelecionada: row.faseSelecionada || '',
      tramitacao: row.tramitacao || '',
      dataProtocolo: row.dataProtocolo || '',
      prazoFatal: row.prazoFatal || '',
      proximaConsultaData: row.proximaConsultaData || '',
      observacao: row.observacao || '',
      valorCausaNumero: parseValorMonetarioBr(row.valorCausa),
      estado: row.estado || '',
      cidade: row.cidade || '',
      consultaAutomatica: row.consultaAutomatica === true,
      statusAtivo: row.statusAtivo !== false,
      responsavel: row.responsavel || '',
      usuarioResponsavelId: null,
      processoId: existente?.id ?? null,
    });
    if (!saved?.id) continue;
    cabecalhos += 1;

    if (Array.isArray(row.parteClienteIds) || Array.isArray(row.parteOpostaIds)) {
      const novasPartes = [
        ...((row.parteClienteIds || []).map((id, ordem) => ({
          pessoaId: Number(id),
          nomeLivre: null,
          polo: 'AUTOR',
          qualificacao: 'Parte cliente',
          ordem,
        }))),
        ...((row.parteOpostaIds || []).map((id, ordem) => ({
          pessoaId: Number(id),
          nomeLivre: null,
          polo: 'REU',
          qualificacao: 'Parte oposta',
          ordem,
        }))),
      ];
      if (novasPartes.length > 0) {
        await sincronizarPartesIncremental(saved.id, novasPartes);
        partes += novasPartes.length;
      }
    }

    if (Array.isArray(row.historico) && row.historico.length > 0) {
      await sincronizarAndamentosIncremental(saved.id, row.historico);
      andamentos += row.historico.length;
    }

    if (row.prazoFatal) {
      await upsertPrazoFatalProcesso(saved.id, row.prazoFatal);
      prazos += 1;
    }
  }

  window.localStorage.setItem(IMPORT_DONE_KEY, '1');
  return { cabecalhos, partes, andamentos, prazos };
}
