import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { buscarPublicacoesEmail, processarEmailsAgora } from '../api/publicacoesEmailApi.js';

const STATUS_OPCOES = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'VINCULADA', label: 'Vinculada' },
  { value: 'TRATADA', label: 'Tratada' },
  { value: 'IGNORADA', label: 'Ignorada' },
];

const STATUS_LABEL = {
  PENDENTE: 'Pendente',
  VINCULADA: 'Vinculada',
  TRATADA: 'Tratada',
  IGNORADA: 'Ignorada',
};

function fmtDataBr(isoDate) {
  if (!isoDate) return '—';
  const s = String(isoDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function fmtInstant(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso);
  }
}

function truncarTeor(texto, max = 150) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function badgeStatusClass(status) {
  switch (status) {
    case 'VINCULADA':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200';
    case 'TRATADA':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'IGNORADA':
      return 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400';
    default:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
}

function ModalTeor({ publicacao, onClose }) {
  if (!publicacao) return null;
  return (
    <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-teor-titulo"
        onClick={onClose}
      >
        <div
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-[#141922] sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <h2 id="modal-teor-titulo" className="text-base font-semibold">
              Teor completo
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-600 dark:text-slate-400">Processo:</span>{' '}
                {publicacao.numeroProcessoEncontrado || '—'}
              </p>
              <p>
                <span className="font-medium text-slate-600 dark:text-slate-400">Data publicação:</span>{' '}
                {fmtDataBr(publicacao.dataPublicacao)}
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium text-slate-600 dark:text-slate-400">Origem:</span>{' '}
                {publicacao.arquivoOrigemNome || '—'}
              </p>
            </div>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed dark:border-white/10 dark:bg-white/5">
              {publicacao.teor || '—'}
            </pre>
          </div>
        </div>
      </div>
  );
}

function CardMobileRow({ row, expandido, onToggle }) {
  const status = row.statusTratamento || 'PENDENTE';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#141922]">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{fmtDataBr(row.dataPublicacao)}</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeStatusClass(status)}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          {expandido ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
        </div>
        <p className="mt-2 font-mono text-xs text-sky-800 dark:text-sky-300">
          {row.numeroProcessoEncontrado || '—'}
        </p>
        <p className="mt-1 line-clamp-3 text-xs text-slate-700 dark:text-slate-300" title={row.teor}>
          {truncarTeor(row.teor, 150)}
        </p>
        <p className="mt-2 truncate text-[10px] text-slate-500">{row.arquivoOrigemNome || '—'}</p>
        <p className="mt-1 text-[10px] text-slate-400">Importado: {fmtInstant(row.createdAt)}</p>
      </button>
      {expandido ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5">
          {row.teor || '—'}
        </pre>
      ) : null}
    </article>
  );
}

export function PublicacoesEmail() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [err, setErr] = useState('');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [resultadoProcessamento, setResultadoProcessamento] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [modalPublicacao, setModalPublicacao] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(buscaTexto.trim()), 400);
    return () => clearTimeout(t);
  }, [buscaTexto]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await buscarPublicacoesEmail({
        texto: buscaDebounced || undefined,
        status: filtroStatus || undefined,
      });
      setRows(data);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar publicações por email.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buscaDebounced, filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalLabel = useMemo(() => {
    const n = rows.length;
    const temFiltro = Boolean(buscaDebounced || filtroStatus);
    if (temFiltro) {
      return `${n} publicação${n === 1 ? '' : 'ões'} (filtro ativo)`;
    }
    return `${n} publicação${n === 1 ? '' : 'ões'} importada${n === 1 ? '' : 's'} por email`;
  }, [rows.length, buscaDebounced, filtroStatus]);

  const handleProcessar = async () => {
    setProcessando(true);
    setErr('');
    setResultadoProcessamento(null);
    try {
      const res = await processarEmailsAgora();
      setResultadoProcessamento(res);
      await carregar();
    } catch (e) {
      setErr(e?.message || 'Falha ao processar emails.');
    } finally {
      setProcessando(false);
    }
  };

  const toggleLinha = (row) => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setModalPublicacao(row);
      return;
    }
    setExpandidoId((prev) => (prev === row.id ? null : row.id));
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-sky-50/35 to-indigo-50/40 text-slate-900 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] dark:text-slate-100">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/processos/publicacoes')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Publicações (PDF)
          </button>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            <h1 className="text-xl font-bold">Publicações por Email</h1>
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{totalLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141922]">
          <button
            type="button"
            onClick={handleProcessar}
            disabled={processando}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Buscar Emails Agora
          </button>
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </button>
        </div>

        {resultadoProcessamento ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">Processamento concluído</p>
            <ul className="mt-2 space-y-1 text-emerald-800 dark:text-emerald-200">
              <li>Emails lidos: {resultadoProcessamento.emailsLidos ?? 0}</li>
              <li>Publicações processadas: {resultadoProcessamento.publicacoesProcessadas ?? 0}</li>
              <li>Erros: {(resultadoProcessamento.erros || []).length}</li>
            </ul>
            {(resultadoProcessamento.erros || []).length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-xs text-red-700 dark:text-red-300">
                {resultadoProcessamento.erros.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141922]">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Buscar no teor ou número do processo…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-white/15 dark:bg-white/5"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {STATUS_OPCOES.map((op) => (
              <option key={op.value || 'todos'} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando publicações…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/5">
            Nenhuma publicação importada por email encontrada.
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map((row) => (
                <CardMobileRow
                  key={row.id}
                  row={row}
                  expandido={expandidoId === row.id}
                  onToggle={() => toggleLinha(row)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#141922] md:block">
              <table className="w-full min-w-[960px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Data publicação</th>
                    <th className="px-3 py-2.5 font-medium">Nº processo</th>
                    <th className="min-w-[280px] px-3 py-2.5 font-medium">Teor</th>
                    <th className="min-w-[180px] px-3 py-2.5 font-medium">Origem / Email</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Importação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rows.map((row) => {
                    const status = row.statusTratamento || 'PENDENTE';
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/5"
                        onClick={() => toggleLinha(row)}
                        title="Clique para ver o teor completo"
                      >
                        <td className="whitespace-nowrap px-3 py-2.5">{fmtDataBr(row.dataPublicacao)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sky-800 dark:text-sky-300">
                          {row.numeroProcessoEncontrado || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" title={row.teor}>
                          {truncarTeor(row.teor, 150)}
                        </td>
                        <td
                          className="max-w-[220px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400"
                          title={row.arquivoOrigemNome}
                        >
                          {row.arquivoOrigemNome || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeStatusClass(status)}`}
                          >
                            {STATUS_LABEL[status] || status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{fmtInstant(row.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modalPublicacao ? <ModalTeor publicacao={modalPublicacao} onClose={() => setModalPublicacao(null)} /> : null}
    </div>
  );
}
