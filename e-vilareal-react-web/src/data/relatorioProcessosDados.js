/**
 * Linhas base do Relatório Processos: mesmos vínculos (cod. cliente + proc) da grade 10×10
 * de {@link ../processosMock.js} e {@link ./processosDadosRelatorio.js}, com nome de **Cliente**
 * igual ao da aba Clientes (cadastro de pessoas via clientesCadastradosMock).
 */
import { getMockProcesso10x10 } from './processosMock.js';
import { gerarMockProcesso } from './processosDadosRelatorio.js';
import { getIdPessoaPorCodCliente } from './clientesCadastradosMock.js';
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

/**
 * Pares (cliente, proc) dentro do mock 10×10 — 21 linhas para manter densidade semelhante ao mock antigo.
 * 10× proc 1 + 10× proc 2 + (1,3).
 */
function paresRelatorioProcessos() {
  const pairs = [];
  for (let c = 1; c <= 10; c++) pairs.push([c, 1]);
  for (let c = 1; c <= 10; c++) pairs.push([c, 2]);
  pairs.push([1, 3]);
  return pairs;
}

export const RELATORIO_PROCESSOS_MOCK_COUNT = paresRelatorioProcessos().length;

/**
 * Uma linha “crua” antes de {@link enriquecerCamposRelatorioProcessos} (cliente = aba Clientes; demais campos alinhados ao Processo).
 */
export function getRelatorioProcessosMockLinhasBase() {
  const pairs = paresRelatorioProcessos();
  return pairs.map(([c, p], idx) => {
    const mock10 = getMockProcesso10x10(c, p);
    const m = gerarMockProcesso(c, p);
    if (!mock10) return null;

    const descricao =
      processosClienteMock[p - 1]?.descricao?.trim() || String(m.naturezaAcao ?? '').trim() || 'AÇÃO (MOCK)';

    const consultor = CONSULTORES[(c + p + idx) % CONSULTORES.length];
    const temPrazo = (c + p + idx) % 4 === 0;
    const temAud = (c + p * 2) % 5 === 0;

    return {
      cliente: getNomeClienteCadastroPorCodigo(c),
      codCliente: pad8(c),
      proc: String(p),
      numeroProcesso: mock10.numeroProcessoNovo,
      inRequerente: (c + p + idx) % 4 === 1 ? 'REQUERIDO' : '',
      ultimoAndamento: `ANDAMENTO — ${String(m.naturezaAcao ?? 'MOCK').slice(0, 80)}`,
      dataConsulta: dataBrDeslocada(c, p, 0),
      proximaConsulta: dataBrDeslocada(c, p, 28),
      observacaoProcesso: `Proc. cadastro ${pad8(c)} / ${p} · ${mock10.parteCliente.slice(0, 40)}…`,
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
