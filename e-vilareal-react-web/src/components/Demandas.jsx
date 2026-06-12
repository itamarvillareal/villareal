import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import { formatBRL } from '../data/relatorioCalculosData.js';
import { listarImoveisApi } from '../repositories/imoveisRepository.js';
import {
  criarDemanda,
  editarDemanda,
  fetchDemandas,
  fetchMetricasDemandas,
} from '../repositories/demandasRepository.js';
import { imoveisBtnPrimary, imoveisInputClass, unidadeResumoCabecalho } from './imoveis/ImoveisAdminLayout.jsx';
import { DemandaAcertoModal } from './demandas/DemandaAcertoModal.jsx';
import { DemandaDetailModal } from './demandas/DemandaDetailModal.jsx';
import { DemandaFormModal } from './demandas/DemandaFormModal.jsx';
import {
  DEMANDA_CATEGORIAS_OPTS,
  DEMANDA_STATUS_OPTS,
  badgeStatus,
  demandaVencida,
  labelCategoria,
  labelStatus,
} from './demandas/demandasConstants.js';

function labelImovelDemanda(im) {
  const titulo = String(im?.titulo ?? '').trim();
  if (titulo) return titulo;
  const resumo = unidadeResumoCabecalho(im?.unidade, im?.condominio);
  if (resumo !== 'Unidade não informada') return resumo;
  return `Imóvel ${im?.id ?? '—'}`;
}

function fmtData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export function Demandas() {
  const [imoveis, setImoveis] = useState([]);
  const [demandas, setDemandas] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editInitial, setEditInitial] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [acertoImovelId, setAcertoImovelId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const q = {
        imovelId: filtroImovel || undefined,
        status: filtroStatus || undefined,
        categoria: filtroCategoria || undefined,
        busca: busca.trim() || undefined,
      };
      const [list, met, imv] = await Promise.all([
        fetchDemandas(q),
        fetchMetricasDemandas({ imovelId: filtroImovel || undefined }),
        listarImoveisApi(),
      ]);
      setDemandas(Array.isArray(list) ? list : []);
      setMetricas(met);
      setImoveis(Array.isArray(imv) ? imv : []);
    } catch (e) {
      console.error(e);
      setDemandas([]);
    } finally {
      setLoading(false);
    }
  }, [filtroImovel, filtroStatus, filtroCategoria, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const cardsFiltrados = useMemo(() => demandas, [demandas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-violet-50/40 to-indigo-50/50 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg">
              <LayoutGrid className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold">Demandas de imóveis</h1>
              <p className="text-xs text-slate-500">Controle de ocorrências e conciliação financeira</p>
            </div>
          </div>
          <button type="button" className={imoveisBtnPrimary} onClick={() => { setEditInitial(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4" /> Nova demanda
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Cards ativos" value={metricas?.cardsAtivos ?? '—'} tone="blue" />
          <MetricCard label="Total valores" value={metricas ? formatBRL(Number(metricas.totalValores ?? 0)) : '—'} tone="green" />
          <MetricCard label="Reembolso pendente" value={metricas ? formatBRL(Number(metricas.reembolsoPendente ?? 0)) : '—'} tone="amber" />
          <MetricCard label="Vencidos" value={metricas?.vencidos ?? '—'} tone="red" />
        </div>

        <div className="flex flex-wrap gap-3 items-end bg-white/80 dark:bg-[#141c2c]/80 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <label className="text-sm min-w-[140px] flex-1">
            <span className="text-slate-500 block mb-1">Imóvel</span>
            <select className={imoveisInputClass} value={filtroImovel} onChange={(e) => setFiltroImovel(e.target.value)}>
              <option value="">Todos os imóveis</option>
              {imoveis.map((im) => (
                <option key={im.id} value={im.id}>
                  {labelImovelDemanda(im)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm min-w-[120px]">
            <span className="text-slate-500 block mb-1">Status</span>
            <select className={imoveisInputClass} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {DEMANDA_STATUS_OPTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm min-w-[120px]">
            <span className="text-slate-500 block mb-1">Categoria</span>
            <select className={imoveisInputClass} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas</option>
              {DEMANDA_CATEGORIAS_OPTS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm flex-1 min-w-[180px]">
            <span className="text-slate-500 block mb-1">Busca</span>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${imoveisInputClass} pl-9`} placeholder="Descrição, condomínio, fornecedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </label>
          {filtroImovel ? (
            <button type="button" className={imoveisBtnPrimary} onClick={() => setAcertoImovelId(filtroImovel)}>
              Acerto do imóvel
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-center text-slate-500 py-12">Carregando…</p>
        ) : cardsFiltrados.length === 0 ? (
          <p className="text-center text-slate-500 py-12">Nenhuma demanda encontrada.</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cardsFiltrados.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDetailId(d.id)}
                className="text-left rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] p-4 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStatus(d.status)}`}>
                    {labelStatus(d.status)}
                  </span>
                  {demandaVencida(d) ? (
                    <span className="text-[10px] font-bold uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Vencido</span>
                  ) : null}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-2">{d.descricao}</h3>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {d.imovelTitulo} — {labelCategoria(d.categoria)}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.pagoPeloEscritorio ? (
                    <span className="text-[10px] bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">Pago escritório</span>
                  ) : null}
                  {d.reembolsavelCliente ? (
                    <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">Reembolsável</span>
                  ) : null}
                  {d.financeiroLancamentoId ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded">Conciliado</span>
                  ) : null}
                </div>
                {d.geraValorContabil ? (
                  <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mt-2">
                    {formatBRL(Number(d.valorEstimado ?? 0))}
                  </p>
                ) : null}
                {d.fornecedorTexto ? <p className="text-xs text-slate-500 mt-1 truncate">{d.fornecedorTexto}</p> : null}
                <p className="text-xs text-slate-400 mt-2">Prazo: {fmtData(d.prazoFinalizacao)}</p>
              </button>
            ))}
          </div>
        )}
      </main>

      <DemandaFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        imoveis={imoveis}
        initial={editInitial}
        onSave={async (body) => {
          if (editInitial?.id) {
            await editarDemanda(editInitial.id, body);
          } else {
            await criarDemanda(body);
          }
          await carregar();
        }}
      />

      <DemandaDetailModal
        demandaId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onEdit={(d) => {
          setDetailId(null);
          setEditInitial(d);
          setFormOpen(true);
        }}
        onRefresh={carregar}
      />

      <DemandaAcertoModal imovelId={acertoImovelId} open={Boolean(acertoImovelId)} onClose={() => setAcertoImovelId(null)} />
    </div>
  );
}

function MetricCard({ label, value, tone }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50/80 dark:bg-blue-500/10',
    green: 'border-emerald-200 bg-emerald-50/80 dark:bg-emerald-500/10',
    amber: 'border-amber-200 bg-amber-50/80 dark:bg-amber-500/10',
    red: 'border-red-200 bg-red-50/80 dark:bg-red-500/10',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] ?? tones.blue}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
