import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  Tag,
} from 'lucide-react';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { buscarProcessoPorId } from '../repositories/processosRepository.js';
import { fetchJuliaCaixa, patchJuliaCaixa } from '../repositories/juliaCaixaRepository.js';
import { mensagemErroAmigavel } from '../utils/mensagemErroAmigavel.js';
import { ProcessoEmbedModal } from './ProcessoEmbedModal.jsx';
import { SeloAssistenteIa } from './ui/AutorUsuarioExibicao.jsx';

const CAIXA_TABS = [
  { value: 'AGUARDANDO_VOCE', label: 'Aguardando você' },
  { value: 'POSTERGADO', label: 'Postergados' },
  { value: 'CONCLUIDO', label: 'Concluídos' },
];

const ORDENACAO_OPCOES = [
  { value: 'URGENCIA', label: 'Urgência' },
  { value: 'PRAZO', label: 'Prazo fatal' },
  { value: 'CONFIANCA', label: 'Confiança' },
];

const IMPACTO_ESTILO = {
  FAVORAVEL: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
  DESFAVORAVEL: 'bg-red-100 text-red-900 dark:bg-red-950/45 dark:text-red-200',
  NEUTRO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  INDEFINIDO: 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
};

const PRIORIDADE_ESTILO = {
  URGENTE:
    'bg-red-200 text-red-950 ring-red-400/90 dark:bg-red-900/50 dark:text-red-100 dark:ring-red-700/80',
  ALTA: 'bg-red-50 text-red-800 ring-red-200/80 dark:bg-red-950/30 dark:text-red-200',
  MEDIA: 'bg-orange-50 text-orange-900 ring-orange-200/80 dark:bg-orange-950/30 dark:text-orange-200',
  MÉDIA: 'bg-orange-50 text-orange-900 ring-orange-200/80 dark:bg-orange-950/30 dark:text-orange-200',
  BAIXA: 'bg-slate-50 text-slate-700 ring-slate-200/80 dark:bg-slate-800/50 dark:text-slate-200',
};

