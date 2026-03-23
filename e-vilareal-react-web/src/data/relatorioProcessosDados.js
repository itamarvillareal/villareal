/**
 * Linhas base do Relatório Processos: todos os códigos em {@link CLIENTE_PARA_PESSOA} × processos 1…10,
 * mesma fonte que a grade do Cadastro de Clientes / Processos ({@link getDadosProcessoClienteUnificado}).
 */
import { getDadosProcessoClienteUnificado } from './processoClienteProcUnificado.js';
import { gerarMockProcesso } from './processosDadosRelatorio.js';
import { CLIENTE_PARA_PESSOA, getIdPessoaPorCodCliente } from './clientesCadastradosMock.js';
import { getPessoaPorId } from './cadastroPessoasMock.js';
import { processosClienteMock } from './mockData.js';

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
      'AÇÃO (MOCK)';

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
      ultimoAndamento: `ANDAMENTO — ${String(m.naturezaAcao ?? u.naturezaAcao ?? 'MOCK').slice(0, 80)}`,
      dataConsulta: dataBrDeslocada(c, p, 0),
      proximaConsulta: dataBrDeslocada(c, p, 28),
      observacaoProcesso: `Proc. cadastro ${pad8(c)} / ${p}${parteSlice ? ` · ${parteSlice}…` : ''}`,
      consultor,
      lmv: String((c * 3 + p * 5) % 40 || 1),
      fase: m.faseSelecionada || 'Em Andamento',
      observacaoFase: idx % 7 === 3 ? 'Obs. fase (mock alinhado)' : '',
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
