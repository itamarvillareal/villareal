/**
 * Linhas base do Relatório Processos: todos os códigos em {@link CLIENTE_PARA_PESSOA} × processos 1…10,
 * mesma fonte que a grade do Cadastro de Clientes / Processos ({@link getDadosProcessoClienteUnificado}).
 */
import { getDadosProcessoClienteUnificado } from './processoClienteProcUnificado.js';
import { gerarMockProcesso } from './processosDadosRelatorio.js';
import { CLIENTE_PARA_PESSOA, getIdPessoaPorCodCliente } from './clientesCadastradosMock.js';
import { getPessoaPorId } from './cadastroPessoasMock.js';
import { processosClienteMock } from './mockData.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import { listarProcessosPorCodigoCliente, mapApiProcessoToUiShape } from '../repositories/processosRepository.js';

const CONSULTORES = ['Karla Almeida', 'ITAMAR', 'DAAE', 'Ana Luisa'];

function pad8(n) {
  return String(Math.floor(Number(n))).padStart(8, '0');
}

/** Mesma regra da aba Clientes (CadastroClientes): nome do cadastro de pessoas por código. */
export function getNomeClienteCadastroPorCodigo(codNum) {
  const n = Number(codNum);
  if (!Number.isFinite(n) || n < 1) return 'CLIENTE 0001';
  const id = getIdPessoaPorCodCliente(n);
  const pes = id != null ? getPessoaPorId(id) : null;
  const nome = pes?.nome?.trim();
  if (nome) return nome;
  return `CLIENTE ${String(n).padStart(4, '0')}`;
}

function dataBrDeslocada(c, p, diasExtra) {
  const base = new Date(2024, 5, 10);
  base.setDate(base.getDate() + diasExtra + c * 2 + p * 3);
  const dd = String(base.getDate()).padStart(2, '0');
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const yyyy = base.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Quantidade de processos por cliente no relatório (= lista mock de 10 descrições no cadastro). */
const PROCESSOS_POR_CLIENTE_RELATORIO = 10;

function listarCodigosClientesMockOrdenados() {
  return Object.keys(CLIENTE_PARA_PESSOA)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b);
}

function paresRelatorioProcessos() {
  const out = [];
  const cods = listarCodigosClientesMockOrdenados();
  for (const c of cods) {
    for (let p = 1; p <= PROCESSOS_POR_CLIENTE_RELATORIO; p++) {
      out.push([c, p]);
    }
  }
  return out;
}

export const RELATORIO_PROCESSOS_MOCK_COUNT = paresRelatorioProcessos().length;

/** Pares [código cliente, proc. 1…10] do mock — usado pelo Relatório Cálculos e geração de rodadas mock. */
export function getParesClienteProcMockRelatorio() {
  return paresRelatorioProcessos();
}

/**
 * Uma linha “crua” antes de {@link enriquecerCamposRelatorioProcessos} (cliente = aba Clientes; demais alinhados ao processo unificado).
 */
export function getRelatorioProcessosMockLinhasBase() {
  const pairs = paresRelatorioProcessos();
  return pairs.map(([c, p], idx) => {
    const u = getDadosProcessoClienteUnificado(c, p);
    const m = gerarMockProcesso(c, p);
    if (!u) return null;

    const descricao =
      processosClienteMock[p - 1]?.descricao?.trim() ||
      String(m.naturezaAcao ?? u.naturezaAcao ?? '').trim() ||
      '—';

    const parteSlice = String(u.parteCliente ?? '').slice(0, 40);

    const consultor = CONSULTORES[(c + p + idx) % CONSULTORES.length];
    const temPrazo = (c + p + idx) % 4 === 0;
    const temAud = (c + p * 2) % 5 === 0;

    return {
      cliente: getNomeClienteCadastroPorCodigo(c),
      codCliente: pad8(c),
      proc: String(p),
      numeroProcesso: u.processoNovo,
      inRequerente: (c + p + idx) % 4 === 1 ? 'REQUERIDO' : '',
      ultimoAndamento: `ANDAMENTO — ${String(m.naturezaAcao ?? u.naturezaAcao ?? '—').slice(0, 80)}`,
      dataConsulta: dataBrDeslocada(c, p, 0),
      proximaConsulta: dataBrDeslocada(c, p, 28),
      observacaoProcesso: `Proc. cadastro ${pad8(c)} / ${p}${parteSlice ? ` · ${parteSlice}…` : ''}`,
      consultor,
      lmv: String((c * 3 + p * 5) % 40 || 1),
      fase: m.faseSelecionada || 'Em Andamento',
      observacaoFase: '',
      descricaoAcao: descricao,
      prazoFatal: temPrazo ? dataBrDeslocada(c, p, 60) : '',
      competencia: m.competencia,
      dataAudiencia: temAud ? dataBrDeslocada(c, p, 14) : '',
      horaAudiencia: temAud ? `${String(8 + ((c + p) % 10)).padStart(2, '0')}:00` : '',
      cepReu: String(74000000 + ((c * 17 + p) % 9999)),
      inv: String((c + p) % 35 || 1),
      consultas: String(12 + ((idx * 13 + c * 3) % 50)),
    };
  }).filter(Boolean);
}

/**
 * Linhas cruas do relatório (mesmo formato que {@link getRelatorioProcessosMockLinhasBase}).
 * Com API (processos + clientes): lista clientes e processos reais; caso contrário usa só o mock.
 */
export async function obterLinhasBaseRelatorioProcessos() {
  if (!featureFlags.useApiProcessos || !featureFlags.useApiClientes) {
    return getRelatorioProcessosMockLinhasBase();
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
