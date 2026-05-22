import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Undo2,
} from 'lucide-react';
import { formatBRL } from '../data/relatorioCalculosData.js';
import { buscarLancamentosNaoVinculados } from '../repositories/financeiroRepository.js';
import { listarImoveisApi } from '../repositories/imoveisRepository.js';
import {
  buscarSugestoesConciliacao,
  desvincularConciliacao,
  listarPagamentos,
  vincularConciliacao,
} from '../repositories/pagamentosRepository.js';
import {
  badgeCategoriaClass,
  CATEGORIAS_PAGAMENTO,
  isoAddDays,
} from './pagamentos/pagamentosUiUtils.js';

const STATUS_PENDENTES = new Set([
  'AGENDADO',
  'PAGO_CONFIRMADO',
  'PAGO_SEM_COMPROVANTE',
  'CONFERENCIA_PENDENTE',
]);

function primeiroDiaMesIso(ref = new Date()) {
  const y = ref.getFullYear();
  const mo = String(ref.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}-01`;
}

function ultimoDiaMesIso(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mo = String(m + 1).padStart(2, '0');
  return `${y}-${mo}-${String(last).padStart(2, '0')}`;
}

function fmtData(iso) {
  if (iso == null || iso === '') return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function truncar(txt, max = 48) {
  const t = String(txt || '').trim();
  if (t.length <= max) return t || '—';
  return `${t.slice(0, max)}…`;
}

function rotuloImovel(p, mapa) {
  if (p.imovelId != null && mapa.has(Number(p.imovelId))) {
    return mapa.get(Number(p.imovelId));
  }
  if (p.imovelNumeroPlanilha != null) return `#${p.imovelNumeroPlanilha}`;
  if (p.condominioTexto) return truncar(p.condominioTexto, 24);
  return '—';
}

function textoDiferencaValor(diff) {
  const d = Number(diff);
  if (!Number.isFinite(d)) return null;
  const abs = Math.abs(d);
  if (abs < 1) return { texto: 'Valores compatíveis', cls: 'text-emerald-700 dark:text-emerald-300' };
  if (abs < 10) {
    return { texto: `Diferença: ${formatBRL(d)}`, cls: 'text-amber-700 dark:text-amber-200' };
  }
  return { texto: `Atenção: diferença de ${formatBRL(d)}`, cls: 'text-red-700 dark:text-red-300 font-semibold' };
}

function filtrosDefault() {
  return {
    periodoInicio: primeiroDiaMesIso(),
    periodoFim: ultimoDiaMesIso(),
    numeroBanco: '',
    imovelId: '',
    categoria: '',
  };
}

