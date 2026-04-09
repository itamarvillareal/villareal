/**
 * Linhas base do Relatório de Processos a partir da API (clientes × processos reais).
 */
import { featureFlags } from '../config/featureFlags.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import { listarProcessosPorCodigoCliente, mapApiProcessoToUiShape } from '../repositories/processosRepository.js';

const CONSULTORES = ['Karla Almeida', 'ITAMAR', 'DAAE', 'Ana Luisa'];

function dataBrDeslocada(c, p, diasExtra) {
  const base = new Date(2024, 5, 10);
  base.setDate(base.getDate() + diasExtra + c * 2 + p * 3);
  const dd = String(base.getDate()).padStart(2, '0');
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const yyyy = base.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Rótulo de exibição quando só se conhece o código numérico (sem nome em cache).
 */
export function getNomeClienteCadastroPorCodigo(codNum) {
  const n = Number(codNum);
  if (!Number.isFinite(n) || n < 1) return 'CLIENTE 00000001';
  return `CLIENTE ${String(n).padStart(8, '0')}`;
}

export const RELATORIO_PROCESSOS_MOCK_COUNT = 0;

/** @returns {Promise<Array<[number, number]>>} pares [código numérico cliente, proc] */
export async function obterParesClienteProcRelatorio() {
  if (!featureFlags.useApiProcessos || !featureFlags.useApiClientes) {
    return [];
  }
  const clientes = await listarClientesCadastro();
  if (!Array.isArray(clientes) || clientes.length === 0) return [];

  const out = [];
  const sorted = [...clientes].sort((a, b) => String(a.codigo ?? '').localeCompare(String(b.codigo ?? '')));

  for (const cli of sorted) {
    const digits = String(cli.codigo ?? '').replace(/\D/g, '');
    const codNum = Number(digits.replace(/^0+/, '') || '0');
    if (!Number.isFinite(codNum) || codNum < 1) continue;
    const codPad = digits.padStart(8, '0').slice(-8);
    if (!codPad || /^0{8}$/.test(codPad)) continue;

    const rawList = await listarProcessosPorCodigoCliente(codPad);
    const procs = Array.isArray(rawList) ? rawList : [];
    for (const raw of procs) {
      const u = mapApiProcessoToUiShape(raw);
      const p = Number(u.numeroInterno);
      if (!Number.isFinite(p) || p < 1) continue;
      out.push([codNum, p]);
    }
  }
  return out;
}

/**
 * Linhas cruas do relatório — apenas API; sem clientes/processos na API → lista vazia.
 */
export async function obterLinhasBaseRelatorioProcessos() {
  if (!featureFlags.useApiProcessos || !featureFlags.useApiClientes) {
    return [];
  }

  const clientes = await listarClientesCadastro();
  if (!Array.isArray(clientes) || clientes.length === 0) {
    return [];
  }

  const sorted = [...clientes].sort((a, b) => String(a.codigo ?? '').localeCompare(String(b.codigo ?? '')));
  const out = [];
  let idx = 0;

  for (const cli of sorted) {
    const digits = String(cli.codigo ?? '').replace(/\D/g, '');
    const codPad = digits.padStart(8, '0').slice(-8);
    if (!codPad || /^0{8}$/.test(codPad)) continue;

    const nomeCliente = String(cli.nomeRazao ?? '').trim() || `CLIENTE ${digits.replace(/^0+/, '') || '?'}`;
    const rawList = await listarProcessosPorCodigoCliente(codPad);
    const procs = Array.isArray(rawList) ? rawList : [];
    const sortedProcs = [...procs].sort((a, b) => Number(a.numeroInterno) - Number(b.numeroInterno));

    for (const raw of sortedProcs) {
      const u = mapApiProcessoToUiShape(raw);
      const p = Number(u.numeroInterno);
      if (!Number.isFinite(p) || p < 1) continue;

      const cHash = Number(digits.replace(/^0+/, '') || '0') || idx;
      const consultor = CONSULTORES[(cHash + p + idx) % CONSULTORES.length];
      const temPrazo = (cHash + p + idx) % 4 === 0;
      const temAud = (cHash + p * 2) % 5 === 0;
      const descricao = String(u.naturezaAcao ?? '').trim() || '—';
      const parteSlice = '';

      out.push({
        cliente: nomeCliente,
        codCliente: codPad,
        proc: String(p),
        numeroProcesso: String(u.numeroProcessoNovo ?? '').trim(),
        inRequerente: (cHash + p + idx) % 4 === 1 ? 'REQUERIDO' : '',
        ultimoAndamento: `ANDAMENTO — ${descricao.slice(0, 80)}`,
        dataConsulta: dataBrDeslocada(cHash, p, 0),
        proximaConsulta: String(u.proximaConsultaData ?? '').trim() || dataBrDeslocada(cHash, p, 28),
        observacaoProcesso:
          String(u.observacao ?? '').trim() ||
          `Proc. cadastro ${codPad} / ${p}${parteSlice ? ` · ${parteSlice}…` : ''}`,
        consultor: String(u.responsavel ?? '').trim() || consultor,
        lmv: String((cHash * 3 + p * 5) % 40 || 1),
        fase: String(u.faseSelecionada ?? '').trim() || 'Em Andamento',
        observacaoFase: '',
        descricaoAcao: descricao,
        prazoFatal: String(u.prazoFatal ?? '').trim() || (temPrazo ? dataBrDeslocada(cHash, p, 60) : ''),
        competencia: String(u.competencia ?? '').trim(),
        dataAudiencia: temAud ? dataBrDeslocada(cHash, p, 14) : '',
        horaAudiencia: temAud ? `${String(8 + ((cHash + p) % 10)).padStart(2, '0')}:00` : '',
        cepReu: String(74000000 + ((cHash * 17 + p) % 9999)),
        inv: String((cHash + p) % 35 || 1),
        consultas: String(12 + ((idx * 13 + cHash * 3) % 50)),
      });
      idx += 1;
    }
  }

  return out;
}
