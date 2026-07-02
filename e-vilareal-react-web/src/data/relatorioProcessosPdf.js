/**
 * Exportação PDF do Relatório de Processos (grade com filtros aplicados).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MODOS_FILTRO_COLUNA } from './relatorioFiltroColuna.js';
import { CAMPOS_OPCOES_ULTIMO_ANDAMENTO } from './relatorioProcessosColunaDinamica.js';
import { normalizarFiltroProcessoAtivo } from './relatorioPresets.js';

const ROTULO_FILTRO_ATIVO = {
  ativos: 'Somente processos ativos',
  inativos: 'Somente processos inativos',
  todos: 'Processos ativos e inativos',
};

/** Pesos relativos por campo (colunas estreitas vs largas). */
const PESO_COLUNA_PDF = {
  codCliente: 0.55,
  proc: 0.4,
  horaAudiencia: 0.45,
  dataConsulta: 0.65,
  proximaConsulta: 0.65,
  prazoFatal: 0.65,
  dataAudiencia: 0.65,
  cepReu: 0.55,
  inRequerente: 0.45,
  consultas: 0.45,
  statusAtivoTexto: 0.55,
  cliente: 1.15,
  numeroProcesso: 1.25,
  unidade: 0.55,
  ultimoAndamento: 1.35,
  observacaoProcesso: 1.1,
  observacaoFase: 1,
  consultor: 0.75,
  fase: 0.75,
  competencia: 0.75,
  descricaoAcao: 1,
  naturezaAcaoProcesso: 0.85,
  parteCliente: 1.1,
  parteOposta: 1.1,
  valorCausaProcesso: 0.75,
  enderecoImovel: 1.2,
};

const MARGEM = { top: 28, right: 24, bottom: 32, left: 24 };

/** Nome padrão: `Relatorio_Processos_AAAAMMDD.pdf`. */
export function nomeArquivoRelatorioProcessosPdf() {
  const hoje = new Date();
  const yyyy = String(hoje.getFullYear());
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');
  return `Relatorio_Processos_${yyyy}${mm}${dd}.pdf`;
}

/** Rótulo exibido no cabeçalho da coluna (respeita campo dinâmico por slot). */
export function rotuloCampoColunaRelatorio(col, campoPorColuna) {
  const chave = campoPorColuna?.[col.id] ?? col.id;
  return CAMPOS_OPCOES_ULTIMO_ANDAMENTO.find((o) => o.fieldKey === chave)?.label ?? col.label ?? chave;
}

function fontSizeParaQuantidadeColunas(qtd) {
  if (qtd <= 6) return 8;
  if (qtd <= 10) return 7;
  if (qtd <= 14) return 6.5;
  if (qtd <= 20) return 6;
  return 5.5;
}

function maxCharsCelula(qtd) {
  if (qtd <= 8) return 120;
  if (qtd <= 14) return 80;
  if (qtd <= 20) return 55;
  return 40;
}

function valorCelulaPdf(valor, maxLen) {
  const t = String(valor ?? '').trim();
  const v = t || '—';
  if (v.length <= maxLen) return v;
  return `${v.slice(0, Math.max(1, maxLen - 1))}…`;
}

function indiceColunasRepetirHorizontal(cols, campoPorColuna) {
  const preferidas = ['codCliente', 'cliente', 'numeroProcesso', 'proc'];
  const indices = [];
  for (const key of preferidas) {
    const idx = cols.findIndex((col) => (campoPorColuna[col.id] ?? col.id) === key);
    if (idx >= 0) indices.push(idx);
  }
  return indices.length ? indices : [0];
}

function calcularEstilosColunas(cols, campoPorColuna, larguraUtil) {
  const pesos = cols.map((col) => {
    const chave = campoPorColuna[col.id] ?? col.id;
    return PESO_COLUNA_PDF[chave] ?? 0.85;
  });
  const soma = pesos.reduce((a, b) => a + b, 0) || 1;
  const styles = {};
  cols.forEach((col, i) => {
    styles[i] = {
      cellWidth: (pesos[i] / soma) * larguraUtil,
    };
  });
  return styles;
}

