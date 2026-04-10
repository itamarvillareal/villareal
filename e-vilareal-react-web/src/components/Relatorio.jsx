import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Columns3, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RelatorioUltimoAndamentoHeader } from './RelatorioUltimoAndamentoHeader.jsx';
import { RelatorioPresetsPanel } from './RelatorioPresetsPanel.jsx';
import {
  CAMPOS_DATA_COLUNA_DINAMICA,
  CAMPOS_OPCOES_ULTIMO_ANDAMENTO,
  COLUNAS_RELATORIO_PROCESSOS,
  carregarCampoPorColunaSalvo,
  salvarCampoPorColuna,
  enriquecerCamposRelatorioProcessos,
} from '../data/relatorioProcessosColunaDinamica.js';
import { normalizarFiltroProcessoAtivo } from '../data/relatorioPresets.js';
import { obterLinhasBaseRelatorioProcessos } from '../data/relatorioProcessosDados.js';
import { preaquecerCamposRelatorioApiFirst } from '../data/processosDadosRelatorio.js';
import { EVENT_RELATORIO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

const STORAGE_COLUNAS_RELATORIO = 'vilareal.relatorioProcessos.colunasVisiveis.v1';
const STORAGE_LARGURA_UNIFORME = 'vilareal.relatorioProcessos.larguraUniforme.v1';
const STORAGE_FILTRO_PROCESSO_ATIVO = 'vilareal.relatorioProcessos.filtroProcessoAtivo.v1';
const STORAGE_MODO_ALTERACAO = 'vilareal.relatorioProcessos.modoAlteracao.v1';
const STORAGE_DADOS_RELATORIO = 'vilareal.relatorioProcessos.dadosLinhas.v1';

/** Acima disso não hidrata nem grava linhas editáveis no localStorage (evita quota e lentidão com o relatório completo). */
const RELATORIO_MAX_LINHAS_PERSISTIDAS = 400;

/** Colunas que identificam o processo — não editáveis no modo de alteração. */
const COLUNAS_RELATORIO_SO_LEITURA = new Set(['codCliente', 'proc']);

/** Colunas cujo valor é data dd/mm/aaaa — ordenação cronológica, não lexicográfica. */
const COLUNAS_DATA_BR = new Set([
  'dataConsulta',
  'proximaConsulta',
  'prazoFatal',
  'dataAudiencia',
  ...CAMPOS_DATA_COLUNA_DINAMICA,
]);

/** dd/mm/aaaa → timestamp (UTC local); vazio ou inválido → 0 (vai ao início na ordem crescente). */
function timestampDataBr(val) {
  const t = String(val ?? '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return 0;
  const d = new Date(yyyy, mm - 1, dd);
  const x = d.getTime();
  return Number.isNaN(x) ? 0 : x;
}

/** Colunas fixas ({@link COLUNAS_RELATORIO_PROCESSOS}); o menu de cada cabeçalho ainda lista todos os campos. */
const COLUNAS = COLUNAS_RELATORIO_PROCESSOS;

const COLUNA_IDS_RELATORIO = COLUNAS.map((c) => c.id);

function carregarColunasVisiveisSalvas() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_COLUNAS_RELATORIO);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

function carregarLarguraUniformeSalva() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_LARGURA_UNIFORME) === '1';
  } catch {
    return false;
  }
}

function carregarFiltroProcessoAtivoSalvo() {
  if (typeof window === 'undefined') return 'ativos';
  try {
    const raw = window.localStorage.getItem(STORAGE_FILTRO_PROCESSO_ATIVO);
    return normalizarFiltroProcessoAtivo(raw);
  } catch {
    return 'ativos';
  }
}

function linhaPassaFiltroAtivo(row, filtro) {
  const f = normalizarFiltroProcessoAtivo(filtro);
  if (f === 'todos') return true;
  const ativo = row.processoCadastroAtivo === true;
  if (f === 'ativos') return ativo;
  return !ativo;
}

function montarLinhasRelatorioBaseDeCruas(linhasCruas) {
  const rows = Array.isArray(linhasCruas) ? linhasCruas : [];
  return rows.map((row, idx) => {
    const enriched = enriquecerCamposRelatorioProcessos(
      {
        ...row,
        codCliente: row.codCliente ?? String(idx + 1).padStart(8, '0'),
        numeroProcesso: row.numeroProcesso ?? row.numeroProcessoNovo ?? '',
      },
      idx
    );
    return { ...enriched, __relatorioIdx: idx };
  });
}

