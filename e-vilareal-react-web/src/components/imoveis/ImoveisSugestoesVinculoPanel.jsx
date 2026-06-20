import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { featureFlags } from '../../config/featureFlags.js';
import {
  descartarSugestaoVinculoImovel,
  filtrarSugestoesSemDescartadas,
  listarDescartesVinculoImovel,
  restaurarSugestaoVinculoImovel,
} from '../../data/imoveisVinculoSugestoesDescartes.js';
import {
  classificarDestaqueNomeExtratoVinculo,
  classesLinhaCoincidenciaNome,
} from '../../data/imoveisVinculoSugestoes.js';
import { buildExtratoUrlParaLancamento } from '../financeiro/extrato/extratoDeepLink.js';
import {
  aplicarSugestaoVinculoImovelExtrato,
  carregarSugestoesVinculoImoveisExtrato,
  invalidarCachesSugestoesVinculoImoveis,
} from '../../repositories/imoveisRepository.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function badgeConfianca(c) {
  const map = {
    alta: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    media: 'bg-amber-100 text-amber-950 border-amber-200',
    baixa: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const cls = map[c] || map.baixa;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${cls}`}>
      {c === 'alta' ? 'Alta' : c === 'media' ? 'Média' : 'Baixa'}
    </span>
  );
}

const btnAprovar =
  'inline-flex items-center justify-center gap-1.5 min-w-[8.5rem] px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50';
const btnDescartar =
  'inline-flex items-center justify-center gap-1.5 min-w-[8.5rem] px-3 py-2 rounded-lg border border-red-200 bg-white text-red-800 text-xs font-semibold hover:bg-red-50 disabled:opacity-50';

function chaveSugestaoRow(s) {
  return s.sugestaoKey || `${s.lancamentoId}|${s.codigoCliente}|${s.proc}`;
}

function abrirExtratoDaSugestao(navigate, s) {
  if (!s?.lancamentoId || typeof navigate !== 'function') return;
  navigate(
    buildExtratoUrlParaLancamento({
      lancamentoId: s.lancamentoId,
      numeroBanco: s.numeroBanco,
      data: s.data,
    }),
  );
}

function tipoDestaqueNomeSugestao(s) {
  return classificarDestaqueNomeExtratoVinculo(
    { descricao: s.descricao, descricaoDetalhada: s.descricaoDetalhada },
    s.locatario,
  );
}

/**
 * Painel de sugestões de vínculo extrato → imóvel (Cod.+Proc.).
 * @param {{
 *   imovelIdContexto?: number | null,
 *   onAprovado?: () => void,
 *   variante?: 'embedded' | 'page',
 *   estrategia?: 'melhorPorLancamento' | 'todosParesQualificados',
 *   limite?: number,
 *   maxParesPorLancamento?: number,
 *   mostrarLinkCentral?: boolean,
 * }} props
 */
export function ImoveisSugestoesVinculoPanel({
  imovelIdContexto = null,
  onAprovado,
  variante = 'embedded',
  estrategia = 'melhorPorLancamento',
  limite = 50,
  maxParesPorLancamento = 6,
  mostrarLinkCentral = true,
}) {
  const navigate = useNavigate();
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [diag, setDiag] = useState(null);
  const [acaoId, setAcaoId] = useState(null);
  const [sucesso, setSucesso] = useState('');
  const [expandidoId, setExpandidoId] = useState(null);
  const [mostrarDescartados, setMostrarDescartados] = useState(false);
  const [listaDescartados, setListaDescartados] = useState([]);
  const [somenteEsteImovel, setSomenteEsteImovel] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroConfianca, setFiltroConfianca] = useState('todas');
  const [filtroCorNome, setFiltroCorNome] = useState('todas');
  const montadoRef = useRef(true);
  const extratoTimerRef = useRef(null);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (extratoTimerRef.current) clearTimeout(extratoTimerRef.current);
    };
  }, []);

  const recarregarDescartes = useCallback(() => {
    setListaDescartados(listarDescartesVinculoImovel());
  }, []);

  const recarregar = useCallback(
    async ({ forcar = false, silencioso = false } = {}) => {
      if (!featureFlags.useApiFinanceiro || !featureFlags.useApiImoveis) return;
      if (silencioso) setAtualizando(true);
      else {
        setCarregandoInicial(true);
        setErro('');
      }
      try {
        const r = await carregarSugestoesVinculoImoveisExtrato({
          forcar,
          estrategia,
          limite,
          maxParesPorLancamento,
          imovelIdFiltro:
            estrategia === 'melhorPorLancamento' && somenteEsteImovel && imovelIdContexto != null
              ? imovelIdContexto
              : null,
        });
        if (!montadoRef.current) return;
        if (!r.ok) {
          setSugestoes([]);
          setDiag(null);
          setErro(r.motivo || 'Não foi possível analisar sugestões.');
          return;
        }
        setSugestoes(r.sugestoes || []);
        setDiag({
          totalCandidatos: r.totalCandidatos ?? 0,
          totalDescartadas: r.totalDescartadas ?? 0,
        });
        recarregarDescartes();
      } catch (e) {
        if (!montadoRef.current) return;
        setSugestoes([]);
        setDiag(null);
        setErro(e?.message || 'Falha ao carregar sugestões.');
      } finally {
        if (!montadoRef.current) return;
        setCarregandoInicial(false);
        setAtualizando(false);
      }
    },
    [recarregarDescartes, estrategia, limite, maxParesPorLancamento, somenteEsteImovel, imovelIdContexto],
  );

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const agendarAtualizacaoExtrato = useCallback(() => {
    if (!onAprovado) return;
    if (extratoTimerRef.current) clearTimeout(extratoTimerRef.current);
    extratoTimerRef.current = setTimeout(() => {
      extratoTimerRef.current = null;
      onAprovado();
    }, 400);
  }, [onAprovado]);

  const visiveis = useMemo(() => {
    let list = filtrarSugestoesSemDescartadas(sugestoes);
    if (somenteEsteImovel && imovelIdContexto != null) {
      list = list.filter((s) => Number(s.imovelId) === Number(imovelIdContexto));
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const blob = `${s.descricao} ${s.locatario} ${s.unidade} ${s.codigoCliente} ${s.proc} ${s.imovelId}`.toLowerCase();
        return blob.includes(q);
      });
    }
    if (filtroConfianca !== 'todas') {
      list = list.filter((s) => s.confianca === filtroConfianca);
    }
    if (filtroCorNome !== 'todas') {
      list = list.filter((s) => tipoDestaqueNomeSugestao(s) === filtroCorNome);
    }
    list = [...list].sort((a, b) => {
      if (estrategia === 'todosParesQualificados' && a.lancamentoId !== b.lancamentoId) {
        return Number(a.lancamentoId) - Number(b.lancamentoId);
      }
      if (imovelIdContexto != null) {
        const aCtx = Number(a.imovelId) === Number(imovelIdContexto) ? 0 : 1;
        const bCtx = Number(b.imovelId) === Number(imovelIdContexto) ? 0 : 1;
        if (aCtx !== bCtx) return aCtx - bCtx;
      }
      return b.score - a.score;
    });
    return list;
  }, [sugestoes, imovelIdContexto, somenteEsteImovel, busca, filtroConfianca, filtroCorNome, estrategia]);

  async function aprovar(s) {
    setAcaoId(`aprovar-${chaveSugestaoRow(s)}`);
    setErro('');
    try {
      await aplicarSugestaoVinculoImovelExtrato(s);
      descartarSugestaoVinculoImovel({
        lancamentoId: s.lancamentoId,
        codigoCliente: s.codigoCliente,
        proc: s.proc,
        imovelId: s.imovelId,
        data: s.data,
        valor: s.valor,
      });
      const chave = chaveSugestaoRow(s);
      setSugestoes((prev) => prev.filter((x) => chaveSugestaoRow(x) !== chave));
      recarregarDescartes();
      setSucesso(
        `Vínculo aprovado: Cod. ${s.codigoCliente} / Proc. ${s.proc} (${s.mesReferencia || 'mês do lançamento'}).`,
      );
      agendarAtualizacaoExtrato();
    } catch (e) {
      setErro(e?.message || 'Falha ao aplicar vínculo.');
    } finally {
      setAcaoId(null);
    }
  }

  function descartar(s) {
    setErro('');
    descartarSugestaoVinculoImovel({
      lancamentoId: s.lancamentoId,
      codigoCliente: s.codigoCliente,
      proc: s.proc,
      imovelId: s.imovelId,
      data: s.data,
      valor: s.valor,
    });
    const chave = chaveSugestaoRow(s);
    setSugestoes((prev) => prev.filter((x) => chaveSugestaoRow(x) !== chave));
    recarregarDescartes();
    setSucesso(
      `Descartado para Cod. ${s.codigoCliente} / Proc. ${s.proc} (lanç. #${s.lancamentoId}).`,
    );
  }

  function restaurarDescartado(lancamentoId, codigoCliente, proc) {
    if (restaurarSugestaoVinculoImovel(lancamentoId, codigoCliente, proc)) {
      recarregarDescartes();
      void recarregar({ forcar: true, silencioso: true });
      setSucesso('Descarte removido. O lançamento pode voltar a aparecer nas sugestões.');
    }
  }

  if (!featureFlags.useApiFinanceiro || !featureFlags.useApiImoveis) return null;

  const filtroAtivo = somenteEsteImovel && imovelIdContexto != null;
  const filtroCorAtivo = filtroCorNome !== 'todas';
  const painelBloqueado = carregandoInicial && sugestoes.length === 0;
  const modoGeral = estrategia === 'todosParesQualificados';
  const shellClass =
    variante === 'page'
      ? 'space-y-4'
      : 'bg-gradient-to-br from-violet-50 to-indigo-50/80 rounded-lg border border-violet-200/90 shadow-sm p-4 space-y-3';

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Sparkles className="w-4 h-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className={`font-semibold text-violet-950 ${variante === 'page' ? 'text-base' : 'text-sm'}`}>
              {modoGeral ? 'Central de sugestões de vínculo' : 'Sugestões de vínculo (extrato bancário)'}
            </h2>
            <p className="text-xs text-violet-900/80 mt-0.5 max-w-3xl">
              {modoGeral ? (
                <>
                  Um mesmo lançamento pode aparecer para <strong>vários imóveis</strong> (ex.: repasses ao mesmo locador
                  com valores diferentes) — aprove cada linha no Cod.+Proc. correto. Descartar vale só para aquele par.
                </>
              ) : (
                <>
                  Créditos (aluguel) e <strong>débitos</strong> (repasse ao locador): o nome no PIX e o valor histórico
                  ajudam a escolher o imóvel. Use <strong>Aprovar</strong> / <strong>Descartar</strong> por par.{' '}
                  {mostrarLinkCentral ? (
                    <Link to="/imoveis/sugestoes-vinculo" className="text-indigo-700 font-medium hover:underline">
                      Abrir central geral
                    </Link>
                  ) : null}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {modoGeral || variante === 'page' ? (
            <>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar descrição, locatário, imóvel…"
                className="text-xs px-2 py-1 rounded border border-violet-200 min-w-[10rem]"
              />
              <select
                value={filtroConfianca}
                onChange={(e) => setFiltroConfianca(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-violet-200"
              >
                <option value="todas">Todas confianças</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </>
          ) : null}
          <select
            value={filtroCorNome}
            onChange={(e) => setFiltroCorNome(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-violet-200"
            title="Filtrar pelo destaque de nome PIX vs locatário"
          >
            <option value="todas">Todas as cores</option>
            <option value="coincide">Nomes coincidem (azul)</option>
            <option value="diferente">Nomes diferentes (vermelho)</option>
            <option value="indeterminado">Sem destaque</option>
          </select>
          {!modoGeral && imovelIdContexto != null ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-violet-950 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={somenteEsteImovel}
                onChange={(e) => setSomenteEsteImovel(e.target.checked)}
                className="rounded border-violet-400 text-violet-700 focus:ring-violet-500"
              />
              Somente imóvel {imovelIdContexto}
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              invalidarCachesSugestoesVinculoImoveis();
              void recarregar({ forcar: true, silencioso: sugestoes.length > 0 });
            }}
            disabled={carregandoInicial || atualizando}
            className="text-xs font-medium px-2 py-1 rounded border border-violet-300 text-violet-900 hover:bg-violet-100/80 disabled:opacity-50"
          >
            {carregandoInicial || atualizando ? 'Analisando…' : 'Reanalisar'}
          </button>
          {listaDescartados.length > 0 ? (
            <button
              type="button"
              onClick={() => setMostrarDescartados((v) => !v)}
              className="text-xs font-medium px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-white/80"
            >
              {mostrarDescartados ? 'Ocultar' : 'Ver'} descartados ({listaDescartados.length})
            </button>
          ) : null}
        </div>
      </div>

      {modoGeral ? (
        <p className="text-[11px] text-violet-800/90 bg-white/60 border border-violet-100 rounded px-2 py-1">
          Modo <strong>geral</strong>: até {maxParesPorLancamento} vínculos sugeridos por lançamento. Priorize aprovar o
          imóvel certo; use descarte nos pares errados.
        </p>
      ) : null}
      {!modoGeral && !filtroAtivo && imovelIdContexto != null ? (
        <p className="text-[11px] text-violet-800/90 bg-white/60 border border-violet-100 rounded px-2 py-1">
          Exibindo sugestões de <strong>todos os imóveis</strong> (filtro &quot;Somente imóvel {imovelIdContexto}&quot; é
          instantâneo, sem nova busca na API). Linhas do imóvel aberto aparecem primeiro.
        </p>
      ) : null}

      {atualizando ? (
        <p className="text-[11px] text-violet-700 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Atualizando lista…
        </p>
      ) : null}

      {erro ? <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{erro}</p> : null}
      {sucesso ? (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">{sucesso}</p>
      ) : null}

      {mostrarDescartados && listaDescartados.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white/90 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Descartados por par Cod.+Proc. (persistidos no navegador)
          </p>
          <ul className="space-y-1 max-h-32 overflow-y-auto text-xs text-slate-600">
            {listaDescartados.map((d) => (
              <li
                key={`${d.lancamentoId}-${d.codigoCliente}-${d.proc}`}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  Lanç. <span className="font-mono">#{d.lancamentoId}</span>
                  {d.data ? ` · ${d.data}` : ''}
                  {d.codigoCliente ? ` · ${d.codigoCliente}/${d.proc}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => restaurarDescartado(d.lancamentoId, d.codigoCliente, d.proc)}
                  className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {painelBloqueado ? (
        <p className="text-sm text-violet-800 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Buscando lançamentos e histórico de vínculos…
        </p>
      ) : visiveis.length === 0 ? (
        <div className="text-sm text-violet-800/90 space-y-1.5">
          <p>
            Nenhuma sugestão pendente
            {filtroAtivo ? ` para o imóvel ${imovelIdContexto}` : ''}
            {filtroCorAtivo ? ' com o filtro de cor selecionado' : ''}. Lançamentos já vinculados no extrato (com Proc.),
            descartados anteriormente ou sem correspondência forte (nome e, em repasses, valor histórico).
          </p>
          {diag ? (
            <p className="text-xs text-violet-700/90">
              Análise: {diag.totalCandidatos} lançamento(s) bancário(s) sem Proc. nos últimos meses
              {diag.totalDescartadas > 0 ? ` · ${diag.totalDescartadas} ocultada(s) por descarte` : ''}.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-violet-200/80 bg-white/95 overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-b border-violet-100 bg-slate-50/90 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded border border-sky-200 bg-sky-100" aria-hidden />
              Nome do PIX coincide com locatário/locador
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded border border-red-200 bg-red-50" aria-hidden />
              Nomes diferentes — conferir valor (repasse) antes de aprovar
            </span>
          </div>
          <div className="overflow-x-auto max-h-[min(32rem,55vh)]">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead className="sticky top-0 z-[1] bg-violet-100/95">
                <tr className="text-xs font-semibold text-violet-950">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">Lançamento</th>
                  <th className="px-3 py-2">Vínculo sugerido</th>
                  <th className="px-3 py-2">Confiança</th>
                  <th className="px-3 py-2 text-right w-52">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((s, idx) => {
                  const rowKey = chaveSugestaoRow(s);
                  const aberto = expandidoId === rowKey;
                  const ocupado = acaoId != null;
                  const destaque =
                    imovelIdContexto != null && Number(s.imovelId) === Number(imovelIdContexto);
                  const mesmoLancAnterior =
                    idx > 0 && visiveis[idx - 1].lancamentoId === s.lancamentoId;
                  const destaqueNome = tipoDestaqueNomeSugestao(s);
                  const clsLinha = classesLinhaCoincidenciaNome(destaqueNome, destaque);
                  return (
                    <Fragment key={rowKey}>
                      <tr
                        className={`border-t ${clsLinha} cursor-pointer hover:bg-violet-50/50`}
                        onDoubleClick={() => abrirExtratoDaSugestao(navigate, s)}
                        title="Duplo clique: abrir lançamento no extrato"
                      >
                        <td className="px-2 py-2 align-top" onDoubleClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setExpandidoId(aberto ? null : rowKey)}
                            className="p-1 rounded text-violet-700 hover:bg-violet-100"
                            aria-label={aberto ? 'Recolher detalhes' : 'Ver motivos'}
                          >
                            {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top text-sm">
                          <div className="font-medium text-slate-900">
                            {!mesmoLancAnterior || modoGeral ? (
                              <>
                                {s.natureza === 'DEBITO' ? (
                                  <span className="text-[10px] font-semibold uppercase text-amber-800 bg-amber-100 border border-amber-200 rounded px-1 py-0.5 mr-1.5 align-middle">
                                    Débito
                                  </span>
                                ) : null}
                                {s.descricao || '—'}
                              </>
                            ) : (
                              <span className="text-slate-400 italic">↳ mesmo lançamento #{s.lancamentoId}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono">
                            {s.data} · {formatBRL(s.valor)} · {s.bancoNome || 'Banco'} · id {s.lancamentoId}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-sm">
                          <div>
                            Imóvel <strong>{s.imovelId}</strong> — {s.unidade}
                            {destaque ? (
                              <span className="ml-1 text-[10px] font-semibold text-violet-700 uppercase">(aberto)</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Cod. <span className="font-mono">{s.codigoCliente}</span> / Proc.{' '}
                            <span className="font-mono">{s.proc}</span>
                            {s.locatario ? (
                              <>
                                <br />
                                {s.rotuloPessoa || (s.natureza === 'DEBITO' ? 'Locador' : 'Locatário')}:{' '}
                                <span className="font-medium">{s.locatario}</span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="space-y-1">
                            {badgeConfianca(s.confianca)}
                            <span className="block text-[10px] text-slate-500">score {s.score}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top" onDoubleClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              disabled={ocupado}
                              className={btnAprovar}
                              onClick={() => void aprovar(s)}
                            >
                              {acaoId === `aprovar-${rowKey}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Aprovar
                            </button>
                            <button
                              type="button"
                              disabled={ocupado}
                              className={btnDescartar}
                              onClick={() => descartar(s)}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Descartar
                            </button>
                            <Link
                              to={buildExtratoUrlParaLancamento({
                                lancamentoId: s.lancamentoId,
                                numeroBanco: s.numeroBanco,
                                data: s.data,
                              })}
                              title={`Abrir lançamento #${s.lancamentoId} no extrato (${s.bancoNome || 'banco'})`}
                              className="inline-flex items-center justify-center gap-1 min-w-[8.5rem] px-3 py-2 rounded-lg border border-indigo-200 bg-white text-indigo-800 text-xs font-semibold hover:bg-indigo-50"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Ver no extrato
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {aberto ? (
                        <tr
                          className={`border-t ${
                            destaqueNome === 'coincide'
                              ? 'bg-sky-50/80'
                              : destaqueNome === 'diferente'
                                ? 'bg-red-50/80'
                                : 'bg-slate-50/80'
                          }`}
                        >
                          <td colSpan={5} className="px-4 py-2">
                            <p className="text-[11px] font-semibold text-slate-600 mb-1">Por que sugerimos este vínculo:</p>
                            <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                              {s.motivos.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
