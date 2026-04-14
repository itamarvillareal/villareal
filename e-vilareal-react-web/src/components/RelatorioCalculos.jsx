import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterX, ArrowDownAZ, ArrowUpAZ, Calculator, FileSpreadsheet, Loader2, ChevronDown } from 'lucide-react';
import {
  carregarLinhasRelatorioCalculosAsync,
  getLinhasRelatorioCalculosConsolidadoComFiltros,
  formatBRL,
  formatCodigoRelatorioCalculos,
  formatMoedaRelatorioCalculos,
  montarFiltroEmitirRelatorioCalculosFromUi,
  parseBRL,
  validarFiltroEmitirRelatorioCalculos,
} from '../data/relatorioCalculosData.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

/**
 * Grade alinhada à planilha de referência: 11 colunas, cabeçalho cinza, linhas zebradas.
 */
const COLUNAS = [
  { id: 'codigo', label: 'Cód.', minW: '72px', align: 'right' },
  { id: 'reu', label: 'Réu', minW: '220px', align: 'left' },
  { id: 'unidade', label: 'Unidade', minW: '120px', align: 'left' },
  { id: 'dataVencimento', label: 'Data de Vencimento', minW: '118px', align: 'center' },
  { id: 'dataPagamento', label: 'Data de Pagamento', minW: '118px', align: 'center' },
  { id: 'valor', label: 'Valor', minW: '128px', align: 'right' },
  { id: 'valorHonorarios', label: 'Valor Honorários', minW: '128px', align: 'right' },
  { id: 'obs', label: 'Obs', minW: '100px', align: 'left' },
  { id: 'parcela', label: 'Parcela', minW: '72px', align: 'center' },
  { id: 'proc', label: 'Proc.', minW: '56px', align: 'center' },
  { id: 'calculoAceito', label: 'Cálculo Aceito', minW: '120px', align: 'center' },
];

const COLUNAS_ORDENACAO_NUMERICA = new Set(['codigo', 'proc', 'parcela']);

function textoCelulaRelatorio(col, row) {
  switch (col.id) {
    case 'codigo':
      return formatCodigoRelatorioCalculos(row.codigo ?? row.codCliente);
    case 'valor':
    case 'valorHonorarios':
      return formatMoedaRelatorioCalculos(row[col.id]);
    default:
      return String(row[col.id] ?? '');
  }
}

function estadoFiltrosVazio() {
  return Object.fromEntries(COLUNAS.map((c) => [c.id, '']));
}

const CRITERIOS_EMITIR_INICIAL = {
  escopoCliente: 'todos',
  textoCodigosCliente: '',
  textoProcessos: '',
  parcelamentoAceito: 'todos',
};

