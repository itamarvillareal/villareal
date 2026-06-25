import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, TrendingUp, Upload } from 'lucide-react';
import {
  importarInvestimentoMovimentacaoApi,
  listarInvestimentoOperacoesApi,
  listarInvestimentoImportsApi,
  obterInvestimentoResumoApi,
  recalcularInvestimentosApi,
} from '../../../repositories/financeiroRepository.js';
import { buildExtratoUrlParaLancamento } from '../extrato/extratoDeepLink.js';
import { useFinanceiroChrome } from '../FinanceiroContext.jsx';
import { Pagination } from '../shared/Pagination.jsx';
import { formatDataBrCompleta } from '../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';

function fmtPctTaxa(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${(Number(v) * 100).toFixed(2)}% a.m.`;
}

function fmtMoeda(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusLabel(s) {
  if (s === 'FECHADA') return 'Encerrada';
  if (s === 'ABERTA') return 'Em carteira';
  if (s === 'LEGADO') return 'Venda sem compra';
  return s ?? '—';
}

function statusHint(s) {
  if (s === 'FECHADA') return 'Compra e venda/vencimento identificados no extrato';
  if (s === 'ABERTA') return 'Compra feita; ainda não houve resgate/vencimento no período importado';
  if (s === 'LEGADO') return 'Venda no extrato sem compra correspondente no histórico BTG importado';
  return '';
}

function ExtratoLancamentoLink({ lancamentoId, numeroBanco, data, valor, rotulo }) {
  const id = Number(lancamentoId);
  if (!Number.isFinite(id) || id <= 0) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <Link
      to={buildExtratoUrlParaLancamento({ lancamentoId: id, numeroBanco, data })}
      title={`Abrir ${rotulo} no extrato (#${id})`}
      className="inline-flex flex-col gap-0.5 text-indigo-700 dark:text-indigo-300 hover:underline"
    >
      <span className="inline-flex items-center gap-1 font-medium">
        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
        {rotulo}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{fmtMoeda(valor)}</span>
    </Link>
  );
}