function fmtData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtData(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtConfianca(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function labelImpacto(v) {
  if (!v) return '—';
  const map = {
    FAVORAVEL: 'Favorável',
    DESFAVORAVEL: 'Desfavorável',
    NEUTRO: 'Neutro',
    INDEFINIDO: 'Indefinido',
  };
  return map[String(v).toUpperCase()] ?? v;
}

function estiloImpacto(v) {
  return IMPACTO_ESTILO[String(v ?? '').toUpperCase()] ?? IMPACTO_ESTILO.NEUTRO;
}

function estiloPrioridade(v) {
  return PRIORIDADE_ESTILO[String(v ?? '').toUpperCase()] ?? PRIORIDADE_ESTILO.BAIXA;
}

function rankPrioridade(v) {
  const p = String(v ?? '').toUpperCase();
  if (p === 'URGENTE') return 4;
  if (p === 'ALTA') return 3;
  if (p === 'MEDIA' || p === 'MÉDIA') return 2;
  if (p === 'BAIXA') return 1;
  return 0;
}

function parseDataIso(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function rotuloQuantidadeCaixa(aba, qtd) {
  const n = Number(qtd) || 0;
  const item = n === 1 ? 'triagem' : 'triagens';
  if (aba === 'POSTERGADO') {
    if (n === 0) return 'Nenhuma triagem postergada';
    return `${n} ${item} postergada${n === 1 ? '' : 's'}`;
  }
  if (aba === 'CONCLUIDO') {
    if (n === 0) return 'Nenhuma triagem concluída';
    return `${n} ${item} concluída${n === 1 ? '' : 's'}`;
  }
  if (n === 0) return 'Nenhuma triagem aguardando revisão';
  return `${n} ${item} aguardando sua revisão`;
}

function ordenarCards(cards, criterio) {
  const copy = [...cards];
  switch (criterio) {
    case 'PRAZO':
      return copy.sort((a, b) => {
        const pa = parseDataIso(a.prazoDataFim);
        const pb = parseDataIso(b.prazoDataFim);
        if (pa && pb) {
          const d = pa.getTime() - pb.getTime();
          if (d !== 0) return d;
        } else if (pa) return -1;
        else if (pb) return 1;
        return (a.triagemId ?? 0) - (b.triagemId ?? 0);
      });
    case 'CONFIANCA':
      return copy.sort((a, b) => {
        const ca = Number(a.confianca);
        const cb = Number(b.confianca);
        const va = Number.isFinite(ca) ? ca : -1;
        const vb = Number.isFinite(cb) ? cb : -1;
        if (vb !== va) return vb - va;
        return rankPrioridade(b.prioridade) - rankPrioridade(a.prioridade);
      });
    case 'URGENCIA':
    default:
      return copy.sort((a, b) => {
        const d = rankPrioridade(b.prioridade) - rankPrioridade(a.prioridade);
        if (d !== 0) return d;
        const pa = parseDataIso(a.prazoDataFim);
        const pb = parseDataIso(b.prazoDataFim);
        if (pa && pb) {
          const t = pa.getTime() - pb.getTime();
          if (t !== 0) return t;
        } else if (pa) return -1;
        else if (pb) return 1;
        return (a.triagemId ?? 0) - (b.triagemId ?? 0);
      });
  }
}

function JuliaCaixaCard({ card, acaoLoading, onConcluir, onPostergar, onCategorizar, onAbrirProcesso }) {
  const [verMais, setVerMais] = useState(false);
  const [postergarAberto, setPostergarAberto] = useState(false);
  const [dataPostergar, setDataPostergar] = useState('');
  const [categoriaAberta, setCategoriaAberta] = useState(false);
  const [categoriaTexto, setCategoriaTexto] = useState(card.categoria ?? '');

  useEffect(() => {
    setCategoriaTexto(card.categoria ?? '');
  }, [card.categoria]);

  const busy = acaoLoading === card.triagemId;

  return (
    <article className="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#141c2c]/95 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug flex-1 min-w-[12rem]">
          {card.classificacao || 'Triagem sem classificação'}
        </h3>
        {card.prioridade ? (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${estiloPrioridade(card.prioridade)}`}
          >
            {card.prioridade}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex px-2 py-0.5 rounded font-semibold ${estiloImpacto(card.impactoCliente)}`}>
          {labelImpacto(card.impactoCliente)}
        </span>
        <span className="text-slate-500 dark:text-slate-400">Confiança: {fmtConfianca(card.confianca)}</span>
        {card.categoria ? (
          <span className="inline-flex items-center gap-1 rounded bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200 px-2 py-0.5">
            <Tag className="w-3 h-3" aria-hidden />
            {card.categoria}
          </span>
        ) : null}
      </div>

      {card.cliente ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={card.cliente}>
          Cliente: {card.cliente}
        </p>
      ) : null}

      {card.codigoCliente || card.numeroInterno != null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {card.codigoCliente ? (
              <div className="inline-flex items-baseline gap-1.5">
                <dt className="font-semibold text-slate-500 dark:text-slate-400">Cód. cliente</dt>
                <dd className="font-mono font-semibold text-slate-800 dark:text-slate-100">{card.codigoCliente}</dd>
              </div>
            ) : null}
            {card.numeroInterno != null ? (
              <div className="inline-flex items-baseline gap-1.5">
                <dt className="font-semibold text-slate-500 dark:text-slate-400">Proc.</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{card.numeroInterno}</dd>
              </div>
            ) : null}
          </dl>
          {card.processoId ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAbrirProcesso(card)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-xs font-semibold px-2.5 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 disabled:opacity-50"
              title="Abrir cadastro do processo em janela flutuante"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Abrir processo
            </button>
          ) : null}
        </div>
      ) : card.processoId ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAbrirProcesso(card)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-xs font-semibold px-2.5 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 disabled:opacity-50 w-fit"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Abrir processo
        </button>
      ) : null}

      {card.numeroCnj ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate" title={card.numeroCnj}>
          CNJ: {card.numeroCnj}
        </p>
      ) : null}

      {card.parteAutora || card.parteOposta ? (
        <dl className="text-sm space-y-1 rounded-lg bg-slate-50/80 dark:bg-white/[0.04] px-3 py-2 border border-slate-100 dark:border-white/5">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-baseline">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
              Parte autora
            </dt>
            <dd className="text-slate-800 dark:text-slate-100 font-medium leading-snug">
              {card.parteAutora || '—'}
            </dd>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
              Parte oposta
            </dt>
            <dd className="text-slate-800 dark:text-slate-100 font-medium leading-snug">
              {card.parteOposta || '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {card.prazoDataFim ? (
        <p
          className={`text-sm font-semibold ${card.prazoVencido ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}
        >
          Prazo: {fmtData(card.prazoDataFim)}
          {card.prazoVencido ? ' · vencido' : null}
        </p>
      ) : null}

      {card.resumo ? (
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{card.resumo}</p>
      ) : null}

      {card.providenciaCliente ? (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-violet-300 dark:border-violet-600 pl-3">
          {card.providenciaCliente}
        </p>
      ) : null}

      {card.acaoSugerida ? (
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setVerMais((v) => !v)}
            className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 font-medium hover:underline"
          >
            {verMais ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {verMais ? 'Ver menos' : 'Ver mais — ação sugerida'}
          </button>
          {verMais ? <p className="mt-2 leading-relaxed whitespace-pre-wrap">{card.acaoSugerida}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-auto pt-1 border-t border-slate-100 dark:border-white/5">
        <span>Triagem #{card.triagemId}</span>
        {card.criadoEm ? <span>{fmtDataHora(card.criadoEm)}</span> : null}
        {card.postergarAte ? <span>Postergado até {fmtData(card.postergarAte)}</span> : null}
      </div>

      {postergarAberto ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 dark:bg-white/5 p-3">
          <label className="text-xs flex flex-col gap-1">
            <span className="text-slate-500">Postergar até</span>
            <input
              type="date"
              className="rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 text-sm"
              value={dataPostergar}
              onChange={(e) => setDataPostergar(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!dataPostergar || busy}
            className="rounded-lg bg-violet-600 text-white text-xs font-semibold px-3 py-2 hover:bg-violet-700 disabled:opacity-50"
            onClick={() => {
              onPostergar(card, dataPostergar);
              setPostergarAberto(false);
            }}
          >
            Confirmar
          </button>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-2"
            onClick={() => setPostergarAberto(false)}
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {categoriaAberta ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 dark:bg-white/5 p-3">
          <label className="text-xs flex flex-col gap-1 flex-1 min-w-[10rem]">
            <span className="text-slate-500">Categoria</span>
            <input
              type="text"
              maxLength={60}
              className="rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 text-sm w-full"
              value={categoriaTexto}
              onChange={(e) => setCategoriaTexto(e.target.value)}
              placeholder="Ex.: Intimação, Acordo…"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-violet-600 text-white text-xs font-semibold px-3 py-2 hover:bg-violet-700 disabled:opacity-50"
            onClick={() => {
              onCategorizar(card, categoriaTexto.trim());
              setCategoriaAberta(false);
            }}
          >
            Salvar
          </button>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-2"
            onClick={() => setCategoriaAberta(false)}
          >
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConcluir(card)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 text-xs font-semibold px-3 py-2 hover:bg-emerald-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Concluir
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPostergarAberto((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Postergar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setCategoriaAberta((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50"
        >
          <Tag className="w-3.5 h-3.5" />
          Categorizar
        </button>
      </div>
    </article>
  );
}

export function JuliaCaixa() {
  const [aba, setAba] = useState('AGUARDANDO_VOCE');
  const [ordenacao, setOrdenacao] = useState('URGENCIA');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [acaoLoading, setAcaoLoading] = useState(null);
  const [processoEmbed, setProcessoEmbed] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const list = await fetchJuliaCaixa(aba);
      setCards(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setCards([]);
      setErro(mensagemErroAmigavel(e, 'carregar a caixa da Júlia'));
    } finally {
      setLoading(false);
    }
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const cardsOrdenados = useMemo(() => ordenarCards(cards, ordenacao), [cards, ordenacao]);

  const executarPatch = async (triagemId, body) => {
    setAcaoLoading(triagemId);
    setErro('');
    try {
      await patchJuliaCaixa(triagemId, body);
      await carregar();
    } catch (e) {
      setErro(mensagemErroAmigavel(e, 'atualizar o card'));
    } finally {
      setAcaoLoading(null);
    }
  };

  const abrirProcessoEmJanela = useCallback((codigoCliente, numeroInterno) => {
    if (!codigoCliente) {
      setErro('Processo sem código de cliente para abrir o cadastro.');
      return;
    }
    setProcessoEmbed({
      revision: Date.now(),
      routerState: buildRouterStateChaveClienteProcesso(codigoCliente, numeroInterno),
    });
  }, []);

  const abrirProcesso = async (card) => {
    if (!card?.processoId) return;
    if (card.codigoCliente) {
      abrirProcessoEmJanela(card.codigoCliente, card.numeroInterno);
      return;
    }
    try {
      const p = await buscarProcessoPorId(card.processoId);
      abrirProcessoEmJanela(p?.codigoCliente, p?.numeroInterno);
    } catch (e) {
      setErro(mensagemErroAmigavel(e, 'abrir o processo'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-violet-50/40 to-indigo-50/50 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg">
              <Sparkles className="w-5 h-5" aria-hidden />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold">Caixa da Júlia</h1>
                <SeloAssistenteIa />
                {!loading ? (
                  <span
                    className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-900 dark:bg-violet-950/60 dark:text-violet-100"
                    aria-label={`${cards.length} cards na aba atual`}
                  >
                    {cards.length}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {loading ? 'Carregando triagens…' : rotuloQuantidadeCaixa(aba, cards.length)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => carregar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Atualizar
          </button>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-white/5 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {CAIXA_TABS.map((tab) => {
              const ativo = aba === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setAba(tab.value)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    ativo
                      ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 shrink-0">
            <span className="font-medium whitespace-nowrap">Ordenar por</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2.5 py-1.5 text-sm font-medium min-w-[9rem]"
            >
              {ORDENACAO_OPCOES.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {erro ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 px-4 py-3 text-sm">
            {erro}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" aria-hidden />
            <p className="text-sm">Carregando caixa…</p>
          </div>
        ) : cards.length === 0 ? (
          <p className="text-center text-slate-500 py-20 text-sm">
            Nenhum card nesta aba.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cardsOrdenados.map((card) => (
              <JuliaCaixaCard
                key={card.triagemId}
                card={card}
                acaoLoading={acaoLoading}
                onConcluir={(c) => executarPatch(c.triagemId, { statusCaixa: 'CONCLUIDO' })}
                onPostergar={(c, data) =>
                  executarPatch(c.triagemId, { statusCaixa: 'POSTERGADO', postergarAte: data })
                }
                onCategorizar={(c, cat) => executarPatch(c.triagemId, { categoria: cat || null })}
                onAbrirProcesso={abrirProcesso}
              />
            ))}
          </div>
        )}
      </main>

      <ProcessoEmbedModal
        embed={processoEmbed}
        onFechar={() => setProcessoEmbed(null)}
        titulo={
          processoEmbed?.routerState?.codigoCliente
            ? `Processo ${processoEmbed.routerState.codigoCliente}${
                processoEmbed.routerState.numeroInterno != null
                  ? ` · Proc. ${processoEmbed.routerState.numeroInterno}`
                  : ''
              }`
            : 'Processo (cadastro)'
        }
      />
    </div>
  );
}
