import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CircleDollarSign, Link2, Loader2, Sparkles, TriangleAlert, Wand2 } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  conciliarAlugueisAutomaticoApi,
  gerarRepassesInternosApi,
  listarRepassesPendentesApi,
  listarSugestoesAlugueisPendentesApi,
  vincularReconciliacaoApi,
} from '../../../repositories/imoveisRepository.js';
import { ImoveisSugestoesVinculoPanel } from '../ImoveisSugestoesVinculoPanel.jsx';
import { useImoveisCentral } from './ImoveisCentralContext.jsx';
import { competenciaLabel, formatBRL } from './imoveisCentralFormat.js';

const th =
  'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-50/90 dark:bg-slate-900/90';
const td =
  'px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 align-middle';

function Secao({ titulo, subtitulo, icone: Icone, acoes, children }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {Icone ? <Icone className="w-4 h-4 text-teal-600 shrink-0" aria-hidden /> : null}
            {titulo}
          </h3>
          {subtitulo ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitulo}</p> : null}
        </div>
        {acoes ? <div className="flex flex-wrap gap-2 shrink-0">{acoes}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Aluguéis do mês: contratos vigentes sem aluguel vinculado + auto-conciliação Cora. */
function SecaoAlugueisDoMes() {
  const navigate = useNavigate();
  const { competencia, itens, carregando, recarregar } = useImoveisCentral();
  const [autoConciliando, setAutoConciliando] = useState(false);
  const [resultadoAuto, setResultadoAuto] = useState(null);
  const [erro, setErro] = useState('');

  const pendentes = useMemo(
    () =>
      itens.filter(
        (it) => it.ocupado && it.contratoId != null && !(Number(it.aluguelRecebido) > 0),
      ),
    [itens],
  );

  async function autoConciliar() {
    setAutoConciliando(true);
    setErro('');
    setResultadoAuto(null);
    try {
      const resp = await conciliarAlugueisAutomaticoApi({ competencia });
      setResultadoAuto(resp);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha na auto-conciliação.');
    } finally {
      setAutoConciliando(false);
    }
  }

  return (
    <Secao
      titulo={`Aluguéis sem crédito vinculado · ${competenciaLabel(competencia)}`}
      subtitulo="Contratos vigentes cuja competência ainda não tem aluguel confirmado. A auto-conciliação vincula créditos Cora inequívocos; o restante se resolve na Conta Corrente do imóvel."
      icone={CircleDollarSign}
      acoes={
        <button
          type="button"
          onClick={() => void autoConciliar()}
          disabled={autoConciliando || !featureFlags.useApiImoveis}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          {autoConciliando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Wand2 className="w-3.5 h-3.5" aria-hidden />
          )}
          Auto-conciliar Cora
        </button>
      }
    >
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {resultadoAuto ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          <span>
            {resultadoAuto.autoVinculados ?? 0} vinculado{(resultadoAuto.autoVinculados ?? 0) === 1 ? '' : 's'}{' '}
            automaticamente · {resultadoAuto.paraRevisao?.length ?? 0} para revisão manual ·{' '}
            {resultadoAuto.semCredito?.length ?? 0} sem crédito no banco.
          </span>
        </div>
      ) : null}
      {carregando ? <p className="text-sm text-slate-500">Carregando…</p> : null}
      {!carregando && pendentes.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Todos os contratos vigentes têm aluguel vinculado nesta competência.
        </p>
      ) : null}
      {pendentes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Imóvel</th>
                <th className={th}>Inquilino</th>
                <th className={`${th} text-right`}>Aluguel esperado</th>
                <th className={th}>Venc.</th>
                <th className={th} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {pendentes.map((it) => (
                <tr key={it.imovelId ?? `np-${it.numeroPlanilha}`} className="hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                  <td className={`${td} font-semibold tabular-nums`}>{it.numeroPlanilha ?? '—'}</td>
                  <td className={`${td} max-w-[260px] truncate`}>
                    {[it.condominio, it.unidade].filter(Boolean).join(' · ') || it.enderecoCompleto || '—'}
                  </td>
                  <td className={`${td} max-w-[180px] truncate`}>{it.inquilino || '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {it.valorAluguel != null ? formatBRL(it.valorAluguel) : '—'}
                  </td>
                  <td className={`${td} tabular-nums`}>dia {it.diaVencimentoAluguel ?? '—'}</td>
                  <td className={`${td} text-right`}>
                    {it.numeroPlanilha != null ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/imoveis/${it.numeroPlanilha}?aba=conta-corrente`)}
                        className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
                      >
                        Abrir conta corrente
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  );
}

const CONFIANCA_BADGE = {
  ALTA: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  MEDIA: 'bg-amber-100 text-amber-900 border-amber-300',
  BAIXA: 'bg-slate-100 text-slate-700 border-slate-300',
};

function dataCurta(iso) {
  if (!iso) return '—';
  const [, m, d] = String(iso).split('-');
  return d && m ? `${d}/${m}` : iso;
}

/**
 * Sugestões de aluguel por pagador: créditos do extrato (sem Cod.+Proc. ou Cora do processo)
 * que casam com o inquilino de contratos ainda sem aluguel na competência. Confirmar = 1 clique.
 */
function SecaoSugestoesAluguelPorPagador() {
  const { competencia, recarregar } = useImoveisCentral();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [vinculandoKey, setVinculandoKey] = useState(null);
  const [vinculandoLote, setVinculandoLote] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    listarSugestoesAlugueisPendentesApi({ competencia, signal: ac.signal })
      .then((r) => setDados(r || null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Falha ao carregar sugestões de aluguel.');
      })
      .finally(() => setCarregando(false));
    return () => ac.abort();
  }, [competencia, tick]);

  const contratosComSugestao = useMemo(
    () => (Array.isArray(dados?.contratos) ? dados.contratos.filter((c) => c.sugestoes?.length > 0) : []),
    [dados],
  );

  // Lote seguro: contratos com exatamente 1 sugestão de confiança ALTA (sem ambiguidade).
  const loteInequivoco = useMemo(
    () =>
      contratosComSugestao.filter(
        (c) => c.sugestoes.length === 1 && c.sugestoes[0].confianca === 'ALTA',
      ),
    [contratosComSugestao],
  );

  async function vincular(contrato, sugestao) {
    const key = `${contrato.contratoId}-${sugestao.lancamentoFinanceiroId}`;
    setVinculandoKey(key);
    setErro('');
    setSucesso('');
    try {
      await vincularReconciliacaoApi(contrato.contratoId, [
        {
          lancamentoFinanceiroId: sugestao.lancamentoFinanceiroId,
          papel: 'ALUGUEL',
          competenciaMes: competencia,
        },
      ]);
      setSucesso(
        `Aluguel do imóvel ${contrato.imovelNumeroPlanilha ?? contrato.contratoId} vinculado (${formatBRL(sugestao.valor)}).`,
      );
      setTick((t) => t + 1);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao vincular o crédito.');
    } finally {
      setVinculandoKey(null);
    }
  }

  async function vincularLote() {
    setVinculandoLote(true);
    setErro('');
    setSucesso('');
    let ok = 0;
    const falhas = [];
    for (const contrato of loteInequivoco) {
      const s = contrato.sugestoes[0];
      try {
        // Sequencial de propósito: evita corrida quando o mesmo crédito aparece em 2 contratos.
        // eslint-disable-next-line no-await-in-loop
        await vincularReconciliacaoApi(contrato.contratoId, [
          { lancamentoFinanceiroId: s.lancamentoFinanceiroId, papel: 'ALUGUEL', competenciaMes: competencia },
        ]);
        ok += 1;
      } catch (e) {
        falhas.push(`Nº ${contrato.imovelNumeroPlanilha ?? contrato.contratoId}: ${e?.message || 'falha'}`);
      }
    }
    if (ok > 0) setSucesso(`${ok} aluguel${ok === 1 ? '' : 'éis'} vinculado${ok === 1 ? '' : 's'} em lote.`);
    if (falhas.length > 0) setErro(falhas.join(' · '));
    setVinculandoLote(false);
    setTick((t) => t + 1);
    recarregar();
  }

  return (
    <Secao
      titulo={`Sugestões de aluguel por pagador · ${competenciaLabel(competencia)}`}
      subtitulo="A API cruza os créditos do extrato (PIX/TED com o nome do pagador) com o inquilino, o valor e o dia de vencimento de cada contrato pendente. Você só confirma — o vínculo e a classificação (Cod.+Proc.) são gravados de uma vez."
      icone={Sparkles}
      acoes={
        loteInequivoco.length > 0 ? (
          <button
            type="button"
            onClick={() => void vincularLote()}
            disabled={vinculandoLote || vinculandoKey != null}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {vinculandoLote ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="w-3.5 h-3.5" aria-hidden />
            )}
            Vincular {loteInequivoco.length} inequívoco{loteInequivoco.length === 1 ? '' : 's'}
          </button>
        ) : null
      }
    >
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          {sucesso}
        </div>
      ) : null}
      {carregando ? <p className="text-sm text-slate-500">Analisando o extrato…</p> : null}
      {!carregando && contratosComSugestao.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhum crédito do extrato casa com os contratos pendentes desta competência
          {dados ? ` (${dados.totalContratosPendentes ?? 0} contrato${(dados.totalContratosPendentes ?? 0) === 1 ? '' : 's'} sem aluguel)` : ''}.
        </p>
      ) : null}
      {!carregando && contratosComSugestao.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Inquilino (contrato)</th>
                <th className={`${th} text-right`}>Aluguel</th>
                <th className={th}>Crédito no extrato</th>
                <th className={`${th} text-right`}>Valor</th>
                <th className={th}>Data</th>
                <th className={th}>Confiança</th>
                <th className={th} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {contratosComSugestao.flatMap((c) =>
                c.sugestoes.map((s, i) => {
                  const key = `${c.contratoId}-${s.lancamentoFinanceiroId}`;
                  return (
                    <tr key={key} className="hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                      <td className={`${td} font-semibold tabular-nums`}>{i === 0 ? (c.imovelNumeroPlanilha ?? '—') : ''}</td>
                      <td className={`${td} max-w-[200px] truncate`} title={c.inquilinoNome ?? undefined}>
                        {i === 0 ? (c.inquilinoNome || '—') : ''}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        {i === 0 && c.valorAluguel != null ? formatBRL(c.valorAluguel) : ''}
                      </td>
                      <td className={`${td} max-w-[320px] truncate`} title={s.descricao ?? undefined}>
                        {s.descricao || '—'}
                        {s.origemCandidato === 'ORFAO' ? (
                          <span className="ml-1.5 text-[10px] uppercase text-slate-400">sem Cod.+Proc.</span>
                        ) : null}
                      </td>
                      <td className={`${td} text-right tabular-nums font-medium`}>{formatBRL(s.valor)}</td>
                      <td className={`${td} tabular-nums`}>{dataCurta(s.dataLancamento)}</td>
                      <td className={td}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${CONFIANCA_BADGE[s.confianca] || CONFIANCA_BADGE.BAIXA}`}
                          title={[
                            s.nomeConfere ? 'nome confere' : null,
                            s.valorConfere ? 'valor confere' : null,
                            s.diaConfere ? 'dia confere' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        >
                          {s.confianca === 'ALTA' ? 'Alta' : s.confianca === 'MEDIA' ? 'Média' : 'Baixa'}
                        </span>
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>
                        <button
                          type="button"
                          onClick={() => void vincular(c, s)}
                          disabled={vinculandoKey != null || vinculandoLote}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
                        >
                          {vinculandoKey === key ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          ) : (
                            <Link2 className="w-3 h-3" aria-hidden />
                          )}
                          Vincular aluguel
                        </button>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  );
}

/** Repasses pendentes/divergentes (carteira derivada dos vínculos). */
function SecaoRepassesPendentes() {
  const navigate = useNavigate();
  const { competencia, porNumeroPlanilha, recarregar } = useImoveisCentral();
  const [carteira, setCarteira] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [gerandoContratoId, setGerandoContratoId] = useState(null);
  const [sucesso, setSucesso] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro('');
    listarRepassesPendentesApi({ ate: competencia })
      .then((r) => {
        if (ativo) setCarteira(r || { totalEmAberto: 0, itens: [] });
      })
      .catch((e) => {
        if (ativo) setErro(e?.message || 'Falha ao carregar repasses pendentes.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [competencia, tick]);

  async function gerarRepasseInterno(item) {
    if (!item?.contratoId) return;
    setGerandoContratoId(item.contratoId);
    setErro('');
    setSucesso('');
    try {
      const resp = await gerarRepassesInternosApi(item.contratoId, { competencia: item.competencia });
      const n = Number(resp?.repassesGerados) || 0;
      setSucesso(
        n > 0
          ? `${n} repasse${n === 1 ? '' : 's'} interno${n === 1 ? '' : 's'} gerado${n === 1 ? '' : 's'} (conta virtual 900).`
          : 'Nenhum repasse pendente para gerar neste contrato.',
      );
      setTick((t) => t + 1);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar repasse interno.');
    } finally {
      setGerandoContratoId(null);
    }
  }

  const itens = Array.isArray(carteira?.itens) ? carteira.itens : [];

  return (
    <Secao
      titulo="Repasses pendentes ou divergentes"
      subtitulo={`Ciclos com aluguel recebido e repasse em aberto até ${competenciaLabel(competencia)}. Total em aberto: ${formatBRL(carteira?.totalEmAberto ?? 0)}.`}
      icone={TriangleAlert}
    >
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          {sucesso}
        </div>
      ) : null}
      {carregando ? <p className="text-sm text-slate-500">Carregando…</p> : null}
      {!carregando && itens.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Nenhum repasse em aberto.</p>
      ) : null}
      {itens.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Imóvel</th>
                <th className={th}>Locador</th>
                <th className={th}>Competência</th>
                <th className={`${th} text-right`}>Aluguel</th>
                <th className={`${th} text-right`}>Repasse esperado</th>
                <th className={`${th} text-right`}>Em aberto</th>
                <th className={th}>Status</th>
                <th className={th} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {itens.map((r, i) => {
                const np = r.imovelNumeroPlanilha;
                const itemVisao = np != null ? porNumeroPlanilha.get(Number(np)) : null;
                const interno = Boolean(itemVisao?.repasseInterno);
                const divergente = String(r.statusRepasse).toUpperCase() === 'DIVERGENTE';
                return (
                  <tr key={`${r.contratoId}-${r.competencia}-${i}`} className="hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                    <td className={`${td} font-semibold tabular-nums`}>{np ?? '—'}</td>
                    <td className={`${td} max-w-[240px] truncate`} title={r.imovelEndereco ?? undefined}>
                      {r.imovelEndereco || '—'}
                    </td>
                    <td className={`${td} max-w-[180px] truncate`} title={r.locadorNome ?? undefined}>
                      {r.locadorNome || '—'}
                    </td>
                    <td className={`${td} tabular-nums`}>{competenciaLabel(r.competencia)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatBRL(r.aluguel)}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatBRL(r.repasseEsperado)}</td>
                    <td className={`${td} text-right tabular-nums font-semibold text-orange-700 dark:text-orange-300`}>
                      {formatBRL(r.valorEmAberto)}
                    </td>
                    <td className={td}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                          divergente
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-orange-50 text-orange-800 border-orange-300'
                        }`}
                      >
                        {divergente ? 'Divergente' : 'Pendente'}
                      </span>
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {interno ? (
                        <button
                          type="button"
                          onClick={() => void gerarRepasseInterno(r)}
                          disabled={gerandoContratoId != null}
                          className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline disabled:opacity-50 mr-3"
                        >
                          {gerandoContratoId === r.contratoId ? 'Gerando…' : 'Gerar repasse interno'}
                        </button>
                      ) : null}
                      {np != null ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/imoveis/${np}?aba=conta-corrente`)}
                          className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
                        >
                          Conta corrente
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  );
}

export function ImoveisConciliacaoPage() {
  const { recarregar } = useImoveisCentral();

  if (!featureFlags.useApiImoveis || !featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Ative <code className="mx-1">VITE_USE_API_IMOVEIS</code> e{' '}
        <code className="mx-1">VITE_USE_API_FINANCEIRO</code> para usar a conciliação.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-[1500px] w-full mx-auto">
      <SecaoAlugueisDoMes />
      <SecaoSugestoesAluguelPorPagador />
      <SecaoRepassesPendentes />
      <Secao
        titulo="Sugestões de vínculo extrato → imóvel"
        subtitulo="Créditos do extrato ainda sem Cod.+Proc. com candidato provável. Aprovar grava o vínculo no lançamento (passo anterior à classificação como aluguel)."
        icone={Sparkles}
      >
        <ImoveisSugestoesVinculoPanel
          variante="page"
          estrategia="todosParesQualificados"
          limite={300}
          maxParesPorLancamento={8}
          mostrarLinkCentral={false}
          onAprovado={recarregar}
        />
      </Secao>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
        A conciliação bancária de contas a pagar (boletos, condomínio) fica em Operacional → Conciliação bancária.
      </p>
    </div>
  );
}
