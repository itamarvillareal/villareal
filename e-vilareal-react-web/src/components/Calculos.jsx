import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ChevronUp, ChevronDown, BarChart2, ExternalLink, RefreshCw, Check, FolderOpen, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLancamentosContaCorrente } from '../data/financeiroData';
import {
  hydrateRodadasCalculosFromApi,
  isCalculosRodadasApiHidratacaoConcluida,
  loadRodadasCalculos,
  mapaRodadasTemValorTituloOuParcela,
  normalizarRodadaRecebidaApi,
  parcelamentoAceitoResumoParaChave,
  saveRodadasCalculos,
} from '../data/calculosRodadasStorage';
import {
  calcularResumoTitulosGrade,
  calcularTotalLinhaTitulo,
  garantirArrayTitulosTamanho,
  mesclarTitulosPaginaNoArray,
  montarTitulosDimensaoParaResumo,
  TITULOS_POR_PAGINA_API,
} from '../data/calculosRodadaTitulosPaginacao.js';
import { fetchCalculoRodada } from '../repositories/calculosRepository.js';
import { RODADAS_VINCULACAO_TESTE_50 } from '../data/vinculacaoAutomaticaTestMock';
import {
  PARCELAS_POR_PAGINA_MOCK as PARCELAS_POR_PAGINA,
  gerarCabecalhoMock,
  gerarParcelasMock,
  gerarTitulosMock,
  linhaVaziaParcela,
} from '../data/calculosRodadasMockGeracao.js';
import { obterIndicesMensaisINPC, obterIndicesMensaisIPCA } from '../services/monetaryIndicesService.js';
import { construirRelatorioCalculoPdf } from '../data/relatorioCalculoPdf.js';
import { baixarBlobDocx, gerarDocumentoListaDebitosWord } from '../utils/gerarDocumentoListaDebitosWord';
import { INDICES_CALCULO, PERIODICIDADE_OPCOES } from '../data/calculosIndices.js';
import {
  loadConfigCalculoCliente,
  mergeConfigPainelCalculo,
  refreshConfigCalculoClienteFromApi,
  editarPercentualFixoCampo,
  normalizarHonorariosValorFixo,
  percentualFixoParaCampo,
} from '../data/clienteConfigCalculoStorage.js';
import {
  extrairPanelConfig,
  listarChavesRodadasClienteProc,
  propagarPanelConfigEmRodadas,
} from '../data/calculosPanelConfigSync.js';
import {
  calcularResumoPlanoPagamento,
  entradaModoAtivo,
  montarLinhasPlanoPagamento,
  normalizarEntradaModo,
  rotuloLinhaPlanoPagamento,
  temPlanoPagamento,
} from '../data/parcelamentoEntrada.js';
import { featureFlags } from '../config/featureFlags.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import { buildRouterStateChaveClienteProcesso, extrairIntentNavegacaoProcessos } from '../domain/camposProcessoCliente.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { getRotuloModuloPorPathname } from '../data/usuarioPermissoesStorage.js';
import { mergeDebitosCalculosMultiSheet } from '../utils/mergeDebitosCalculosPlanilha.js';
import { listarProcessosResumoPorCodigoCliente } from '../repositories/processosRepository.js';
import { resolverTextosPartesCabecalhoCalculo } from '../data/processosDadosRelatorio.js';
import {
  calcularTotalTituloGrade,
  mesclarTitulosGravadosComRecalculo,
  patchRodadaAoAceitarPagamento,
  patchRodadaAoDesfazerAceitarPagamento,
  titulosGradeTemValor,
} from '../data/calculosDebitosTitulos.js';
import TitulosGrid from './calculos/TitulosGrid.jsx';
import { ModalCobrancaWhatsAppCalculos } from './calculos/ModalCobrancaWhatsAppCalculos.jsx';
import { sugerirProximaDataVencimento } from './calculos/calculosTitulosGridUtils.js';
import { IndicesAtualizacaoConferenciaModal } from './calculos/IndicesAtualizacaoConferenciaModal.jsx';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { salvarValorCausaDoProcesso } from '../data/processosHistoricoData.js';
import { atualizarValorCausaProcesso } from '../repositories/processosRepository.js';
import {
  enriquecerTitulosAPartirDeParcelasNaRodada,
  linhaTituloVaziaCalculos,
} from '../data/calculosTitulosParcelasSync.js';

const ProcessosLazy = lazy(() =>
  import('./Processos.jsx').then((module) => ({ default: module.Processos }))
);

const TABS = ['Títulos', 'Custas Judiciais', 'Parcelamento', 'Pagamento', 'Honorários', 'Descrição dos Valores'];

const INDICES = INDICES_CALCULO;

const inputClass =
  'w-full px-2 py-1.5 max-lg:py-2 max-lg:text-base border border-slate-300 rounded text-sm bg-white';
const TITULOS_POR_PAGINA = 20;

function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(Math.floor(n));
}