export function InvestimentosPage() {
  const { bancos } = useFinanceiroChrome();
  const toast = useFinanceiroToast();
  const contasInvestimento = useMemo(
    () => (bancos ?? []).filter((b) => [21, 27, 28].includes(Number(b.numero))),
    [bancos],
  );

  const [numeroBanco, setNumeroBanco] = useState('');
  const [page, setPage] = useState(0);
  const [operacoes, setOperacoes] = useState({ content: [], totalElements: 0, totalPages: 0 });
  const [resumo, setResumo] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [somenteComTaxa, setSomenteComTaxa] = useState(false);
  const pageSize = 30;

  const nb = numeroBanco ? Number(numeroBanco) : null;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, res, imp] = await Promise.all([
        listarInvestimentoOperacoesApi({ numeroBanco: nb, somenteComTaxa, page, size: pageSize }),
        obterInvestimentoResumoApi(nb),
        listarInvestimentoImportsApi(nb),
      ]);
      setOperacoes(ops);
      setResumo(res);
      setImports(imp);
    } catch (e) {
      toast.error(e.message || 'Erro ao carregar investimentos');
    } finally {
      setLoading(false);
    }
  }, [nb, page, somenteComTaxa, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const r = await importarInvestimentoMovimentacaoApi(file, nb ?? undefined);
      toast.success(`Importado: ${r.arquivoNome} → ${r.bancoNome} (${r.linhasCdb} ops)`);
      await carregar();
    } catch (err) {
      toast.error(err.message || 'Falha no import');
    } finally {
      setUploading(false);
    }
  }

  async function onRecalcular() {
    if (!nb) {
      toast.error('Selecione uma conta');
      return;
    }
    try {
      await recalcularInvestimentosApi({ numeroBanco: nb });
      toast.success('Operações recalculadas');
      await carregar();
    } catch (e) {
      toast.error(e.message || 'Erro ao recalcular');
    }
  }

  return (
    <div className="min-h-0 h-full overflow-y-auto overscroll-y-contain p-4 space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Investimentos BTG
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cada linha é um flip CDB/LCA/LCI: compra e venda/vencimento cruzados com o extrato bancário.
            Clique nos links para abrir o lançamento no extrato.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 bg-white dark:bg-slate-900"
            value={numeroBanco}
            onChange={(ev) => {
              setNumeroBanco(ev.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas contas BTG</option>
            {contasInvestimento.map((c) => (
              <option key={c.numero} value={String(c.numero)}>
                {c.nome} ({c.numero})
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4" />
            {uploading ? 'Enviando…' : 'Importar xlsx'}
            <input type="file" accept=".xlsx" className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
          <button
            type="button"
            onClick={onRecalcular}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Recalcular
          </button>
        </div>
      </div>

      {resumo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Mediana taxa a.m. líq." value={fmtPctTaxa(resumo.medianaTaxaMensalLiquida)} />
          <Kpi label="Ops fechadas c/ taxa" value={String(resumo.operacoesFechadasComTaxa)} />
          <Kpi label="Posições abertas" value={String(resumo.operacoesAbertas)} />
          <Kpi label="Volume aberto" value={fmtMoeda(resumo.volumeAberto)} />
        </div>
      ) : null}

      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={somenteComTaxa}
            onChange={(ev) => {
              setSomenteComTaxa(ev.target.checked);
              setPage(0);
            }}
          />
          Só operações com taxa calculada
        </label>
        {loading ? <span className="text-slate-400">Carregando…</span> : null}
        <span className="text-slate-400 text-xs hidden sm:inline">
          · Em carteira = comprado, aguardando resgate · Encerrada = vendido ou vencido · Venda sem compra = histórico
          incompleto no xlsx
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2 whitespace-nowrap">Dt. compra</th>
              <th className="px-3 py-2 whitespace-nowrap">Dt. venda</th>
              <th className="px-3 py-2">Compra (extrato)</th>
              <th className="px-3 py-2">Venda / venc. (extrato)</th>
              <th className="px-3 py-2">Dias</th>
              <th className="px-3 py-2">Taxa a.m. líq.</th>
              <th className="px-3 py-2">Lucro líq.</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(operacoes.content ?? []).map((op) => (
              <tr key={op.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                <td className="px-3 py-2 font-mono text-xs">{op.codigoProduto}</td>
                <td className="px-3 py-2 text-xs">{op.tipoProduto ?? '—'}</td>
                <td className="px-3 py-2">{op.bancoNome}</td>
                <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                  {op.dataCompra ? formatDataBrCompleta(op.dataCompra) : '—'}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                  {op.status === 'ABERTA' ? (
                    <span className="text-amber-700 dark:text-amber-400">—</span>
                  ) : op.dataVenda ? (
                    formatDataBrCompleta(op.dataVenda)
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  <ExtratoLancamentoLink
                    lancamentoId={op.compraLancamentoId}
                    numeroBanco={op.numeroBanco}
                    data={op.dataCompra}
                    valor={op.valorCompraCaixa}
                    rotulo="Compra"
                  />
                </td>
                <td className="px-3 py-2">
                  {op.status === 'ABERTA' ? (
                    <span className="text-xs text-amber-700 dark:text-amber-400">Em carteira</span>
                  ) : (
                    <ExtratoLancamentoLink
                      lancamentoId={op.vendaLancamentoId}
                      numeroBanco={op.numeroBanco}
                      data={op.dataVenda}
                      valor={op.valorVendaCaixa}
                      rotulo="Venda"
                    />
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{op.diasCarteira ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                  {fmtPctTaxa(op.taxaMensalLiquida)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {fmtMoeda(op.lucroLiquido)}
                  {op.status === 'FECHADA' && (op.valorIrrf != null || op.valorIof != null) ? (
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      IRRF {fmtMoeda(op.valorIrrf)} · IOF {fmtMoeda(op.valorIof)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs" title={statusHint(op.status)}>
                    {statusLabel(op.status)}
                  </span>
                  {op.vinculoConfianca === 'BAIXA' ? (
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      vínculo fraco
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && !(operacoes.content ?? []).length ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                  Nenhuma operação. Importe um export de Movimentação BTG (.xlsx).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={operacoes.totalPages ?? 0}
        totalItems={operacoes.totalElements ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {imports.length ? (
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium text-slate-600 dark:text-slate-300">Últimos imports</p>
          {imports.slice(0, 5).map((i) => (
            <p key={i.id}>
              {i.arquivoNome} — {i.bancoNome} — {i.periodoInicio} a {i.periodoFim} ({i.linhasCdb} ops,{' '}
              {i.linhasVinculadas} vinculadas)
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
      <p className="text-lg font-medium tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

export default InvestimentosPage;
