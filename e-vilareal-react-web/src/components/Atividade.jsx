import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Search } from 'lucide-react';
import { listarAtividadesAuditoria } from '../api/auditoriaService.js';
import { TablePaginationBar } from './ui/TablePaginationBar.jsx';
import { MODULOS_PERMISSAO } from '../data/usuarioPermissoesStorage.js';
import { TIPOS_ACAO_AUDITORIA } from '../services/auditoriaCliente.js';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData.js';

function isoDateDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function escCsv(c) {
  const s = String(c ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const LS_PAGE_SIZE_AUDITORIA = 'vilareal:pageSize:atividade';

function readPageSizeAuditoria() {
  try {
    const raw = localStorage.getItem(LS_PAGE_SIZE_AUDITORIA);
    if (raw == null) return 20;
    const n = Number(raw);
    return [10, 20, 25, 50, 100].includes(n) ? n : 20;
  } catch {
    return 20;
  }
}

async function coletarExportacao(filtros, maxLinhas = 2000) {
  const size = 400;
  let page = 0;
  const out = [];
  while (out.length < maxLinhas) {
    const chunk = await listarAtividadesAuditoria({ ...filtros, page, size });
    const rows = chunk.content ?? [];
    out.push(...rows);
    if (rows.length < size || chunk.last) break;
    page += 1;
  }
  return out.slice(0, maxLinhas);
}

/**
 * Relatório de atividades / log de auditoria (dados persistidos no backend).
 */
export function Atividade() {
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dataInicio, setDataInicio] = useState(() => isoDateDiasAtras(30));
  const [dataFim, setDataFim] = useState(hoje);
  const [usuarioId, setUsuarioId] = useState('');
  const [modulo, setModulo] = useState('');
  const [tipoAcao, setTipoAcao] = useState('');
  const [registroAfetadoId, setRegistroAfetadoId] = useState('');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(readPageSizeAuditoria);
  /** Força nova busca ao aplicar filtro mesmo permanecendo na página 0. */
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [data, setData] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [exportando, setExportando] = useState(false);

  const usuarios = useMemo(() => getUsuariosAtivos() ?? [], []);

  const filtrosApi = useMemo(
    () => ({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      usuarioId: usuarioId || undefined,
      modulo: modulo || undefined,
      tipoAcao: tipoAcao || undefined,
      registroAfetadoId: registroAfetadoId || undefined,
      q: buscaAplicada.trim() || undefined,
    }),
    [dataInicio, dataFim, usuarioId, modulo, tipoAcao, registroAfetadoId, buscaAplicada]
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await listarAtividadesAuditoria({ ...filtrosApi, page, size });
      setData(res);
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar o relatório. Verifique se o backend está em execução.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filtrosApi, page, size]);

  useEffect(() => {
    carregar();
  }, [carregar, reloadKey]);

  const totalPages = Math.max(0, data?.totalPages ?? 0);
  const totalElements = data?.totalElements ?? 0;
  const content = data?.content ?? [];

  const persistPageSizeAuditoria = (n) => {
    const v = [10, 20, 25, 50, 100].includes(n) ? n : 20;
    try {
      localStorage.setItem(LS_PAGE_SIZE_AUDITORIA, String(v));
    } catch {
      /* ignore */
    }
    setSize(v);
    setPage(0);
    setReloadKey((k) => k + 1);
  };

  function handleBuscar(e) {
    e?.preventDefault?.();
    setBuscaAplicada(buscaTexto);
    setPage(0);
    setReloadKey((k) => k + 1);
  }

  async function exportarCsv() {
    setExportando(true);
    setErro(null);
    try {
      const linhas = await coletarExportacao(filtrosApi, 2000);
      const cols = [
        'id',
        'dataBr',
        'horaBr',
        'usuarioNome',
        'usuarioId',
        'modulo',
        'tela',
        'tipoAcao',
        'descricao',
        'registroAfetadoId',
        'registroAfetadoNome',
        'ipOrigem',
        'observacoesTecnicas',
      ];
      const header = cols.join(';');
      const body = linhas
        .map((r) => cols.map((c) => escCsv(r[c])).join(';'))
        .join('\r\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + header + '\r\n' + body], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `auditoria-atividades-${hoje}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErro(e?.message || 'Falha ao exportar CSV.');
    } finally {
      setExportando(false);
    }
  }

  async function exportarPdf() {
    setExportando(true);
    setErro(null);
    try {
      const linhas = await coletarExportacao(filtrosApi, 500);
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(11);
      doc.text('Relatório de atividades / auditoria', 40, 36);
      doc.setFontSize(8);
      doc.text(`Gerado em ${hoje} — até 500 linhas neste arquivo`, 40, 52);
      const tableRows = linhas.map((r) => [
        r.id,
        `${r.dataBr ?? ''} ${r.horaBr ?? ''}`,
        r.usuarioNome ?? '',
        r.modulo ?? '',
        r.tipoAcao ?? '',
        (r.descricao ?? '').slice(0, 120) + ((r.descricao?.length ?? 0) > 120 ? '…' : ''),
        r.registroAfetadoId ?? '',
      ]);
      autoTable(doc, {
        startY: 64,
        head: [['ID', 'Data/hora', 'Usuário', 'Módulo', 'Ação', 'Descrição (resumo)', 'Reg. ID']],
        body: tableRows,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85] },
      });
      doc.save(`auditoria-atividades-${hoje}.pdf`);
    } catch (e) {
      setErro(e?.message || 'Falha ao exportar PDF.');
    } finally {
      setExportando(false);
    }
  }

  const inputCls =
    'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-800';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 p-4">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 p-5">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 bg-clip-text text-transparent">
            Relatório de atividades
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Histórico persistido no banco de dados (auditoria). Use os filtros e exporte para planilha (CSV compatível
            com Excel) ou PDF.
          </p>
        </div>

        <form
          onSubmit={handleBuscar}
          className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Período inicial</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Período final</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Usuário</label>
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.apelido || u.nome || u.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Módulo</label>
            <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {MODULOS_PERMISSAO.map((m) => (
                <option key={m.id} value={m.label}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Tipo de ação</label>
            <select value={tipoAcao} onChange={(e) => setTipoAcao(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {TIPOS_ACAO_AUDITORIA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-0.5">ID / código do registro</label>
            <input
              type="text"
              value={registroAfetadoId}
              onChange={(e) => setRegistroAfetadoId(e.target.value)}
              className={inputCls}
              placeholder="Ex.: 64 ou 00000001"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-0.5">Pesquisa textual</label>
            <div className="flex gap-2">
              <input
                type="search"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className={`${inputCls} flex-1`}
                placeholder="Busca em descrição, nome do registro, usuário, tela…"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 shrink-0"
              >
                <Search className="w-4 h-4" />
                Filtrar
              </button>
            </div>
          </div>
        </form>

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">{erro}</div>
        )}

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-600">
              {data != null ? (
                <>
                  <span className="font-semibold text-slate-800">{data.totalElements ?? 0}</span> registro(s) — página{' '}
                  <span className="font-mono">{(data.number ?? 0) + 1}</span> /{' '}
                  <span className="font-mono">{Math.max(1, totalPages)}</span>
                </>
              ) : (
                '—'
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={exportando}
                onClick={exportarCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Excel (CSV)
              </button>
              <button
                type="button"
                disabled={exportando}
                onClick={exportarPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 border-b border-slate-200 w-28">Data</th>
                  <th className="px-3 py-2 border-b border-slate-200 w-24">Hora</th>
                  <th className="px-3 py-2 border-b border-slate-200">Usuário</th>
                  <th className="px-3 py-2 border-b border-slate-200">Módulo</th>
                  <th className="px-3 py-2 border-b border-slate-200 w-36">Ação</th>
                  <th className="px-3 py-2 border-b border-slate-200">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin inline-block mr-2 align-middle" />
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading &&
                  content.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer"
                      onClick={() => setDetalhe(row)}
                    >
                      <td className="px-3 py-2 text-slate-800 whitespace-nowrap">{row.dataBr}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-xs whitespace-nowrap">{row.horaBr}</td>
                      <td className="px-3 py-2 text-slate-800">{row.usuarioNome}</td>
                      <td className="px-3 py-2 text-slate-700">{row.modulo}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{row.tipoAcao}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-md truncate" title={row.descricao}>
                        {row.descricao}
                      </td>
                    </tr>
                  ))}
                {!loading && content.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={size}
            onPageChange={setPage}
            onPageSizeChange={persistPageSizeAuditoria}
            loading={loading}
            idPrefix="auditoria-atividades"
          />
        </div>
      </div>

      {detalhe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 ring-1 ring-indigo-500/10 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-800">Detalhe do log #{detalhe.id}</h2>
              <button
                type="button"
                onClick={() => setDetalhe(null)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Fechar
              </button>
            </div>
            <dl className="px-4 py-3 text-sm space-y-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Data / hora</dt>
                <dd className="text-slate-800">
                  {detalhe.dataBr} {detalhe.horaBr} ({detalhe.ocorridoEm})
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Usuário</dt>
                <dd className="text-slate-800">
                  {detalhe.usuarioNome} <span className="text-slate-500 font-mono text-xs">({detalhe.usuarioId})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Módulo / tela</dt>
                <dd className="text-slate-800">
                  {detalhe.modulo} — {detalhe.tela || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Tipo de ação</dt>
                <dd className="text-slate-800">{detalhe.tipoAcao}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Descrição</dt>
                <dd className="text-slate-800 whitespace-pre-wrap">{detalhe.descricao}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Registro afetado</dt>
                <dd className="text-slate-800">
                  {detalhe.registroAfetadoNome || '—'}{' '}
                  <span className="font-mono text-xs text-slate-600">id: {detalhe.registroAfetadoId || '—'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">IP / origem</dt>
                <dd className="text-slate-800 font-mono text-xs">{detalhe.ipOrigem || '—'}</dd>
              </div>
              {detalhe.observacoesTecnicas && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Obs. técnicas</dt>
                  <dd className="text-slate-700 text-xs whitespace-pre-wrap">{detalhe.observacoesTecnicas}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