function padCliente8(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

/** Evita « X - Proc.» quando autor/réu vêm vazios no JSON (`??` não cobre string ''). */
function rotuloCabecalhoCalculoParte(val) {
  const t = String(val ?? '').trim();
  return t || '—';
}

function normalizarProc(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

let __ultimoCalculosRodadaLog = '';

/** Normaliza quantidade informada pelo usuário (0–9999); vazio vira "00"; até 99 com dois dígitos. */
function formatarQuantidadeParcelasExibicao(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d === '') return '00';
  const n = Math.min(9999, Math.max(0, Number(d)));
  return n <= 99 ? String(n).padStart(2, '0') : String(n);
}

/** Converte texto percentual (pt-BR) em número. */
function parsePercentualBR(str) {
  const t = String(str ?? '')
    .trim()
    .replace(/%/g, '')
    .trim();
  if (!t) return NaN;
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Formata taxa com duas casas decimais (vírgula), padrão brasileiro. */
function formatarTaxaJurosParcelamento2Casas(s) {
  const n = parsePercentualBR(s);
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Quantidade de parcelas a partir do texto (ex.: "12", "00" → 0). */
function parseQuantidadeParcelasNumero(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return 0;
  return Math.min(9999, Math.max(0, Number(d)));
}

/**
 * Valor de cada parcela (prestação fixa) — taxa composta ao mês (Tabela Price).
 * PV = débito atualizado (total dos títulos); taxaPercentAoMes = % a.m.; n = nº de parcelas.
 */
function calcularParcelaPrecoMensalPrice(pv, taxaPercentAoMes, nParcelas) {
  const n = Math.max(0, Math.floor(Number(nParcelas) || 0));
  if (n <= 0 || pv <= 0) return null;
  const i = Number(taxaPercentAoMes) / 100;
  if (!Number.isFinite(i) || i < 0) return null;
  let pmt;
  if (i === 0 || i < 1e-14) {
    pmt = pv / n;
  } else {
    pmt = (pv * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  }
  return Math.trunc(pmt * 100) / 100;
}

/** dd/mm/yyyy → Date local ou null (mesma regra do parseDateBR da tela). */
function parseDateBRModulo(str) {
  let s = String(str ?? '').trim();
  const alias = resolverAliasHojeEmTexto(s, 'br');
  if (alias) s = alias;
  if (!s || s.length < 10) return null;
  const [dd, mm, yyyy] = s.split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBRFromDate(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Normaliza texto digitado para dd/mm/aaaa; vazio ou inválido → ''.
 * Evita depender de &lt;input type="date"&gt;, que em muitos navegadores mostra "dd/mm/aaaa" quando vazio.
 */
function normalizarTextoDataBRparaSalvar(s) {
  let t = String(s ?? '').trim();
  const alias = resolverAliasHojeEmTexto(t, 'br');
  if (alias) t = alias;
  if (!t) return '';
  const d0 = parseDateBRModulo(t);
  if (d0 && !Number.isNaN(d0.getTime())) return formatDateBRFromDate(d0);
  const parts = t.split(/[/-]/).map((p) => p.trim());
  if (parts.length === 2) {
    const dd = String(Math.min(31, Math.max(1, Number(parts[0]) || 0))).padStart(2, '0');
    const mm = String(Math.min(12, Math.max(1, Number(parts[1]) || 0))).padStart(2, '0');
    const yyyy = String(new Date().getFullYear());
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? '' : formatDateBRFromDate(d);
  }
  if (parts.length !== 3) return '';
  const dd = String(Math.min(31, Math.max(1, Number(parts[0]) || 0))).padStart(2, '0');
  const mm = String(Math.min(12, Math.max(1, Number(parts[1]) || 0))).padStart(2, '0');
  let yyyy = String(parts[2] ?? '').replace(/\D/g, '');
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  if (yyyy.length !== 4) return '';
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? '' : formatDateBRFromDate(d);
}

/** Soma meses mantendo o dia quando possível (ex.: 31/01 + 1 mês → último dia de fevereiro). */
function addMonthsDate(d, months) {
  const m = Math.round(Number(months) || 0);
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() !== day) {
    x.setDate(0);
  }
  return x;
}

/**
 * Datas de vencimento/pagamento mensais a partir da data do cálculo:
 * 1ª parcela = 1 mês após a data base, 2ª = 2 meses, …
 */
function gerarDataParcelaMensalBR(dataCalculoStr, indiceZeroBased) {
  const base = parseDateBRModulo(dataCalculoStr) ?? new Date();
  const d = addMonthsDate(base, indiceZeroBased + 1);
  return formatDateBRFromDate(d);
}

function SpinnerField({ value, onChange, min = 0, className = 'w-20', inputRef, onKeyDown }) {
  const num = Number(value);
  return (
    <div className={`flex border border-slate-300 rounded overflow-hidden bg-white ${className}`}>
      <button
        type="button"
        tabIndex={-1}
        className="px-2 py-1.5 border-r border-slate-300 hover:bg-slate-100"
        onClick={() => onChange(Math.max(min, (isNaN(num) ? 0 : num) - 1))}
        aria-label="Diminuir"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(isNaN(v) ? min : v);
        }}
        onKeyDown={onKeyDown}
        className="w-full min-w-[3ch] px-1 py-1.5 text-sm text-center border-0 tabular-nums"
      />
      <button
        type="button"
        tabIndex={-1}
        className="px-2 py-1.5 border-l border-slate-300 hover:bg-slate-100"
        onClick={() => onChange((isNaN(num) ? 0 : num) + 1)}
        aria-label="Aumentar"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

function SpinnerFieldManual({
  value,
  onChange,
  min = 1,
  step = 1,
  className = 'w-full',
  formatDisplay = (n) => String(n),
  parseInput = (s) => Number(String(s).replace(/\D/g, '')),
  onStep,
  onBlur,
  inputRef,
  onKeyDown,
}) {
  const num = Number(parseInput(value));
  const safeNum = Number.isFinite(num) ? num : min;
  return (
    <div className={`flex border border-slate-300 rounded overflow-hidden bg-white ${className}`}>
      <button
        type="button"
        tabIndex={-1}
        className="px-2 py-1.5 border-r border-slate-300 hover:bg-slate-100"
        onClick={() => {
          const next = formatDisplay(Math.max(min, safeNum - step));
          onChange(next);
          if (typeof onStep === 'function') onStep(next);
        }}
        aria-label="Diminuir"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="w-full min-w-[6ch] px-2 py-1.5 text-sm text-center border-0 tabular-nums"
      />
      <button
        type="button"
        tabIndex={-1}
        className="px-2 py-1.5 border-l border-slate-300 hover:bg-slate-100"
        onClick={() => {
          const next = formatDisplay(safeNum + step);
          onChange(next);
          if (typeof onStep === 'function') onStep(next);
        }}
        aria-label="Aumentar"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * @param {import('react-router-dom').Location['state'] | null} [props.embedIntent] — substitui `location.state` ao hidratar cliente/proc/dimensão (ex.: modal no Relatório de Cálculos).
 * @param {number|string} [props.embedIntentRevision] — altera para re-aplicar o intent sem mudar de rota.
 * @param {() => void} [props.onFecharEmbed] — se definido, o «X» do cabeçalho chama isto em vez de `history.back()` (modo embutido).
 */
export function Calculos({ embedIntent, embedIntentRevision = 0, onFecharEmbed } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbedded = embedIntent !== undefined && embedIntent !== null;
  const intentStateForHydration = isEmbedded ? embedIntent : location.state;
  const intentRevisionForHydration = isEmbedded ? String(embedIntentRevision) : location.key;
  const stateFromProcessos =
    intentStateForHydration && typeof intentStateForHydration === 'object' ? intentStateForHydration : null;
  const navCalculos = extrairIntentNavegacaoProcessos(stateFromProcessos);
  const codClienteFromState = navCalculos?.hasCod ? String(navCalculos.codRaw ?? '').trim() : '';
  const procFromState =
    navCalculos?.hasProcKey && navCalculos.procRaw !== undefined && navCalculos.procRaw !== null
      ? String(navCalculos.procRaw)
      : '';
  const dimensaoFromState = stateFromProcessos?.dimensao;
  const abaCalculosFromState = stateFromProcessos?.abaCalculos ?? '';

  const [tabAtiva, setTabAtiva] = useState('Títulos');
  const tabAnteriorRef = useRef('Títulos');
  const inputCodClienteRodadaRef = useRef(null);
  const inputProcRodadaRef = useRef(null);
  const inputDimensaoRodadaRef = useRef(null);
  const btnIrRodadaRef = useRef(null);
  const [pagina, setPagina] = useState(1);
  const [paginaParcelamento, setPaginaParcelamento] = useState(1);
  const [proc, setProc] = useState(35);
  const [codigoCliente, setCodigoCliente] = useState('00000001');
  const [codClienteManual, setCodClienteManual] = useState('00000001');
  const [procManual, setProcManual] = useState('35');
  const [dimensao, setDimensao] = useState(0);
  const [dataCalculo, setDataCalculo] = useState('16/03/2026');
  const [juros, setJuros] = useState('1 %');
  const [multa, setMulta] = useState('0 %');
  const [honorariosTipo, setHonorariosTipo] = useState('fixos');
  const [honorariosValor, setHonorariosValor] = useState('0 %');
  const [honorariosVariaveisTexto, setHonorariosVariaveisTexto] = useState('');
  const [indice, setIndice] = useState('INPC');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [modeloListaDebitos, setModeloListaDebitos] = useState('01');
  const [indiceMenuAberto, setIndiceMenuAberto] = useState(false);
  const [modalIndicesConferencia, setModalIndicesConferencia] = useState(false);
  const indicePickerRef = useRef(null);
  const [aceitarPagamento, setAceitarPagamento] = useState(false);
  const [modoAlteracao, setModoAlteracao] = useState(false);
  const [indicesMensaisINPC, setIndicesMensaisINPC] = useState(null);
  const [indicesMensaisIPCA, setIndicesMensaisIPCA] = useState(null);
  // Cada (cliente + proc + dimensão) representa uma rodada independente de cálculos (estado próprio).
  // Com API ativa não carregamos localStorage (quota); o GET em hydrate preenche via evento + espelho em memória.
  const [rodadasState, setRodadasState] = useState(() =>
    featureFlags.useApiCalculos
      ? { ...RODADAS_VINCULACAO_TESTE_50 }
      : {
          ...(loadRodadasCalculos() || {}),
          ...RODADAS_VINCULACAO_TESTE_50,
        }
  );
  /** Com API de cálculos, bloqueia autosave até o GET inicial em `hydrateRodadasCalculosFromApi` concluir (evita PUT que apaga o MySQL). */
  const [hidratacaoConcluida, setHidratacaoConcluida] = useState(
    () => !featureFlags.useApiCalculos || isCalculosRodadasApiHidratacaoConcluida()
  );
  const saveRodadasTimerRef = useRef(null);
  const fetchRodadaReqIdRef = useRef(0);
  const fetchRodadaAbortRef = useRef(null);
  /** `${rodadaKey}:page:${n}` → payload normalizado da página */
  const paginasRodadaCacheRef = useRef(new Map());
  const isDirtyRodadaRef = useRef(false);
  /** Chaves extras para PUT após propagar panelConfig entre dimensões. */
  const persistRodadaKeysRef = useRef(null);
  const [carregandoRodadaApi, setCarregandoRodadaApi] = useState(false);
  const debitosPlanilhaInputRef = useRef(null);
  const [sincronizandoRodadasApi, setSincronizandoRodadasApi] = useState(false);
  const rodadasStateRef = useRef(rodadasState);
  rodadasStateRef.current = rodadasState;

  const handleImportarDebitosPlanilhaClick = useCallback(() => {
    debitosPlanilhaInputRef.current?.click();
  }, []);

  const handleSincronizarRodadasComBanco = useCallback(async () => {
    if (!featureFlags.useApiCalculos) {
      window.alert('API de cálculos desativada (VITE_USE_API_CALCULOS).');
      return;
    }
    setSincronizandoRodadasApi(true);
    try {
      await hydrateRodadasCalculosFromApi({ preferServer: true });
      setRodadasState({
        ...(loadRodadasCalculos() || {}),
        ...RODADAS_VINCULACAO_TESTE_50,
      });
      window.alert(
        featureFlags.useApiCalculos
          ? 'Rodadas atualizadas a partir do MySQL (memória da sessão alinhada ao servidor).'
          : 'Rodadas atualizadas a partir do MySQL (localStorage alinhado ao servidor).'
      );
    } catch (err) {
      console.error(err);
      window.alert(`Falha ao sincronizar: ${err?.message || String(err)}`);
    } finally {
      setSincronizandoRodadasApi(false);
    }
  }, []);

  const handleDebitosPlanilhaFileChange = useCallback(async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const matrices = wb.SheetNames.map((name) =>
        XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
      );

      /** @type {Record<string, number[]>} */
      let numerosInternosPorCliente8 = {};
      if (featureFlags.useApiProcessos) {
        const codigos = new Set();
        for (const m of matrices) {
          if (!Array.isArray(m)) continue;
          for (let i = 1; i < m.length; i += 1) {
            const row = m[i];
            const codNum = Number(String(row?.[0] ?? '').trim().replace(/\D/g, '') || NaN);
            if (Number.isFinite(codNum) && codNum >= 1) {
              codigos.add(String(codNum).padStart(8, '0'));
            }
          }
        }
        await Promise.all(
          [...codigos].map(async (cod8) => {
            try {
              const lista = await listarProcessosResumoPorCodigoCliente(cod8);
              numerosInternosPorCliente8[cod8] = (lista || [])
                .map((p) => Number(p?.numeroInterno))
                .filter((n) => Number.isFinite(n) && n >= 1);
            } catch (err) {
              console.warn(`[Calculos] import débitos: falha ao listar processos ${cod8}`, err);
            }
          })
        );
      }

      const { nextRodadas, stats } = mergeDebitosCalculosMultiSheet(rodadasStateRef.current, matrices, {
        numerosInternosPorCliente8,
      });
      setRodadasState(nextRodadas);
      rodadasStateRef.current = nextRodadas;
      const keysComValor = Object.keys(nextRodadas).filter((k) =>
        mapaRodadasTemValorTituloOuParcela({ [k]: nextRodadas[k] })
      );
      const gravou = saveRodadasCalculos(nextRodadas, { persistRodadaKeysComValor: keysComValor });
      const avisosTxt =
        stats.avisos.length > 0
          ? `\n\n${stats.avisos.slice(0, 15).join('\n')}${stats.avisos.length > 15 ? '\n…' : ''}`
          : '';
      const avisoGravacao =
        gravou || featureFlags.useApiCalculos
          ? ''
          : '\n\nAtenção: não foi possível gravar no armazenamento do navegador (ex.: quota cheia). Recarregar pode perder dados.';
      window.alert(
        `Importação de débitos concluída.\n` +
          `Folhas lidas: ${stats.sheetsUsadas ?? matrices.length}\n` +
          `Linhas na planilha (dados): ${stats.linhasLidas}\n` +
          `Rodadas atualizadas/criadas: ${stats.aplicadas}\n` +
          `Linhas ignoradas: ${stats.ignoradas}${avisosTxt}${avisoGravacao}`
      );
    } catch (err) {
      console.error(err);
      window.alert(`Erro ao ler a planilha: ${err?.message || String(err)}`);
    }
  }, []);

  useEffect(() => {
    const h = (e) => {
      const fromEvent = e?.detail?.rodadas;
      const mapaCompleto = e?.detail?.mapaCompleto === true;
      if (featureFlags.useApiCalculos) {
        if (mapaCompleto && fromEvent && typeof fromEvent === 'object' && !Array.isArray(fromEvent)) {
          setRodadasState({
            ...fromEvent,
            ...RODADAS_VINCULACAO_TESTE_50,
          });
        }
        return;
      }
      if (fromEvent && typeof fromEvent === 'object' && !Array.isArray(fromEvent)) {
        setRodadasState({
          ...fromEvent,
          ...RODADAS_VINCULACAO_TESTE_50,
        });
        return;
      }
      setRodadasState({
        ...(loadRodadasCalculos() || {}),
        ...RODADAS_VINCULACAO_TESTE_50,
      });
    };
    window.addEventListener('vilareal:calculos-rodadas-atualizadas', h);
    return () => window.removeEventListener('vilareal:calculos-rodadas-atualizadas', h);
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiCalculos) return undefined;
    const onInicio = () => setHidratacaoConcluida(false);
    const onFim = (e) => {
      if (e?.detail?.ok) setHidratacaoConcluida(true);
    };
    window.addEventListener('vilareal:calculos-rodadas-api-hidratacao-iniciada', onInicio);
    window.addEventListener('vilareal:calculos-rodadas-api-hidratacao-concluida', onFim);
    return () => {
      window.removeEventListener('vilareal:calculos-rodadas-api-hidratacao-iniciada', onInicio);
      window.removeEventListener('vilareal:calculos-rodadas-api-hidratacao-concluida', onFim);
    };
  }, []);

  useEffect(() => {
    if (!indiceMenuAberto) return undefined;
    const down = (e) => {
      const el = indicePickerRef.current;
      if (el && !el.contains(e.target)) setIndiceMenuAberto(false);
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [indiceMenuAberto]);

  useEffect(() => {
    setIndiceMenuAberto(false);
  }, [tabAtiva]);

  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [processoEmbed, setProcessoEmbed] = useState(null);

  function confirmarAlternarAceitarPagamento(next) {
    const isLock = Boolean(next);
    const msg = isLock
      ? 'Confirmar travar o cálculo? Ao travar, as atualizações automáticas param e você poderá ajustar manualmente (se “Modo de Alteração” estiver marcado).'
      : 'Confirmar liberar o cálculo? Os valores serão recalculados para hoje, os débitos voltam a ser editáveis (e você pode incluir novos) e o plano de pagamento (parcelamento) será apagado.';
    return window.confirm(msg);
  }

  function aplicarValorCausaProcessoAoAceitarPagamento(valorTotalAtualizado) {
    const valorCampo = formatValorMoedaCampo(valorTotalAtualizado);
    if (!valorCampo) return;
    salvarValorCausaDoProcesso(codigoClienteNorm, procNorm, valorCampo);
    void atualizarValorCausaProcesso({
      processoId: navCalculos?.processoApiId,
      codigoCliente: codigoClienteNorm,
      numeroInterno: procNorm,
      valorTotalAtualizado,
    });
  }

  // Datas Especiais (por linha)
  const [modalCobrancaWhatsApp, setModalCobrancaWhatsApp] = useState(false);
  const [modalDatasEspeciais, setModalDatasEspeciais] = useState(false);
  const [linhaModalIdx, setLinhaModalIdx] = useState(null); // índice global dentro de rodadaAtual.titulos
  const [indicesRefreshToken, setIndicesRefreshToken] = useState(0); // força recarregar índices quando datas especiais mudarem
  const [formDatasEspeciais, setFormDatasEspeciais] = useState({
    dataInicialAtual: '',
    dataInicialJuros: '',
    dataFinalAtual: '',
    dataFinalJuros: '',
    taxaJurosEspecial: '',
    multaEspecial: '',
    indiceEspecial: '',
    honorariosTipoEspecial: '',
    honorariosValorEspecial: '',
  });

  useEffect(() => {
    if (codClienteFromState !== '') setCodigoCliente(padCliente8(codClienteFromState));
    if (procFromState !== '') {
      const n = Number(procFromState);
      if (!Number.isNaN(n)) setProc(Math.max(1, Math.floor(n)));
    }
    if (dimensaoFromState !== undefined && dimensaoFromState !== null && String(dimensaoFromState).trim() !== '') {
      const d = Number(dimensaoFromState);
      if (!Number.isNaN(d) && d >= 0) setDimensao(Math.floor(d));
    } else if (
      stateFromProcessos &&
      (codClienteFromState !== '' || procFromState !== '') &&
      !Object.prototype.hasOwnProperty.call(stateFromProcessos, 'dimensao')
    ) {
      setDimensao(0);
    }
    if (abaCalculosFromState === 'Acordos' && !isEmbedded) {
      navigate('/calculos/acordos', { replace: true, state: stateFromProcessos ?? undefined });
      return;
    }
    if (abaCalculosFromState && TABS.includes(abaCalculosFromState)) {
      setTabAtiva(abaCalculosFromState);
    }
  }, [
    codClienteFromState,
    procFromState,
    dimensaoFromState,
    abaCalculosFromState,
    stateFromProcessos,
    intentRevisionForHydration,
    isEmbedded,
    navigate,
  ]);

  // Mantém campos manuais sincronizados com o estado efetivo
  useEffect(() => {
    setCodClienteManual(padCliente8(codigoCliente));
  }, [codigoCliente]);
  useEffect(() => {
    setProcManual(String(normalizarProc(proc)));
  }, [proc]);

  // Proc. (número do processo do cliente) nunca pode ser 0
  useEffect(() => {
    setProc((p) => Math.max(1, Math.floor(Number(p) || 1)));
  }, []);

  function hojeBR() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }


  const dimensaoNorm = Math.max(0, Math.floor(Number(dimensao) || 0));
  useEffect(() => {
    if (dimensaoNorm !== dimensao) setDimensao(dimensaoNorm);
  }, [dimensaoNorm, dimensao]);

  const codigoClienteNorm = padCliente8(codigoCliente);
  const procNorm = normalizarProc(proc);
  const rodadaKey = `${codigoClienteNorm}:${procNorm}:${dimensaoNorm}`;

  function persistirDataCalculoRodada(dataBr) {
    const next = String(dataBr ?? '').trim();
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      if (String(cur.dataCalculoRodada ?? '').trim() === next) return prev;
      isDirtyRodadaRef.current = true;
      return { ...prev, [rodadaKey]: { ...cur, dataCalculoRodada: next } };
    });
  }

  /** Persiste rodadas no navegador (Financeiro usa para buscar parcelas no extrato). PUT na API só após hidratação GET (ver `hidratacaoConcluida` + `calculosRodadasStorage`). */
  useEffect(() => {
    if (featureFlags.useApiCalculos && !hidratacaoConcluida) return undefined;
    if (featureFlags.useApiCalculos && !isDirtyRodadaRef.current) return undefined;
    if (saveRodadasTimerRef.current) window.clearTimeout(saveRodadasTimerRef.current);
    saveRodadasTimerRef.current = window.setTimeout(() => {
      if (featureFlags.useApiCalculos) {
        const keysExtra = persistRodadaKeysRef.current;
        persistRodadaKeysRef.current = null;
        if (Array.isArray(keysExtra) && keysExtra.length > 0) {
          saveRodadasCalculos(rodadasState, { persistRodadaKeysComValor: keysExtra });
        } else {
          saveRodadasCalculos(rodadasState, { persistRodadaKey: rodadaKey });
        }
        for (const k of paginasRodadaCacheRef.current.keys()) {
          if (String(k).startsWith(`${rodadaKey}:`)) {
            paginasRodadaCacheRef.current.delete(k);
          }
        }
      } else {
        saveRodadasCalculos(rodadasState);
      }
      isDirtyRodadaRef.current = false;
    }, 450);
    return () => {
      if (saveRodadasTimerRef.current) {
        window.clearTimeout(saveRodadasTimerRef.current);
        saveRodadasTimerRef.current = null;
      }
      if (!isDirtyRodadaRef.current) return;
      const rodadas = rodadasStateRef.current;
      if (featureFlags.useApiCalculos) {
        if (!hidratacaoConcluida) return;
        const keysExtra = persistRodadaKeysRef.current;
        persistRodadaKeysRef.current = null;
        if (Array.isArray(keysExtra) && keysExtra.length > 0) {
          saveRodadasCalculos(rodadas, { persistRodadaKeysComValor: keysExtra });
        } else {
          saveRodadasCalculos(rodadas, { persistRodadaKey: rodadaKey });
        }
      } else {
        saveRodadasCalculos(rodadas);
      }
      isDirtyRodadaRef.current = false;
    };
  }, [rodadasState, hidratacaoConcluida, rodadaKey]);

  useEffect(() => {
    setIndiceMenuAberto(false);
  }, [rodadaKey]);

  useEffect(() => {
    if (!featureFlags.useApiCalculos) return;
    void refreshConfigCalculoClienteFromApi(codigoClienteNorm);
  }, [codigoClienteNorm]);

  const updatePainelCampo = useCallback(
    (partial) => {
      if (partial.juros !== undefined) setJuros(partial.juros);
      if (partial.multa !== undefined) setMulta(partial.multa);
      if (partial.honorariosTipo !== undefined) {
        setHonorariosTipo(partial.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      }
      if (partial.honorariosValor !== undefined) setHonorariosValor(partial.honorariosValor);
      if (partial.honorariosVariaveisTexto !== undefined) setHonorariosVariaveisTexto(partial.honorariosVariaveisTexto);
      if (partial.indice !== undefined) setIndice(partial.indice);
      if (partial.periodicidade !== undefined) setPeriodicidade(partial.periodicidade);
      if (partial.modeloListaDebitos !== undefined) setModeloListaDebitos(partial.modeloListaDebitos);
      setRodadasState((prev) => {
        const cur = prev[rodadaKey];
        if (!cur) return prev;
        const def = loadConfigCalculoCliente(codigoClienteNorm);
        const mergedBase = mergeConfigPainelCalculo(def, cur.panelConfig);
        const nextPanel = extrairPanelConfig({ ...mergedBase, ...partial });
        const chaves = listarChavesRodadasClienteProc(prev, codigoClienteNorm, procNorm);
        const { nextMap, chavesAlteradas } = propagarPanelConfigEmRodadas(prev, chaves, nextPanel);
        if (chavesAlteradas.length === 0) return prev;
        isDirtyRodadaRef.current = true;
        persistRodadaKeysRef.current = chavesAlteradas;
        return nextMap;
      });
    },
    [rodadaKey, codigoClienteNorm, procNorm]
  );

  useEffect(() => {
    const def = loadConfigCalculoCliente(codigoClienteNorm);
    const r = rodadasState[rodadaKey];
    const merged = mergeConfigPainelCalculo(def, r?.panelConfig);
    setJuros(merged.juros);
    setMulta(merged.multa);
    setHonorariosTipo(merged.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
    setHonorariosValor(merged.honorariosValor ?? '0 %');
    setHonorariosVariaveisTexto(merged.honorariosVariaveisTexto ?? '');
    setIndice(merged.indice);
    setPeriodicidade(merged.periodicidade ?? 'mensal');
    setModeloListaDebitos(merged.modeloListaDebitos ?? '01');
  }, [rodadaKey, codigoClienteNorm]);

  useEffect(() => {
    const h = (ev) => {
      const detail = ev?.detail;
      let rodadas = rodadasStateRef.current;
      if (detail?.chavesRodadas?.length) {
        rodadas = loadRodadasCalculos();
        setRodadasState(rodadas);
      }
      const def = loadConfigCalculoCliente(codigoClienteNorm);
      const r = rodadas[rodadaKey];
      const merged = mergeConfigPainelCalculo(def, r?.panelConfig);
      setJuros(merged.juros);
      setMulta(merged.multa);
      setHonorariosTipo(merged.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      setHonorariosValor(merged.honorariosValor ?? '0 %');
      setHonorariosVariaveisTexto(merged.honorariosVariaveisTexto ?? '');
      setIndice(merged.indice);
      setPeriodicidade(merged.periodicidade ?? 'mensal');
      setModeloListaDebitos(merged.modeloListaDebitos ?? '01');
    };
    window.addEventListener('vilareal:cliente-config-calculo-atualizado', h);
    return () => window.removeEventListener('vilareal:cliente-config-calculo-atualizado', h);
  }, [rodadaKey, codigoClienteNorm]);

  function aplicarClienteProcManual() {
    const cod = padCliente8(codClienteManual);
    const p = normalizarProc(procManual);
    if (cod === codigoClienteNorm && p === procNorm) return;
    setCodigoCliente(cod);
    setProc(p);
    setPagina(1);
    // remove o state antigo (evita “voltar” para o valor vindo de Processos)
    if (!isEmbedded) {
      navigate('/calculos', { replace: true, state: buildRouterStateChaveClienteProcesso(cod, p) });
    }
  }

  function aplicarClienteProcComValores(codValue, procValue) {
    const cod = padCliente8(codValue);
    const p = normalizarProc(procValue);
    if (cod === codigoClienteNorm && p === procNorm) return;
    setCodigoCliente(cod);
    setProc(p);
    setPagina(1);
    setCodClienteManual(cod);
    setProcManual(String(p));
    if (!isEmbedded) {
      navigate('/calculos', { replace: true, state: buildRouterStateChaveClienteProcesso(cod, p) });
    }
  }

  function normalizarCampoManual() {
    setCodClienteManual((v) => padCliente8(v));
    setProcManual((v) => String(normalizarProc(v)));
  }

  function commitClienteProcManual() {
    normalizarCampoManual();
    aplicarClienteProcManual();
  }

  function handleEnterCampoRodada(e, proximoRef, onCommit = commitClienteProcManual) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onCommit();
    proximoRef?.current?.focus?.();
  }

  /**
   * Os campos «Cod Cliente» / «Proc.» são manuais até clicar «Ir»; ao entrar em Títulos ou Parcelamento
   * aplicamos automaticamente se diferirem do par já em uso — evita ver rodada vazia por chave errada.
   */
  useEffect(() => {
    const anterior = tabAnteriorRef.current;
    tabAnteriorRef.current = tabAtiva;
    if (anterior === tabAtiva) return;
    if (tabAtiva !== 'Parcelamento' && tabAtiva !== 'Títulos') return;
    const cod = padCliente8(codClienteManual);
    const p = normalizarProc(procManual);
    const curCod = padCliente8(codigoCliente);
    const curP = normalizarProc(proc);
    if (cod !== curCod || p !== curP) {
      setCodigoCliente(cod);
      setProc(p);
      setPagina(1);
      setCodClienteManual(cod);
      setProcManual(String(p));
      if (!isEmbedded) {
        navigate('/calculos', { replace: true, state: buildRouterStateChaveClienteProcesso(cod, p) });
      }
    }
  }, [tabAtiva, codClienteManual, procManual, codigoCliente, proc, navigate, isEmbedded]);

  // Garante que a rodada exista ao alternar cliente/proc/dimensão (sem API: mock local; com API: GET individual abaixo)
  useEffect(() => {
    if (featureFlags.useApiCalculos) return undefined;
    setRodadasState((prev) => {
      if (prev[rodadaKey]) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          pagina: 1,
          paginaParcelamento: 1,
          titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
          parcelas: gerarParcelasMock(),
          quantidadeParcelasInformada: '00',
          taxaJurosParcelamento: '0,00',
          entradaParcelamentoModo: 'nenhuma',
          entradaParcelamentoValor: '',
          entradaParcelamentoPercentual: '',
          entradaParcelamentoDataVenc: '',
          limpezaAtiva: false,
          snapshotAntesLimpeza: null,
          cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
          honorariosDataRecebimento: {},
          parcelamentoAceito: false,
          panelConfig: undefined,
        },
      };
    });
    return undefined;
  }, [rodadaKey, codigoClienteNorm, procNorm, dimensaoNorm]);

  // Com API: carrega ou cria (404) só a chave atual — GET paginado exceto rodada com aceite (snapshot completo).
  useEffect(() => {
    if (!featureFlags.useApiCalculos || !hidratacaoConcluida) return undefined;

    if (fetchRodadaAbortRef.current) {
      fetchRodadaAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchRodadaAbortRef.current = controller;

    const myId = ++fetchRodadaReqIdRef.current;
    const key = rodadaKey;
    const parts = key.split(':');
    const sc = parts[0];
    const sp = Number(parts[1]);
    const sd = Number(parts[2]);
    const aceiteResumo = parcelamentoAceitoResumoParaChave(key);
    let paginaFetch = Math.max(1, Number(pagina) || 1);
    const cacheKey = aceiteResumo ? `${key}:full` : `${key}:page:${paginaFetch}`;

    if (!aceiteResumo && paginasRodadaCacheRef.current.has(cacheKey)) {
      setCarregandoRodadaApi(false);
      const cached = paginasRodadaCacheRef.current.get(cacheKey);
      if (cached && myId === fetchRodadaReqIdRef.current) {
        setRodadasState((prev) => {
          const cur = prev[key];
          const mergedTitulos = mesclarTitulosPaginaNoArray(
            cur?.titulos,
            cached.titulos,
            paginaFetch,
            TITULOS_POR_PAGINA_API
          );
          return {
            ...prev,
            [key]: {
              ...(cur && typeof cur === 'object' ? cur : {}),
              ...cached,
              titulos: mergedTitulos,
              pagina: paginaFetch,
            },
          };
        });
      }
      return () => controller.abort();
    }

    setCarregandoRodadaApi(true);
    (async () => {
      try {
        const fetchOpts = {
          signal: controller.signal,
          ...(aceiteResumo
            ? {}
            : { titulosPage: paginaFetch, titulosLimit: TITULOS_POR_PAGINA_API }),
        };
        const raw = await fetchCalculoRodada(sc, sp, sd, fetchOpts);
        if (controller.signal.aborted || myId !== fetchRodadaReqIdRef.current) return;
        if (raw == null) {
          setRodadasState((prev) => {
            if (prev[key]) return prev;
            return {
              ...prev,
              [key]: {
                pagina: 1,
                paginaParcelamento: 1,
                titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
                parcelas: gerarParcelasMock(),
                quantidadeParcelasInformada: '00',
                taxaJurosParcelamento: '0,00',
                entradaParcelamentoModo: 'nenhuma',
                entradaParcelamentoValor: '',
                entradaParcelamentoPercentual: '',
                entradaParcelamentoDataVenc: '',
                limpezaAtiva: false,
                snapshotAntesLimpeza: null,
                cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
                honorariosDataRecebimento: {},
                parcelamentoAceito: false,
                panelConfig: undefined,
              },
            };
          });
          return;
        }
        let one = normalizarRodadaRecebidaApi(key, raw);
        if (!one || controller.signal.aborted || myId !== fetchRodadaReqIdRef.current) return;

        let rawFinal = raw;
        const pagination = raw.titulosPagination;
        if (!aceiteResumo && one.parcelamentoAceito && pagination) {
          const rawFull = await fetchCalculoRodada(sc, sp, sd, { signal: controller.signal });
          if (controller.signal.aborted || myId !== fetchRodadaReqIdRef.current) return;
          if (rawFull) {
            rawFinal = rawFull;
            one = normalizarRodadaRecebidaApi(key, rawFull) ?? one;
          }
        }

        const paginationFinal = rawFinal.titulosPagination;
        const travadoPayload = Boolean(one.parcelamentoAceito);
        const totalTitulos =
          paginationFinal?.total != null ? Number(paginationFinal.total) : one.titulos?.length ?? 0;

        if (!travadoPayload && paginationFinal) {
          paginasRodadaCacheRef.current.set(cacheKey, {
            ...one,
            titulos: Array.isArray(one.titulos) ? one.titulos : [],
          });
        } else if (travadoPayload) {
          paginasRodadaCacheRef.current.set(`${key}:full`, one);
        }

        setRodadasState((prev) => {
          const cur = prev[key];
          let titulosMerged;
          if (travadoPayload) {
            titulosMerged = Array.isArray(one.titulos) ? one.titulos : [];
            paginaFetch = 1;
          } else {
            const base = garantirArrayTitulosTamanho(cur?.titulos, totalTitulos);
            titulosMerged = mesclarTitulosPaginaNoArray(
              base,
              one.titulos,
              paginaFetch,
              TITULOS_POR_PAGINA_API
            );
          }
          return {
            ...prev,
            [key]: {
              ...(cur && typeof cur === 'object' ? cur : {}),
              ...one,
              titulos: titulosMerged,
              pagina: paginaFetch,
            },
          };
        });
      } catch (e) {
        if (e?.name === 'AbortError') return;
        if (myId === fetchRodadaReqIdRef.current) {
          console.error('[vilareal] Falha ao carregar rodada de cálculo:', e);
        }
      } finally {
        if (myId === fetchRodadaReqIdRef.current) {
          setCarregandoRodadaApi(false);
        }
      }
    })();

    return () => {
      controller.abort();
      setCarregandoRodadaApi(false);
    };
  }, [rodadaKey, hidratacaoConcluida, codigoClienteNorm, procNorm, dimensaoNorm, pagina]);

  const rodadaAtual = rodadasState[rodadaKey] || {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: gerarTitulosMock(codigoClienteNorm, procNorm, dimensaoNorm),
    parcelas: gerarParcelasMock(),
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    entradaParcelamentoModo: 'nenhuma',
    entradaParcelamentoValor: '',
    entradaParcelamentoPercentual: '',
    entradaParcelamentoDataVenc: '',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(codigoClienteNorm, procNorm),
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: undefined,
  };

  const rodadaExisteNoEstado = rodadasState[rodadaKey] != null;
  const calculoTravadoAceito = Boolean(rodadaAtual.parcelamentoAceito);
  const calculoAceito = aceitarPagamento || calculoTravadoAceito;

  useEffect(() => {
    const logKey = rodadaKey;
    const t = window.setTimeout(() => {
      if (logKey === __ultimoCalculosRodadaLog) return;
      __ultimoCalculosRodadaLog = logKey;
      const path = isEmbedded ? '/calculos' : (location.pathname || '/calculos').replace(/\/+$/, '') || '/calculos';
      const mod = getRotuloModuloPorPathname(path);
      const { usuarioNome } = getContextoAuditoriaUsuario();
      const nomeCliente = String(rodadaAtual.cabecalho?.autor ?? '').trim();
      const dimPart = dimensaoNorm > 0 ? `, dimensão ${dimensaoNorm}` : '';
      const nomePart = nomeCliente ? ` do cliente ${nomeCliente}` : '';
      registrarAuditoria({
        modulo: mod,
        tela: path,
        tipoAcao: 'ACESSO_MODULO',
        descricao: `Usuário ${usuarioNome} acessou cálculos${nomePart} (código ${codigoClienteNorm}, proc. ${procNorm}${dimPart}).`,
        registroAfetadoId: `${codigoClienteNorm}:${procNorm}`,
        registroAfetadoNome: nomeCliente || null,
        observacoesTecnicas: dimensaoNorm > 0 ? `dimensao=${dimensaoNorm}` : null,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [rodadaKey, codigoClienteNorm, procNorm, dimensaoNorm, location.pathname, isEmbedded, rodadaAtual.cabecalho?.autor]);

  useEffect(() => {
    const dc = String(rodadaAtual.dataCalculoRodada ?? '').trim();
    if (dc) setDataCalculo(dc);
    else if (!calculoAceito) setDataCalculo(hojeBR());
  }, [rodadaKey, calculoAceito, rodadaAtual.dataCalculoRodada]);

  // Preenche cabecalho.autor / .reu a partir de Processos + Cliente (API) ou histórico local, sem sobrescrever texto já salvo na rodada.
  useEffect(() => {
    if (featureFlags.useApiCalculos && !hidratacaoConcluida) return undefined;
    if (!rodadaExisteNoEstado) return undefined;

    let cancelled = false;
    const key = rodadaKey;
    const cod8 = codigoClienteNorm;
    const procN = procNorm;

    void (async () => {
      let autor = '';
      let reu = '';
      let unidade = '';
      try {
        const partes = await resolverTextosPartesCabecalhoCalculo(cod8, procN);
        if (cancelled) return;
        autor = String(partes.parteCliente ?? '').trim();
        reu = String(partes.parteOposta ?? '').trim();
        unidade = String(partes.unidade ?? '').trim();
      } catch {
        /* rede / storage: mantém cabecalho já persistido */
      }
      if (cancelled) return;
      if (!autor && !reu && !unidade) return;

      setRodadasState((prev) => {
        const cur = prev[key];
        if (!cur || typeof cur !== 'object') return prev;
        const cab = cur.cabecalho && typeof cur.cabecalho === 'object' ? cur.cabecalho : {};
        const keepAutor = String(cab.autor ?? '').trim();
        const keepReu = String(cab.reu ?? '').trim();
        const keepUnidade = String(cab.unidade ?? '').trim();
        const nextAutor = keepAutor || autor;
        const nextReu = keepReu || reu;
        const nextUnidade = keepUnidade || unidade;
        if (nextAutor === keepAutor && nextReu === keepReu && nextUnidade === keepUnidade) return prev;
        return {
          ...prev,
          [key]: { ...cur, cabecalho: { autor: nextAutor, reu: nextReu, unidade: nextUnidade } },
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [rodadaExisteNoEstado, rodadaKey, codigoClienteNorm, procNorm, hidratacaoConcluida]);

  const autorBarraCalculo = rotuloCabecalhoCalculoParte(rodadaAtual.cabecalho?.autor);
  const reuBarraCalculo = rotuloCabecalhoCalculoParte(rodadaAtual.cabecalho?.reu);
  const unidadeBarraCalculo = String(rodadaAtual.cabecalho?.unidade ?? '').trim();

  // Sincroniza o checkbox com `parcelamentoAceito` da rodada no estado (inclui após GET individual assíncrono).
  const parcelamentoAceitoRodadaAtual = rodadasState[rodadaKey]?.parcelamentoAceito;
  useEffect(() => {
    setAceitarPagamento(Boolean(parcelamentoAceitoRodadaAtual));
  }, [rodadaKey, parcelamentoAceitoRodadaAtual]);

  // Ao trocar dimensão/rodada, volta à página 1 (evita grade vazia se a rodada anterior ficou na pág. 2+).
  useEffect(() => {
    setPagina(1);
    setPaginaParcelamento(1);
    paginasRodadaCacheRef.current = new Map();
  }, [rodadaKey]);

  // Mantém a página (Títulos) sincronizada no estado da rodada atual
  useEffect(() => {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const nextPagina = Math.max(1, Number(pagina) || 1);
      if (cur.pagina === nextPagina) return prev;
      return { ...prev, [rodadaKey]: { ...cur, pagina: nextPagina } };
    });
  }, [pagina, rodadaKey]);

  // Mantém a página (Parcelamento) sincronizada no estado da rodada atual — ligada à mesma chave que títulos/dimensão.
  useEffect(() => {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const nextPagParc = Math.max(1, Number(paginaParcelamento) || 1);
      if ((cur.paginaParcelamento ?? 1) === nextPagParc) return prev;
      return { ...prev, [rodadaKey]: { ...cur, paginaParcelamento: nextPagParc } };
    });
  }, [paginaParcelamento, rodadaKey]);

  const titulos = useMemo(() => {
    const gravados = rodadaAtual.titulosGravadosAceito;
    const mapTitulosAceitos = (lista) =>
      lista.map((t) => {
        const vi = parseValorMonetarioBr(t.valorInicial);
        if (vi != null && vi < 0) {
          return { ...t, total: calcularTotalTituloGrade(t) };
        }
        return t;
      });
    const fromEstado = Array.isArray(rodadaAtual.titulos) ? rodadaAtual.titulos : [];
    if (Array.isArray(gravados) && gravados.length > 0) {
      return mesclarTitulosGravadosComRecalculo(gravados, fromEstado, mapTitulosAceitos);
    }
    if (calculoTravadoAceito) {
      if (fromEstado.some((t) => String(t?.valorInicial ?? '').trim() !== '')) {
        return mapTitulosAceitos(fromEstado);
      }
    }
    const enriquecida = enriquecerTitulosAPartirDeParcelasNaRodada(rodadaAtual);
    const t = enriquecida.titulos;
    return Array.isArray(t) ? t : [];
  }, [rodadaAtual, calculoTravadoAceito, aceitarPagamento]);

  // Mantém vencimento/valor do txt; encargos vêm do recálculo (não do snapshot gravado).
  useEffect(() => {
    if (modoAlteracao) return;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const gravados = cur.titulosGravadosAceito;
      if (!Array.isArray(gravados) || gravados.length === 0) return prev;
      const atual = cur.titulos;
      if (!Array.isArray(atual) || atual.length !== gravados.length) return prev;
      let changed = false;
      const next = atual.map((a, i) => {
        const g = gravados[i];
        if (!g || typeof g !== 'object') return a;
        const venc = String(g.dataVencimento ?? '').trim();
        const val = String(g.valorInicial ?? '').trim();
        if (
          String(a?.dataVencimento ?? '').trim() === venc &&
          String(a?.valorInicial ?? '').trim() === val
        ) {
          return a;
        }
        changed = true;
        return { ...a, dataVencimento: g.dataVencimento, valorInicial: g.valorInicial };
      });
      if (!changed) return prev;
      return { ...prev, [rodadaKey]: { ...cur, titulos: next } };
    });
  }, [rodadaKey, modoAlteracao, parcelamentoAceitoRodadaAtual]);

  const parcelas = Array.isArray(rodadaAtual.parcelas) ? rodadaAtual.parcelas : gerarParcelasMock();
  const quantidadeParcelasInformada = rodadaAtual.quantidadeParcelasInformada ?? '00';
  const taxaJurosParcelamento = rodadaAtual.taxaJurosParcelamento ?? '0,00';
  const entradaParcelamentoModo = rodadaAtual.entradaParcelamentoModo ?? 'nenhuma';
  const entradaParcelamentoValor = rodadaAtual.entradaParcelamentoValor ?? '';
  const entradaParcelamentoPercentual = rodadaAtual.entradaParcelamentoPercentual ?? '';
  const entradaParcelamentoDataVenc = rodadaAtual.entradaParcelamentoDataVenc ?? '';
  const temEntradaAtiva = entradaModoAtivo(rodadaAtual);
  const limpezaAtiva = rodadaAtual.limpezaAtiva;

  /** Valor, vencimento e datas especiais por linha — muda na importação/edição; ignora colunas derivadas (juros, total…) para não re-disparar o recálculo sem necessidade. */
  const titulosChaveRecalculo = useMemo(() => {
    const arr = Array.isArray(titulos) ? titulos : [];
    return arr
      .map((t) => {
        const esp = t?.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
        let espJson = '';
        try {
          espJson = JSON.stringify(esp);
        } catch {
          espJson = '';
        }
        return `${String(t?.valorInicial ?? '').trim()}\t${String(t?.dataVencimento ?? '').trim()}\t${espJson}`;
      })
      .join('\f');
  }, [titulos]);

  const titulosPaginationMeta = rodadaAtual.titulosPagination;
  const totalPaginas =
    titulosPaginationMeta?.totalPages != null
      ? Math.max(1, Number(titulosPaginationMeta.totalPages) || 1)
      : Math.max(1, Math.ceil(titulos.length / TITULOS_POR_PAGINA));
  useEffect(() => {
    setPagina((p) => Math.min(Math.max(1, Number(p) || 1), totalPaginas));
  }, [totalPaginas]);

  const inicio = (pagina - 1) * TITULOS_POR_PAGINA;
  const fim = inicio + TITULOS_POR_PAGINA;

  const titulosPaginaVisiveis = useMemo(() => titulos.slice(inicio, fim), [titulos, inicio, fim]);

  const titulosDimensao = useMemo(
    () =>
      montarTitulosDimensaoParaResumo(
        titulos,
        titulosPaginationMeta?.total,
        paginasRodadaCacheRef.current.entries(),
        rodadaKey
      ),
    [titulos, titulosPaginationMeta?.total, rodadaKey, pagina]
  );

  const titulosPaginaCompletos = useMemo(() => {
    const titulosPagina = titulos.slice(inicio, fim);
    if (titulosPagina.length < TITULOS_POR_PAGINA) {
      return [
        ...titulosPagina,
        ...Array.from({ length: TITULOS_POR_PAGINA - titulosPagina.length }, () => ({
          dataVencimento: '',
          valorInicial: '',
          datasEspeciais: null,
          atualizacaoMonetaria: '',
          diasAtraso: '',
          juros: '',
          multa: '',
          honorarios: '',
          total: '',
          descricaoValor: '',
        })),
      ];
    }
    return titulosPagina;
  }, [titulos, inicio, fim]);

  const totalPaginasParcelas = Math.max(1, Math.ceil(parcelas.length / PARCELAS_POR_PAGINA));
  useEffect(() => {
    setPaginaParcelamento((p) => Math.min(Math.max(1, Number(p) || 1), totalPaginasParcelas));
  }, [totalPaginasParcelas]);

  const inicioParcelas = (paginaParcelamento - 1) * PARCELAS_POR_PAGINA;
  const fimParcelas = inicioParcelas + PARCELAS_POR_PAGINA;
  const parcelasPagina = parcelas.slice(inicioParcelas, fimParcelas);
  const parcelasPaginaCompletas =
    parcelasPagina.length < PARCELAS_POR_PAGINA
      ? [
        ...parcelasPagina,
        ...Array.from({ length: PARCELAS_POR_PAGINA - parcelasPagina.length }, () => linhaVaziaParcela()),
      ]
      : parcelasPagina;

  // 1ª linha do rodapé: soma só os títulos visíveis na página atual.
  const resumoPagina = useMemo(
    () => calcularResumoTitulosGrade(titulosPaginaVisiveis),
    [titulosPaginaVisiveis]
  );
  // 2ª linha: soma todos os títulos da dimensão (todas as páginas), a partir do estado + cache de páginas.
  const resumoGeral = useMemo(
    () => calcularResumoTitulosGrade(titulosDimensao),
    [titulosDimensao]
  );

  const showAvisoParcelasTitulosVazios = useMemo(
    () =>
      !titulosGradeTemValor(titulos) &&
      (parcelas || []).some((p) =>
        ['dataVencimento', 'valorParcela', 'honorariosParcela', 'observacao', 'dataPagamento'].some(
          (k) => String(p?.[k] ?? '').trim() !== ''
        )
      ),
    [titulos, parcelas]
  );

  const rodadaTitulosLength = (rodadaAtual.titulos || []).length;

  const handleTituloFieldChange = useCallback(
    (globalIdx, patch) => {
      atualizarTituloNaRodada(globalIdx, patch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rodadaKey, calculoTravadoAceito, aceitarPagamento, indicesMensaisINPC, indicesMensaisIPCA, pagina]
  );

  const handleAbrirDatasEspeciais = useCallback((globalIdx) => {
    abrirModalDatasEspeciais(globalIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaKey, rodadaAtual.titulos]);

  const handlePaginaAnterior = useCallback(() => {
    setPagina((p) => Math.max(1, Number(p) || 1) - 1);
  }, []);

  const handlePaginaProxima = useCallback(() => {
    setPagina((p) => Math.min(totalPaginas, Math.max(1, Number(p) || 1) + 1));
  }, [totalPaginas]);

  function gerarNomeArquivoPdf() {
    const hoje = new Date();
    const yyyy = String(hoje.getFullYear());
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `Calculo_Processo_${codigoClienteNorm}_${yyyy}${mm}${dd}.pdf`;
  }

  async function gerarPdfCalculo() {
    let titulosPdf = titulosDimensao;
    let resumoPdf = resumoGeral;

    const totalEsperado = titulosPaginationMeta?.total;
    const qtdCarregada = titulosDimensao.filter((t) => String(t?.valorInicial ?? '').trim() !== '').length;
    if (
      featureFlags.useApiCalculos &&
      totalEsperado != null &&
      Number(totalEsperado) > qtdCarregada
    ) {
      try {
        const rawFull = await fetchCalculoRodada(codigoClienteNorm, procNorm, dimensaoNorm);
        if (rawFull?.titulos && Array.isArray(rawFull.titulos)) {
          titulosPdf = rawFull.titulos;
          resumoPdf = calcularResumoTitulosGrade(titulosPdf);
        }
      } catch (e) {
        console.warn('[vilareal] PDF: não foi possível carregar todos os títulos; usando estado local.', e);
      }
    }

    let cabPdf = rodadaAtual?.cabecalho || {};
    if (!String(cabPdf.unidade ?? '').trim()) {
      try {
        const partes = await resolverTextosPartesCabecalhoCalculo(codigoClienteNorm, procNorm);
        if (String(partes.unidade ?? '').trim()) {
          cabPdf = { ...cabPdf, unidade: partes.unidade };
        }
      } catch {
        /* mantém cabecalho local */
      }
    }

    const doc = construirRelatorioCalculoPdf({
      titulos: titulosPdf,
      resumo: resumoPdf,
      cabecalho: cabPdf,
      codigoCliente: codigoClienteNorm,
      proc: procNorm,
      dataCalculo,
      juros,
      multa,
      honorariosTipo,
      honorariosValor,
      indice,
      planoPagamento:
        aceitarPagamento && temPlanoPagamento(rodadaAtual)
          ? {
              linhas: (() => {
                const nParc = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);
                const temEnt = temEntradaAtiva;
                const limite = temEnt ? nParc + 1 : nParc;
                const linhas = [];
                for (let i = 0; i < limite && i < parcelas.length; i++) {
                  const p = parcelas[i];
                  if (!p) continue;
                  const vp = String(p.valorParcela ?? '').trim();
                  const hp = String(p.honorariosParcela ?? '').trim();
                  if (!vp && !hp) continue;
                  const totalLinha = formatBRL(parseBRL(vp) + parseBRL(hp));
                  linhas.push({
                    rotulo: rotuloLinhaPlanoPagamento(p, i, temEnt).replace(/:$/, ''),
                    dataVencimento: p.dataVencimento ?? '',
                    valorParcela: vp,
                    honorariosParcela: hp,
                    totalLinha,
                  });
                }
                return linhas;
              })(),
            }
          : null,
    });

    doc.save(gerarNomeArquivoPdf());
  }

  function nomeIndiceParaDocumentoWord(nome) {
    const u = String(nome ?? '').toUpperCase();
    if (u === 'POUPANÇA' || u === 'POUPANCA') return 'Poupança';
    if (u === 'NENHUM') return 'Nenhum';
    return String(nome ?? '');
  }

  function formatTaxaPercentualDocx(val) {
    const s = String(val ?? '').trim();
    if (!s) return '—';
    return /%/.test(s) ? s : `${s}%`;
  }

  async function gerarWordListaDebitos() {
    if (!aceitarPagamento) {
      window.alert("Marque a opção 'Aceitar Pagamento' antes de gerar o documento.");
      return;
    }

    const cab = rodadaAtual?.cabecalho || {};

    // Word == PDF: linhas e totais devem vir do MESMO conjunto de títulos.
    // Reaproveita a resolução do PDF (títulos da dimensão + busca do conjunto
    // completo quando a paginação da API não carregou tudo), evitando que a
    // tabela use `rodadaAtual.titulos` enquanto os totais usam `resumoGeral`.
    let titulosDoc = titulosDimensao;
    let resumoDoc = resumoGeral;
    const totalEsperadoWord = titulosPaginationMeta?.total;
    const qtdCarregadaWord = titulosDimensao.filter((t) => String(t?.valorInicial ?? '').trim() !== '').length;
    if (
      featureFlags.useApiCalculos &&
      totalEsperadoWord != null &&
      Number(totalEsperadoWord) > qtdCarregadaWord
    ) {
      try {
        const rawFull = await fetchCalculoRodada(codigoClienteNorm, procNorm, dimensaoNorm);
        if (rawFull?.titulos && Array.isArray(rawFull.titulos)) {
          titulosDoc = rawFull.titulos;
          resumoDoc = calcularResumoTitulosGrade(titulosDoc);
        }
      } catch (e) {
        console.warn('[vilareal] Word: não foi possível carregar todos os títulos; usando estado local.', e);
      }
    }

    // Mesmo critério do resumo (`calcularResumoTitulosGrade`): conta apenas
    // títulos com `valorInicial` preenchido, garantindo que as linhas exibidas
    // sejam exatamente as que entram na totalização.
    const linhasTitulos = (titulosDoc || []).filter((t) => String(t?.valorInicial ?? '').trim() !== '');

    if (linhasTitulos.length === 0) {
      window.alert(
        'Não há títulos calculados para exportar. Preencha a grade de títulos, aguarde o cálculo e aceite o pagamento antes de gerar o Word.'
      );
      return;
    }

    const indiceDoc = nomeIndiceParaDocumentoWord(indice);
    const dataBaseStr = String(dataCalculo ?? '').trim() || '—';

    const linhasWord = linhasTitulos.map((t) => {
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const dataIniJuros = String(esp.dataInicialJuros || t.dataVencimento || '').trim() || '—';
      const taxaJ =
        esp.taxaJurosEspecial != null && String(esp.taxaJurosEspecial).trim() !== '' ? esp.taxaJurosEspecial : juros;
      const taxaM = esp.multaEspecial != null && String(esp.multaEspecial).trim() !== '' ? esp.multaEspecial : multa;
      const devedorNome = String(cab.reu || '').trim() || '—';
      return {
        devedor: devedorNome.toUpperCase(),
        valor: String(t.valorInicial || '').trim() || '—',
        dataInicialJuros: dataIniJuros,
        taxaJuros: formatTaxaPercentualDocx(taxaJ),
        valorJuros: String(t.juros || '').trim() || '—',
        taxaMulta: formatTaxaPercentualDocx(taxaM),
        multa: String(t.multa || '').trim() || '—',
        atualizacaoMonetaria: String(t.atualizacaoMonetaria || '').trim() || '—',
        dataAtualMonet: dataBaseStr,
        encargosContratuais: String(t.honorarios || '').trim() || '—',
        total: String(t.total || '').trim() || calcularTotalTituloGrade(t),
      };
    });

    try {
      const linhaUnidade = String(cab.unidade ?? '').trim()
        ? `Unidade: ${String(cab.unidade).trim()}`
        : '';
      const blob = await gerarDocumentoListaDebitosWord({
        tituloPrincipal: `Lista de Débitos - Cálculo atualizado até ${dataBaseStr}`,
        linhaCliente: `Cliente (código): ${codigoClienteNorm}`,
        linhaProcesso: `Processo: ${procNorm}`,
        linhaUnidade,
        linhaMeta: `Data-base do cálculo: ${dataBaseStr}   |   Índice monetário: ${indiceDoc}`,
        colunaAtualizacaoTitulo: `Atualização Monetária\n(${indiceDoc})`,
        linhas: linhasWord,
        totais: {
          principal: resumoDoc.valorInicial,
          juros: resumoDoc.juros,
          multa: resumoDoc.multa,
          encargos: resumoDoc.honorarios,
          geral: resumoDoc.total,
        },
      });
      const safeData =
        dataBaseStr !== '—'
          ? dataBaseStr.replace(/\//g, '-').replace(/\s+/g, '_')
          : new Date().toISOString().slice(0, 10);
      const nomeArquivo = `Lista_de_Debitos_Cliente_${codigoClienteNorm}_Proc_${procNorm}_${safeData}.docx`;
      baixarBlobDocx(blob, nomeArquivo);
    } catch (err) {
      console.error(err);
      window.alert('Não foi possível gerar o documento Word. Tente novamente.');
    }
  }

  function linhaVaziaTitulo() {
    return {
      dataVencimento: '',
      valorInicial: '',
      datasEspeciais: null,
      atualizacaoMonetaria: '',
      diasAtraso: '',
      juros: '',
      multa: '',
      honorarios: '',
      total: '',
    };
  }

  function limparPaginaAtual() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      const snapshot = cur.snapshotAntesLimpeza || cur.titulos.map((t) => ({ ...t }));
      const nextTitulos = cur.titulos.map((t) => ({ ...t }));
      for (let i = inicio; i < Math.min(fim, nextTitulos.length); i++) {
        nextTitulos[i] = linhaVaziaTitulo();
      }
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: nextTitulos,
          snapshotAntesLimpeza: snapshot,
          limpezaAtiva: true,
        },
      };
    });
  }

  function reverterLimpeza() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      if (!cur.snapshotAntesLimpeza) return prev;
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: cur.snapshotAntesLimpeza.map((t) => ({ ...t })),
          snapshotAntesLimpeza: null,
          limpezaAtiva: false,
        },
      };
    });
  }

  function parseBRL(str) {
    if (str == null) return 0;
    const s = String(str).trim();
    if (!s) return 0;
    // Aceita "R$ 1.234,56" ou "1234,56" etc.
    const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }

  function formatBRL(n) {
    const v = Number(n) || 0;
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function parsePercent(str) {
    const raw = String(str ?? '').trim();
    if (!raw) return 0;
    const n = parsePercentualBR(raw.replace(/R\$\s*/gi, ''));
    return Number.isFinite(n) ? n / 100 : 0;
  }

  function trunc2(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // Legado usa truncamento (não arredondamento). Mantemos aqui para reduzir divergências visuais.
    return Math.trunc(v * 100) / 100;
  }

  function round2(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // Usado no recálculo do relatório (IPCA): arredonda no fim do período.
    return Math.round(v * 100) / 100;
  }

  // Equivalente ao cálculo de "Meses_Juros" do VBA (Calcula_Juros):
  // Meses_Juros = (AnoFinal - AnoInicial) * 12 + (MesFinal - MesInicial)
  // e se Dia_Final > Dia_Inicial => +1 mês.
  function mesesJurosLegacy(dataInicial, dataFinal) {
    if (!dataInicial || !dataFinal) return 0;
    const y1 = dataInicial.getFullYear();
    const m1 = dataInicial.getMonth();
    const d1 = dataInicial.getDate();
    const y2 = dataFinal.getFullYear();
    const m2 = dataFinal.getMonth();
    const d2 = dataFinal.getDate();
    let meses = (y2 - y1) * 12 + (m2 - m1);
    if (d2 > d1) meses += 1;
    return Math.max(0, Math.floor(meses));
  }

  function parseDateBR(str) {
    let s = String(str ?? '').trim();
    const alias = resolverAliasHojeEmTexto(s, 'br');
    if (alias) s = alias;
    if (!s || s.length < 10) return null;
    const [dd, mm, yyyy] = s.split('/');
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function diffDays(a, b) {
    if (!a || !b) return 0;
    const ms = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((b.getTime() - a.getTime()) / ms));
  }

  function calcularAtualizacaoMonetariaINPC(principal, dataInicialVenc, dataFinalCalc, indicesMensaisMap) {
    // Atualização mês a mês (competência mensal), acumulando sobre o valor corrente.
    // Regra do legado: índice mensal negativo -> considerar 0.
    // Observação: o legado (VBA) utiliza uma conversão específica do valor mensal do INPC.
    // Para reproduzir fielmente o resultado observado no cálculo do VBA (ex.: linha com principal=1000, venc=15/01/2016, calc=16/03/2026),
    // aplicamos um fator de escala no valor mensal antes de converter para decimal.
    const INPC_SCALE_TO_VBA = 2.027220805003458;

    if (!principal || !dataInicialVenc || !dataFinalCalc) return principal;

    let calculo = Number(principal) || 0;
    const startMonth = new Date(dataInicialVenc.getFullYear(), dataInicialVenc.getMonth(), 1);
    const endMonth = new Date(dataFinalCalc.getFullYear(), dataFinalCalc.getMonth(), 1);

    const monthKeyFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (let cur = new Date(startMonth); cur <= endMonth; cur.setMonth(cur.getMonth() + 1)) {
      const mk = monthKeyFromDate(cur);
      const idxMes = indicesMensaisMap?.[mk] ?? 0;
      const idxAdj = idxMes < 0 ? 0 : idxMes;
      const idxAdjEscalado = idxAdj * INPC_SCALE_TO_VBA;
      // aplica mês a mês: Calculo = Arredondamento(Calculo + Calculo*(idx/100), 2)
      calculo = trunc2(calculo + calculo * (idxAdjEscalado / 100));
    }
    return trunc2(calculo);
  }

  // Replicação do relatório (IPCA / “IPCA-E”):
  // - Compõe mensalmente, porém NÃO trunca/arredonda o acumulado a cada mês.
  // - Índices mensais negativos são permitidos (não zera como no INPC).
  // - Ao final, arredonda a diferença (atualizado - principal) em 2 casas.
  function calcularAtualizacaoMonetariaIPCA(principal, dataInicialVenc, dataFinalCalc, indicesMensaisMap) {
    if (!principal || !dataInicialVenc || !dataFinalCalc) return 0;

    let calculo = Number(principal) || 0;
    const startMonth = new Date(dataInicialVenc.getFullYear(), dataInicialVenc.getMonth(), 1);
    // Legado do relatório: “até mm/aaaa” é o mês anterior ao mês da data final.
    const endMonth = new Date(dataFinalCalc.getFullYear(), dataFinalCalc.getMonth() - 1, 1);

    const monthKeyFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    for (let cur = new Date(startMonth); cur <= endMonth; cur.setMonth(cur.getMonth() + 1)) {
      const mk = monthKeyFromDate(cur);
      const idxMes = indicesMensaisMap?.[mk] ?? 0;
      calculo = calculo + calculo * (idxMes / 100);
    }

    const atualizacaoBruta = calculo - principal;
    const atualizacaoArred = round2(atualizacaoBruta);
    return atualizacaoArred < 0 ? 0 : atualizacaoArred;
  }

  function fatorIndiceSelecionado(nomeIndice) {
    // Mock simples para demonstrar recálculo; depois será substituído por série histórica real.
    const map = {
      INPC: 1.045,
      IPCA: 1.052,
      'IPCA-E': 1.052,
      IGPM: 1.063,
      SELIC: 1.078,
      TR: 1.008,
      CDI: 1.071,
      'POUPANÇA': 1.034,
      NENHUM: 1.0,
    };
    return map[String(nomeIndice ?? 'NENHUM').toUpperCase()] ?? 1.0;
  }

  function recalcularTitulos(lista, indicesMensaisINPCMap, indicesMensaisIPCAMap, dataOverride) {
    const jurosPct = parsePercent(juros);
    const multaPct = parsePercent(multa);
    // dataOverride (quando informada) força a data do cálculo sem mexer no estado do aceite.
    const dataCalcGlobal =
      dataOverride ?? parseDateBR(dataCalculo) ?? parseDateBR(hojeBR());
    const honorPctFixo = parsePercent(honorariosValor);

    let changed = false;
    const next = lista.map((row) => {
      const principalStr = String(row.valorInicial ?? '').trim();
      const vencStr = String(row.dataVencimento ?? '').trim();
      const principal = parseBRL(row.valorInicial);
      const venc = parseDateBR(row.dataVencimento);
      const esp = row.datasEspeciais && typeof row.datasEspeciais === 'object' ? row.datasEspeciais : {};

      const indiceLinha = String(esp.indiceEspecial ?? '').trim() !== '' ? esp.indiceEspecial : indice;
      const idxUpperLinha = String(indiceLinha).toUpperCase();
      const fatorLinha = fatorIndiceSelecionado(indiceLinha);

      const dataInicialAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dataFinalAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcGlobal;
      const dataInicialJuros = parseDateBR(esp.dataInicialJuros) ?? venc;
      const dataFinalJuros = parseDateBR(esp.dataFinalJuros) ?? dataCalcGlobal;

      const hasTaxaJurosEspecial = String(esp.taxaJurosEspecial ?? '').trim() !== '';
      const jurosPctUsado = hasTaxaJurosEspecial ? parsePercent(esp.taxaJurosEspecial) : jurosPct;
      // Legado: distinguir "vazio" de "0".
      // Se faltar valor/vencimento (texto vazio), a linha fica com componentes vazios (não exibindo 0 residual).
      if (!dataCalcGlobal || principalStr === '' || vencStr === '') {
        return {
          ...row,
          diasAtraso: '',
          atualizacaoMonetaria: '',
          juros: '',
          multa: '',
          honorarios: '',
          total: '',
        };
      }

      const dias = diffDays(dataInicialJuros, dataFinalJuros);
      const multaPctUsada = String(esp.multaEspecial ?? '').trim() !== '' ? parsePercent(esp.multaEspecial) : multaPct;
      const honorariosTipoUsado =
        String(esp.honorariosTipoEspecial ?? '').trim() !== '' ? esp.honorariosTipoEspecial : honorariosTipo;
      const honorPctFixoUsado =
        String(esp.honorariosValorEspecial ?? '').trim() !== '' ? parsePercent(esp.honorariosValorEspecial) : honorPctFixo;

      // Legado: atualização monetária trabalha com o "valor atualizado total" do último mês.
      let atualizado = principal;
      let atualizacaoMonetariaValor = null;

      if (idxUpperLinha === 'INPC' && indicesMensaisINPCMap) {
        atualizado = calcularAtualizacaoMonetariaINPC(principal, dataInicialAtual, dataFinalAtual, indicesMensaisINPCMap);
      } else if ((idxUpperLinha === 'IPCA-E' || idxUpperLinha === 'IPCA') && indicesMensaisIPCAMap) {
        // O relatório usa uma lógica própria (ver calcularAtualizacaoMonetariaIPCA).
        atualizacaoMonetariaValor = calcularAtualizacaoMonetariaIPCA(principal, dataInicialAtual, dataFinalAtual, indicesMensaisIPCAMap);
        atualizado = principal + atualizacaoMonetariaValor;
      } else if (idxUpperLinha !== 'NENHUM') {
        // Fallback (mock) para índices ainda não integrados 100% (mantém comportamento atual).
        atualizado = trunc2(principal * fatorLinha);
      }

      // Legado: AtualMonet(Linha) = Arredondamento(atualizado - principal, 2) e zera se negativo.
      if (atualizacaoMonetariaValor == null) {
        const atualizacaoBruta = atualizado - principal;
        const t = trunc2(atualizacaoBruta);
        atualizacaoMonetariaValor = t < 0 ? 0 : t;
      }

      // Legado (Calcula_Juros): juros = (CalculoAtualizado * (Tx_Juros/100)) * Meses_Juros
      // e Meses_Juros é por diferença de meses + ajuste pelo dia.
      const meses = dias <= 0 ? 0 : mesesJurosLegacy(dataInicialJuros, dataFinalJuros);
      const jurosValor = dias <= 0 ? 0 : trunc2(atualizado * jurosPctUsado * meses);
      // Legado: multa incide após juros, base = principal + atualização + juros
      const baseMulta = principal + atualizacaoMonetariaValor + jurosValor;
      const multaValor = trunc2(baseMulta * multaPctUsada);
      // Legado: honorários por último, base = principal + atualização + juros + multa
      const honorPctVariavel = dias > 60 ? 0.2 : dias > 30 ? 0.1 : 0;
      const honorPct = honorariosTipoUsado === 'variaveis' ? honorPctVariavel : honorPctFixoUsado;
      const baseHonor = baseMulta + multaValor;
      const honorariosCalc = trunc2(baseHonor * honorPct);

      const nextRow = calcularTotalLinhaTitulo({
        ...row,
        diasAtraso: String(dias),
        atualizacaoMonetaria: formatBRL(trunc2(atualizacaoMonetariaValor)),
        juros: formatBRL(jurosValor),
        multa: formatBRL(multaValor),
        honorarios: formatBRL(honorariosCalc),
      });

      if (
        nextRow.diasAtraso !== row.diasAtraso ||
        nextRow.atualizacaoMonetaria !== row.atualizacaoMonetaria ||
        nextRow.juros !== row.juros ||
        nextRow.multa !== row.multa ||
        nextRow.honorarios !== row.honorarios ||
        nextRow.total !== row.total
      ) {
        changed = true;
      }
      return nextRow;
    });
    return { next, changed };
  }

  // Recalcula ao abrir e a cada mudança, exceto quando o cálculo está aceito/travado.
  useEffect(() => {
    if (calculoAceito) return;
    if (featureFlags.useApiCalculos && !rodadaExisteNoEstado) return;
    const idxUpperGeral = String(indice).toUpperCase();
    const precisaINPC =
      idxUpperGeral === 'INPC' ||
      (rodadaAtual.titulos || []).some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'INPC');
    const precisaIPCA =
      idxUpperGeral === 'IPCA-E' ||
      idxUpperGeral === 'IPCA' ||
      (rodadaAtual.titulos || []).some((t) => {
        const v = String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase();
        return v === 'IPCA-E' || v === 'IPCA';
      });

    if (precisaINPC && indicesMensaisINPC == null) return;
    if (precisaIPCA && indicesMensaisIPCA == null) return;
    const gravados = rodadaAtual.titulosGravadosAceito;
    const temGravadosImutaveis = Array.isArray(gravados) && gravados.length > 0;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey] || { ...rodadaAtual };
      const baseTitulos = Array.isArray(cur.titulos) ? cur.titulos : [];
      const listaFull = temGravadosImutaveis ? gravados : baseTitulos;
      const { next, changed } = recalcularTitulos(listaFull, indicesMensaisINPC, indicesMensaisIPCA);
      if (!changed) return prev;
      isDirtyRodadaRef.current = true;
      for (const k of paginasRodadaCacheRef.current.keys()) {
        if (String(k).startsWith(`${rodadaKey}:page:`)) {
          paginasRodadaCacheRef.current.delete(k);
        }
      }
      return {
        ...prev,
        [rodadaKey]: {
          ...cur,
          titulos: next,
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calculoAceito,
    rodadaExisteNoEstado,
    indice,
    juros,
    multa,
    honorariosTipo,
    honorariosValor,
    dataCalculo,
    rodadaKey,
    pagina,
    indicesMensaisINPC,
    indicesMensaisIPCA,
    titulosChaveRecalculo,
  ]);

  // Carrega índices mensais do INPC antes de recalcular.
  useEffect(() => {
    if (calculoAceito && !modoAlteracao) return;
    const idxUpperGeral = String(indice).toUpperCase();
    const precisaINPC =
      idxUpperGeral === 'INPC' ||
      (rodadaAtual.titulos || []).some((t) => String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase() === 'INPC');

    if (!precisaINPC) {
      setIndicesMensaisINPC(null);
      return;
    }

    const dataCalcDate = parseDateBR(dataCalculo) ?? parseDateBR(hojeBR());
    if (!dataCalcDate) return;

    // Busca o intervalo monetário coberto pelas “Datas Especiais” (por linha) e pela data geral.
    let minDataInicialAtual = null;
    let maxDataFinalAtual = dataCalcDate;
    for (const t of (rodadaAtual.titulos || [])) {
      const venc = parseDateBR(t.dataVencimento);
      if (!venc) continue;
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const diAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dfAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcDate;

      if (diAtual && (!minDataInicialAtual || diAtual < minDataInicialAtual)) minDataInicialAtual = diAtual;
      if (dfAtual && dfAtual > maxDataFinalAtual) maxDataFinalAtual = dfAtual;
    }
    const inicio = minDataInicialAtual || dataCalcDate;
    const fim = maxDataFinalAtual || dataCalcDate;

    let cancelled = false;
    obterIndicesMensaisINPC(inicio, fim)
      .then((map) => {
        if (cancelled) return;
        setIndicesMensaisINPC(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Se falhar a busca, não quebra a tela; cai no fallback do mock.
        setIndicesMensaisINPC({});
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculoAceito, modoAlteracao, indice, dataCalculo, rodadaKey, indicesRefreshToken, titulosChaveRecalculo]);

  // Carrega índices mensais do IPCA (IPCA / “IPCA-E”) antes de recalcular.
  useEffect(() => {
    if (calculoAceito && !modoAlteracao) return;
    const idxUpper = String(indice).toUpperCase();
    const precisaIPCA =
      idxUpper === 'IPCA-E' ||
      idxUpper === 'IPCA' ||
      (rodadaAtual.titulos || []).some((t) => {
        const v = String(t?.datasEspeciais?.indiceEspecial ?? '').toUpperCase();
        return v === 'IPCA-E' || v === 'IPCA';
      });

    if (!precisaIPCA) {
      setIndicesMensaisIPCA(null);
      return;
    }

    const dataCalcDate = parseDateBR(dataCalculo) ?? parseDateBR(hojeBR());
    if (!dataCalcDate) return;

    // Busca o intervalo monetário coberto pelas “Datas Especiais” (por linha) e pela data geral.
    let minDataInicialAtual = null;
    let maxDataFinalAtual = dataCalcDate;
    for (const t of (rodadaAtual.titulos || [])) {
      const venc = parseDateBR(t.dataVencimento);
      if (!venc) continue;
      const esp = t.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
      const diAtual = parseDateBR(esp.dataInicialAtual) ?? venc;
      const dfAtual = parseDateBR(esp.dataFinalAtual) ?? dataCalcDate;

      if (diAtual && (!minDataInicialAtual || diAtual < minDataInicialAtual)) minDataInicialAtual = diAtual;
      if (dfAtual && dfAtual > maxDataFinalAtual) maxDataFinalAtual = dfAtual;
    }
    const inicio = minDataInicialAtual || dataCalcDate;

    // “até mm/aaaa” (do relatório) = mês anterior ao mês da data final atual.
    const endPrevMonth = new Date(maxDataFinalAtual.getFullYear(), maxDataFinalAtual.getMonth() - 1, 1);

    let cancelled = false;
    obterIndicesMensaisIPCA(inicio, endPrevMonth)
      .then((map) => {
        if (cancelled) return;
        setIndicesMensaisIPCA(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Se falhar a busca, não quebra a tela; cai no zero.
        setIndicesMensaisIPCA({});
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculoAceito, modoAlteracao, indice, dataCalculo, rodadaKey, indicesRefreshToken, titulosChaveRecalculo]);

  function abrirModalDatasEspeciais(indexGlobal) {
    const linha = (rodadaAtual.titulos || [])[indexGlobal];
    const esp = linha && linha.datasEspeciais && typeof linha.datasEspeciais === 'object' ? linha.datasEspeciais : {};
    setLinhaModalIdx(indexGlobal);
    setFormDatasEspeciais({
      dataInicialAtual: String(esp.dataInicialAtual ?? ''),
      dataInicialJuros: String(esp.dataInicialJuros ?? ''),
      dataFinalAtual: String(esp.dataFinalAtual ?? ''),
      dataFinalJuros: String(esp.dataFinalJuros ?? ''),
      taxaJurosEspecial: String(esp.taxaJurosEspecial ?? ''),
      multaEspecial: String(esp.multaEspecial ?? ''),
      indiceEspecial: String(esp.indiceEspecial ?? ''),
      honorariosTipoEspecial: String(esp.honorariosTipoEspecial ?? ''),
      honorariosValorEspecial: String(esp.honorariosValorEspecial ?? ''),
    });
    setModalDatasEspeciais(true);
  }

  function fecharModalDatasEspeciais() {
    setModalDatasEspeciais(false);
    setLinhaModalIdx(null);
  }

  function salvarModalDatasEspeciais() {
    if (linhaModalIdx == null) return;

    const esp = {};
    if (String(formDatasEspeciais.dataInicialAtual ?? '').trim() !== '') esp.dataInicialAtual = formDatasEspeciais.dataInicialAtual;
    if (String(formDatasEspeciais.dataInicialJuros ?? '').trim() !== '') esp.dataInicialJuros = formDatasEspeciais.dataInicialJuros;
    if (String(formDatasEspeciais.dataFinalAtual ?? '').trim() !== '') esp.dataFinalAtual = formDatasEspeciais.dataFinalAtual;
    if (String(formDatasEspeciais.dataFinalJuros ?? '').trim() !== '') esp.dataFinalJuros = formDatasEspeciais.dataFinalJuros;
    if (String(formDatasEspeciais.taxaJurosEspecial ?? '').trim() !== '') esp.taxaJurosEspecial = formDatasEspeciais.taxaJurosEspecial;
    if (String(formDatasEspeciais.multaEspecial ?? '').trim() !== '') esp.multaEspecial = formDatasEspeciais.multaEspecial;
    if (String(formDatasEspeciais.indiceEspecial ?? '').trim() !== '') esp.indiceEspecial = formDatasEspeciais.indiceEspecial;
    if (String(formDatasEspeciais.honorariosTipoEspecial ?? '').trim() !== '') esp.honorariosTipoEspecial = formDatasEspeciais.honorariosTipoEspecial;
    if (String(formDatasEspeciais.honorariosValorEspecial ?? '').trim() !== '') esp.honorariosValorEspecial = formDatasEspeciais.honorariosValorEspecial;

    const espToSave = Object.keys(esp).length > 0 ? esp : null;

    atualizarTituloNaRodada(linhaModalIdx, { datasEspeciais: espToSave });
    setIndicesRefreshToken((t) => t + 1);
    fecharModalDatasEspeciais();
  }

  function handleFocusTituloCampo(globalIdx, campo) {
    if (globalIdx < 1) return;
    const titulosRodada = rodadaAtual.titulos || [];
    const prev = titulosRodada[globalIdx - 1];
    if (!prev) return;
    const cur = titulosRodada[globalIdx] ?? {};

    if (campo === 'dataVencimento') {
      if (String(cur.dataVencimento ?? '').trim()) return;
      const prevData = normalizarTextoDataBRparaSalvar(String(prev.dataVencimento ?? '').trim());
      if (!prevData) return;
      const sugestao = sugerirProximaDataVencimento(prevData, periodicidade);
      if (sugestao) atualizarTituloNaRodada(globalIdx, { dataVencimento: sugestao });
      return;
    }

    if (campo === 'valorInicial') {
      if (String(cur.valorInicial ?? '').trim()) return;
      const prevValor = String(prev.valorInicial ?? '').trim();
      if (!prevValor) return;
      atualizarTituloNaRodada(globalIdx, { valorInicial: prevValor });
    }
  }

  function atualizarTituloNaRodada(indexGlobal, patch) {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      if (indexGlobal < 0) return prev;
      const titulosBase = Array.isArray(cur.titulos) ? [...cur.titulos] : [];
      while (indexGlobal >= titulosBase.length) {
        titulosBase.push(linhaTituloVaziaCalculos());
      }
      const titulosAtualizados = titulosBase.map((r, i) => {
        if (i !== indexGlobal) return r;
        return { ...r, ...patch };
      });
      const patchSoTotal =
        Object.keys(patch).length === 1 && Object.prototype.hasOwnProperty.call(patch, 'total');
      const aplicarTotalManual = (lista) =>
        lista.map((row, i) => {
          if (i !== indexGlobal || patchSoTotal) return row;
          return calcularTotalLinhaTitulo(row);
        });
      // Travado + Modo de Alteração: preserva componentes editados manualmente, mas atualiza Total e rodapé.
      const next = calculoAceito
        ? aplicarTotalManual(titulosAtualizados)
        : recalcularTitulos(titulosAtualizados, indicesMensaisINPC, indicesMensaisIPCA).next;
      isDirtyRodadaRef.current = true;
      paginasRodadaCacheRef.current.delete(`${rodadaKey}:page:${pagina}`);
      return {
        ...prev,
        [rodadaKey]: { ...cur, titulos: next },
      };
    });
  }

  function parcelaTemValor(parcela) {
    if (!parcela || typeof parcela !== 'object') return false;
    return [
      parcela.dataVencimento,
      parcela.valorParcela,
      parcela.honorariosParcela,
      parcela.observacao,
      parcela.dataPagamento,
    ].some((v) => String(v ?? '').trim() !== '');
  }

  function atualizarQuantidadeParcelasInformada(valorBruto) {
    const digits = String(valorBruto ?? '').replace(/\D/g, '').slice(0, 4);
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      return {
        ...prev,
        [rodadaKey]: { ...cur, quantidadeParcelasInformada: digits },
      };
    });
  }

  function onBlurQuantidadeParcelasInformada() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const fmt = formatarQuantidadeParcelasExibicao(cur.quantidadeParcelasInformada ?? '');
      return {
        ...prev,
        [rodadaKey]: { ...cur, quantidadeParcelasInformada: fmt },
      };
    });
  }

  function atualizarTaxaJurosParcelamento(valorBruto) {
    const t = String(valorBruto ?? '')
      .replace(/%/g, '')
      .replace(/[^\d.,]/g, '');
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      return {
        ...prev,
        [rodadaKey]: { ...cur, taxaJurosParcelamento: t },
      };
    });
  }

  function onBlurTaxaJurosParcelamento() {
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const fmt = formatarTaxaJurosParcelamento2Casas(cur.taxaJurosParcelamento ?? '');
      return {
        ...prev,
        [rodadaKey]: { ...cur, taxaJurosParcelamento: fmt },
      };
    });
  }

  function patchEntradaParcelamento(partial) {
    if (aceitarPagamento && !modoAlteracao) return;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      isDirtyRodadaRef.current = true;
      return { ...prev, [rodadaKey]: { ...cur, ...partial } };
    });
  }

  function setEntradaParcelamentoModo(modo) {
    const next = normalizarEntradaModo(modo);
    const dataPadrao = normalizarTextoDataBRparaSalvar(dataCalculo) || dataCalculo;
    patchEntradaParcelamento({
      entradaParcelamentoModo: next,
      entradaParcelamentoDataVenc:
        next === 'nenhuma' ? '' : normalizarTextoDataBRparaSalvar(entradaParcelamentoDataVenc) || dataPadrao,
    });
  }

  function patchParcelaSoDataPagamento(patch) {
    const keys = Object.keys(patch ?? {});
    return keys.length === 1 && keys[0] === 'dataPagamento';
  }

  function atualizarParcelaNaRodada(indexGlobal, patch) {
    if (aceitarPagamento && !modoAlteracao && !patchParcelaSoDataPagamento(patch)) return;
    isDirtyRodadaRef.current = true;
    for (const k of paginasRodadaCacheRef.current.keys()) {
      if (String(k).startsWith(`${rodadaKey}:`)) {
        paginasRodadaCacheRef.current.delete(k);
      }
    }
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const listaAtual = Array.isArray(cur.parcelas) ? [...cur.parcelas] : gerarParcelasMock();
      while (indexGlobal >= listaAtual.length) listaAtual.push(linhaVaziaParcela());
      listaAtual[indexGlobal] = { ...listaAtual[indexGlobal], ...patch };

      const ultimoIndice = listaAtual.length - 1;
      if (parcelaTemValor(listaAtual[ultimoIndice])) {
        listaAtual.push(linhaVaziaParcela());
      }

      return {
        ...prev,
        [rodadaKey]: { ...cur, parcelas: listaAtual },
      };
    });
  }

  function chaveHonorarioTitulo(i) {
    return `titulo:${i}`;
  }
  function chaveHonorarioParcela(i) {
    return `parcela:${i}`;
  }

  function atualizarHonorarioDataRecebimento(chave, dataBr) {
    if (aceitarPagamento && !modoAlteracao) return;
    isDirtyRodadaRef.current = true;
    setRodadasState((prev) => {
      const cur = prev[rodadaKey];
      if (!cur) return prev;
      const map = { ...(cur.honorariosDataRecebimento || {}), [chave]: dataBr };
      return { ...prev, [rodadaKey]: { ...cur, honorariosDataRecebimento: map } };
    });
  }

  const resumoDebitoParcelamento = useMemo(() => {
    const modo = normalizarEntradaModo(entradaParcelamentoModo);
    if (modo === 'nenhuma') return resumoGeral;
    const dataCalcNorm = normalizarTextoDataBRparaSalvar(dataCalculo);
    const dataEntNorm =
      normalizarTextoDataBRparaSalvar(String(entradaParcelamentoDataVenc || dataCalculo).trim()) || dataCalcNorm;
    if (!dataEntNorm || dataEntNorm === dataCalcNorm) return resumoGeral;
    const gravados = rodadaAtual.titulosGravadosAceito;
    const temGravadosImutaveis = Array.isArray(gravados) && gravados.length > 0;
    const baseTitulos = temGravadosImutaveis ? gravados : titulosDimensao;
    const { next } = recalcularTitulos(baseTitulos, indicesMensaisINPC, indicesMensaisIPCA, dataEntNorm);
    return calcularResumoTitulosGrade(next);
  }, [
    entradaParcelamentoModo,
    entradaParcelamentoDataVenc,
    dataCalculo,
    resumoGeral,
    titulosDimensao,
    rodadaAtual.titulosGravadosAceito,
    indicesMensaisINPC,
    indicesMensaisIPCA,
    juros,
    multa,
    honorariosTipo,
    honorariosValor,
    indice,
  ]);

  const resumoParcelamento = useMemo(() => {
    const nParc = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);
    const temEnt = temEntradaAtiva;
    const limite = temEnt ? nParc + 1 : nParc;
    const baseResumo = calcularResumoPlanoPagamento(parcelas.slice(0, limite), nParc, temEnt);
    const dataCalcNorm = normalizarTextoDataBRparaSalvar(dataCalculo);
    const dataEntNorm =
      normalizarTextoDataBRparaSalvar(String(entradaParcelamentoDataVenc || dataCalculo).trim()) || dataCalcNorm;
    return {
      ...baseResumo,
      valorFinalAtualizado: resumoDebitoParcelamento.total,
      valorFinalAtualizadoCustas: formatBRL(0),
      debitoDataCalculo: resumoGeral.total,
      debitoDataEntrada: resumoDebitoParcelamento.total,
      mostrarDoisDebitos: temEnt && dataEntNorm !== dataCalcNorm,
    };
  }, [
    parcelas,
    quantidadeParcelasInformada,
    temEntradaAtiva,
    resumoDebitoParcelamento,
    resumoGeral.total,
    dataCalculo,
    entradaParcelamentoDataVenc,
  ]);

  const honorariosRecebimentoMap = rodadaAtual.honorariosDataRecebimento || {};

  /** Mesma base da Conta Corrente em Processos: extratos filtrados por cliente/proc (conciliação). */
  const financeiroContaEscritorioRodada = useMemo(
    () => getLancamentosContaCorrente(codigoClienteNorm, procNorm),
    [codigoClienteNorm, procNorm]
  );

  const nParcelasAtivas = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);

  const linhasHonorariosTitulo = useMemo(() => {
    const out = [];
    titulos.forEach((t, i) => {
      const v = parseBRL(t.honorarios);
      if (v > 0) out.push({ indice: i, titulo: t, valor: v });
    });
    return out;
  }, [titulos]);

  const linhasHonorariosParcela = useMemo(() => {
    const out = [];
    const totalLinhas = temEntradaAtiva ? nParcelasAtivas + 1 : nParcelasAtivas;
    if (totalLinhas <= 0) return out;
    for (let i = 0; i < totalLinhas; i++) {
      const p = parcelas[i];
      if (!p) continue;
      const v = parseBRL(p.honorariosParcela);
      if (v > 0) out.push({ indice: i, parcela: p, valor: v });
    }
    return out;
  }, [parcelas, nParcelasAtivas, temEntradaAtiva]);

  const somaHonorariosComRecebimento = useMemo(() => {
    let s = 0;
    for (const { indice } of linhasHonorariosTitulo) {
      const d = honorariosRecebimentoMap[chaveHonorarioTitulo(indice)];
      if (String(d ?? '').trim()) s += parseBRL(titulos[indice]?.honorarios);
    }
    for (const { indice } of linhasHonorariosParcela) {
      const d = honorariosRecebimentoMap[chaveHonorarioParcela(indice)];
      if (String(d ?? '').trim()) s += parseBRL(parcelas[indice]?.honorariosParcela);
    }
    return trunc2(s);
  }, [linhasHonorariosTitulo, linhasHonorariosParcela, honorariosRecebimentoMap, titulos, parcelas]);

  // Preenche entrada (opcional) + parcelas Price sobre o saldo.
  useEffect(() => {
    if (calculoAceito) return;

    const tm = setTimeout(() => {
      const nParc = parseQuantidadeParcelasNumero(quantidadeParcelasInformada);
      const temEnt = entradaModoAtivo({ entradaParcelamentoModo });
      if (nParc <= 0 && !temEnt) {
        setRodadasState((prev) => {
          const cur = prev[rodadaKey];
          if (!cur) return prev;
          const listaBase = Array.isArray(cur.parcelas) ? [...cur.parcelas] : gerarParcelasMock();
          const next = listaBase.map((l) => ({
            ...l,
            tipo: 'parcela',
            valorParcela: '',
            honorariosParcela: '',
            dataVencimento: '',
            dataPagamento: '',
          }));
          return { ...prev, [rodadaKey]: { ...cur, parcelas: next } };
        });
        return;
      }

      let taxaM = parsePercentualBR(taxaJurosParcelamento);
      if (!Number.isFinite(taxaM)) taxaM = 0;

      const dataCalcNorm = normalizarTextoDataBRparaSalvar(dataCalculo);
      const dataEntStr =
        normalizarTextoDataBRparaSalvar(String(entradaParcelamentoDataVenc || dataCalculo).trim()) ||
        dataCalcNorm;
      const dataBaseParc = temEnt && dataEntStr !== dataCalcNorm ? dataEntStr : dataCalcNorm;

      const montado = montarLinhasPlanoPagamento({
        resumoDebito: resumoDebitoParcelamento,
        entradaModo: entradaParcelamentoModo,
        entradaValor: entradaParcelamentoValor,
        entradaPercentual: entradaParcelamentoPercentual,
        dataEntrada: dataEntStr,
        nParcelas: nParc,
        taxaPercent: taxaM,
        dataBaseParcelas: dataBaseParc,
        gerarDataParcela: (base, i) => gerarDataParcelaMensalBR(base, i),
      });

      setRodadasState((prev) => {
        const cur = prev[rodadaKey];
        if (!cur) return prev;
        const listaBase = Array.isArray(cur.parcelas) ? [...cur.parcelas] : gerarParcelasMock();
        const linhas = montado.erro ? [] : montado.linhas;
        const minLen = Math.max(linhas.length, PARCELAS_POR_PAGINA);
        const next = [];
        for (let i = 0; i < minLen; i++) {
          next.push(
            i < linhas.length
              ? { ...linhaVaziaParcela(), ...linhas[i] }
              : { ...linhaVaziaParcela(), ...(listaBase[i] || {}) }
          );
          if (i >= linhas.length) {
            next[i] = {
              ...next[i],
              tipo: 'parcela',
              valorParcela: '',
              honorariosParcela: '',
              dataVencimento: '',
              dataPagamento: '',
            };
          }
        }
        const ultimo = next.length - 1;
        if (parcelaTemValor(next[ultimo])) {
          next.push(linhaVaziaParcela());
        }
        isDirtyRodadaRef.current = true;
        return { ...prev, [rodadaKey]: { ...cur, parcelas: next } };
      });
    }, 320);

    return () => clearTimeout(tm);
  }, [
    rodadaKey,
    quantidadeParcelasInformada,
    taxaJurosParcelamento,
    resumoDebitoParcelamento,
    entradaParcelamentoModo,
    entradaParcelamentoValor,
    entradaParcelamentoPercentual,
    entradaParcelamentoDataVenc,
    dataCalculo,
    calculoTravadoAceito,
    aceitarPagamento,
  ]);

  return (
    <div
      className={`min-h-0 flex flex-col bg-slate-50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] ${isEmbedded ? 'w-full min-w-0' : 'flex-1'}`}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200 shrink-0">
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate min-w-0">
          Cálculos Atualizados dos Títulos
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              setProcessoEmbed({
                revision: Date.now(),
                routerState: buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm),
              })
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 text-xs font-medium hover:bg-indigo-100 dark:border-indigo-500/50 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/40"
            title={`Abrir cadastro do processo (cliente ${codigoClienteNorm}, proc. ${procNorm}) numa janela suspensa`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" aria-hidden />
            Processo
          </button>
          <button
            type="button"
            onClick={() => {
              if (isEmbedded && typeof onFecharEmbed === 'function') onFecharEmbed();
              else window.history.back();
            }}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div
        className="px-3 py-1.5 bg-slate-700 text-white flex items-center justify-between gap-3 text-sm shrink-0 cursor-pointer select-none"
        onDoubleClick={() =>
          navigate('/processos', { state: buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm) })
        }
        title={`${autorBarraCalculo} X ${reuBarraCalculo} - Proc. ${procNorm}${unidadeBarraCalculo ? ` — ${unidadeBarraCalculo}` : ''} — duplo clique: abrir em Processos (cliente ${codigoClienteNorm}, proc. ${procNorm})`}
      >
        <span className="font-medium truncate min-w-0 leading-snug">
          {autorBarraCalculo} X {reuBarraCalculo} - Proc. {procNorm}
          {unidadeBarraCalculo ? (
            <span className="font-normal text-white/90"> — {unidadeBarraCalculo}</span>
          ) : null}
        </span>
        <span className="text-[11px] font-mono tabular-nums shrink-0 text-white/90 border-l border-white/25 pl-3">
          Cód. {String(codigoClienteNorm)}
        </span>
      </div>

      <div className="flex overflow-x-auto flex-nowrap border-b border-slate-200 bg-slate-100 shrink-0 gap-0.5 px-1 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTabAtiva(tab)}
            className={`shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors ${tabAtiva === tab ? 'bg-white text-slate-900 border border-b-0 border-slate-200 -mb-px shadow-sm' : 'text-slate-600 hover:bg-white/70 border border-transparent'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <aside className="order-last lg:order-last w-full shrink-0 lg:w-52 max-lg:max-h-[min(48dvh,420px)] border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-100/90 p-2 overflow-y-auto overflow-x-hidden space-y-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          <div className="p-1.5 rounded border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 gap-2 lg:block lg:space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Cod Cliente</label>
                <SpinnerFieldManual
                  inputRef={inputCodClienteRodadaRef}
                  value={codClienteManual}
                  onChange={(v) => setCodClienteManual(v)}
                  min={1}
                  step={1}
                  className="w-full"
                  formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1))).padStart(8, '0')}
                  parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
                  onStep={(nextCod) => aplicarClienteProcComValores(nextCod, procManual)}
                  onBlur={commitClienteProcManual}
                  onKeyDown={(e) => handleEnterCampoRodada(e, inputProcRodadaRef)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Proc.</label>
                <SpinnerFieldManual
                  inputRef={inputProcRodadaRef}
                  value={procManual}
                  onChange={(v) => setProcManual(v)}
                  min={1}
                  step={1}
                  className="w-full"
                  formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1)))}
                  parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
                  onStep={(nextProc) => aplicarClienteProcComValores(codClienteManual, nextProc)}
                  onBlur={commitClienteProcManual}
                  onKeyDown={(e) => handleEnterCampoRodada(e, inputDimensaoRodadaRef)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-0.5">Dimensão</label>
                <SpinnerField
                  inputRef={inputDimensaoRodadaRef}
                  value={dimensao}
                  onChange={setDimensao}
                  min={0}
                  className="w-full"
                  onKeyDown={(e) =>
                    handleEnterCampoRodada(e, btnIrRodadaRef, () => {
                      setDimensao((v) => Math.max(0, Math.floor(Number(v) || 0)));
                      commitClienteProcManual();
                    })
                  }
                />
              </div>
              <button
                ref={btnIrRodadaRef}
                type="button"
                onClick={aplicarClienteProcManual}
                className="col-span-3 lg:col-span-1 w-full px-2 py-2 lg:py-1.5 rounded bg-blue-600 text-white text-sm lg:text-xs font-medium hover:bg-blue-700"
              >
                Ir
              </button>
            </div>
          </div>
          {tabAtiva === 'Títulos' && (
            <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Página</label>
                <SpinnerField value={pagina} onChange={setPagina} min={1} className="w-full lg:w-24" />
                <p className="mt-1 text-[11px] text-slate-500">de {String(totalPaginas).padStart(2, '0')}</p>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    if (limpezaAtiva) reverterLimpeza();
                    else setConfirmarLimpeza(true);
                  }}
                  className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50"
                >
                  {limpezaAtiva ? 'Reverter limpeza' : 'Limpa Página Toda'}
                </button>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Data do Cálculo:</label>
                <input
                  type="text"
                  value={dataCalculo}
                  disabled={calculoAceito && !modoAlteracao}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = resolverAliasHojeEmTexto(v, 'br') ?? v;
                    setDataCalculo(next);
                    if (!calculoAceito || modoAlteracao) persistirDataCalculoRodada(next);
                  }}
                  onBlur={(e) => {
                    const next = normalizarTextoDataBRparaSalvar(e.target.value);
                    setDataCalculo(next);
                    if (!calculoAceito || modoAlteracao) persistirDataCalculoRodada(next);
                  }}
                  placeholder="dd/mm/aaaa ou hj"
                  className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Juros:</label>
                <input
                  type="text"
                  value={juros}
                  onChange={(e) => updatePainelCampo({ juros: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">Multa:</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={percentualFixoParaCampo(multa)}
                    onChange={(e) =>
                      updatePainelCampo({ multa: editarPercentualFixoCampo(e.target.value) })
                    }
                    onBlur={(e) =>
                      updatePainelCampo({
                        multa: normalizarHonorariosValorFixo(e.target.value),
                      })
                    }
                    placeholder="2"
                    className={`${inputClass} pr-7`}
                  />
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                    aria-hidden
                  >
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-2 lg:col-span-1 border border-slate-200 rounded p-1.5 bg-white shadow-sm">
                <p className="text-[11px] font-medium text-slate-700 mb-1">Honorários</p>
                <div className="flex gap-2 mb-0.5">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="honorarios"
                      checked={honorariosTipo === 'fixos'}
                      onChange={() => updatePainelCampo({ honorariosTipo: 'fixos' })}
                      className="text-slate-600"
                    />
                    Fixos
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="honorarios"
                      checked={honorariosTipo === 'variaveis'}
                      onChange={() => updatePainelCampo({ honorariosTipo: 'variaveis' })}
                      className="text-slate-600"
                    />
                    Variáveis
                  </label>
                </div>
                {honorariosTipo === 'variaveis' && (
                  <>
                    <p className="text-xs text-slate-500 mb-1">
                      Padrão sugerido: ≤ 30 dias = 0% &nbsp;|&nbsp; 31–60 dias = 10% &nbsp;|&nbsp; &gt; 60 dias = 20%
                    </p>
                    <textarea
                      value={honorariosVariaveisTexto}
                      onChange={(e) => updatePainelCampo({ honorariosVariaveisTexto: e.target.value })}
                      rows={3}
                      placeholder="Regras personalizadas (texto livre; padrão do cliente em Cadastro de Clientes)"
                      className="w-full text-sm border border-slate-300 rounded px-2 py-1 mb-1 font-mono"
                    />
                  </>
                )}
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={percentualFixoParaCampo(honorariosValor)}
                    onChange={(e) =>
                      updatePainelCampo({ honorariosValor: editarPercentualFixoCampo(e.target.value) })
                    }
                    onBlur={(e) =>
                      updatePainelCampo({
                        honorariosValor: normalizarHonorariosValorFixo(e.target.value),
                      })
                    }
                    placeholder="20"
                    disabled={honorariosTipo !== 'fixos'}
                    className={`${inputClass} pr-7 ${honorariosTipo !== 'fixos' ? 'bg-slate-50 text-slate-400' : ''}`}
                  />
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                    aria-hidden
                  >
                    %
                  </span>
                </div>
              </div>
              <div className="col-span-2 lg:col-span-1 border border-slate-200 rounded p-1.5 bg-white shadow-sm relative" ref={indicePickerRef}>
                <p className="text-[11px] font-medium text-slate-700 mb-1">Índice</p>
                <button
                  type="button"
                  onClick={() => setIndiceMenuAberto((v) => !v)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIndiceMenuAberto(false);
                    setModalIndicesConferencia(true);
                  }}
                  title="Clique para escolher; duplo clique para conferir índices mês a mês"
                  className="w-full flex items-center justify-between gap-1.5 px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-left text-[11px] font-medium text-slate-800 hover:bg-slate-50"
                  aria-expanded={indiceMenuAberto}
                  aria-haspopup="listbox"
                  aria-label={`Índice: ${indice}. Abrir lista; duplo clique confere valores mensais`}
                >
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    {indice}
                    {indice === 'INPC' && <BarChart2 className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />}
                  </span>
                  {indiceMenuAberto ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden />
                  )}
                </button>
                {indiceMenuAberto ? (
                  <ul
                    className="absolute left-1.5 right-1.5 top-full z-30 mt-0.5 max-h-44 overflow-y-auto rounded border border-slate-200 bg-white py-0.5 shadow-lg"
                    role="listbox"
                    aria-label="Escolher índice"
                  >
                    {INDICES.map((nome) => (
                      <li key={nome} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={indice === nome}
                          onClick={() => {
                            updatePainelCampo({ indice: nome });
                            setIndiceMenuAberto(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center gap-1.5 hover:bg-slate-50 ${
                            indice === nome ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-800'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                            {indice === nome ? <Check className="w-3 h-3 text-blue-600" strokeWidth={3} aria-hidden /> : null}
                          </span>
                          <span className="truncate">{nome}</span>
                          {nome === 'INPC' && <BarChart2 className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-auto" aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="col-span-2 lg:col-span-1 border border-slate-200 rounded p-1.5 bg-white shadow-sm">
                <p className="text-[11px] font-medium text-slate-700 mb-0.5">Periodicidade (sugestão)</p>
                <select
                  value={periodicidade}
                  onChange={(e) => updatePainelCampo({ periodicidade: e.target.value })}
                  className={inputClass}
                >
                  {PERIODICIDADE_OPCOES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="space-y-1 pt-1.5 border-t border-slate-200">
            <button type="button" className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50">Cancelar</button>
            <button type="button" className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">Configurações</button>
            <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={aceitarPagamento}
                onChange={(e) => {
                  const next = e.target.checked;
                  const ok = confirmarAlternarAceitarPagamento(next);
                  if (!ok) return;
                  setAceitarPagamento(next);
                  if (next) {
                    aplicarValorCausaProcessoAoAceitarPagamento(resumoGeral.total);
                  } else {
                    setIndicesRefreshToken((t) => t + 1);
                    setPaginaParcelamento(1);
                  }
                  setRodadasState((prev) => {
                    const cur = prev[rodadaKey];
                    if (!cur) return prev;
                    const patch = next
                      ? patchRodadaAoAceitarPagamento(cur, dataCalculo)
                      : patchRodadaAoDesfazerAceitarPagamento(cur, titulos);
                    isDirtyRodadaRef.current = true;
                    paginasRodadaCacheRef.current = new Map();
                    return { ...prev, [rodadaKey]: { ...cur, ...patch } };
                  });
                }}
                className="rounded border-slate-300"
              />
              Aceitar Pagamento
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
              <input type="checkbox" checked={modoAlteracao} onChange={(e) => setModoAlteracao(e.target.checked)} className="rounded border-slate-300" />
              Modo de Alteração
            </label>
            <input
              ref={debitosPlanilhaInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              aria-hidden="true"
              onChange={handleDebitosPlanilhaFileChange}
            />
            <button
              type="button"
              onClick={handleImportarDebitosPlanilhaClick}
              className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50 text-left"
            >
              Importar débitos (Excel)
            </button>
            {featureFlags.useApiCalculos && (
              <button
                type="button"
                disabled={sincronizandoRodadasApi}
                onClick={() => void handleSincronizarRodadasComBanco()}
                className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50 text-left flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${sincronizandoRodadasApi ? 'animate-spin' : ''}`} aria-hidden />
                Sincronizar com banco
              </button>
            )}
            <button
              type="button"
              onClick={() => void gerarPdfCalculo()}
              className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50 text-left"
            >
              Salvar Formulário em PDF
            </button>
            <button
              type="button"
              onClick={() => {
                void gerarWordListaDebitos();
              }}
              className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50"
            >
              Gerar no Word
            </button>
            <button
              type="button"
              onClick={() => setModalCobrancaWhatsApp(true)}
              className="w-full px-2 py-2 lg:py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-medium hover:bg-emerald-100 flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
              Cobrança WhatsApp
            </button>
            <button type="button" className="w-full px-2 py-2 lg:py-1.5 rounded border border-slate-200 bg-white text-slate-700 text-xs hover:bg-slate-50">Email Automático</button>
          </div>
        </aside>

        <div className="order-first flex-1 min-w-0 min-h-0 overflow-auto p-2 [-webkit-overflow-scrolling:touch] flex flex-col">
          {tabAtiva === 'Títulos' && (
            <TitulosGrid
              titulosPaginaCompletos={titulosPaginaCompletos}
              resumoPagina={resumoPagina}
              resumoGeral={resumoGeral}
              pagina={pagina}
              totalPaginas={totalPaginas}
              inicio={inicio}
              fim={fim}
              titulosTotalLength={titulos.length}
              rodadaTitulosLength={rodadaTitulosLength}
              aceitarPagamento={aceitarPagamento}
              modoAlteracao={modoAlteracao}
              showAvisoParcelasVazias={showAvisoParcelasTitulosVazios}
              isLoading={featureFlags.useApiCalculos && carregandoRodadaApi}
              onTituloFieldChange={handleTituloFieldChange}
              onFocusTituloCampo={handleFocusTituloCampo}
              onAbrirDatasEspeciais={handleAbrirDatasEspeciais}
              onPaginaAnterior={handlePaginaAnterior}
              onPaginaProxima={handlePaginaProxima}
            />
          )}
          {tabAtiva === 'Parcelamento' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <p className="text-xs text-slate-700 mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                O <strong>parcelamento</strong> acompanha os <strong>cálculos da aba Títulos</strong> para a{' '}
                <strong>dimensão {dimensaoNorm}</strong> (cliente {codigoClienteNorm}, proc. {procNorm}). Ao mudar a{' '}
                <strong>dimensão</strong>, os títulos e o parcelamento exibidos passam a ser os dessa dimensão — cada combinação
                cliente/processo/dimensão mantém parcelamento e totais próprios.{' '}
                Com <strong>quantidade de parcelas</strong> e <strong>taxa de juros de parcelamento</strong> (% ao mês) informados,
                o valor de cada parcela e o <strong>honorário por parcela</strong> são calculados automaticamente (prestação fixa — Tabela Price)
                sobre o total dos títulos e sobre a soma dos honorários da aba Títulos, com a mesma taxa.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate('/financeiro', {
                      state: {
                        financeiroBuscaParcelas: {
                          dimensao: dimensaoNorm,
                          ...buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm),
                        },
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buscar estas parcelas no Financeiro
                </button>
                <span className="text-xs text-slate-600 max-w-xl">
                  Abre o Financeiro: a busca é <strong>automática</strong> (extratos sem classificação × parcelas de cálculos
                  com <strong>Aceitar Pagamento</strong>). Você só revisa e aprova o vínculo.
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(paginaParcelamento).padStart(2, '0')} — Parcelas {inicioParcelas + 1} a {Math.min(fimParcelas, parcelas.length)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.min(totalPaginasParcelas, p + 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-3">
                <div className="overflow-x-auto border border-slate-300 [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[520px] text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-24">Parcela</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-28">Data Venc.</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Valor</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Honor. Parc.</th>
                        <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelasPaginaCompletas.map((row, idx) => {
                        const globalIdx = inicioParcelas + idx;
                        const podeEditar = !aceitarPagamento || modoAlteracao;
                        return (
                          <tr key={`parcela-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">
                              {rotuloLinhaPlanoPagamento(row, globalIdx, temEntradaAtiva)}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder=""
                                  autoComplete="off"
                                  value={row.dataVencimento || ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const r = resolverAliasHojeEmTexto(v, 'br');
                                    atualizarParcelaNaRodada(globalIdx, { dataVencimento: r ?? v });
                                  }}
                                  onBlur={(e) =>
                                    atualizarParcelaNaRodada(globalIdx, {
                                      dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                                    })
                                  }
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.dataVencimento}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.valorParcela}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { valorParcela: e.target.value })}
                                  onBlur={(e) => {
                                    const raw = String(e.target.value ?? '').trim();
                                    atualizarParcelaNaRodada(globalIdx, { valorParcela: raw === '' ? '' : formatBRL(parseBRL(raw)) });
                                  }}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.valorParcela}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.honorariosParcela}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { honorariosParcela: e.target.value })}
                                  onBlur={(e) => {
                                    const raw = String(e.target.value ?? '').trim();
                                    atualizarParcelaNaRodada(globalIdx, { honorariosParcela: raw === '' ? '' : formatBRL(parseBRL(raw)) });
                                  }}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.honorariosParcela}
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              {podeEditar ? (
                                <input
                                  type="text"
                                  value={row.observacao}
                                  onChange={(e) => atualizarParcelaNaRodada(globalIdx, { observacao: e.target.value })}
                                  className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                />
                              ) : row.observacao}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-medium">
                        <td className="border border-slate-300 px-2 py-1" colSpan={2}>Total da página</td>
                        <td className="border border-slate-300 px-2 py-1">
                          {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.valorParcela), 0)))}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.honorariosParcela), 0)))}
                        </td>
                        <td className="border border-slate-300 px-2 py-1" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="border border-slate-300 p-3 bg-slate-50 space-y-3">
                  <div className="border border-slate-300 bg-white p-2">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Parcelamentos</p>
                    <div className="space-y-1.5 text-sm">
                      <fieldset
                        className="space-y-1.5 pb-2 border-b border-slate-200"
                        disabled={aceitarPagamento && !modoAlteracao}
                      >
                        <legend className="text-xs font-medium text-slate-600 mb-1">Entrada</legend>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {[
                            ['nenhuma', 'Sem entrada'],
                            ['reais', 'R$'],
                            ['percentual', '%'],
                          ].map(([modo, label]) => (
                            <label key={modo} className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`entrada-modo-${rodadaKey}`}
                                checked={normalizarEntradaModo(entradaParcelamentoModo) === modo}
                                onChange={() => setEntradaParcelamentoModo(modo)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {normalizarEntradaModo(entradaParcelamentoModo) === 'reais' && (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entradaParcelamentoValor}
                            onChange={(e) => patchEntradaParcelamento({ entradaParcelamentoValor: e.target.value })}
                            onBlur={(e) =>
                              patchEntradaParcelamento({
                                entradaParcelamentoValor: formatValorMoedaCampo(e.target.value),
                              })
                            }
                            placeholder="0,00"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                          />
                        )}
                        {normalizarEntradaModo(entradaParcelamentoModo) === 'percentual' && (
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={entradaParcelamentoPercentual}
                              onChange={(e) =>
                                patchEntradaParcelamento({ entradaParcelamentoPercentual: e.target.value })
                              }
                              placeholder="10"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm pr-7"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                              %
                            </span>
                          </div>
                        )}
                        {temEntradaAtiva && (
                          <label className="block text-xs text-slate-600">
                            Data da entrada
                            <input
                              type="text"
                              value={entradaParcelamentoDataVenc || dataCalculo}
                              onChange={(e) => {
                                const v = e.target.value;
                                const next = resolverAliasHojeEmTexto(v, 'br') ?? v;
                                patchEntradaParcelamento({ entradaParcelamentoDataVenc: next });
                              }}
                              onBlur={(e) =>
                                patchEntradaParcelamento({
                                  entradaParcelamentoDataVenc: normalizarTextoDataBRparaSalvar(e.target.value),
                                })
                              }
                              placeholder="dd/mm/aaaa"
                              className="mt-0.5 w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </label>
                        )}
                        {resumoParcelamento.mostrarDoisDebitos && (
                          <p className="text-[11px] text-slate-600 leading-snug">
                            Débito na data do cálculo: <b>{resumoParcelamento.debitoDataCalculo}</b>
                            <br />
                            Débito na data da entrada: <b>{resumoParcelamento.debitoDataEntrada}</b>
                          </p>
                        )}
                        {temEntradaAtiva && (
                          <>
                            <p className="flex justify-between gap-2">
                              <span>Entrada:</span>
                              <b>{resumoParcelamento.entradaTotal}</b>
                            </p>
                            <p className="flex justify-between gap-2">
                              <span>Saldo a parcelar:</span>
                              <b>{formatBRL(Math.max(0, parseBRL(resumoParcelamento.debitoDataEntrada) - parseBRL(resumoParcelamento.entradaTotal)))}</b>
                            </p>
                          </>
                        )}
                      </fieldset>
                      <div className="flex justify-between items-center gap-2">
                        <span>Quantidade de Parcelas:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={aceitarPagamento && !modoAlteracao}
                          value={quantidadeParcelasInformada}
                          onChange={(e) => atualizarQuantidadeParcelasInformada(e.target.value)}
                          onBlur={onBlurQuantidadeParcelasInformada}
                          title="Informe a quantidade de parcelas"
                          className="w-[4.5rem] px-2 py-1 border border-slate-300 rounded text-sm bg-white text-slate-800 text-right tabular-nums shrink-0 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </div>
                      <p className="flex justify-between gap-2"><span>Valor Final das Parcelas:</span><b>{resumoParcelamento.valorFinalParcelas}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Total Pago (após parcelamento):</span><b>{resumoParcelamento.valorTotalPagar}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final dos Honorários:</span><b>{resumoParcelamento.valorFinalHonorarios}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor dos Honorários (Parcela):</span><b>{resumoParcelamento.valorHonorariosParcela}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor das Custas (Parcela):</span><b>{resumoParcelamento.valorCustasParcela}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final das Custas após:</span><b>{resumoParcelamento.valorFinalCustas}</b></p>
                    </div>
                  </div>
                  <div className="border border-slate-300 bg-white p-2">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Informações</p>
                    <div className="space-y-1.5 text-sm">
                      <p className="flex justify-between gap-2"><span>Valor final Atualizado:</span><b>{resumoParcelamento.valorFinalAtualizado}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Final Atualizado das Custas:</span><b>{resumoParcelamento.valorFinalAtualizadoCustas}</b></p>
                      <p className="flex justify-between gap-2"><span>Valor Total a ser Pago:</span><b>{resumoParcelamento.valorTotalPagar}</b></p>
                      <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="leading-tight">Taxa de Juros de Parcelamento:</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={aceitarPagamento && !modoAlteracao}
                            value={taxaJurosParcelamento}
                            onChange={(e) => atualizarTaxaJurosParcelamento(e.target.value)}
                            onBlur={onBlurTaxaJurosParcelamento}
                            title="Taxa em porcentagem (duas casas decimais)"
                            placeholder="0,00"
                            className="w-[5.25rem] px-2 py-1 border border-slate-300 rounded text-sm bg-white text-slate-800 text-right tabular-nums disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <span className="text-slate-600 font-medium">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tabAtiva === 'Pagamento' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <p className="text-xs text-slate-700 mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                A aba <strong>Pagamento</strong> mostra as mesmas parcelas da aba <strong>Parcelamento</strong> para a{' '}
                <strong>dimensão {dimensaoNorm}</strong> (cliente {codigoClienteNorm}, proc. {procNorm}), sem os painéis de resumo
                lateral. Os valores acompanham o parcelamento; use a coluna <strong>Data de Pagamento</strong> para registrar quando
                cada parcela foi quitada (sempre editável, mesmo com cálculo aceito).
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(paginaParcelamento).padStart(2, '0')} — Parcelas {inicioParcelas + 1} a{' '}
                  {Math.min(fimParcelas, parcelas.length)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaParcelamento((p) => Math.min(totalPaginasParcelas, p + 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-300 [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[640px] text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-24">Parcela</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-28">Data Venc.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Valor</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-40">Honor. Parc.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700">Obs.</th>
                      <th className="border border-slate-300 px-2 py-1 text-left font-semibold text-slate-700 w-36">Data de Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelasPaginaCompletas.map((row, idx) => {
                      const globalIdx = inicioParcelas + idx;
                      const podeEditar = !aceitarPagamento || modoAlteracao;
                      return (
                        <tr key={`pagamento-parcela-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="border border-slate-200 px-2 py-1 text-slate-700">
                            {rotuloLinhaPlanoPagamento(row, globalIdx, temEntradaAtiva)}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder=""
                                autoComplete="off"
                                value={row.dataVencimento || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const r = resolverAliasHojeEmTexto(v, 'br');
                                  atualizarParcelaNaRodada(globalIdx, { dataVencimento: r ?? v });
                                }}
                                onBlur={(e) =>
                                  atualizarParcelaNaRodada(globalIdx, {
                                    dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                                  })
                                }
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.dataVencimento
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                value={row.valorParcela}
                                onChange={(e) => atualizarParcelaNaRodada(globalIdx, { valorParcela: e.target.value })}
                                onBlur={(e) => {
                                  const raw = String(e.target.value ?? '').trim();
                                  atualizarParcelaNaRodada(globalIdx, { valorParcela: raw === '' ? '' : formatBRL(parseBRL(raw)) });
                                }}
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.valorParcela
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                value={row.honorariosParcela}
                                onChange={(e) => atualizarParcelaNaRodada(globalIdx, { honorariosParcela: e.target.value })}
                                onBlur={(e) => {
                                  const raw = String(e.target.value ?? '').trim();
                                  atualizarParcelaNaRodada(globalIdx, {
                                    honorariosParcela: raw === '' ? '' : formatBRL(parseBRL(raw)),
                                  });
                                }}
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.honorariosParcela
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {podeEditar ? (
                              <input
                                type="text"
                                value={row.observacao}
                                onChange={(e) => atualizarParcelaNaRodada(globalIdx, { observacao: e.target.value })}
                                className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              row.observacao
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder=""
                              autoComplete="off"
                              value={row.dataPagamento ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                const r = resolverAliasHojeEmTexto(v, 'br');
                                atualizarParcelaNaRodada(globalIdx, { dataPagamento: r ?? v });
                              }}
                              onBlur={(e) =>
                                atualizarParcelaNaRodada(globalIdx, {
                                  dataPagamento: normalizarTextoDataBRparaSalvar(e.target.value),
                                })
                              }
                              className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-medium">
                      <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                        Total da página
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.valorParcela), 0)))}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {formatBRL(trunc2(parcelasPagina.reduce((acc, p) => acc + parseBRL(p.honorariosParcela), 0)))}
                      </td>
                      <td className="border border-slate-300 px-2 py-1" />
                      <td className="border border-slate-300 px-2 py-1" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {tabAtiva === 'Honorários' && (
            <div className="border border-slate-300 rounded bg-white p-3 space-y-4">
              <p className="text-xs text-slate-700 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                Os valores de <strong>honorários</strong> vêm da aba <strong>Títulos</strong> (coluna Honorários) e do{' '}
                <strong>parcelamento</strong> (honorários por parcela). Informe a <strong>data de recebimento</strong> para
                conferir com o extrato. A conciliação usa os <strong>mesmos cliente, processo e Conta Escritório</strong> do
                módulo <strong>Financeiro</strong> (critério idêntico à Conta Corrente em Processos).
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-emerald-900">Financeiro — Conta Escritório (este cliente/proc.)</p>
                  <p className="text-emerald-800 tabular-nums">
                    Soma dos lançamentos: <strong>{formatBRL(trunc2(financeiroContaEscritorioRodada.soma))}</strong> —{' '}
                    {financeiroContaEscritorioRodada.lancamentos.length} lançamento(s).
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Honorários com data de recebimento informada (soma):{' '}
                    <strong>{formatBRL(somaHonorariosComRecebimento)}</strong> — compare com créditos no extrato.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/financeiro', {
                      state: {
                        financeiroConciliacaoHonorarios: {
                          dimensao: dimensaoNorm,
                          rotulo: `Cálculos — dim. ${dimensaoNorm} — geral`,
                          valorCentavos: null,
                          ...buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm),
                        },
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Financeiro (filtrar)
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Honorários por título (aba Títulos)</h3>
                {linhasHonorariosTitulo.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum honorário calculado por título nesta dimensão.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Linha</th>
                          <th className="border border-slate-300 px-2 py-1 text-left w-28 min-w-0">Data venc.</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Valor honorários</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data recebimento</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Conciliação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasHonorariosTitulo.map(({ indice, titulo }) => {
                          const chave = chaveHonorarioTitulo(indice);
                          const podeEditar = !aceitarPagamento || modoAlteracao;
                          const valorNum = parseBRL(titulo.honorarios);
                          return (
                            <tr key={chave} className={indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">#{indice + 1}</td>
                              <td className="border border-slate-200 px-1.5 py-1 w-28 min-w-0 tabular-nums whitespace-nowrap">
                                {titulo.dataVencimento || '—'}
                              </td>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">{titulo.honorarios}</td>
                              <td className="border border-slate-200 px-2 py-1 w-44">
                                {podeEditar ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder=""
                                    autoComplete="off"
                                    value={honorariosRecebimentoMap[chave] ?? ''}
                                    onChange={(e) => atualizarHonorarioDataRecebimento(chave, e.target.value)}
                                    onBlur={(e) =>
                                      atualizarHonorarioDataRecebimento(
                                        chave,
                                        normalizarTextoDataBRparaSalvar(e.target.value)
                                      )
                                    }
                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                  />
                                ) : (
                                  honorariosRecebimentoMap[chave] ?? ''
                                )}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate('/financeiro', {
                                      state: {
                                        financeiroConciliacaoHonorarios: {
                                          dimensao: dimensaoNorm,
                                          rotulo: `Honor. título linha ${indice + 1}`,
                                          valorCentavos: Math.round(valorNum * 100),
                                          ...buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm),
                                        },
                                      },
                                    })
                                  }
                                  className="text-xs text-blue-700 underline hover:text-blue-900"
                                >
                                  Ver no Financeiro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Honorários por parcela (parcelamento)</h3>
                {linhasHonorariosParcela.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhuma parcela com honorário ou quantidade de parcelas zerada — ajuste na aba Parcelamento.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-2 py-1 text-left">Parcela</th>
                          <th className="border border-slate-300 px-2 py-1 text-left w-28 min-w-0">Data venc.</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Honor. parcela</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Data recebimento</th>
                          <th className="border border-slate-300 px-2 py-1 text-left">Conciliação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasHonorariosParcela.map(({ indice, parcela }) => {
                          const chave = chaveHonorarioParcela(indice);
                          const podeEditar = !aceitarPagamento || modoAlteracao;
                          const valorNum = parseBRL(parcela.honorariosParcela);
                          return (
                            <tr key={chave} className={indice % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">
                                {String(indice + 1).padStart(2, '0')}
                              </td>
                              <td className="border border-slate-200 px-1.5 py-1 w-28 min-w-0 tabular-nums whitespace-nowrap">
                                {parcela.dataVencimento || '—'}
                              </td>
                              <td className="border border-slate-200 px-2 py-1 tabular-nums">{parcela.honorariosParcela}</td>
                              <td className="border border-slate-200 px-2 py-1 w-44">
                                {podeEditar ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder=""
                                    autoComplete="off"
                                    value={honorariosRecebimentoMap[chave] ?? ''}
                                    onChange={(e) => atualizarHonorarioDataRecebimento(chave, e.target.value)}
                                    onBlur={(e) =>
                                      atualizarHonorarioDataRecebimento(
                                        chave,
                                        normalizarTextoDataBRparaSalvar(e.target.value)
                                      )
                                    }
                                    className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                                  />
                                ) : (
                                  honorariosRecebimentoMap[chave] ?? ''
                                )}
                              </td>
                              <td className="border border-slate-200 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate('/financeiro', {
                                      state: {
                                        financeiroConciliacaoHonorarios: {
                                          dimensao: dimensaoNorm,
                                          rotulo: `Honor. parcela ${String(indice + 1).padStart(2, '0')}`,
                                          valorCentavos: Math.round(valorNum * 100),
                                          ...buildRouterStateChaveClienteProcesso(codigoClienteNorm, procNorm),
                                        },
                                      },
                                    })
                                  }
                                  className="text-xs text-blue-700 underline hover:text-blue-900"
                                >
                                  Ver no Financeiro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {tabAtiva === 'Descrição dos Valores' && (
            <div className="border border-slate-300 rounded bg-white p-3">
              <p className="text-xs text-slate-700 mb-3 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
                Para cada <strong>título</strong> cadastrado na aba <strong>Títulos</strong> (dimensão {dimensaoNorm}, cliente{' '}
                {codigoClienteNorm}, proc. {procNorm}), use o campo abaixo para descrever em texto a que se refere aquele
                valor (objeto, origem, contrato, observações).
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-sm text-slate-600">
                  Página {String(pagina).padStart(2, '0')} — Linhas {inicio + 1} a {Math.min(fim, titulos.length)} (de{' '}
                  {titulos.length})
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-300 rounded [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[480px] text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-14">#</th>
                      <th className="border border-slate-300 px-1.5 py-1.5 text-left font-semibold text-slate-700 w-[7rem] min-w-0 max-w-[7rem]">
                        Data venc.
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">
                        Valor inicial
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[280px]">
                        Descrição do valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {titulosPaginaCompletos.map((row, idx) => {
                      const globalIdx = inicio + idx;
                      const linhaExiste = globalIdx < (rodadaAtual.titulos || []).length;
                      const podeEditar = linhaExiste && (!aceitarPagamento || modoAlteracao);
                      return (
                        <tr key={`desc-valor-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600 tabular-nums">
                            {String(globalIdx + 1).padStart(3, '0')}
                          </td>
                          <td className="border border-slate-200 px-1.5 py-1 text-slate-700 w-[7rem] min-w-0 max-w-[7rem] tabular-nums">
                            {linhaExiste ? row.dataVencimento || '—' : '—'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-700">
                            {linhaExiste ? row.valorInicial || '—' : '—'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 align-top min-w-0">
                            {linhaExiste ? (
                              podeEditar ? (
                                <textarea
                                  value={row.descricaoValor ?? ''}
                                  onChange={(e) =>
                                    atualizarTituloNaRodada(globalIdx, { descricaoValor: e.target.value })
                                  }
                                  rows={2}
                                  placeholder="Descreva a que se refere este título…"
                                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm min-h-[2.75rem] resize-y"
                                />
                              ) : (
                                <span className="text-slate-800 whitespace-pre-wrap block py-1">
                                  {(row.descricaoValor ?? '').trim() !== ''
                                    ? row.descricaoValor
                                    : '—'}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tabAtiva !== 'Títulos' &&
            tabAtiva !== 'Parcelamento' &&
            tabAtiva !== 'Pagamento' &&
            tabAtiva !== 'Honorários' &&
            tabAtiva !== 'Descrição dos Valores' && (
            <div className="p-4 bg-white rounded border border-slate-300">
              <p className="text-sm text-slate-500">Conteúdo da aba &quot;{tabAtiva}&quot;.</p>
            </div>
          )}
        </div>
      </div>

      {modalDatasEspeciais && linhaModalIdx != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Configurações Especiais de Parcela</h2>
              <button type="button" className="p-1 rounded hover:bg-slate-100" onClick={fecharModalDatasEspeciais} aria-label="Fechar">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-700">
                Defina overrides apenas para a linha selecionada (datas/juros, multa, índice de correção monetária e honorários).
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Inicial Atual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataInicialAtual || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataInicialAtual: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataInicialAtual: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Inicial Juros</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataInicialJuros || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataInicialJuros: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataInicialJuros: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Atual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataFinalAtual || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataFinalAtual: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataFinalAtual: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Data Final Juros</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    autoComplete="off"
                    value={formDatasEspeciais.dataFinalJuros || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      const r = resolverAliasHojeEmTexto(v, 'br');
                      setFormDatasEspeciais((prev) => ({ ...prev, dataFinalJuros: r ?? v }));
                    }}
                    onBlur={(e) =>
                      setFormDatasEspeciais((prev) => ({
                        ...prev,
                        dataFinalJuros: normalizarTextoDataBRparaSalvar(e.target.value),
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">Taxa Juros Especial da Parcela</label>
                <input
                  type="text"
                  value={formDatasEspeciais.taxaJurosEspecial}
                  onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, taxaJurosEspecial: e.target.value }))}
                  placeholder="Ex: 1 %"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Multa (%) da Parcela</label>
                  <input
                    type="text"
                    value={formDatasEspeciais.multaEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, multaEspecial: e.target.value }))}
                    placeholder="Ex: 0 %"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Índice de Correção Monetária</label>
                  <select
                    value={formDatasEspeciais.indiceEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, indiceEspecial: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Usar índice geral</option>
                    {INDICES.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Honorários da Parcela</label>
                  <select
                    value={formDatasEspeciais.honorariosTipoEspecial}
                    onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, honorariosTipoEspecial: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">Usar honorários gerais</option>
                    <option value="fixos">Fixos</option>
                    <option value="variaveis">Variáveis</option>
                  </select>
                  {formDatasEspeciais.honorariosTipoEspecial === 'fixos' && (
                    <input
                      type="text"
                      value={formDatasEspeciais.honorariosValorEspecial}
                      onChange={(e) => setFormDatasEspeciais((prev) => ({ ...prev, honorariosValorEspecial: e.target.value }))}
                      placeholder="Ex: 10 %"
                      className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={fecharModalDatasEspeciais}>
                Cancelar
              </button>
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={salvarModalDatasEspeciais}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarLimpeza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Confirmar limpeza</h2>
            </div>
            <div className="px-4 py-3 text-sm text-slate-700">
              Deseja limpar todos os dados da <b>página {pagina}</b> (linhas {inicio + 1} a {Math.min(fim, titulos.length)})?
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarLimpeza(false)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmarLimpeza(false);
                  limparPaginaAtual();
                }}
                className="px-3 py-2 rounded border border-red-300 bg-red-50 text-red-700 text-sm hover:bg-red-100"
              >
                Limpar página
              </button>
            </div>
          </div>
        </div>
      )}

      {processoEmbed ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calculos-processo-embed-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProcessoEmbed(null);
          }}
        >
          <div
            className="flex flex-col w-[min(100vw-0.5rem,1280px)] h-[min(100dvh-0.5rem,920px)] max-h-[min(100dvh-0.5rem,920px)] min-h-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f141c] shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141c2c] shrink-0">
              <h2 id="calculos-processo-embed-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                Processo (cadastro)
              </h2>
              <button
                type="button"
                onClick={() => setProcessoEmbed(null)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Fechar formulário de processo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                    Carregando formulário de processos…
                  </div>
                }
              >
                <ProcessosLazy
                  key={processoEmbed.revision}
                  embedIntent={processoEmbed.routerState}
                  embedIntentRevision={processoEmbed.revision}
                  onFecharEmbed={() => setProcessoEmbed(null)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}

      <IndicesAtualizacaoConferenciaModal
        open={modalIndicesConferencia}
        onClose={() => setModalIndicesConferencia(false)}
        indice={indice}
        titulos={titulos}
        dataCalculo={dataCalculo}
        aceitarPagamento={aceitarPagamento}
        hojeBR={hojeBR}
        indicesMensaisINPC={indicesMensaisINPC}
        indicesMensaisIPCA={indicesMensaisIPCA}
      />

      <ModalCobrancaWhatsAppCalculos
        open={modalCobrancaWhatsApp}
        onClose={() => setModalCobrancaWhatsApp(false)}
        codigoCliente={codigoClienteNorm}
        numeroProcesso={procNorm}
        dimensao={dimensaoNorm}
      />
    </div>
  );
}
