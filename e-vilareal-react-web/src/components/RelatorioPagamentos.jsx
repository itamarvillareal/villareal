import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, FileSpreadsheet, Loader2, Printer, Search } from 'lucide-react';
import { formatBRL } from '../data/relatorioCalculosData.js';
import { listarClientesIndiceCadastro } from '../repositories/clientesRepository.js';
import { listarImoveisApi } from '../repositories/imoveisRepository.js';
import {
  buscarComparativoMensal,
  buscarEficiencia,
  buscarGastosPorImovel,
  buscarLucratividade,
  buscarPendencias,
} from '../repositories/relatoriosPagamentosRepository.js';
import {
  CATEGORIAS_PAGAMENTO,
  corCategoriaChart,
} from './pagamentos/pagamentosUiUtils.js';

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

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtDias(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v).toFixed(1)} dias`;
}

function celulaMoeda(v) {
  const n = Number(v ?? 0);
  if (Math.abs(n) < 0.005) {
    return <span className="text-slate-400">—</span>;
  }
  return <span className="tabular-nums">{formatBRL(n)}</span>;
}

function exportarCsv(nomeArquivo, headers, rows) {
  const sep = ';';
  const linhas = [headers.join(sep), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep))];
  const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function corMetricaDias(v, verde, amarelo) {
  if (v == null) return 'text-slate-700';
  if (v < verde) return 'text-emerald-700 dark:text-emerald-300';
  if (v <= amarelo) return 'text-amber-700 dark:text-amber-200';
  return 'text-red-700 dark:text-red-300';
}

function corMetricaPct(v, verdeLim, amareloLim) {
  if (v == null) return 'text-slate-700';
  if (v < verdeLim) return 'text-emerald-700 dark:text-emerald-300';
  if (v <= amareloLim) return 'text-amber-700 dark:text-amber-200';
  return 'text-red-700 dark:text-red-300';
}

const ABAS = [
  { id: 'gastos', label: 'Gastos por imóvel' },
  { id: 'comparativo', label: 'Comparativo mensal' },
  { id: 'lucratividade', label: 'Lucratividade' },
  { id: 'eficiencia', label: 'Eficiência' },
  { id: 'pendencias', label: 'Pendências' },
];

export function RelatorioPagamentos() {
  const navigate = useNavigate();
  const [aba, setAba] = useState('gastos');
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaMesIso);
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaMesIso);
  const [imovelId, setImovelId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [categoriasSel, setCategoriasSel] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);

  useEffect(() => {
    Promise.all([listarClientesIndiceCadastro(), listarImoveisApi()])
      .then(([c, i]) => {
        setClientes((c || []).filter((x) => x.clienteId != null));
        setImoveis(Array.isArray(i) ? i : []);
      })
      .catch(() => {});
  }, []);

  const imoveisFiltrados = useMemo(() => {
    if (!clienteId) return imoveis;
    const cid = Number(clienteId);
    return imoveis.filter((im) => {
      const ic = im.clienteId ?? im._apiClienteId;
      return ic != null && Number(ic) === cid;
    });
  }, [imoveis, clienteId]);

  const paramsBase = useCallback(() => {
    const p = { periodoInicio, periodoFim };
    if (clienteId) p.clienteId = Number(clienteId);
    if (categoriasSel.length > 0) p.categorias = categoriasSel;
    return p;
  }, [periodoInicio, periodoFim, clienteId, categoriasSel]);

  const carregarAba = useCallback(async () => {
    setCarregando(true);
    setErro('');
    setDados(null);
    try {
      if (aba === 'pendencias') {
        setDados(await buscarPendencias());
      } else if (aba === 'gastos') {
        setDados(await buscarGastosPorImovel(paramsBase()));
      } else if (aba === 'comparativo') {
        const ano = new Date(periodoInicio).getFullYear();
        const q = { ano };
        const im = imovelId ? Number(imovelId) : null;
        if (im) q.imovelId = im;
        setDados(await buscarComparativoMensal(q));
      } else if (aba === 'lucratividade') {
        setDados(await buscarLucratividade(paramsBase()));
      } else if (aba === 'eficiencia') {
        setDados(await buscarEficiencia(paramsBase()));
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar relatório.');
    } finally {
      setCarregando(false);
    }
  }, [aba, paramsBase, periodoInicio, imovelId]);

  useEffect(() => {
    void carregarAba();
  }, [aba]);

  const anoComparativo = new Date(periodoInicio).getFullYear();

  return (
    <div className="relatorio-pagamentos min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-indigo-50/35 to-slate-50 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 md:p-6 print:bg-white print:p-2">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only-table { display: block !important; }
          .relatorio-pagamentos { background: white !important; }
        }
      `}</style>

      <header className="no-print flex items-center gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg">
          <BarChart3 className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Relatório Pagamentos</h1>
          <p className="text-sm text-slate-500">Desempenho e lucratividade da administração de imóveis</p>
        </div>
      </header>

      {erro ? (
        <div className="no-print mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {erro}
        </div>
      ) : null}

      <section className="no-print rounded-xl border border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/85 p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-end text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Período início</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Período fim</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 min-w-[160px]">
            <span className="text-slate-500">Cliente</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setImovelId('');
              }}
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.clienteId ?? c.id} value={String(c.clienteId ?? c.id)}>
                  {c.codigo} — {c.nomeRazao}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 min-w-[160px]">
            <span className="text-slate-500">Imóvel</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={imovelId}
              onChange={(e) => setImovelId(e.target.value)}
            >
              <option value="">Todos</option>
              {imoveisFiltrados.map((im) => (
                <option key={im.id ?? im._apiImovelId} value={String(im.id ?? im._apiImovelId)}>
                  #{im.numeroPlanilha ?? im.id} {im.condominio ? `— ${String(im.condominio).slice(0, 24)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 min-w-[200px]">
            <span className="text-slate-500">Categorias</span>
            <select
              multiple
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950 min-h-[2.5rem]"
              value={categoriasSel}
              onChange={(e) =>
                setCategoriasSel(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
            >
              {CATEGORIAS_PAGAMENTO.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={carregando}
            onClick={() => void carregarAba()}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Gerar relatório
          </button>
        </div>
      </section>

      <div className="no-print flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              aba === t.id
                ? 'border-indigo-600 text-indigo-800 dark:text-indigo-300'
                : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {aba === 'gastos' && dados ? <AbaGastos data={dados} /> : null}
          {aba === 'comparativo' && dados ? (
            <AbaComparativo data={dados} ano={anoComparativo} />
          ) : null}
          {aba === 'lucratividade' && dados ? <AbaLucratividade data={dados} /> : null}
          {aba === 'eficiencia' && dados ? <AbaEficiencia data={dados} /> : null}
          {aba === 'pendencias' && dados ? (
            <AbaPendencias data={dados} onIrPagamentos={(id, st) => navigate(`/imoveis/pagamentos?imovelId=${id}&status=${st}`)} />
          ) : null}
        </>
      )}
    </div>
  );
}

function AbaGastos({ data }) {
  const cats = data.categoriasPresentes || [];
  const imoveis = data.imoveis || [];
  const totaisCat = {};
  for (const c of cats) totaisCat[c] = 0;
  for (const im of imoveis) {
    for (const c of cats) {
      totaisCat[c] += Number(im.gastosPorCategoria?.[c] ?? 0);
    }
  }

  const chartData = imoveis.map((im) => {
    const row = {
      nome: im.numeroPlanilha || String(im.imovelId),
    };
    for (const c of cats) {
      row[c] = Number(im.gastosPorCategoria?.[c] ?? 0);
    }
    return row;
  });

  function exportCsvClick() {
    const headers = ['Imovel', ...cats, 'Total'];
    const rows = imoveis.map((im) => [
      `${im.numeroPlanilha || im.imovelId}`,
      ...cats.map((c) => String(im.gastosPorCategoria?.[c] ?? 0)),
      String(im.total ?? 0),
    ]);
    rows.push(['TOTAL', ...cats.map((c) => String(totaisCat[c])), String(data.totalGeral ?? 0)]);
    exportarCsv('gastos-por-imovel.csv', headers, rows);
  }

  if (!imoveis.length) {
    return <p className="text-sm text-slate-500 py-8 text-center">Nenhum gasto encontrado no período.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        <button type="button" onClick={exportCsvClick} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-2 text-left">Imóvel</th>
              {cats.map((c) => (
                <th key={c} className="px-2 py-2 text-right">
                  {c}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {imoveis.map((im) => (
              <tr key={im.imovelId} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-1.5">
                  {im.numeroPlanilha}
                  {im.endereco ? <span className="text-slate-500 block truncate max-w-[180px]">{im.endereco}</span> : null}
                </td>
                {cats.map((c) => (
                  <td key={c} className="px-2 py-1.5 text-right">
                    {celulaMoeda(im.gastosPorCategoria?.[c])}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-semibold">{celulaMoeda(im.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold bg-slate-50 dark:bg-slate-800/80">
              <td className="px-2 py-2">Total</td>
              {cats.map((c) => (
                <td key={c} className="px-2 py-2 text-right">
                  {celulaMoeda(totaisCat[c])}
                </td>
              ))}
              <td className="px-2 py-2 text-right">{celulaMoeda(data.totalGeral)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="no-print h-[320px] w-full overflow-x-auto">
        <ResponsiveContainer width={Math.max(600, imoveis.length * 72)} height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Legend />
            {cats.map((c) => (
              <Bar key={c} dataKey={c} stackId="a" fill={corCategoriaChart(c)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AbaComparativo({ data, ano }) {
  const meses = data.meses || [];
  const catsSet = new Set();
  for (const m of meses) {
    Object.keys(m.categorias || {}).forEach((c) => catsSet.add(c));
  }
  const cats = [...catsSet].sort();
  const alertaSet = new Set((data.alertasAnomalia || []).map((a) => `${a.mes}-${a.categoria}`));

  const chartData = meses.map((m) => ({
    mes: m.nomeMes?.slice(0, 3) || m.mes,
    ...Object.fromEntries(cats.map((c) => [c, Number(m.categorias?.[c] ?? 0)])),
  }));

  function exportCsvClick() {
    const headers = ['Categoria', ...meses.map((m) => m.nomeMes || m.mes), 'Total'];
    const rows = cats.map((cat) => {
      let tot = 0;
      const vals = meses.map((m) => {
        const v = Number(m.categorias?.[cat] ?? 0);
        tot += v;
        return String(v);
      });
      return [cat, ...vals, String(tot)];
    });
    exportarCsv(`comparativo-${ano}.csv`, headers, rows);
  }

  if (!meses.some((m) => Number(m.total) > 0)) {
    return <p className="text-sm text-slate-500 py-8 text-center">Sem pagamentos no ano {ano}.</p>;
  }

  return (
    <div className="space-y-4">
      {data.imovel?.numeroPlanilha ? (
        <p className="text-sm text-slate-600">
          Imóvel: <strong>{data.imovel.numeroPlanilha}</strong> — média mensal {formatBRL(Number(data.mediaMensal ?? 0))}
        </p>
      ) : (
        <p className="text-sm text-slate-600">Todos os imóveis — média mensal {formatBRL(Number(data.mediaMensal ?? 0))}</p>
      )}
      <div className="flex justify-end no-print">
        <button type="button" onClick={exportCsvClick} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-2 text-left">Categoria</th>
              {meses.map((m) => (
                <th key={m.mes} className="px-2 py-2 text-right">
                  {(m.nomeMes || '').slice(0, 3)}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => {
              let linhaTot = 0;
              return (
                <tr key={cat} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-2 py-1.5">{cat}</td>
                  {meses.map((m) => {
                    const v = Number(m.categorias?.[cat] ?? 0);
                    linhaTot += v;
                    const anom = alertaSet.has(`${m.mes}-${cat}`);
                    return (
                      <td
                        key={m.mes}
                        className={`px-2 py-1.5 text-right ${anom ? 'bg-amber-100/80 dark:bg-amber-950/40' : ''}`}
                        title={
                          anom
                            ? (data.alertasAnomalia.find((a) => a.mes === m.mes && a.categoria === cat)?.percentualAcima?.toFixed(1) ?? '') +
                              '% acima da média 6m'
                            : undefined
                        }
                      >
                        {celulaMoeda(v)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right font-medium">{celulaMoeda(linhaTot)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 font-bold bg-slate-50 dark:bg-slate-800/80">
              <td className="px-2 py-2">Total</td>
              {meses.map((m) => (
                <td key={m.mes} className="px-2 py-2 text-right">
                  {celulaMoeda(m.total)}
                </td>
              ))}
              <td className="px-2 py-2 text-right" />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="no-print h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => formatBRL(v)} width={90} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Legend />
            {cats.map((c) => (
              <Line key={c} type="monotone" dataKey={c} stroke={corCategoriaChart(c)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AbaLucratividade({ data }) {
  const imoveis = data.imoveis || [];

  function exportCsvClick() {
    exportarCsv('lucratividade.csv', ['Imovel', 'Volume', 'Receita', 'Qtd'], imoveis.map((im) => [
      im.numeroPlanilha || im.imovelId,
      String(im.volumeAdministrado ?? 0),
      String(im.receitaAdministracao ?? 0),
      String(im.qtdPagamentos ?? 0),
    ]));
  }

  if (
    !imoveis.length ||
    (Number(data.totalReceitaAdministracao ?? 0) === 0 && Number(data.totalVolumeAdministrado ?? 0) === 0)
  ) {
    return (
      <p className="text-sm text-slate-600 py-8 text-center max-w-lg mx-auto">
        Nenhuma prestação de contas com taxa encontrada no período. Gere prestações com taxa de administração em{' '}
        <Link to="/imoveis/acerto-cliente" className="text-violet-700 underline font-semibold">
          Acerto com Cliente
        </Link>
        .
      </p>
    );
  }

  const chartData = imoveis.map((im) => ({
    nome: im.numeroPlanilha || String(im.imovelId),
    receita: Number(im.receitaAdministracao ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        <button type="button" onClick={exportCsvClick} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-2 text-left">Imóvel</th>
              <th className="px-2 py-2 text-right">Volume administrado</th>
              <th className="px-2 py-2 text-right">Receita administração</th>
              <th className="px-2 py-2 text-right">Qtd pagamentos</th>
            </tr>
          </thead>
          <tbody>
            {imoveis.map((im) => (
              <tr key={im.imovelId} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-1.5">{im.numeroPlanilha}</td>
                <td className="px-2 py-1.5 text-right">{celulaMoeda(im.volumeAdministrado)}</td>
                <td className="px-2 py-1.5 text-right font-semibold text-emerald-800 dark:text-emerald-300">
                  {celulaMoeda(im.receitaAdministracao)}
                </td>
                <td className="px-2 py-1.5 text-right">{im.qtdPagamentos}</td>
              </tr>
            ))}
            <tr className="border-t-2 font-bold bg-slate-50 dark:bg-slate-800/80">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right">{celulaMoeda(data.totalVolumeAdministrado)}</td>
              <td className="px-2 py-2 text-right">{celulaMoeda(data.totalReceitaAdministracao)}</td>
              <td className="px-2 py-2 text-right" />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="no-print h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => formatBRL(v)} />
            <YAxis type="category" dataKey="nome" width={80} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Bar dataKey="receita" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AbaEficiencia({ data }) {
  const m = data.metricas || {};
  const serie = data.serieMensal || [];

  const cards = [
    {
      label: 'Identificação → agendamento',
      valor: fmtDias(m.tempoMedioIdentificacaoAgendamento),
      cls: corMetricaDias(m.tempoMedioIdentificacaoAgendamento, 3, 7),
    },
    {
      label: 'Agendamento → pagamento',
      valor: fmtDias(m.tempoMedioAgendamentoPagamento),
      cls: corMetricaDias(m.tempoMedioAgendamentoPagamento, 2, 5),
    },
    {
      label: 'Falha bancária',
      valor: fmtPct(m.taxaFalhaBancaria),
      cls: corMetricaPct(m.taxaFalhaBancaria, 0.05, 0.15),
    },
    {
      label: 'Divergência de valor',
      valor: fmtPct(m.taxaDivergenciaValor),
      cls: corMetricaPct(m.taxaDivergenciaValor, 0.1, 0.25),
    },
    {
      label: 'Vencidos',
      valor: fmtPct(m.taxaVencidos),
      cls: corMetricaPct(m.taxaVencidos, 0.05, 0.15),
    },
  ];

  const chartData = serie.map((s) => ({
    mes: s.nomeMes?.slice(0, 3) || s.mes,
    identAg: s.tempoMedioIdentificacaoAgendamento,
    agPag: s.tempoMedioAgendamentoPagamento,
    falha: (s.taxaFalhaBancaria ?? 0) * 100,
    div: (s.taxaDivergenciaValor ?? 0) * 100,
    venc: (s.taxaVencidos ?? 0) * 100,
  }));

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 no-print">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85 p-3">
            <div className="text-[11px] text-slate-500">{c.label}</div>
            <div className={`text-xl font-bold mt-1 ${c.cls}`}>{c.valor}</div>
          </div>
        ))}
      </div>
      <div className="no-print h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis yAxisId="dias" orientation="left" />
            <YAxis yAxisId="pct" orientation="right" unit="%" />
            <Tooltip />
            <Legend />
            <Line yAxisId="dias" type="monotone" dataKey="identAg" name="Id→Ag (dias)" stroke="#6366f1" dot={false} />
            <Line yAxisId="dias" type="monotone" dataKey="agPag" name="Ag→Pg (dias)" stroke="#8b5cf6" dot={false} />
            <Line yAxisId="pct" type="monotone" dataKey="falha" name="Falha %" stroke="#ef4444" dot={false} />
            <Line yAxisId="pct" type="monotone" dataKey="div" name="Diverg %" stroke="#f59e0b" dot={false} />
            <Line yAxisId="pct" type="monotone" dataKey="venc" name="Venc %" stroke="#64748b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function celulaPendencia(pendencias, status) {
  const p = pendencias?.[status];
  if (!p || !p.qtd) return <span className="text-slate-400">—</span>;
  return (
    <span>
      {p.qtd} ({formatBRL(Number(p.valor ?? 0))})
    </span>
  );
}

const STATUS_PAGO_COL = ['PAGO_CONFIRMADO', 'PAGO_SEM_COMPROVANTE', 'CONFERENCIA_PENDENTE'];

function celulaPagoAgregado(pendencias) {
  let qtd = 0;
  let valor = 0;
  let statusLink = '';
  for (const st of STATUS_PAGO_COL) {
    const p = pendencias?.[st];
    if (p?.qtd) {
      qtd += p.qtd;
      valor += Number(p.valor ?? 0);
      if (!statusLink) statusLink = st;
    }
  }
  if (!qtd) return { node: <span className="text-slate-400">—</span>, statusLink: '' };
  return {
    node: (
      <span>
        {qtd} ({formatBRL(valor)})
      </span>
    ),
    statusLink,
  };
}

function CelulaPendenciaLink({ imovelId, status, pendencias, onIrPagamentos }) {
  if (status === '__PAGO__') {
    const agg = celulaPagoAgregado(pendencias);
    if (!agg.statusLink) return agg.node;
    return (
      <button
        type="button"
        className="text-left hover:underline text-indigo-700 dark:text-indigo-300"
        onClick={() => onIrPagamentos(imovelId, agg.statusLink)}
      >
        {agg.node}
      </button>
    );
  }
  const p = pendencias?.[status];
  if (!p?.qtd) return <span className="text-slate-400">—</span>;
  const node = celulaPendencia(pendencias, status);
  if (!imovelId) return node;
  return (
    <button
      type="button"
      className="text-left hover:underline text-indigo-700 dark:text-indigo-300"
      onClick={() => onIrPagamentos(imovelId, status)}
    >
      {node}
    </button>
  );
}

function AbaPendencias({ data, onIrPagamentos }) {
  const resumo = data.resumoGeral || {};
  const imoveis = data.imoveis || [];

  const cards = [
    { key: 'totalPendente', label: 'Pendente', cls: 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' },
    { key: 'totalAgendado', label: 'Agendado', cls: 'border-sky-300 bg-sky-50 dark:bg-sky-950/30' },
    { key: 'totalPago', label: 'Pago (não conf.)', cls: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' },
    { key: 'totalConferido', label: 'Conferido', cls: 'border-violet-300 bg-violet-50 dark:bg-violet-950/30' },
    { key: 'totalGeralAberto', label: 'Total em aberto', cls: 'border-slate-400 bg-slate-100 dark:bg-slate-800 font-bold' },
  ];

  return (
    <div className="space-y-4">
      <p className="no-print text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        Este relatório mostra a situação atual, independente do período selecionado.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {cards.map((c) => {
          const r = resumo[c.key];
          return (
            <div key={c.key} className={`rounded-xl border px-3 py-2 ${c.cls}`}>
              <div className="text-[11px] font-medium">{c.label}</div>
              <div className="text-sm font-bold">
                {r ? `${r.qtd} — ${formatBRL(Number(r.valor ?? 0))}` : '—'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 no-print">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
          <Printer className="w-3.5 h-3.5" /> Imprimir
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85 print-only-table">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-2 text-left">Imóvel</th>
              <th className="px-2 py-2">Pendentes</th>
              <th className="px-2 py-2">Agendados</th>
              <th className="px-2 py-2">Pagos</th>
              <th className="px-2 py-2">Conferidos</th>
              <th className="px-2 py-2 text-right font-bold">Total aberto</th>
            </tr>
          </thead>
          <tbody>
            {imoveis.map((im, idx) => (
              <tr key={im.imovelId ?? `s-${idx}`} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-1.5">{im.numeroPlanilha || '—'}</td>
                <td className="px-2 py-1.5">
                  <CelulaPendenciaLink
                    imovelId={im.imovelId}
                    status="PENDENTE"
                    pendencias={im.pendencias}
                    onIrPagamentos={onIrPagamentos}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CelulaPendenciaLink
                    imovelId={im.imovelId}
                    status="AGENDADO"
                    pendencias={im.pendencias}
                    onIrPagamentos={onIrPagamentos}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CelulaPendenciaLink
                    imovelId={im.imovelId}
                    status="__PAGO__"
                    pendencias={im.pendencias}
                    onIrPagamentos={onIrPagamentos}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <CelulaPendenciaLink
                    imovelId={im.imovelId}
                    status="CONFERIDO"
                    pendencias={im.pendencias}
                    onIrPagamentos={onIrPagamentos}
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-semibold">{celulaMoeda(im.totalAberto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!imoveis.length ? (
        <p className="text-sm text-slate-500 text-center py-6">Nenhuma pendência em aberto.</p>
      ) : null}
    </div>
  );
}
