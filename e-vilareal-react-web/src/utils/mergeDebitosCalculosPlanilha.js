/**
 * Merge de linhas da planilha `debitos.xlsx` no mapa de rodadas de Cálculos (aba Parcelamento).
 * Colunas: A=código cliente, B=vencimento 1ª parcela, C=valor 1ª parcela, G=processo, H=dimensão.
 * Linha 1 = cabeçalho; dados a partir da linha 2 (índice 1 na matriz).
 *
 * Módulo autossuficiente (sem importar `processosDadosRelatorio`) para o script Node não puxar o grafo da app.
 */

const PARCELAS_POR_PAGINA_MOCK = 20;

function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(n);
}

function normalizarProcesso(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

function padCliente(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

function gerarCabecalhoMock() {
  return { autor: '', reu: '' };
}

function gerarTitulosMock() {
  const vazio = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
  };
  return Array.from({ length: 60 }, () => ({ ...vazio }));
}

function linhaVaziaParcela() {
  return {
    dataVencimento: '',
    valorParcela: '',
    honorariosParcela: '',
    observacao: '',
    dataPagamento: '',
  };
}

function gerarParcelasMock() {
  return Array.from({ length: PARCELAS_POR_PAGINA_MOCK }, () => linhaVaziaParcela());
}

function criarRodadaMockCalculos(_codClienteRaw, _procRaw, _dimensaoRaw, overrides = {}) {
  const base = {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: gerarTitulosMock(),
    parcelas: gerarParcelasMock(),
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(),
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: undefined,
  };
  return { ...base, ...overrides };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Serial Excel (parte inteira) → YYYY-MM-DD (UTC), alinhado a import-agenda-planilha.mjs */
function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Célula de data → ISO yyyy-mm-dd ou null */
function parseDataCelulaParaISO(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
    if (val >= 1 && val <= 31 && val === Math.floor(val)) return null;
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isoParaDataBR(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

export function formatBRLDebitos(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseValorCelula(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const s = String(val)
    .trim()
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rodadaKeyFromAGH(codRaw, procRaw, dimRaw) {
  const cod8 = padCliente(codRaw);
  const proc = normalizarProcesso(procRaw);
  const dim = Math.max(0, Math.floor(Number(dimRaw) || 0));
  return `${cod8}:${proc}:${dim}`;
}

function cloneRodada(r) {
  try {
    return JSON.parse(JSON.stringify(r));
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} rodadasAtual
 * @param {unknown[][]} matrix - primeira linha = cabeçalho
 * @returns {{ nextRodadas: Record<string, unknown>, stats: { linhasLidas: number, aplicadas: number, ignoradas: number, avisos: string[] } }}
 */
export function mergeDebitosCalculosPlanilha(rodadasAtual, matrix) {
  const base = rodadasAtual && typeof rodadasAtual === 'object' ? { ...rodadasAtual } : {};
  const avisos = [];
  let linhasLidas = 0;
  let ignoradas = 0;
  let aplicadas = 0;

  if (!Array.isArray(matrix) || matrix.length < 2) {
    return {
      nextRodadas: base,
      stats: { linhasLidas: 0, aplicadas: 0, ignoradas: 0, avisos: ['Planilha sem linhas de dados (apenas cabeçalho ou vazia).'] },
    };
  }

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    linhasLidas += 1;
    const sheetRow = i + 1;
    const a = row[0];
    const b = row[1];
    const c = row[2];
    const g = row[6];
    const h = row[7];

    const codNum = Number(String(a ?? '').trim().replace(/\D/g, '') || NaN);
    const procNum = Number(String(g ?? '').trim().replace(/\D/g, '') || NaN);
    if (!Number.isFinite(codNum) || codNum < 1 || !Number.isFinite(procNum) || procNum < 1) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: ignorada (código cliente ou processo inválido).`);
      continue;
    }

    const dim = h === '' || h == null ? 0 : Math.max(0, Math.floor(Number(h) || 0));
    const key = rodadaKeyFromAGH(codNum, procNum, dim);

    const iso = parseDataCelulaParaISO(b);
    const dataBR = iso ? isoParaDataBR(iso) : '';
    const valorNum = parseValorCelula(c);
    const valorBRL = valorNum != null ? formatBRLDebitos(valorNum) : '';

    if (!dataBR && !valorBRL) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: ignorada (sem data nem valor em B/C).`);
      continue;
    }

    let rodada = base[key] ? cloneRodada(base[key]) : null;
    if (!rodada) {
      rodada = criarRodadaMockCalculos(codNum, procNum, dim);
    }
    if (!rodada) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: falha ao criar rodada.`);
      continue;
    }

    const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas.map((p) => ({ ...p })) : gerarParcelasMock();
    while (parcelas.length < 1) parcelas.push(linhaVaziaParcela());
    const p0 = { ...parcelas[0] };
    if (dataBR) p0.dataVencimento = dataBR;
    if (valorBRL) p0.valorParcela = valorBRL;
    parcelas[0] = p0;

    let qty = String(rodada.quantidadeParcelasInformada ?? '00');
    if ((dataBR || valorBRL) && (qty === '00' || qty === '')) {
      qty = '01';
    }

    base[key] = {
      ...rodada,
      parcelas,
      quantidadeParcelasInformada: qty,
    };
    aplicadas += 1;
  }

  return {
    nextRodadas: base,
    stats: { linhasLidas, aplicadas, ignoradas, avisos },
  };
}

const ROW_CABECALHO_PLACEHOLDER = ['cod', 'venc', 'valor', '', '', '', 'proc', 'dim'];

/**
 * Mescla várias matrizes (ex.: uma por folha do Excel). Na 2ª folha em diante, se a 1ª linha
 * já parecer dados (A e G com cliente e processo válidos), insere cabeçalho fictício para o merge
 * manter «linha 1 = cabeçalho» em todas as folhas.
 */
export function mergeDebitosCalculosMultiSheet(rodadasAtual, matrices) {
  const list = Array.isArray(matrices) ? matrices : [];
  let acc = rodadasAtual && typeof rodadasAtual === 'object' ? { ...rodadasAtual } : {};
  const avisos = [];
  let linhasLidas = 0;
  let aplicadas = 0;
  let ignoradas = 0;
  let sheetsUsadas = 0;

  for (let i = 0; i < list.length; i += 1) {
    let m = list[i];
    if (!Array.isArray(m) || m.length === 0) continue;
    if (i > 0 && m.length > 0) {
      const first = m[0];
      const codProbe = Number(String(first?.[0] ?? '').replace(/\D/g, '') || NaN);
      const procProbe = Number(String(first?.[6] ?? '').replace(/\D/g, '') || NaN);
      const pareceLinhaDados =
        Number.isFinite(codProbe) &&
        codProbe >= 1 &&
        Number.isFinite(procProbe) &&
        procProbe >= 1;
      if (pareceLinhaDados) {
        m = [ROW_CABECALHO_PLACEHOLDER, ...m];
      }
    }
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha(acc, m);
    acc = nextRodadas;
    linhasLidas += stats.linhasLidas;
    aplicadas += stats.aplicadas;
    ignoradas += stats.ignoradas;
    for (const a of stats.avisos) avisos.push(`Folha ${i + 1}: ${a}`);
    sheetsUsadas += 1;
  }

  return {
    nextRodadas: acc,
    stats: { linhasLidas, aplicadas, ignoradas, avisos, sheetsUsadas },
  };
}