export function ConciliacaoBancaria() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState(filtrosDefault);
  const [imoveis, setImoveis] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [sugestoesRaw, setSugestoesRaw] = useState([]);
  const [ultimosConciliados, setUltimosConciliados] = useState([]);
  const [selPagamento, setSelPagamento] = useState(null);
  const [selLancamento, setSelLancamento] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [erro, setErro] = useState('');
  const [mensagemOk, setMensagemOk] = useState('');
  const [ultimosAberto, setUltimosAberto] = useState(false);
  const lancamentoRefs = useRef({});

  useEffect(() => {
    let cancel = false;
    listarImoveisApi()
      .then((lista) => {
        if (!cancel) setImoveis(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!cancel) setImoveis([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!mensagemOk) return undefined;
    const t = setTimeout(() => setMensagemOk(''), 5000);
    return () => clearTimeout(t);
  }, [mensagemOk]);

  const mapaImoveis = useMemo(() => {
    const m = new Map();
    for (const im of imoveis) {
      const id = im.id ?? im._apiImovelId;
      if (id == null) continue;
      const label =
        im.numeroPlanilha != null
          ? `#${im.numeroPlanilha}${im.condominio ? ` ${String(im.condominio).slice(0, 20)}` : ''}`
          : truncar(im.condominio || im.endereco || im.descricao, 28);
      m.set(Number(id), label);
    }
    return m;
  }, [imoveis]);

  const mapaSugestoes = useMemo(() => {
    const m = new Map();
    for (const bloco of sugestoesRaw) {
      const pid = bloco?.pagamento?.id;
      const lista = bloco?.sugestoes ?? [];
      const melhor = lista.find((s) => Number(s?.score) > 0);
      if (pid != null && melhor) {
        m.set(Number(pid), melhor);
      }
    }
    return m;
  }, [sugestoesRaw]);

  const paresSugestao = useMemo(() => {
    const pares = [];
    for (const [pagamentoId, sug] of mapaSugestoes.entries()) {
      const lid = sug?.lancamento?.id;
      if (lid != null) pares.push({ pagamentoId, financeiroLancamentoId: Number(lid), score: sug.score });
    }
    return pares;
  }, [mapaSugestoes]);

  const bancosOpcoes = useMemo(() => {
    const seen = new Map();
    for (const l of lancamentos) {
      const nb = l.numeroBanco;
      const nome = l.bancoNome || `Banco ${nb ?? '?'}`;
      const key = nb != null ? String(nb) : nome;
      if (!seen.has(key)) seen.set(key, { numeroBanco: nb, label: nb != null ? `${nome} (${nb})` : nome });
    }
    return [...seen.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [lancamentos]);

  const totaisResumo = useMemo(() => {
    const soma = (arr, campo) => arr.reduce((s, x) => s + Number(x?.[campo] ?? 0), 0);
    return {
      pagamentos: { count: pagamentos.length, valor: soma(pagamentos, 'valor') },
      lancamentos: { count: lancamentos.length, valor: soma(lancamentos, 'valor') },
      sugestoes: paresSugestao.length,
    };
  }, [pagamentos, lancamentos, paresSugestao]);

  const carregarUltimosConciliados = useCallback(async () => {
    const lista = await listarPagamentos({ conciliado: true, somenteNaoConciliado: false });
    const arr = Array.isArray(lista) ? lista : [];
    arr.sort((a, b) => String(b.dataConferencia || '').localeCompare(String(a.dataConferencia || '')));
    setUltimosConciliados(arr.slice(0, 10));
  }, []);

  const buscar = useCallback(async (filtrosOverride) => {
    setCarregando(true);
    setErro('');
    setSelPagamento(null);
    setSelLancamento(null);
    try {
      const f = filtrosOverride ?? filtros;
      const { periodoInicio, periodoFim, numeroBanco, imovelId, categoria } = f;
      const fimLanc = isoAddDays(periodoFim, 5);
      const qPag = {
        conciliado: false,
        somenteNaoConciliado: true,
        vencimentoDe: periodoInicio,
        vencimentoAte: periodoFim,
      };
      if (imovelId) qPag.imovelId = Number(imovelId);
      if (categoria) qPag.categoria = categoria;

      const qLanc = { periodoInicio, periodoFim: fimLanc };
      if (numeroBanco !== '') qLanc.numeroBanco = numeroBanco;

      const qSug = { periodoInicio, periodoFim };
      if (numeroBanco !== '') qSug.numeroBanco = String(numeroBanco);

      const [pagRaw, lancRaw, sugRaw] = await Promise.all([
        listarPagamentos(qPag),
        buscarLancamentosNaoVinculados(qLanc),
        buscarSugestoesConciliacao(qSug),
      ]);

      const pagFiltrado = (Array.isArray(pagRaw) ? pagRaw : []).filter((p) => STATUS_PENDENTES.has(p.status));
      pagFiltrado.sort((a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento)));
      setPagamentos(pagFiltrado);
      setLancamentos(Array.isArray(lancRaw) ? lancRaw : []);
      setSugestoesRaw(Array.isArray(sugRaw) ? sugRaw : []);
      await carregarUltimosConciliados();
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar dados de conciliação.');
    } finally {
      setCarregando(false);
    }
  }, [filtros, carregarUltimosConciliados]);

  useEffect(() => {
    void buscar(filtrosDefault());
  }, []);

  function limparFiltros() {
    const defs = filtrosDefault();
    setFiltros(defs);
    void buscar(defs);
  }

  function selecionarPagamento(p) {
    setSelPagamento(p);
    const sug = mapaSugestoes.get(Number(p.id));
    const lid = sug?.lancamento?.id;
    if (lid != null) {
      const alvo = lancamentos.find((l) => Number(l.id) === Number(lid));
      if (alvo) {
        setSelLancamento(alvo);
        requestAnimationFrame(() => {
          lancamentoRefs.current[lid]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        return;
      }
    }
    setSelLancamento(null);
  }

  async function vincularPar(pagamentoId, financeiroLancamentoId) {
    await vincularConciliacao({ pagamentoId, financeiroLancamentoId });
  }

  async function confirmarVinculoManual() {
    if (!selPagamento || !selLancamento) return;
    setErro('');
    try {
      await vincularPar(selPagamento.id, selLancamento.id);
      setMensagemOk('Pagamento conciliado com sucesso.');
      await buscar();
    } catch (e) {
      setErro(e?.message || 'Falha ao vincular.');
    }
  }

  async function aceitarSugestaoPagamento(p) {
    const sug = mapaSugestoes.get(Number(p.id));
    const lid = sug?.lancamento?.id;
    if (lid == null) return;
    setErro('');
    try {
      await vincularPar(p.id, Number(lid));
      setMensagemOk('Pagamento conciliado com sucesso.');
      await buscar();
    } catch (e) {
      setErro(e?.message || 'Falha ao vincular sugestão.');
    }
  }

  async function aceitarTodasSugestoes() {
    const n = paresSugestao.length;
    if (n === 0) return;
    if (!window.confirm(`Vincular ${n} pagamentos automaticamente?`)) return;
    setErro('');
    let ok = 0;
    for (let i = 0; i < paresSugestao.length; i++) {
      const par = paresSugestao[i];
      setBatchProgress(`Vinculando ${i + 1}/${n}…`);
      try {
        await vincularPar(par.pagamentoId, par.financeiroLancamentoId);
        ok++;
      } catch {
        break;
      }
    }
    setBatchProgress('');
    setMensagemOk(`${ok} pagamento(s) conciliado(s) com sucesso.`);
    await buscar();
  }

  async function desfazerConciliacao(p) {
    if (
      !window.confirm('Remover vínculo? O pagamento voltará para Pago confirmado.')
    ) {
      return;
    }
    setErro('');
    try {
      await desvincularConciliacao({ pagamentoId: p.id });
      setMensagemOk('Vínculo removido.');
      await buscar();
    } catch (e) {
      setErro(e?.message || 'Falha ao desvincular.');
    }
  }

  const diffPainel =
    selPagamento && selLancamento
      ? textoDiferencaValor(Number(selLancamento.valor ?? 0) - Number(selPagamento.valor ?? 0))
      : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-teal-50/30 to-indigo-50/40 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c]/95 backdrop-blur-sm sticky top-0 z-20 shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/imoveis/pagamentos')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Pagamentos
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
              <Link2 className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold">Conciliação bancária</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vincule pagamentos operacionais às transações do extrato importado.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={carregando || paresSugestao.length === 0}
            onClick={() => void aceitarTodasSugestoes()}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Aceitar todas as sugestões ({paresSugestao.length})
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 pb-32 space-y-4">
        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {erro}
          </div>
        ) : null}
        {mensagemOk ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
            {mensagemOk}
          </div>
        ) : null}
        {batchProgress ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {batchProgress}
          </div>
        ) : null}

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-orange-200/80 bg-orange-50/90 px-4 py-3 dark:border-orange-900/50 dark:bg-orange-950/30">
            <div className="text-xs font-medium text-orange-900/80 dark:text-orange-200">Pagamentos aguardando</div>
            <div className="text-xl font-bold tabular-nums">{totaisResumo.pagamentos.count}</div>
            <div className="text-sm tabular-nums text-orange-950/90 dark:text-orange-100">
              {formatBRL(totaisResumo.pagamentos.valor)}
            </div>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
            <div className="text-xs font-medium text-sky-900/80 dark:text-sky-200">Transações não vinculadas</div>
            <div className="text-xl font-bold tabular-nums">{totaisResumo.lancamentos.count}</div>
            <div className="text-sm tabular-nums">{formatBRL(totaisResumo.lancamentos.valor)}</div>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200">Sugestões encontradas</div>
            <div className="text-xl font-bold tabular-nums">{totaisResumo.sugestoes}</div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 p-3">
          <div className="flex flex-wrap gap-2 items-end text-xs">
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Período início</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
                value={filtros.periodoInicio}
                onChange={(e) => setFiltros((f) => ({ ...f, periodoInicio: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-500">Período fim</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
                value={filtros.periodoFim}
                onChange={(e) => setFiltros((f) => ({ ...f, periodoFim: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-0.5 min-w-[140px]">
              <span className="text-slate-500">Banco</span>
              <select
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
                value={filtros.numeroBanco}
                onChange={(e) => setFiltros((f) => ({ ...f, numeroBanco: e.target.value }))}
              >
                <option value="">Todos</option>
                {bancosOpcoes.map((b) => (
                  <option key={String(b.numeroBanco ?? b.label)} value={b.numeroBanco ?? ''}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 min-w-[160px]">
              <span className="text-slate-500">Imóvel</span>
              <select
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
                value={filtros.imovelId}
                onChange={(e) => setFiltros((f) => ({ ...f, imovelId: e.target.value }))}
              >
                <option value="">Todos</option>
                {imoveis.map((im) => {
                  const id = im.id ?? im._apiImovelId;
                  return (
                    <option key={id} value={String(id)}>
                      {rotuloImovel({ imovelId: id, imovelNumeroPlanilha: im.numeroPlanilha, condominioTexto: im.condominio }, mapaImoveis)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 min-w-[140px]">
              <span className="text-slate-500">Categoria</span>
              <select
                className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 dark:border-slate-600"
                value={filtros.categoria}
                onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Todas</option>
                {CATEGORIAS_PAGAMENTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={carregando}
              onClick={() => void buscar()}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
            >
              {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Buscar
            </button>
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-600"
            >
              Limpar
            </button>
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-4 min-h-[420px]">
          <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 flex flex-col min-h-[360px]">
            <h2 className="text-sm font-semibold px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              Pagamentos pendentes de conciliação ({pagamentos.length})
            </h2>
            <ul className="flex-1 overflow-y-auto divide-y dark:divide-slate-700 text-xs">
              {pagamentos.map((p) => {
                const sug = mapaSugestoes.get(Number(p.id));
                const sel = selPagamento?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selecionarPagamento(p)}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                        sel ? 'ring-2 ring-inset ring-teal-500 bg-teal-50/60 dark:bg-teal-950/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="whitespace-nowrap text-slate-500 w-12">{fmtData(p.dataVencimento)}</span>
                        <span className="text-slate-600 dark:text-slate-300 w-20 truncate shrink-0">
                          {rotuloImovel(p, mapaImoveis)}
                        </span>
                        <span className={badgeCategoriaClass(p.categoria)}>{p.categoria}</span>
                        <span className="flex-1 min-w-0 truncate" title={p.descricao}>
                          {truncar(p.descricao, 40)}
                        </span>
                        <span className="font-semibold tabular-nums shrink-0">{formatBRL(Number(p.valor ?? 0))}</span>
                        {sug ? (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-100">
                              Match {sug.score}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                void aceitarSugestaoPagamento(p);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation();
                                  void aceitarSugestaoPagamento(p);
                                }
                              }}
                              className="rounded bg-emerald-600 text-white px-1.5 py-0.5 text-[10px] font-semibold hover:bg-emerald-700"
                            >
                              Aceitar
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
              {!carregando && pagamentos.length === 0 ? (
                <li className="p-8 text-center text-slate-500">Nenhum pagamento pendente no período.</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 flex flex-col min-h-[360px]">
            <h2 className="text-sm font-semibold px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              Transações bancárias ({lancamentos.length})
            </h2>
            {lancamentos.length === 0 && !carregando ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-sm text-slate-600 dark:text-slate-400">
                <p>Nenhuma transação bancária encontrada no período.</p>
                <p className="mt-2">
                  Importe o extrato em{' '}
                  <Link to="/financeiro/extrato" className="text-teal-700 dark:text-teal-300 font-semibold underline">
                    Financeiro → Extrato
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto divide-y dark:divide-slate-700 text-xs">
                {lancamentos.map((l) => {
                  const sel = selLancamento?.id === l.id;
                  const destacadoSug =
                    selPagamento &&
                    mapaSugestoes.get(Number(selPagamento.id))?.lancamento?.id === l.id;
                  return (
                    <li key={l.id} ref={(el) => { lancamentoRefs.current[l.id] = el; }}>
                      <button
                        type="button"
                        onClick={() => setSelLancamento(l)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                          sel || destacadoSug
                            ? 'ring-2 ring-inset ring-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/25'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-slate-500 w-12">{fmtData(l.dataLancamento)}</span>
                          <span className="w-24 truncate shrink-0 text-slate-600">{truncar(l.bancoNome, 18)}</span>
                          <span className="flex-1 min-w-0 truncate" title={l.descricao}>
                            {truncar(l.descricao, 44)}
                          </span>
                          <span className="font-semibold tabular-nums shrink-0">{formatBRL(Number(l.valor ?? 0))}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold"
            onClick={() => setUltimosAberto((v) => !v)}
          >
            Últimos conciliados ({ultimosConciliados.length})
            {ultimosAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {ultimosAberto ? (
            <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-left">
                  <tr>
                    <th className="px-3 py-2">Data conf.</th>
                    <th className="px-3 py-2">Pagamento</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Transação bancária</th>
                    <th className="px-3 py-2 w-24">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosConciliados.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtData(p.dataConferencia)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={p.descricao}>
                        {truncar(p.descricao, 50)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatBRL(Number(p.valorPagoBanco ?? p.valor ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {p.financeiroLancamentoId != null ? `Lanç. #${p.financeiroLancamentoId}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          title="Desfazer conciliação"
                          className="inline-flex items-center gap-0.5 rounded border border-orange-300 px-1.5 py-0.5 hover:bg-orange-50"
                          onClick={() => void desfazerConciliacao(p)}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Desfazer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ultimosConciliados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        Nenhum pagamento conciliado recente.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>

      {selPagamento && selLancamento ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 bg-white/98 dark:bg-slate-900/98 dark:border-slate-600 shadow-2xl backdrop-blur-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex-1 min-w-[200px]">
              <span className="text-slate-500 block">Pagamento</span>
              <span className="font-medium">
                {truncar(selPagamento.descricao, 40)} — {formatBRL(Number(selPagamento.valor ?? 0))} — Venc.{' '}
                {fmtData(selPagamento.dataVencimento)}
              </span>
            </div>
            <div className="flex-1 min-w-[200px]">
              <span className="text-slate-500 block">Transação</span>
              <span className="font-medium">
                {truncar(selLancamento.descricao, 40)} — {formatBRL(Number(selLancamento.valor ?? 0))} —{' '}
                {fmtData(selLancamento.dataLancamento)}
              </span>
            </div>
            {diffPainel ? (
              <div className={`font-medium ${diffPainel.cls}`}>{diffPainel.texto}</div>
            ) : null}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-600"
                onClick={() => {
                  setSelPagamento(null);
                  setSelLancamento(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-4 py-1.5 font-semibold text-white hover:bg-teal-700"
                onClick={() => void confirmarVinculoManual()}
              >
                Vincular
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {carregando ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 pointer-events-none">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : null}
    </div>
  );
}
