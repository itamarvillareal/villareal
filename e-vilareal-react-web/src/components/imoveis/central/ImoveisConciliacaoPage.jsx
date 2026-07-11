import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  Check,
  CircleDollarSign,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  carregarFollowupAlugueisApi,
  carregarTriagemAlugueisApi,
  cobrarAlugueisAtrasadosApi,
  conciliarAlugueisAutomaticoApi,
  gerarRepassesInternosApi,
  listarRepassesPendentesApi,
  listarSugestoesAlugueisPendentesApi,
  registrarEventoFollowupAluguelApi,
  vincularReconciliacaoApi,
} from '../../../repositories/imoveisRepository.js';
import { ImoveisSugestoesVinculoPanel } from '../ImoveisSugestoesVinculoPanel.jsx';
import { useImoveisCentral } from './ImoveisCentralContext.jsx';
import { competenciaLabel, formatBRL } from './imoveisCentralFormat.js';

const th =
  'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap bg-slate-50/90 dark:bg-slate-900/90';
const td =
  'px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 align-middle';

function Secao({ id, titulo, subtitulo, icone: Icone, acoes, children }) {
  return (
    <section id={id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
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

const SITUACAO_INFO = {
  EM_ATRASO: { rotulo: 'Em atraso', classe: 'bg-red-100 text-red-900 border-red-300' },
  PAGAMENTO_PROVAVEL: { rotulo: 'Pagamento no extrato', classe: 'bg-sky-100 text-sky-900 border-sky-300' },
  A_VENCER: { rotulo: 'A vencer', classe: 'bg-slate-100 text-slate-700 border-slate-300' },
};

function KpiChip({ valor, rotulo, classe }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${classe}`}>
      <span className="tabular-nums text-sm">{valor}</span> {rotulo}
    </span>
  );
}

/**
 * Triagem automática dos aluguéis do mês: a API separa o que ela resolve sozinha (pagamento
 * localizado no extrato → conciliar) do que precisa de ação humana (atraso → cobrar WhatsApp).
 */
function SecaoAlugueisDoMes() {
  const navigate = useNavigate();
  const { competencia, recarregar, versaoRecarga } = useImoveisCentral();
  const [triagem, setTriagem] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [autoConciliando, setAutoConciliando] = useState(false);
  const [resultadoAuto, setResultadoAuto] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [cobrandoContratoId, setCobrandoContratoId] = useState(null);
  const [cobrandoLote, setCobrandoLote] = useState(false);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    carregarTriagemAlugueisApi({ competencia, signal: ac.signal })
      .then((r) => setTriagem(r || null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Falha ao carregar a triagem de aluguéis.');
      })
      .finally(() => setCarregando(false));
    return () => ac.abort();
  }, [competencia, versaoRecarga]);

  const itens = useMemo(() => (Array.isArray(triagem?.itens) ? triagem.itens : []), [triagem]);
  const cobraveis = useMemo(
    () => itens.filter((it) => it.situacao === 'EM_ATRASO' && it.temTelefone && !it.jaCobradoEsteMes),
    [itens],
  );

  function resumoLote(resp) {
    const partes = [`${resp?.enviados ?? 0} cobrança${(resp?.enviados ?? 0) === 1 ? '' : 's'} enviada${(resp?.enviados ?? 0) === 1 ? '' : 's'}`];
    if (resp?.semTelefone > 0) partes.push(`${resp.semTelefone} sem telefone`);
    if (resp?.falhos > 0) partes.push(`${resp.falhos} com falha`);
    return partes.join(' · ') + '.';
  }

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

  async function cobrar(contratoIds, { lote = false } = {}) {
    if (lote) setCobrandoLote(true);
    else setCobrandoContratoId(contratoIds[0]);
    setErro('');
    setSucesso('');
    try {
      const resp = await cobrarAlugueisAtrasadosApi({ contratoIds, competencia });
      setSucesso(resumoLote(resp));
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao disparar a cobrança.');
    } finally {
      setCobrandoLote(false);
      setCobrandoContratoId(null);
    }
  }

  function irParaSugestoes() {
    document.getElementById('sugestoes-pagador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const ocupado = autoConciliando || cobrandoLote || cobrandoContratoId != null;

  return (
    <Secao
      titulo={`Aluguéis do mês · ${competenciaLabel(competencia)}`}
      subtitulo="Triagem automática: quem já pagou (crédito localizado no extrato) vai para conciliação 1-clique; quem está em atraso já vem com a cobrança WhatsApp pronta — você só aprova."
      icone={CircleDollarSign}
      acoes={
        <>
          {cobraveis.length > 0 ? (
            <button
              type="button"
              onClick={() => void cobrar(cobraveis.map((it) => it.contratoId), { lote: true })}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {cobrandoLote ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <MessageCircle className="w-3.5 h-3.5" aria-hidden />
              )}
              Cobrar {cobraveis.length} em atraso
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void autoConciliar()}
            disabled={ocupado || !featureFlags.useApiImoveis}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {autoConciliando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="w-3.5 h-3.5" aria-hidden />
            )}
            Auto-conciliar Cora
          </button>
        </>
      }
    >
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          {sucesso}
        </div>
      ) : null}
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
      {triagem ? (
        <div className="flex flex-wrap gap-2">
          <KpiChip valor={triagem.totalEmAtraso ?? 0} rotulo="em atraso" classe="bg-red-50 text-red-800 border-red-200" />
          <KpiChip
            valor={triagem.totalPagamentoProvavel ?? 0}
            rotulo="com pagamento no extrato"
            classe="bg-sky-50 text-sky-800 border-sky-200"
          />
          <KpiChip valor={triagem.totalAVencer ?? 0} rotulo="a vencer" classe="bg-slate-50 text-slate-600 border-slate-200" />
        </div>
      ) : null}
      {carregando ? <p className="text-sm text-slate-500">Analisando contratos e extrato…</p> : null}
      {!carregando && itens.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Todos os contratos vigentes têm aluguel vinculado nesta competência.
        </p>
      ) : null}
      {itens.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Imóvel</th>
                <th className={th}>Inquilino</th>
                <th className={`${th} text-right`}>Aluguel</th>
                <th className={th}>Venc.</th>
                <th className={th}>Situação</th>
                <th className={th} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const info = SITUACAO_INFO[it.situacao] || SITUACAO_INFO.A_VENCER;
                const atrasado = it.situacao === 'EM_ATRASO';
                return (
                  <tr key={it.contratoId} className="hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
                    <td className={`${td} font-semibold tabular-nums`}>{it.imovelNumeroPlanilha ?? '—'}</td>
                    <td className={`${td} max-w-[240px] truncate`} title={it.imovelEndereco ?? undefined}>
                      {[it.condominio, it.unidade].filter(Boolean).join(' · ') || it.imovelEndereco || '—'}
                    </td>
                    <td className={`${td} max-w-[180px] truncate`} title={it.inquilinoNome ?? undefined}>
                      {it.inquilinoNome || '—'}
                      {atrasado && !it.temTelefone ? (
                        <span className="ml-1.5 text-[10px] uppercase text-red-500">sem telefone</span>
                      ) : null}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {it.valorAluguel != null ? formatBRL(it.valorAluguel) : '—'}
                    </td>
                    <td className={`${td} tabular-nums`}>dia {it.diaVencimentoAluguel ?? '10'}</td>
                    <td className={td}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${info.classe}`}
                      >
                        {atrasado && it.diasAtraso > 0
                          ? `Em atraso · ${it.diasAtraso}d`
                          : it.situacao === 'PAGAMENTO_PROVAVEL' && it.confiancaPagamento
                            ? `${info.rotulo} (${it.confiancaPagamento === 'ALTA' ? 'alta' : it.confiancaPagamento === 'MEDIA' ? 'média' : 'baixa'})`
                            : info.rotulo}
                      </span>
                      {atrasado && it.jaCobradoEsteMes ? (
                        <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-semibold whitespace-nowrap">
                          Cobrado este mês
                        </span>
                      ) : null}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {it.situacao === 'PAGAMENTO_PROVAVEL' ? (
                        <button
                          type="button"
                          onClick={irParaSugestoes}
                          className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline mr-3"
                        >
                          Conciliar abaixo
                        </button>
                      ) : null}
                      {atrasado && it.temTelefone ? (
                        <button
                          type="button"
                          onClick={() => void cobrar([it.contratoId])}
                          disabled={ocupado}
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold disabled:opacity-50 mr-3 ${
                            it.jaCobradoEsteMes
                              ? 'border border-red-300 text-red-700 hover:bg-red-50'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                          title={it.telefoneFormatado || undefined}
                        >
                          {cobrandoContratoId === it.contratoId ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          ) : (
                            <MessageCircle className="w-3 h-3" aria-hidden />
                          )}
                          {it.jaCobradoEsteMes ? 'Cobrar de novo' : 'Cobrar WhatsApp'}
                        </button>
                      ) : null}
                      {it.imovelNumeroPlanilha != null ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/imoveis/${it.imovelNumeroPlanilha}?aba=conta-corrente`)}
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

const ACAO_INFO = {
  CONCILIAR: { rotulo: 'Conciliar crédito', classe: 'bg-sky-100 text-sky-900 border-sky-300' },
  ENVIAR_MENSAGEM: { rotulo: 'Enviar cobrança', classe: 'bg-red-100 text-red-900 border-red-300' },
  REENVIAR_MENSAGEM: { rotulo: 'Reenviar cobrança', classe: 'bg-red-100 text-red-900 border-red-300' },
  LIGAR: { rotulo: 'Ligar', classe: 'bg-orange-100 text-orange-900 border-orange-300' },
  VERIFICAR_RESPOSTA: { rotulo: 'Verificar resposta', classe: 'bg-violet-100 text-violet-900 border-violet-300' },
  AGUARDAR: { rotulo: 'Aguardando', classe: 'bg-slate-100 text-slate-700 border-slate-300' },
};

function dataHoraCurta(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Casos em aberto — o gestor de follow-up. Cada atraso (inclusive de meses anteriores) é um caso
 * que a API acompanha até a resolução: ela verifica sozinha se o inquilino respondeu no WhatsApp
 * e escala a ação (mensagem → reenviar → ligar), com prazo. Nada depende da memória do usuário.
 */
function SecaoCasosEmAberto() {
  const navigate = useNavigate();
  const { competencia, recarregar, versaoRecarga } = useImoveisCentral();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupadoKey, setOcupadoKey] = useState(null);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    carregarFollowupAlugueisApi({ competencia, signal: ac.signal })
      .then((r) => setDados(r || null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Falha ao carregar os casos em aberto.');
      })
      .finally(() => setCarregando(false));
    return () => ac.abort();
  }, [competencia, versaoRecarga]);

  const itens = useMemo(() => (Array.isArray(dados?.itens) ? dados.itens : []), [dados]);

  async function executar(key, fn, mensagemOk) {
    setOcupadoKey(key);
    setErro('');
    setSucesso('');
    try {
      await fn();
      if (mensagemOk) setSucesso(mensagemOk);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao executar a ação.');
    } finally {
      setOcupadoKey(null);
    }
  }

  function cobrar(item) {
    void executar(`cobrar-${item.contratoId}-${item.competencia}`, async () => {
      const resp = await cobrarAlugueisAtrasadosApi({ contratoIds: [item.contratoId], competencia: item.competencia });
      if ((resp?.enviados ?? 0) === 0) throw new Error('A cobrança não foi enviada — verifique o telefone.');
    }, `Cobrança enviada para ${item.inquilinoNome || 'o inquilino'} (${item.competencia}).`);
  }

  function registrarLigacao(item) {
    const observacao = window.prompt('O que ficou combinado na ligação? (opcional)') ?? undefined;
    void executar(
      `ligacao-${item.contratoId}-${item.competencia}`,
      () => registrarEventoFollowupAluguelApi({
        contratoId: item.contratoId,
        competencia: item.competencia,
        tipo: 'LIGACAO',
        observacao,
      }),
      'Ligação registrada — a API recalculou o próximo passo do caso.',
    );
  }

  function adiar(item, dias) {
    const ate = new Date();
    ate.setDate(ate.getDate() + dias);
    const adiadoAte = ate.toISOString().slice(0, 10);
    void executar(
      `adiar-${item.contratoId}-${item.competencia}`,
      () => registrarEventoFollowupAluguelApi({
        contratoId: item.contratoId,
        competencia: item.competencia,
        tipo: 'ADIAR',
        adiadoAte,
      }),
      `Caso adiado até ${dataHoraCurta(adiadoAte)} — ele volta a cobrar você automaticamente.`,
    );
  }

  function resolver(item) {
    const observacao = window.prompt(
      'Marcar este caso como tratado (ele sai da lista). Por quê? Ex.: acordo fechado, pagamento em espécie…',
    );
    if (observacao == null) return;
    void executar(
      `resolver-${item.contratoId}-${item.competencia}`,
      () => registrarEventoFollowupAluguelApi({
        contratoId: item.contratoId,
        competencia: item.competencia,
        tipo: 'RESOLVIDO_MANUAL',
        observacao: observacao || undefined,
      }),
      'Caso marcado como tratado.',
    );
  }

  function abrirConversa(item) {
    if (item.telefoneE164) navigate(`/whatsapp/conversas?telefone=${encodeURIComponent(item.telefoneE164)}`);
  }

  function irParaSugestoes() {
    document.getElementById('sugestoes-pagador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const ocupado = ocupadoKey != null;

  return (
    <Secao
      titulo="Casos em aberto — follow-up"
      subtitulo={`A API acompanha cada atraso até a solução, inclusive de meses anteriores (${dados?.mesesAnalisados ?? 3} competências analisadas): confere sozinha se o inquilino respondeu no WhatsApp e escala a ação — mensagem, reenvio, ligação. O caso some da lista quando o aluguel é conciliado.`}
      icone={BellRing}
    >
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden />
          {sucesso}
        </div>
      ) : null}
      {dados ? (
        <div className="flex flex-wrap gap-2">
          <KpiChip valor={dados.totalAcaoHoje ?? 0} rotulo="exigem ação agora" classe="bg-red-50 text-red-800 border-red-200" />
          <KpiChip valor={dados.totalAguardando ?? 0} rotulo="aguardando prazo" classe="bg-slate-50 text-slate-600 border-slate-200" />
        </div>
      ) : null}
      {carregando ? <p className="text-sm text-slate-500">Verificando mensagens, respostas e prazos…</p> : null}
      {!carregando && itens.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Nenhum caso de aluguel em aberto. Tudo tratado ou conciliado.
        </p>
      ) : null}
      {itens.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[1100px] text-left border-collapse">
            <thead>
              <tr>
                <th className={th}>Nº</th>
                <th className={th}>Inquilino</th>
                <th className={th}>Competência</th>
                <th className={`${th} text-right`}>Aluguel</th>
                <th className={th}>Atraso</th>
                <th className={th}>Histórico do caso</th>
                <th className={th}>Próxima ação</th>
                <th className={th} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const key = `${it.contratoId}-${it.competencia}`;
                const acao = ACAO_INFO[it.proximaAcao] || ACAO_INFO.AGUARDAR;
                const historico = [];
                if (it.cobrancasEnviadas > 0) {
                  historico.push(
                    `${it.cobrancasEnviadas} msg${it.cobrancasEnviadas === 1 ? '' : 's'} (última ${dataHoraCurta(it.ultimaCobrancaEm)})`,
                  );
                }
                if (it.ligacoesRegistradas > 0) {
                  historico.push(`${it.ligacoesRegistradas} ligação${it.ligacoesRegistradas === 1 ? '' : 'ões'}`);
                }
                if (it.respondeuAposUltimaAcao) historico.push(`respondeu ${dataHoraCurta(it.ultimaRespostaEm)}`);
                else if (it.cobrancasEnviadas > 0 || it.ligacoesRegistradas > 0) historico.push('sem resposta');
                return (
                  <tr
                    key={key}
                    className={`hover:bg-teal-50/50 dark:hover:bg-teal-950/20 ${it.acaoVencida ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                  >
                    <td className={`${td} font-semibold tabular-nums`}>{it.imovelNumeroPlanilha ?? '—'}</td>
                    <td className={`${td} max-w-[180px] truncate`} title={it.inquilinoNome ?? undefined}>
                      {it.inquilinoNome || '—'}
                      {!it.temTelefone ? (
                        <span className="ml-1.5 text-[10px] uppercase text-red-500">sem WhatsApp</span>
                      ) : null}
                    </td>
                    <td className={`${td} tabular-nums`}>{competenciaLabel(it.competencia)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {it.valorAluguel != null ? formatBRL(it.valorAluguel) : '—'}
                    </td>
                    <td className={`${td} tabular-nums font-semibold text-red-700 dark:text-red-300`}>
                      {it.diasAtraso}d
                    </td>
                    <td className={`${td} max-w-[240px]`}>
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {historico.length > 0 ? historico.join(' · ') : 'nenhuma cobrança ainda'}
                      </span>
                      {it.ultimaAnotacao ? (
                        <span className="block text-[11px] text-slate-400 truncate" title={it.ultimaAnotacao}>
                          “{it.ultimaAnotacao}”
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${acao.classe}`}
                        title={it.proximaAcaoDescricao || undefined}
                      >
                        {acao.rotulo}
                        {it.proximaAcao === 'AGUARDAR' && it.prazoAcao ? ` até ${dataHoraCurta(it.prazoAcao)}` : ''}
                      </span>
                      {it.acaoVencida && it.proximaAcao !== 'AGUARDAR' ? (
                        <span className="block mt-0.5 text-[11px] text-red-600 dark:text-red-400">
                          {it.proximaAcaoDescricao}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {it.proximaAcao === 'CONCILIAR' ? (
                        <button
                          type="button"
                          onClick={irParaSugestoes}
                          className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline mr-3"
                        >
                          Conciliar abaixo
                        </button>
                      ) : null}
                      {(it.proximaAcao === 'ENVIAR_MENSAGEM' || it.proximaAcao === 'REENVIAR_MENSAGEM') && it.temTelefone ? (
                        <button
                          type="button"
                          onClick={() => cobrar(it)}
                          disabled={ocupado}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 mr-3"
                          title={it.telefoneFormatado || undefined}
                        >
                          {ocupadoKey === `cobrar-${key}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          ) : (
                            <MessageCircle className="w-3 h-3" aria-hidden />
                          )}
                          {it.proximaAcao === 'REENVIAR_MENSAGEM' ? 'Reenviar' : 'Cobrar'}
                        </button>
                      ) : null}
                      {it.proximaAcao === 'VERIFICAR_RESPOSTA' && it.temTelefone ? (
                        <button
                          type="button"
                          onClick={() => abrirConversa(it)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-violet-600 text-white font-semibold hover:bg-violet-700 mr-3"
                        >
                          <MessageCircle className="w-3 h-3" aria-hidden />
                          Abrir conversa
                        </button>
                      ) : null}
                      {it.proximaAcao === 'LIGAR' ? (
                        <button
                          type="button"
                          onClick={() => registrarLigacao(it)}
                          disabled={ocupado}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:opacity-50 mr-3"
                          title={it.telefoneFormatado ? `Ligar para ${it.telefoneFormatado}` : undefined}
                        >
                          {ocupadoKey === `ligacao-${key}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                          ) : (
                            <Phone className="w-3 h-3" aria-hidden />
                          )}
                          {it.telefoneFormatado ? `Liguei (${it.telefoneFormatado})` : 'Registrar contato'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => adiar(it, 3)}
                        disabled={ocupado}
                        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50 mr-3"
                        title="Silencia o caso por 3 dias — depois disso ele volta a exigir ação"
                      >
                        Adiar 3d
                      </button>
                      <button
                        type="button"
                        onClick={() => resolver(it)}
                        disabled={ocupado}
                        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                        title="Marcar como tratado fora do sistema (sai da lista)"
                      >
                        Resolvido
                      </button>
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
  const { competencia, recarregar, versaoRecarga } = useImoveisCentral();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [vinculandoKey, setVinculandoKey] = useState(null);
  const [vinculandoLote, setVinculandoLote] = useState(false);

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
  }, [competencia, versaoRecarga]);

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
    recarregar();
  }

  return (
    <Secao
      id="sugestoes-pagador"
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
  const { competencia, porNumeroPlanilha, recarregar, versaoRecarga } = useImoveisCentral();
  const [carteira, setCarteira] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [gerandoContratoId, setGerandoContratoId] = useState(null);
  const [sucesso, setSucesso] = useState('');

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
  }, [competencia, versaoRecarga]);

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
      <SecaoCasosEmAberto />
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