function montarLinhasRelatorioBase() {
  return montarLinhasRelatorioBaseDeCruas([]);
}

/**
 * @param {boolean} preferirCamposDaBase - Se true (após «Atualizar relatório»), valores vindos da base
 *   sobrescrevem o snapshot em localStorage — senão dados novos da API nunca aparecem.
 * @param {Array|null|undefined} baseLinhas - Linhas já enriquecidas; se omitido, usa {@link montarLinhasRelatorioBase}.
 */
function mesclarLinhasRelatorioComPersistido(preferirCamposDaBase, baseLinhas) {
  const base = Array.isArray(baseLinhas) ? baseLinhas : montarLinhasRelatorioBase();
  const n = base.length;
  if (typeof window === 'undefined') return base;
  if (n > RELATORIO_MAX_LINHAS_PERSISTIDAS) return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_DADOS_RELATORIO);
    if (!raw) return base;
    const p = JSON.parse(raw);
    if (!Array.isArray(p) || p.length !== n) return base;
    return p.map((salvo, i) => {
      const b = base[i];
      if (preferirCamposDaBase) {
        return {
          ...salvo,
          ...b,
          __relatorioIdx: i,
          codCliente: b.codCliente,
          proc: b.proc,
        };
      }
      return {
        ...b,
        ...salvo,
        __relatorioIdx: i,
        codCliente: b.codCliente,
        proc: b.proc,
      };
    });
  } catch {
    return base;
  }
}

function carregarDadosRelatorioInicial() {
  return mesclarLinhasRelatorioComPersistido(false);
}

function carregarModoAlteracaoSalvo() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_MODO_ALTERACAO) === '1';
  } catch {
    return false;
  }
}