function desenharRodapePagina(doc, dataGeracao) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const pagina = doc.getCurrentPageInfo().pageNumber;
  const total = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Villa Real — gerado em ${dataGeracao}`, MARGEM.left, altura - 14);
  doc.text(`Página ${pagina}/${total}`, largura - MARGEM.right, altura - 14, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function desenharBlocoCabecalho(doc, filtrosDescricao, larguraUtil) {
  let y = MARGEM.top;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório de Processos', MARGEM.left, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  y += 14;

  const linhasMeta = Array.isArray(filtrosDescricao) ? filtrosDescricao : [];
  for (const linha of linhasMeta) {
    const partes = doc.splitTextToSize(String(linha), larguraUtil);
    doc.text(partes, MARGEM.left, y);
    y += partes.length * 10 + 2;
  }

  return y + 6;
}

/**
 * Monta linhas de texto descrevendo os filtros ativos (para o cabeçalho do PDF).
 */
export function descreverFiltrosRelatorioProcessos({
  filtroProcessoAtivo,
  filtrosPorColuna = {},
  modoFiltroPorColuna = {},
  campoPorColuna = {},
  colunas = [],
  totalLinhas,
  linhasFiltradas,
}) {
  const linhas = [];
  const f = normalizarFiltroProcessoAtivo(filtroProcessoAtivo);
  linhas.push(ROTULO_FILTRO_ATIVO[f] ?? ROTULO_FILTRO_ATIVO.ativos);

  for (const col of colunas) {
    const modo = modoFiltroPorColuna[col.id] ?? MODOS_FILTRO_COLUNA.contem;
    const filtro = String(filtrosPorColuna[col.id] ?? '').trim();
    const label = rotuloCampoColunaRelatorio(col, campoPorColuna);

    if (modo === MODOS_FILTRO_COLUNA.vazios) {
      linhas.push(`${label}: vazios`);
      continue;
    }
    if (modo === MODOS_FILTRO_COLUNA.preenchidos) {
      linhas.push(`${label}: com valor`);
      continue;
    }
    if (filtro) {
      linhas.push(`${label}: contém «${filtro}»`);
    }
  }

  if (
    totalLinhas != null &&
    linhasFiltradas != null &&
    Number.isFinite(totalLinhas) &&
    Number.isFinite(linhasFiltradas) &&
    linhasFiltradas !== totalLinhas
  ) {
    linhas.push(`Exibindo ${linhasFiltradas} de ${totalLinhas} processos`);
  } else if (linhasFiltradas != null && Number.isFinite(linhasFiltradas)) {
    linhas.push(`${linhasFiltradas} processo(s) no relatório`);
  }

  return linhas;
}

/**
 * @param {object} params
 * @param {Array<Record<string, unknown>>} params.linhas — linhas já filtradas e ordenadas
 * @param {Array<{ id: string, label?: string }>} params.colunasAtivas — colunas visíveis
 * @param {Record<string, string>} [params.campoPorColuna]
 * @param {string[]} [params.filtrosDescricao]
 * @returns {import('jspdf').jsPDF}
 */
export function construirRelatorioProcessosPdf({
  linhas,
  colunasAtivas,
  campoPorColuna = {},
  filtrosDescricao = [],
}) {
  const rows = Array.isArray(linhas) ? linhas : [];
  const cols = Array.isArray(colunasAtivas) ? colunasAtivas : [];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const larguraUtil = larguraPagina - MARGEM.left - MARGEM.right;
  const dataGeracao = new Date().toLocaleString('pt-BR');
  const fontSize = fontSizeParaQuantidadeColunas(cols.length);
  const maxChars = maxCharsCelula(cols.length);
  const usarQuebraHorizontal = cols.length > 10;

  const startY = desenharBlocoCabecalho(doc, filtrosDescricao, larguraUtil);

  const headers = cols.map((col) => rotuloCampoColunaRelatorio(col, campoPorColuna));
  const body = rows.map((row) =>
    cols.map((col) => {
      const chave = campoPorColuna[col.id] ?? col.id;
      return valorCelulaPdf(row[chave], maxChars);
    }),
  );

  autoTable(doc, {
    startY,
    head: [headers],
    body,
    tableWidth: larguraUtil,
    columnStyles: usarQuebraHorizontal ? undefined : calcularEstilosColunas(cols, campoPorColuna, larguraUtil),
    styles: {
      fontSize,
      cellPadding: cols.length > 14 ? 2 : 2.5,
      overflow: 'linebreak',
      valign: 'top',
      lineWidth: 0.1,
      lineColor: [226, 232, 240],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: Math.max(5, fontSize - 0.5),
      halign: 'left',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: MARGEM,
    showHead: 'everyPage',
    horizontalPageBreak: usarQuebraHorizontal,
    horizontalPageBreakRepeat: usarQuebraHorizontal ? indiceColunasRepetirHorizontal(cols, campoPorColuna) : undefined,
    didDrawPage: () => desenharRodapePagina(doc, dataGeracao),
  });

  return doc;
}

/** Gera e dispara download do PDF. */
export function baixarRelatorioProcessosPdf(params) {
  const doc = construirRelatorioProcessosPdf(params);
  doc.save(nomeArquivoRelatorioProcessosPdf());
}
