import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Landmark,
  FolderOpen,
  CircleDollarSign,
  AlertTriangle,
} from 'lucide-react';
import { getImovelMock, getImoveisMockTotal } from '../data/imoveisMockData.js';
import { padCliente } from '../data/processosDadosRelatorio.js';
import {
  gerarAlertasAdministracaoImovel,
  montarPainelAdministracaoImovel,
  nomeContaPorLetra,
  PAPEL_DESPESA_REPASSAR,
  processoEhAdministracaoImovel,
  rotuloPapelAdministracao,
} from '../data/imoveisAdministracaoFinanceiro.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

export function ImoveisAdministracaoFinanceiro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [refreshTick, setRefreshTick] = useState(0);

  const imovelId = useMemo(() => {
    const st = location.state && typeof location.state === 'object' ? location.state : null;
    const fromState = st?.imovelId != null ? Number(st.imovelId) : NaN;
    if (Number.isFinite(fromState) && fromState >= 1) return Math.floor(fromState);
    const q = new URLSearchParams(location.search || '');
    const fromQ = Number(q.get('imovel'));
    if (Number.isFinite(fromQ) && fromQ >= 1) return Math.floor(fromQ);
    return 1;
  }, [location.state, location.search]);

  const mock = useMemo(() => getImovelMock(imovelId), [imovelId, refreshTick]);
  const totalImoveis = getImoveisMockTotal();

  const codigoStr = mock ? String(mock.codigo ?? '').trim() : '';
  const procStr = mock ? String(mock.proc ?? '').trim() : '';
  const vinculoOk = codigoStr !== '' && procStr !== '';

  const painel = useMemo(() => {
    if (!vinculoOk) return null;
    return montarPainelAdministracaoImovel(codigoStr, procStr);
  }, [codigoStr, procStr, refreshTick, vinculoOk]);

  const alertas = useMemo(() => {
    if (!painel || !mock) return [];
    return gerarAlertasAdministracaoImovel(mock, painel.porMes, painel.mesesOrdenados);
  }, [painel, mock]);

  const ehAdm = vinculoOk && processoEhAdministracaoImovel(codigoStr, procStr);

  const recarregar = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (location.hash === '#extrato-imoveis') {
      const el = document.getElementById('extrato-imoveis');
      if (el) window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash, painel]);

  return (
    <div className="min-h-full bg-slate-200 p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/imoveis', { state: { imovelId } })}
              className="p-2 rounded-lg border border-slate-400 bg-white text-slate-600 hover:bg-slate-100 shrink-0 mt-0.5"
              aria-label="Voltar ao cadastro do imóvel"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Landmark className="w-6 h-6 text-teal-700 shrink-0" aria-hidden />
                Financeiro da locação
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Movimentações são as mesmas da <strong>Conta Corrente</strong> em Processos e do módulo{' '}
                <strong>Financeiro</strong> (Cod. cliente + Proc.). A remuneração do escritório é calculada aqui; não há
                lançamento explícito só para isso no extrato.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={recarregar}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
              Atualizar extrato
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/processos', {
                  state: { codCliente: padCliente(codigoStr || '1'), proc: procStr || '1' },
                })
              }
              disabled={!vinculoOk}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4" aria-hidden />
              Abrir Processos
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/financeiro', {
                  state: {
                    financeiroConciliacaoHonorarios: {
                      codCliente: padCliente(codigoStr || '1'),
                      proc: procStr || '1',
                      rotulo: `Imóvel ${imovelId}`,
                    },
                  },
                })
              }
              disabled={!vinculoOk}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-emerald-600 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50"
            >
              <CircleDollarSign className="w-4 h-4" aria-hidden />
              Abrir Financeiro
            </button>
          </div>
        </div>

        {!mock && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            Imóvel <strong>{imovelId}</strong> sem cadastro mock (use 1 a {totalImoveis}).{' '}
            <button type="button" className="underline font-medium" onClick={() => navigate('/imoveis')}>
              Voltar
            </button>
          </div>
        )}

        {mock && (
          <>
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-800">Vínculo obrigatório (cliente + processo)</p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <span>
                  <span className="text-slate-500">Nº imóvel:</span>{' '}
                  <strong className="tabular-nums">{imovelId}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Cod. cliente (locador):</span>{' '}
                  <strong className="font-mono">{vinculoOk ? padCliente(codigoStr) : '—'}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Proc.:</span>{' '}
                  <strong className="tabular-nums">{vinculoOk ? procStr : '—'}</strong>
                </span>
                <span>
                  <span className="text-slate-500">Unidade:</span> <strong>{mock.unidade}</strong>
                </span>
              </div>
              {!vinculoOk && (
                <p className="text-sm text-red-700">
                  Preencha <strong>Código</strong> e <strong>Proc.</strong> no cadastro do imóvel para liberar o financeiro
                  da locação.
                </p>
              )}
              {ehAdm && (
                <p className="text-xs text-teal-800 bg-teal-50 border border-teal-100 rounded px-2 py-1.5">
                  Processo reconhecido como <strong>administração de imóvel</strong> (par cadastro + mock). Despesas com
                  tag <code className="text-[11px]">[ADM_IMOVEL:DESPESA_REPASSAR]</code> ou classificação compatível são
                  destacadas para desconto no repasse ao locador.
                </p>
              )}
            </div>

            {!vinculoOk ? null : (
              <>
                {alertas.length > 0 && (
                  <div
                    className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 space-y-2"
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                      Alertas (conta corrente vinculada)
                    </p>
                    <ul className="list-disc pl-5 text-sm text-amber-950 space-y-1">
                      {alertas.map((a, i) => (
                        <li key={`${a.tipo}-${a.mes}-${i}`}>{a.texto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
                  <h2 className="text-sm font-semibold text-slate-800 mb-3">Consolidação mensal</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Valores derivados dos lançamentos do Financeiro. <strong>Remuneração do escritório</strong> = líquido
                    após despesas − repasse efetivo ao locador (não aparece como linha separada no extrato).
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead>
                        <tr>
                          <th className={th}>Mês</th>
                          <th className={`${th} text-right`}>Recebido (inquilino)</th>
                          <th className={`${th} text-right`}>Despesas (repassar)</th>
                          <th className={`${th} text-right`}>Líquido após despesas</th>
                          <th className={`${th} text-right`}>Repasse ao locador</th>
                          <th className={`${th} text-right`}>Remuneração escritório</th>
                        </tr>
                      </thead>
                      <tbody>
                        {painel.mesesOrdenados.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={`${td} text-slate-500 text-center py-6`}>
                              Nenhum lançamento com este Cod. cliente e Proc. no extrato. Inclua ou vincule lançamentos no
                              Financeiro.
                            </td>
                          </tr>
                        ) : (
                          painel.mesesOrdenados.map((chave) => {
                            const row = painel.porMes.get(chave);
                            return (
                              <tr key={chave}>
                                <td className={`${td} font-medium`}>{row.label}</td>
                                <td className={`${td} text-right tabular-nums`}>{formatBRL(row.totalRecebido)}</td>
                                <td className={`${td} text-right tabular-nums text-orange-800`}>
                                  {formatBRL(row.totalDespesasRepassar)}
                                </td>
                                <td className={`${td} text-right tabular-nums`}>{formatBRL(row.liquidoAposDespesas)}</td>
                                <td className={`${td} text-right tabular-nums text-slate-800`}>
                                  {formatBRL(row.totalRepasse)}
                                </td>
                                <td className={`${td} text-right tabular-nums font-medium text-teal-800`}>
                                  {formatBRL(row.remuneracaoEscritorio)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div id="extrato-imoveis" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 scroll-mt-4">
                  <h2 className="text-sm font-semibold text-slate-800 mb-1">Conta corrente do imóvel</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Lista espelhada do Financeiro (todos os lançamentos com o mesmo Cod. cliente e Proc.). Despesas a
                    descontar do repasse aparecem com destaque.
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse min-w-[960px]">
                      <thead>
                        <tr>
                          <th className={th}>Data</th>
                          <th className={th}>Banco</th>
                          <th className={th}>Conta contábil</th>
                          <th className={th}>Descrição</th>
                          <th className={th}>Detalhe / classificação</th>
                          <th className={`${th} text-right`}>Valor</th>
                          <th className={th}>Papel (locação)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {painel.transacoes.length === 0 ? (
                          <tr>
                            <td colSpan={7} className={`${td} text-slate-500 text-center py-6`}>
                              Sem movimentações vinculadas.
                            </td>
                          </tr>
                        ) : (
                          painel.transacoes.map((t, idx) => {
                            const { papel, despesaRepassarAoLocador } = t.classificacao;
                            const isDesp = papel === PAPEL_DESPESA_REPASSAR || despesaRepassarAoLocador;
                            const rowClass = isDesp ? 'bg-orange-50/80' : '';
                            return (
                              <tr key={`${t.nomeBanco}-${t.numero}-${t.data}-${idx}`} className={rowClass}>
                                <td className={`${td} tabular-nums whitespace-nowrap`}>{t.data}</td>
                                <td className={td}>{t.nomeBanco}</td>
                                <td className={`${td} text-xs`}>{nomeContaPorLetra(t.letra)}</td>
                                <td className={td}>{t.descricao}</td>
                                <td className={`${td} text-xs max-w-[220px]`}>
                                  {t.descricaoDetalhada || t.categoria || '—'}
                                </td>
                                <td className={`${td} text-right tabular-nums font-medium`}>
                                  {formatBRL(t.valor)}
                                </td>
                                <td className={td}>
                                  <span
                                    className={`inline-flex flex-col gap-0.5 text-xs ${
                                      isDesp ? 'text-orange-900 font-semibold' : 'text-slate-700'
                                    }`}
                                  >
                                    {rotuloPapelAdministracao(papel)}
                                    {isDesp && (
                                      <span className="text-[10px] font-normal uppercase tracking-wide text-orange-800">
                                        Despesa a repassar ao locador
                                      </span>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
