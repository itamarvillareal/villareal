import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { featureFlags } from '../config/featureFlags.js';
import { carregarRelatorioResultadoProcessos } from '../data/relatorioResultadoProcessosDados.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { ResultadoFinanceiroSubmenu } from './resultado-financeiro/ResultadoFinanceiroSubmenu.jsx';

function fmtReais(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const btnPrimario =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20';

export function RelatorioResultadoProcessos() {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [gerado, setGerado] = useState(false);
  const [apenasComLancamentos, setApenasComLancamentos] = useState(true);
  const [ultimaCarga, setUltimaCarga] = useState(null);

  const totais = useMemo(() => {
    return linhas.reduce(
      (acc, l) => ({
        lucro: acc.lucro + (Number(l.lucroProcesso) || 0),
        entrada: acc.entrada + (Number(l.totalEntrada) || 0),
        pagamento: acc.pagamento + (Number(l.totalPagamento) || 0),
      }),
      { lucro: 0, entrada: 0, pagamento: 0 },
    );
  }, [linhas]);

  const executarRelatorio = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const r = await carregarRelatorioResultadoProcessos({ apenasComLancamentos });
      if (!r.ok) {
        setLinhas([]);
        setGerado(false);
        setErro(r.motivo || 'Não foi possível gerar o relatório.');
        return;
      }
      setLinhas(r.linhas);
      setGerado(true);
      setUltimaCarga(r.ultimaCarga);
    } catch (e) {
      setLinhas([]);
      setGerado(false);
      setErro(e?.message || 'Falha ao gerar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, [apenasComLancamentos]);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/30 to-emerald-50/40 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 sm:p-6">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <ResultadoFinanceiroSubmenu />

        <header className="flex flex-wrap items-start gap-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 p-2.5 text-white shadow-lg shadow-indigo-500/25">
            <CircleDollarSign className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Resultado financeiro</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Visão consolidada de <strong>todos os processos</strong> — lucro nos autos (Conta Corrente por Cod. cliente + Proc.).
            </p>
          </div>
        </header>

        <div className="bg-white/95 dark:bg-slate-900/95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Resultado nos autos</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Consolida lançamentos da Conta Corrente (mesmo Cod. cliente + Proc.) classificados como entrada,
            pagamento/repasse e despesa. O <strong>lucro do processo</strong> é a soma algébrica desses lançamentos
            (ex.: depósito judicial menos PIX de repasse). Quando a remuneração é percentual sobre proveito, este
            resultado depende do que entra nos autos e é <strong>imprevisível</strong> — use a aba{' '}
            <strong>Cobrança de honorários</strong> para acompanhar parcelas fixas contratadas. Classifique os papéis
            na Conta Corrente em Processos ou use tags{' '}
            <code className="text-xs">[CC_PROC:ENTRADA]</code> / <code className="text-xs">[CC_PROC:PAGAMENTO]</code> no
            Financeiro.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={apenasComLancamentos}
              onChange={(e) => setApenasComLancamentos(e.target.checked)}
            />
            Apenas processos com lançamentos no extrato
          </label>
          <button type="button" className={btnPrimario} disabled={carregando} onClick={() => void executarRelatorio()}>
            {carregando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Gerar relatório
              </>
            )}
          </button>
          {!featureFlags.useApiFinanceiro ? (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              API financeira desativada — usa extratos gravados neste navegador.
            </p>
          ) : null}
          {erro ? <p className="text-sm text-red-700 dark:text-red-300">{erro}</p> : null}
          {gerado && ultimaCarga ? (
            <p className="text-xs text-slate-500">
              {linhas.length} processo(s) · Lucro total {fmtReais(totais.lucro)} · Entradas {fmtReais(totais.entrada)} ·
              Pagamentos {fmtReais(totais.pagamento)}
            </p>
          ) : null}
        </div>

        {gerado ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-sm border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Cod.</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Proc.</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Cliente</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Lanç.</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Entrada</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Pagamento</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Despesa</th>
                  <th className="px-3 py-2 font-semibold text-teal-800 dark:text-teal-200 text-right">Lucro proc.</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 text-right">Lucro mês</th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Nº vínculos</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                      Nenhum processo com os filtros escolhidos.
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    <tr
                      key={`${l.codCliente}-${l.proc}`}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer"
                      title="Duplo clique: abrir processo"
                      onDoubleClick={() =>
                        navigate('/processos', {
                          state: buildRouterStateChaveClienteProcesso(l.codCliente, l.proc),
                        })
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">{l.codCliente}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.proc}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{l.cliente}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.qtdLancamentos}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-800">{fmtReais(l.totalEntrada)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-orange-800">{fmtReais(l.totalPagamento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtReais(l.totalDespesa)}</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-semibold ${
                          l.lucroProcesso >= 0 ? 'text-teal-800' : 'text-red-700'
                        }`}
                      >
                        {fmtReais(l.lucroProcesso)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {fmtReais(l.lucroMesAtual)}
                        <span className="block text-[10px] text-slate-400">{l.mesReferenciaLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-600">{l.qtdVinculos || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