export function Relatorio() {
  const navigate = useNavigate();
  const [ordenarPor, setOrdenarPor] = useState(null);
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [painelColunasAberto, setPainelColunasAberto] = useState(false);
  const painelColunasRef = useRef(null);
  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const salvo = carregarColunasVisiveisSalvas();
    const base = Object.fromEntries(COLUNAS.map((c) => [c.id, true]));
    if (!salvo) return base;
    return { ...base, ...Object.fromEntries(COLUNAS.map((c) => [c.id, salvo[c.id] !== false])) };
  });
  const [larguraUniforme, setLarguraUniforme] = useState(() => carregarLarguraUniformeSalva());
  const [campoPorColuna, setCampoPorColuna] = useState(() => carregarCampoPorColunaSalvo(COLUNA_IDS_RELATORIO));
  const [filtroProcessoAtivo, setFiltroProcessoAtivo] = useState(() => carregarFiltroProcessoAtivoSalvo());
  const [modoAlteracao, setModoAlteracao] = useState(() => carregarModoAlteracaoSalvo());

  useEffect(() => {
    salvarCampoPorColuna(campoPorColuna, COLUNA_IDS_RELATORIO);
  }, [campoPorColuna]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_COLUNAS_RELATORIO, JSON.stringify(colunasVisiveis));
    } catch {
      /* ignore */
    }
  }, [colunasVisiveis]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_LARGURA_UNIFORME, larguraUniforme ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [larguraUniforme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_FILTRO_PROCESSO_ATIVO, normalizarFiltroProcessoAtivo(filtroProcessoAtivo));
    } catch {
      /* ignore */
    }
  }, [filtroProcessoAtivo]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_MODO_ALTERACAO, modoAlteracao ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [modoAlteracao]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!painelColunasAberto) return;
      const el = painelColunasRef.current;
      if (el && !el.contains(e.target)) setPainelColunasAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [painelColunasAberto]);

  const colunasAtivas = useMemo(() => {
    const list = COLUNAS.filter((c) => colunasVisiveis[c.id] !== false);
    return list.length > 0 ? list : COLUNAS;
  }, [colunasVisiveis]);

  const colIdsRelatorio = useMemo(() => COLUNAS.map((c) => c.id), []);

  const marcarTodasColunas = () => {
    setColunasVisiveis(Object.fromEntries(COLUNAS.map((c) => [c.id, true])));
  };

  const desmarcarTodasColunas = () => {
    const primeiro = COLUNAS[0]?.id;
    if (!primeiro) return;
    const next = Object.fromEntries(COLUNAS.map((c) => [c.id, c.id === primeiro]));
    setColunasVisiveis(next);
  };

  const alternarColuna = (id) => {
    setColunasVisiveis((prev) => {
      const visivel = prev[id] !== false;
      if (visivel) {
        const outrasVisiveis = COLUNAS.filter((c) => c.id !== id && prev[c.id] !== false);
        if (outrasVisiveis.length === 0) return prev;
        return { ...prev, [id]: false };
      }
      return { ...prev, [id]: true };
    });
  };

  const [dados, setDados] = useState(() => []);
  /** Só após o usuário clicar em «Emitir relatório» — evita montar milhares de linhas ao abrir a página. */
  const [relatorioEmitido, setRelatorioEmitido] = useState(false);
  const [emitindoRelatorio, setEmitindoRelatorio] = useState(false);
  const emitindoRelatorioRef = useRef(false);

  const emitirOuAtualizarRelatorio = useCallback(() => {
    if (emitindoRelatorioRef.current) return;
    emitindoRelatorioRef.current = true;
    setEmitindoRelatorio(true);
    void (async () => {
      let baseRaw = [];
      try {
        baseRaw = await obterLinhasBaseRelatorioProcessos();
      } catch (e) {
        console.error(e);
        baseRaw = [];
      }
      try {
        const basePairs = baseRaw.map((r) => [r.codCliente, r.proc]);
        await preaquecerCamposRelatorioApiFirst(basePairs);
      } catch {
        /* mock/local cobre */
      }
      try {
        const baseEnriched = montarLinhasRelatorioBaseDeCruas(baseRaw);
        const next = mesclarLinhasRelatorioComPersistido(relatorioEmitido, baseEnriched);
        setDados(next);
        setRelatorioEmitido(true);
      } finally {
        emitindoRelatorioRef.current = false;
        setEmitindoRelatorio(false);
      }
    })();
  }, [relatorioEmitido]);

  useEffect(() => {
    if (!relatorioEmitido) return;
    if (dados.length > RELATORIO_MAX_LINHAS_PERSISTIDAS) return;
    try {
      window.localStorage.setItem(STORAGE_DADOS_RELATORIO, JSON.stringify(dados));
    } catch {
      /* ignore */
    }
  }, [dados, relatorioEmitido]);

  useEffect(() => {
    if (!relatorioEmitido) return undefined;
    const h = () => setDados(carregarDadosRelatorioInicial());
    window.addEventListener(EVENT_RELATORIO_PERSISTENCIA_EXTERNA, h);
    return () => window.removeEventListener(EVENT_RELATORIO_PERSISTENCIA_EXTERNA, h);
  }, [relatorioEmitido]);

  const atualizarCelulaRelatorio = (relIdx, chaveCampo, valor) => {
    setDados((prev) => {
      const next = [...prev];
      const i = next.findIndex((r) => r.__relatorioIdx === relIdx);
      if (i < 0) return prev;
      next[i] = { ...next[i], [chaveCampo]: valor };
      return next;
    });
  };
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(() =>
    COLUNAS.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {})
  );

  const dadosFiltrados = useMemo(() => {
    return dados.filter((row) => {
      if (!linhaPassaFiltroAtivo(row, filtroProcessoAtivo)) return false;
      return COLUNAS.every((col) => {
        const filtro = String(filtrosPorColuna[col.id] ?? '').trim().toLowerCase();
        if (!filtro) return true;
        const chave = campoPorColuna[col.id] ?? col.id;
        const valor = String(row[chave] ?? '').toLowerCase();
        return valor.includes(filtro);
      });
    });
  }, [dados, filtrosPorColuna, campoPorColuna, filtroProcessoAtivo]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      const chaveOrdenacao = campoPorColuna[ordenarPor] ?? ordenarPor;

      if (COLUNAS_DATA_BR.has(chaveOrdenacao)) {
        const ta = timestampDataBr(a[chaveOrdenacao]);
        const tb = timestampDataBr(b[chaveOrdenacao]);
        const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      const va = a[chaveOrdenacao] ?? '';
      const vb = b[chaveOrdenacao] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc, campoPorColuna]);

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((a) => !a);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-200 overscroll-y-contain">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Relatório de Processos</h1>
            {!relatorioEmitido ? (
              <p className="mt-1 max-w-xl text-xs text-slate-600">
                Para não travar o navegador, as linhas só são montadas depois que você emitir o relatório.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                {dados.length === 0 ? (
                  'Nenhum processo carregado.'
                ) : dadosFiltrados.length === dados.length ? (
                  <>
                    <span className="font-semibold text-slate-800 tabular-nums">{dadosFiltrados.length}</span>
                    {dadosFiltrados.length === 1 ? ' processo' : ' processos'}
                  </>
                ) : (
                  <>
                    Exibindo{' '}
                    <span className="font-semibold text-slate-800 tabular-nums">{dadosFiltrados.length}</span>
                    {' de '}
                    <span className="tabular-nums">{dados.length}</span>
                    {' processos'}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={emitirOuAtualizarRelatorio}
            disabled={emitindoRelatorio}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-700 bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-60 disabled:pointer-events-none shadow-sm"
            title={
              relatorioEmitido
                ? 'Recarrega processos (API/mock); células editadas no relatório só permanecem em campos que não vêm da base atualizada'
                : 'Monta a tabela com todos os processos (pode levar alguns segundos)'
            }
          >
            {emitindoRelatorio ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
            )}
            {relatorioEmitido ? 'Atualizar relatório' : 'Emitir relatório'}
          </button>
          <RelatorioPresetsPanel
            colIds={colIdsRelatorio}
            colunasVisiveis={colunasVisiveis}
            setColunasVisiveis={setColunasVisiveis}
            larguraUniforme={larguraUniforme}
            setLarguraUniforme={setLarguraUniforme}
            campoPorColuna={campoPorColuna}
            setCampoPorColuna={setCampoPorColuna}
            filtroProcessoAtivo={filtroProcessoAtivo}
            setFiltroProcessoAtivo={setFiltroProcessoAtivo}
            modoAlteracao={modoAlteracao}
            setModoAlteracao={setModoAlteracao}
          />
          <div className="relative" ref={painelColunasRef}>
            <button
              type="button"
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-600 bg-white text-teal-800 text-sm font-medium hover:bg-teal-50 shadow-sm"
              title="Escolher quais colunas exibir e largura"
            >
              <Columns3 className="w-4 h-4 shrink-0" aria-hidden />
              Colunas
            </button>
            {painelColunasAberto ? (
              <div className="absolute right-0 top-full mt-1 z-20 w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-sm">
                <p className="text-xs text-slate-600 mb-2">
                  Marque as colunas que deseja ver na tabela. Use <strong>Marcar todas</strong> para exibir todas.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={marcarTodasColunas}
                    className="px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs hover:bg-slate-100"
                  >
                    Marcar todas
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarTodasColunas}
                    className="px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs hover:bg-slate-100"
                    title="Mantém só a primeira coluna (Cod. Cliente)"
                  >
                    Só primeira coluna
                  </button>
                </div>
                <label className="flex items-center gap-2 mb-2 cursor-pointer border-b border-slate-100 pb-2">
                  <input
                    type="checkbox"
                    checked={larguraUniforme}
                    onChange={(e) => setLarguraUniforme(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-800">Mesma largura em todas as colunas visíveis</span>
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {COLUNAS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={colunasVisiveis[col.id] !== false}
                        onChange={() => alternarColuna(col.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
          {emitindoRelatorio && !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-slate-600">
              <Loader2 className="w-10 h-10 text-teal-700 animate-spin" aria-hidden />
              <p className="text-sm font-medium text-slate-800">Gerando relatório…</p>
              <p className="text-xs text-slate-500 text-center max-w-sm">Aguarde enquanto as linhas são montadas.</p>
            </div>
          ) : !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
              <FileSpreadsheet className="w-14 h-14 text-slate-300" aria-hidden />
              <div className="max-w-md space-y-2">
                <p className="text-slate-800 font-medium">Relatório de Processos ainda não foi emitido</p>
                <p className="text-sm text-slate-600">
                  Use o botão <strong className="text-slate-800">Emitir relatório</strong> acima para carregar a grade. Isso evita que a página congele ao entrar no menu.
                </p>
              </div>
              <button
                type="button"
                onClick={emitirOuAtualizarRelatorio}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-teal-700 bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
                Emitir relatório
              </button>
            </div>
          ) : (
          <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
            {emitindoRelatorio ? (
              <div className="absolute inset-0 z-20 bg-white/70 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                <Loader2 className="w-5 h-5 animate-spin text-teal-700" aria-hidden />
                Atualizando…
              </div>
            ) : null}
            <table
              className={`w-full text-sm border-collapse ${larguraUniforme ? 'table-fixed' : ''}`}
              style={{ minWidth: larguraUniforme ? '100%' : 'max-content' }}
            >
              <thead className="sticky top-0 z-10">
                <tr className="bg-teal-700 text-white">
                  {colunasAtivas.map((col) => (
                    <RelatorioUltimoAndamentoHeader
                      key={col.id}
                      menuInstanceId={col.id}
                      minWStyle={{ minWidth: col.minW }}
                      larguraUniforme={larguraUniforme}
                      colunasAtivasLength={colunasAtivas.length}
                      options={CAMPOS_OPCOES_ULTIMO_ANDAMENTO}
                      selectedFieldKey={campoPorColuna[col.id] ?? col.id}
                      onSelectField={(fieldKey) =>
                        setCampoPorColuna((prev) => ({ ...prev, [col.id]: fieldKey }))
                      }
                      onSort={() => toggleOrdenacao(col.id)}
                      ordenarAtivo={ordenarPor === col.id}
                      ordemAsc={ordemAsc}
                      modoAlteracao={modoAlteracao}
                    />
                  ))}
                </tr>
                <tr className="bg-slate-100">
                  {colunasAtivas.map((col) => (
                    <th
                      key={`${col.id}-filtro`}
                      className="px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0"
                      style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                    >
                      <input
                        type="text"
                        value={filtrosPorColuna[col.id] ?? ''}
                        onChange={(e) =>
                          setFiltrosPorColuna((prev) => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                        placeholder="Filtrar..."
                        className={`w-full px-2 py-1 border rounded text-xs bg-white ${
                          modoAlteracao
                            ? 'border-red-200 text-red-700 placeholder:text-red-300'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={colunasAtivas.length} className="px-3 py-6 text-center text-slate-500">
                      Nenhum resultado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados.map((row, idx) => (
                    <tr
                      key={row.__relatorioIdx ?? idx}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${
                        modoAlteracao ? 'cursor-default' : 'cursor-pointer'
                      }`}
                      title={
                        modoAlteracao
                          ? 'Modo alteração: edite as células (texto em vermelho). Cod. Cliente e Proc. são fixos.'
                          : 'Duplo clique: abrir processo'
                      }
                      onDoubleClick={() => {
                        if (modoAlteracao) return;
                        navigate('/processos', {
                          state: buildRouterStateChaveClienteProcesso(row.codCliente ?? '', row.proc ?? ''),
                        });
                      }}
                    >
                      {colunasAtivas.map((col) => {
                        const chaveValor = campoPorColuna[col.id] ?? col.id;
                        const textoCelula = row[chaveValor] ?? '';
                        const valorStr = String(textoCelula);
                        const soLeitura = COLUNAS_RELATORIO_SO_LEITURA.has(col.id) || !modoAlteracao;
                        const labelAcessivel =
                          CAMPOS_OPCOES_ULTIMO_ANDAMENTO.find((o) => o.fieldKey === chaveValor)?.label ?? col.label;

                        if (!modoAlteracao) {
                          return (
                            <td
                              key={col.id}
                              className={`px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-800 ${
                                col.id === 'codCliente' ? 'tabular-nums' : ''
                              } ${larguraUniforme ? 'truncate max-w-0' : ''}`}
                              style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                              title={larguraUniforme ? valorStr : undefined}
                            >
                              {valorStr}
                            </td>
                          );
                        }

                        if (soLeitura) {
                          return (
                            <td
                              key={col.id}
                              className={`px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-red-600 font-semibold tabular-nums ${
                                col.id === 'codCliente' ? '' : ''
                              } ${larguraUniforme ? 'truncate max-w-0' : ''}`}
                              style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                              title={larguraUniforme ? valorStr : undefined}
                            >
                              {valorStr}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col.id}
                            className={`p-0 border-r border-slate-200 last:border-r-0 align-stretch ${larguraUniforme ? 'max-w-0' : ''}`}
                            style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                          >
                            <input
                              type="text"
                              value={valorStr}
                              onChange={(e) =>
                                atualizarCelulaRelatorio(row.__relatorioIdx, chaveValor, e.target.value)
                              }
                              className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-red-600 outline-none border-0 focus:ring-2 focus:ring-inset focus:ring-red-200"
                              aria-label={`${labelAcessivel} — linha ${(row.__relatorioIdx ?? idx) + 1}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