export function RelatorioCalculos() {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState(() => []);
  const [relatorioEmitido, setRelatorioEmitido] = useState(false);
  const [emitindoRelatorio, setEmitindoRelatorio] = useState(false);
  const emitindoRelatorioRef = useRef(false);
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(estadoFiltrosVazio);
  const [ordenarPor, setOrdenarPor] = useState(null);
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [cargaRodadasProgresso, setCargaRodadasProgresso] = useState(null);
  const [criteriosEmitir, setCriteriosEmitir] = useState(() => ({ ...CRITERIOS_EMITIR_INICIAL }));

  const filtrosEmitirResolvidos = useMemo(
    () => montarFiltroEmitirRelatorioCalculosFromUi(criteriosEmitir),
    [criteriosEmitir]
  );

  const recarregar = useCallback(async () => {
    if (featureFlags.useApiCalculos) {
      setEmitindoRelatorio(true);
      setCargaRodadasProgresso({ done: 0, total: 0 });
      try {
        const linhasFinais = await carregarLinhasRelatorioCalculosAsync({
          filtrosEmitir: filtrosEmitirResolvidos,
          onProgress: ({ done, total, linhas }) => {
            setCargaRodadasProgresso({ done, total });
            setLinhas(linhas);
          },
        });
        setLinhas(linhasFinais);
      } catch (e) {
        if (e?.name !== 'AbortError') console.error(e);
      } finally {
        setCargaRodadasProgresso(null);
        setEmitindoRelatorio(false);
      }
      return;
    }
    setLinhas(getLinhasRelatorioCalculosConsolidadoComFiltros(filtrosEmitirResolvidos));
  }, [filtrosEmitirResolvidos]);

  const emitirOuAtualizarRelatorio = useCallback(async () => {
    if (emitindoRelatorioRef.current) return;
    const v = validarFiltroEmitirRelatorioCalculos(filtrosEmitirResolvidos);
    if (!v.ok) {
      window.alert(v.erro ?? 'Ajuste os critérios do relatório.');
      return;
    }
    emitindoRelatorioRef.current = true;
    setEmitindoRelatorio(true);
    try {
      if (featureFlags.useApiCalculos) {
        setCargaRodadasProgresso({ done: 0, total: 0 });
        const linhasFinais = await carregarLinhasRelatorioCalculosAsync({
          filtrosEmitir: filtrosEmitirResolvidos,
          onProgress: ({ done, total, linhas }) => {
            setCargaRodadasProgresso({ done, total });
            setLinhas(linhas);
          },
        });
        setLinhas(linhasFinais);
        setCargaRodadasProgresso(null);
      } else {
        setLinhas(getLinhasRelatorioCalculosConsolidadoComFiltros(filtrosEmitirResolvidos));
      }
      setRelatorioEmitido(true);
    } catch (e) {
      if (e?.name !== 'AbortError') console.error(e);
      setCargaRodadasProgresso(null);
    } finally {
      emitindoRelatorioRef.current = false;
      setEmitindoRelatorio(false);
    }
  }, [filtrosEmitirResolvidos]);

  useEffect(() => {
    if (!relatorioEmitido) return;
    const h = () => recarregar();
    window.addEventListener('vilareal:calculos-rodadas-atualizadas', h);
    window.addEventListener('vilareal:cliente-config-calculo-atualizado', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('vilareal:calculos-rodadas-atualizadas', h);
      window.removeEventListener('vilareal:cliente-config-calculo-atualizado', h);
      window.removeEventListener('storage', h);
    };
  }, [relatorioEmitido, recarregar]);

  const limparFiltros = () => {
    setFiltrosPorColuna(estadoFiltrosVazio());
    setOrdenarPor(null);
    setOrdemAsc(true);
  };

  const redefinirCriteriosEmitir = () => {
    setCriteriosEmitir({ ...CRITERIOS_EMITIR_INICIAL });
  };

  const dadosFiltrados = useMemo(() => {
    return linhas.filter((row) =>
      COLUNAS.every((col) => {
        const filtro = String(filtrosPorColuna[col.id] ?? '').trim().toLowerCase();
        if (!filtro) return true;
        const exibicao = textoCelulaRelatorio(col, row).toLowerCase();
        return exibicao.includes(filtro);
      })
    );
  }, [linhas, filtrosPorColuna]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      if (COLUNAS_ORDENACAO_NUMERICA.has(ordenarPor)) {
        let na;
        let nb;
        if (ordenarPor === 'codigo') {
          na = Number(String(a.codigo ?? a.codCliente ?? '').replace(/\D/g, '')) || 0;
          nb = Number(String(b.codigo ?? b.codCliente ?? '').replace(/\D/g, '')) || 0;
        } else if (ordenarPor === 'parcela') {
          na = Number(a.indiceParcela) || 0;
          nb = Number(b.indiceParcela) || 0;
        } else {
          na = Number(String(a[ordenarPor] ?? '').replace(/\D/g, '')) || 0;
          nb = Number(String(b[ordenarPor] ?? '').replace(/\D/g, '')) || 0;
        }
        const cmp = na === nb ? 0 : na < nb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      const va = textoCelulaRelatorio(COLUNAS.find((c) => c.id === ordenarPor) ?? { id: ordenarPor }, a);
      const vb = textoCelulaRelatorio(COLUNAS.find((c) => c.id === ordenarPor) ?? { id: ordenarPor }, b);
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc]);

  /** Soma das linhas visíveis após filtros por coluna (independente da ordenação). */
  const totaisFiltrados = useMemo(() => {
    let somaValor = 0;
    let somaHonorarios = 0;
    for (const row of dadosFiltrados) {
      somaValor += parseBRL(String(row.valor ?? ''));
      somaHonorarios += parseBRL(String(row.valorHonorarios ?? ''));
    }
    return {
      qtd: dadosFiltrados.length,
      somaValor,
      somaHonorarios,
    };
  }, [dadosFiltrados]);

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((v) => !v);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  const alignClass = (align) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right tabular-nums';
    return 'text-left';
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] flex flex-col">
      <div className="flex-1 min-h-0 p-4 flex flex-col max-w-[1800px] mx-auto w-full">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Calculator className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent">
              Relatório de Cálculos
            </h1>
            <p className="text-sm text-slate-600 mt-0.5 max-w-3xl">
              Uma linha por parcela do parcelamento (como na planilha): código, réu, unidade, datas de vencimento e pagamento,
              valores, honorários, observação, parcela, processo e indicação de cálculo aceito. Duplo clique na linha abre a
              rodada em Cálculos.
            </p>
            {!relatorioEmitido ? (
              <p className="text-xs text-slate-600 mt-1.5 max-w-xl">
                Para não travar o navegador, as linhas só são montadas depois que você emitir o relatório. Defina abaixo o
                escopo (todos, um ou vários clientes, processos opcionais e filtro por «Aceitar pagamento») antes de emitir.
              </p>
            ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={emitirOuAtualizarRelatorio}
              disabled={emitindoRelatorio}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
              title={
                relatorioEmitido
                  ? 'Recarrega o consolidado a partir das rodadas de Cálculos e do armazenamento'
                  : 'Monta a tabela com todas as parcelas (pode levar alguns segundos)'
              }
            >
              {emitindoRelatorio ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
              )}
              {relatorioEmitido ? 'Atualizar relatório' : 'Emitir relatório'}
            </button>
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm"
              title="Zera filtros e ordenação"
            >
              <FilterX className="w-4 h-4 shrink-0" aria-hidden />
              Limpar filtros
            </button>
          </div>
        </header>

        <section
          className="mb-3 rounded-2xl border border-indigo-200/80 bg-white/90 dark:bg-slate-900/40 dark:border-indigo-900/50 p-4 shadow-sm"
          aria-label="Critérios do relatório"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Critérios antes de emitir</h2>
            <button
              type="button"
              onClick={redefinirCriteriosEmitir}
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 underline-offset-2 hover:underline"
            >
              Redefinir critérios
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Clientes</legend>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="escopoClienteRel"
                  checked={criteriosEmitir.escopoCliente === 'todos'}
                  onChange={() => setCriteriosEmitir((p) => ({ ...p, escopoCliente: 'todos' }))}
                  className="text-indigo-600"
                />
                Todos os clientes
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="escopoClienteRel"
                  checked={criteriosEmitir.escopoCliente === 'um'}
                  onChange={() => setCriteriosEmitir((p) => ({ ...p, escopoCliente: 'um' }))}
                  className="text-indigo-600"
                />
                Um cliente apenas
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="escopoClienteRel"
                  checked={criteriosEmitir.escopoCliente === 'varios'}
                  onChange={() => setCriteriosEmitir((p) => ({ ...p, escopoCliente: 'varios' }))}
                  className="text-indigo-600"
                />
                Vários clientes
              </label>
            </fieldset>
            <div className="min-w-0 md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {criteriosEmitir.escopoCliente === 'um' ? 'Código do cliente' : 'Códigos de cliente (vários)'}
              </label>
              {criteriosEmitir.escopoCliente === 'varios' ? (
                <textarea
                  value={criteriosEmitir.textoCodigosCliente}
                  onChange={(e) => setCriteriosEmitir((p) => ({ ...p, textoCodigosCliente: e.target.value }))}
                  rows={4}
                  disabled={criteriosEmitir.escopoCliente === 'todos'}
                  placeholder="Um por linha ou separados por vírgula (ex.: 1, 12, 12345678)"
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white disabled:opacity-50 dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100"
                />
              ) : (
                <input
                  type="text"
                  value={criteriosEmitir.textoCodigosCliente}
                  onChange={(e) => setCriteriosEmitir((p) => ({ ...p, textoCodigosCliente: e.target.value }))}
                  disabled={criteriosEmitir.escopoCliente === 'todos'}
                  placeholder={criteriosEmitir.escopoCliente === 'um' ? 'Ex.: 12345678 ou 1' : '—'}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white disabled:opacity-50 dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100"
                />
              )}
              {criteriosEmitir.escopoCliente === 'todos' ? (
                <p className="text-[11px] text-slate-500 mt-1">Não aplicável quando o escopo é «todos».</p>
              ) : null}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Números de processo (opcional)
                </label>
                <input
                  type="text"
                  value={criteriosEmitir.textoProcessos}
                  onChange={(e) => setCriteriosEmitir((p) => ({ ...p, textoProcessos: e.target.value }))}
                  placeholder="Vazio = todos. Ex.: 1, 2, 5"
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="filtroAceitarPagRel" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Aceitar pagamento (no Cálculos)
                </label>
                <select
                  id="filtroAceitarPagRel"
                  value={criteriosEmitir.parcelamentoAceito}
                  onChange={(e) =>
                    setCriteriosEmitir((p) => ({ ...p, parcelamentoAceito: e.target.value }))
                  }
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white dark:bg-slate-950 dark:border-slate-600 dark:text-slate-100"
                >
                  <option value="todos">Todos (com e sem marcação)</option>
                  <option value="sim">Somente com «Aceitar pagamento» marcado</option>
                  <option value="nao">Somente sem marcação</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mesmo sinal da coluna «Cálculo aceito» na grade (parcelamento travado no Cálculos).
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 overflow-hidden flex flex-col">
          {emitindoRelatorio && !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-slate-600">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" aria-hidden />
              <p className="text-sm font-medium text-slate-800">Gerando relatório…</p>
              <p className="text-xs text-slate-500 text-center max-w-sm">Aguarde enquanto as parcelas são consolidadas.</p>
              {featureFlags.useApiCalculos && cargaRodadasProgresso?.total > 0 ? (
                <p className="text-xs text-indigo-700 tabular-nums font-medium">
                  Rodadas carregadas: {cargaRodadasProgresso.done} / {cargaRodadasProgresso.total}
                </p>
              ) : null}
            </div>
          ) : !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
              <FileSpreadsheet className="w-14 h-14 text-slate-300" aria-hidden />
              <div className="max-w-md space-y-2">
                <p className="text-slate-800 font-medium">Relatório ainda não foi emitido</p>
                <p className="text-sm text-slate-600">
                  Use o botão <strong className="text-slate-800">Emitir relatório</strong> acima para carregar a grade no formato
                  da planilha.
                </p>
              </div>
              <button
                type="button"
                onClick={emitirOuAtualizarRelatorio}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
                Emitir relatório
              </button>
            </div>
          ) : (
            <div className="overflow-auto flex-1 relative">
              {emitindoRelatorio ? (
                <div className="absolute inset-0 z-20 bg-white/70 flex flex-col items-center justify-center gap-2 text-sm font-medium text-slate-700 px-4">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" aria-hidden />
                  <span>Atualizando…</span>
                  {featureFlags.useApiCalculos && cargaRodadasProgresso?.total > 0 ? (
                    <span className="text-xs text-indigo-800 tabular-nums">
                      {cargaRodadasProgresso.done} / {cargaRodadasProgresso.total} rodadas
                    </span>
                  ) : null}
                </div>
              ) : null}
              <table className="w-full text-sm border-collapse bg-white" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-md">
                    {COLUNAS.map((col) => (
                      <th
                        key={col.id}
                        className={`px-2 py-2 font-semibold border-b border-r border-white/20 last:border-r-0 ${alignClass(col.align)}`}
                        style={{ minWidth: col.minW }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOrdenacao(col.id)}
                          className={`inline-flex items-center justify-center gap-1 w-full hover:bg-white/15 rounded px-1 py-0.5 ${alignClass(col.align)}`}
                        >
                          <span className="select-none">{col.label}</span>
                          <span className="inline-flex items-center gap-0.5 shrink-0 opacity-90">
                            {ordenarPor === col.id ? (
                              ordemAsc ? (
                                <ArrowDownAZ className="w-3.5 h-3.5" aria-hidden />
                              ) : (
                                <ArrowUpAZ className="w-3.5 h-3.5" aria-hidden />
                              )
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                            )}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-200">
                    {COLUNAS.map((col) => (
                      <th
                        key={`${col.id}-f`}
                        className={`px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0 ${alignClass(col.align)}`}
                      >
                        <input
                          type="text"
                          value={filtrosPorColuna[col.id] ?? ''}
                          onChange={(e) =>
                            setFiltrosPorColuna((prev) => ({ ...prev, [col.id]: e.target.value }))
                          }
                          placeholder="Filtrar..."
                          className="w-full px-2 py-1 border border-slate-400 rounded text-xs bg-white text-slate-800 shadow-sm"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dadosOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-slate-500 border-b border-slate-300">
                        {linhas.length === 0
                          ? 'Nenhuma parcela encontrada (sem quantidade de parcelas ou linhas preenchidas nas rodadas de Cálculos).'
                          : 'Nenhuma linha corresponde aos filtros.'}
                      </td>
                    </tr>
                  ) : (
                    dadosOrdenados.map((row, idx) => (
                      <tr
                        key={`${row.rodadaKey}|${row.indiceParcela}`}
                        className={`border-b border-slate-300 cursor-pointer hover:brightness-[0.98] ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'
                        }`}
                        title="Duplo clique: abrir em Cálculos"
                        onDoubleClick={() =>
                          navigate('/calculos', {
                            replace: false,
                            state: {
                              dimensao: row.navigateDimensao ?? row.dimensao,
                              ...buildRouterStateChaveClienteProcesso(
                                row.navigateCodCliente ?? row.codCliente,
                                row.navigateProc ?? row.proc
                              ),
                            },
                          })
                        }
                      >
                        {COLUNAS.map((col) => (
                          <td
                            key={col.id}
                            className={`px-2 py-1.5 border-r border-slate-300 last:border-r-0 text-slate-900 ${alignClass(col.align)}`}
                            style={{ minWidth: col.minW }}
                          >
                            {textoCelulaRelatorio(col, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr
                    className="bg-indigo-50/90 dark:bg-slate-800/90 border-t-2 border-indigo-400/80 dark:border-indigo-600/80 font-semibold text-slate-900 dark:text-slate-100 shadow-[0_-1px_0_0_rgba(99,102,241,0.15)]"
                    aria-label="Totais do resultado filtrado"
                  >
                    <td
                      colSpan={2}
                      className="px-2 py-2 border-r border-slate-300 text-left"
                      style={{ minWidth: '292px' }}
                    >
                      Total
                      {totaisFiltrados.qtd > 0 ? (
                        <span className="ml-1.5 font-normal text-slate-600 dark:text-slate-400 tabular-nums">
                          ({totaisFiltrados.qtd} {totaisFiltrados.qtd === 1 ? 'parcela' : 'parcelas'})
                        </span>
                      ) : null}
                    </td>
                    <td
                      colSpan={3}
                      className="px-2 py-2 border-r border-slate-300"
                      style={{ minWidth: '356px' }}
                    />
                    <td
                      className="px-2 py-2 border-r border-slate-300 text-right tabular-nums"
                      style={{ minWidth: COLUNAS.find((c) => c.id === 'valor')?.minW }}
                    >
                      {formatBRL(totaisFiltrados.somaValor)}
                    </td>
                    <td
                      className="px-2 py-2 border-r border-slate-300 text-right tabular-nums"
                      style={{ minWidth: COLUNAS.find((c) => c.id === 'valorHonorarios')?.minW }}
                    >
                      {formatBRL(totaisFiltrados.somaHonorarios)}
                    </td>
                    <td colSpan={4} className="px-2 py-2 border-r border-slate-300 last:border-r-0" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
