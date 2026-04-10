import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, Building2, Info } from 'lucide-react';
import {
  buildRelatorioFinanceiroImoveisMes,
  classificarLancamentoAdministracaoImovel,
  mesReferenciaDataBr,
  TAG_ADM_ALUGUEL,
  TAG_ADM_REPASSE,
} from '../data/imoveisAdministracaoFinanceiro.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarLancamentosProcessoApiFirst } from '../repositories/financeiroRepository.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function chaveMesDeAnoMes(ano, mes) {
  return `${ano}-${pad2(mes)}`;
}

function labelMesPt(chave) {
  const [y, m] = chave.split('-');
  return `${m}/${y}`;
}

function fmtReais(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BadgeStatus({ tipo }) {
  const map = {
    ok: { cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200', txt: 'No prazo' },
    sem_prazo_cadastrado: {
      cls: 'bg-sky-100 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100',
      txt: 'Sem dia no cadastro',
    },
    atraso: { cls: 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200', txt: 'Fora do prazo' },
    ausente: { cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200', txt: 'Ausente' },
    pendente: { cls: 'bg-amber-100 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100', txt: 'Pendente' },
    aguarda_aluguel: { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', txt: 'Aguarda aluguel' },
    ok_sem_prazo: { cls: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200', txt: 'OK (sem dia)' },
    n_a: { cls: 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500', txt: 'N/A' },
    sem_ref: { cls: 'bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500', txt: '—' },
    '—': { cls: 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-600', txt: '—' },
  };
  const x = map[tipo] || map['—'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${x.cls}`}>{x.txt}</span>
  );
}

export function RelatorioFinanceiroImoveis() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [soOcupados, setSoOcupados] = useState(true);
  const [apiOverrides, setApiOverrides] = useState({});
  const [apiLoading, setApiLoading] = useState(false);
  const [apiErro, setApiErro] = useState('');

  const chaveMes = useMemo(() => chaveMesDeAnoMes(ano, mes), [ano, mes]);
  const linhasBase = useMemo(() => buildRelatorioFinanceiroImoveisMes(chaveMes, { soOcupados }), [chaveMes, soOcupados]);
  const linhas = useMemo(
    () => linhasBase.map((l) => (apiOverrides[l.imovelId] ? { ...l, ...apiOverrides[l.imovelId] } : l)),
    [linhasBase, apiOverrides]
  );

  useEffect(() => {
    let cancelled = false;
    if (!featureFlags.useApiFinanceiro) {
      setApiOverrides({});
      setApiErro('');
      setApiLoading(false);
      return;
    }
    void (async () => {
      try {
        setApiLoading(true);
        setApiErro('');
        const next = {};
        for (const linha of linhasBase) {
          const imovel = linha.codigo != null && linha.proc != null ? { codigo: linha.codigo, proc: linha.proc } : null;
          if (!imovel?.codigo || !imovel?.proc) continue;
          const lancs = await listarLancamentosProcessoApiFirst({
            codigoCliente: String(imovel.codigo).padStart(8, '0'),
            numeroInterno: Number(imovel.proc),
          });
          const doMes = (lancs || []).filter((t) => mesReferenciaDataBr(t.data)?.chave === chaveMes);
          const marcados = doMes.map((t) => ({
            ...t,
            classificacao: classificarLancamentoAdministracaoImovel(t, imovel.codigo, imovel.proc),
          }));
          const aluguel = marcados.find((t) => t.classificacao?.papel === 'aluguel' && Number(t.valor) > 0);
          const repasse = marcados.find((t) => t.classificacao?.papel === 'repasse' && Number(t.valor) < 0);
          next[linha.imovelId] = {
            totalAluguel: marcados
              .filter((t) => t.classificacao?.papel === 'aluguel' && Number(t.valor) > 0)
              .reduce((s, t) => s + Number(t.valor || 0), 0),
            totalRepasse: Math.abs(
              marcados
                .filter((t) => t.classificacao?.papel === 'repasse' && Number(t.valor) < 0)
                .reduce((s, t) => s + Number(t.valor || 0), 0)
            ),
            dataPrimeiroAluguel: aluguel?.data ?? null,
            dataPrimeiroRepasse: repasse?.data ?? null,
          };
        }
        if (!cancelled) setApiOverrides(next);
      } catch (e) {
        if (!cancelled) setApiErro(e?.message || 'Falha ao carregar visão API-first do relatório.');
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chaveMes, linhasBase]);

  const anos = useMemo(() => {
    const y0 = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => y0 - 3 + i);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/40 dark:from-[#0c0f14] dark:via-[#0c0f14] dark:to-[#0c0f14] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#121822]/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm shadow-indigo-500/5 dark:shadow-none">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/imoveis')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Imóveis
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" aria-hidden />
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 dark:ring-white/10">
              <Landmark className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-white dark:to-slate-200 bg-clip-text text-transparent truncate">
                Relatório Financeiro Imóveis
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aluguel e repasse a partir do Financeiro (Cod. cliente + Proc.) × cadastro do imóvel (dias de pagamento e
                repasse)
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c] backdrop-blur-sm p-4 sm:p-5 shadow-xl shadow-indigo-500/5 dark:shadow-none ring-1 ring-indigo-500/10 dark:ring-white/[0.06] space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Mês
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm min-w-[8rem]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              Ano
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm min-w-[7rem]"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pb-0.5">
              <input
                type="checkbox"
                checked={soOcupados}
                onChange={(e) => setSoOcupados(e.target.checked)}
                className="rounded border-slate-300 dark:border-white/20"
              />
              Somente imóveis ocupados
            </label>
            <button
              type="button"
              onClick={() => navigate('/financeiro')}
              className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-sm font-medium text-indigo-900 dark:text-indigo-100 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/50"
            >
              Abrir Financeiro
            </button>
          </div>
          <div className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-black/20 rounded-lg px-3 py-2 border border-slate-100 dark:border-white/[0.06]">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
            <p>
              Os lançamentos são os mesmos da <strong>Conta Corrente</strong> do processo no Financeiro (vínculo{' '}
              <strong>Cod. cliente</strong> + <strong>Proc.</strong> iguais aos do imóvel). Classificação de{' '}
              <strong>aluguel</strong> e <strong>repasse</strong>: use as tags <code className="text-[10px] bg-white dark:bg-black/30 px-1 rounded">{TAG_ADM_ALUGUEL}</code> e{' '}
              <code className="text-[10px] bg-white dark:bg-black/30 px-1 rounded">{TAG_ADM_REPASSE}</code> na descrição/categoria, ou deixe o sistema inferir por texto quando o processo for de administração de imóvel.
            </p>
          </div>
          {featureFlags.useApiFinanceiro ? (
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {apiLoading ? 'Atualizando relatório com dados reais da API...' : 'Relatório em modo API-first parcial (totais e datas por processo).'}
              {apiErro ? <span className="ml-2 text-red-600 dark:text-red-300">{apiErro}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c] backdrop-blur-sm shadow-xl shadow-indigo-500/5 dark:shadow-none ring-1 ring-indigo-500/10 dark:ring-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-gradient-to-r from-indigo-600 to-violet-700 dark:from-[#1e2a45] dark:to-[#2a1f45] flex flex-wrap items-center gap-2">
            <Building2 className="w-4 h-4 text-white/90" />
            <span className="text-sm font-semibold text-white">
              Mês de referência: <span className="text-white/95 font-bold">{labelMesPt(chaveMes)}</span>
            </span>
            <span className="text-xs text-white/80">
              ({linhas.length} imóvel{linhas.length === 1 ? '' : 'es'})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-slate-50/95 dark:bg-black/25 text-left text-xs font-semibold text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.08]">
                  <th className="py-3 px-3 w-12">Nº</th>
                  <th className="py-3 px-3 min-w-[140px]">Unidade</th>
                  <th className="py-3 px-3">Cod.</th>
                  <th className="py-3 px-3">Proc.</th>
                  <th className="py-3 px-3 text-right">Valor loc. ref.</th>
                  <th className="py-3 px-3 text-right">Aluguel (mês)</th>
                  <th className="py-3 px-3">Data aluguel</th>
                  <th className="py-3 px-3">Situação aluguel</th>
                  <th className="py-3 px-3 text-right">Repasse (mês)</th>
                  <th className="py-3 px-3">Data repasse</th>
                  <th className="py-3 px-3">Situação repasse</th>
                  <th className="py-3 px-3 w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
                      Nenhum imóvel neste filtro. Ajuste o mês ou inclua imóveis desocupados.
                    </td>
                  </tr>
                ) : (
                  linhas.map((L) => (
                    <tr
                      key={L.imovelId}
                      className="border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{L.imovelId}</td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-[200px] truncate" title={L.unidade}>
                        {L.unidade || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">{L.codigo}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">{L.proc}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{fmtReais(L.valorReferenciaLocacao)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtReais(L.totalAluguel)}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {L.dataPrimeiroAluguel || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <BadgeStatus tipo={L.statusAluguel} />
                          {L.legendaAluguel ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 leading-tight max-w-[200px]">
                              {L.legendaAluguel}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{fmtReais(L.totalRepasse)}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {L.dataPrimeiroRepasse || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <BadgeStatus tipo={L.statusRepasse} />
                          {L.legendaRepasse ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 leading-tight max-w-[200px]">
                              {L.legendaRepasse}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => navigate('/imoveis', { state: { imovelId: L.imovelId } })}
                            className="text-left text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
                          >
                            Cadastro
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate({ pathname: '/imoveis/financeiro', hash: '#extrato-imoveis', state: { imovelId: L.imovelId } })
                            }
                            className="text-left text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline"
                          >
                            Conta corrente
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
