import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Info, Link2, Loader2, Receipt, RefreshCw, ScrollText } from 'lucide-react';
import { listarContratosHonorarios, listarSugestoesFinanceiroHonorarios, aprovarSugestaoFinanceiroHonorarios } from '../repositories/documentosRepository.js';
import { buildRouterStateChaveClienteProcesso, buildLinkDestinoProcesso } from '../domain/camposProcessoCliente.js';
import { montarDadosParaDocumentoFromProcesso } from '../helpers/documentoHelper.js';
import { ResultadoFinanceiroSubmenu } from './resultado-financeiro/ResultadoFinanceiroSubmenu.jsx';
import {
  CUMPRIMENTO_A_COBRAR,
  CUMPRIMENTO_NO_FINANCEIRO,
  CUMPRIMENTO_RECEBIDO,
  CUMPRIMENTO_SEM_REGISTRO,
  ROTULOS_CUMPRIMENTO,
  ROTULOS_SITUACAO,
  SITUACAO_ATRASADO,
  SITUACAO_A_VENCER,
  SITUACAO_QUITADO,
  SITUACAO_SEM_FINANCEIRO,
  classeBadgeCumprimento,
  classeBadgeSituacao,
  consolidarRecebiveisContratos,
  formatarDataBR,
  formatarMoedaBRL,
  formatarRotuloBanco,
  resumirRecebiveisConsolidados,
  rotuloStatusPagamento,
} from '../data/recebiveisConsolidadosUtils.js';

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const btnSecondary =
  'inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';

const btnPrimary =
  'inline-flex items-center gap-2 rounded-xl border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500';

const FILTROS_SITUACAO = [
  { id: 'TODOS', label: 'Todos' },
  { id: SITUACAO_ATRASADO, label: ROTULOS_SITUACAO[SITUACAO_ATRASADO] },
  { id: SITUACAO_A_VENCER, label: ROTULOS_SITUACAO[SITUACAO_A_VENCER] },
  { id: SITUACAO_QUITADO, label: ROTULOS_SITUACAO[SITUACAO_QUITADO] },
  { id: SITUACAO_SEM_FINANCEIRO, label: ROTULOS_SITUACAO[SITUACAO_SEM_FINANCEIRO] },
];

const FILTROS_CUMPRIMENTO = [
  { id: 'TODOS', label: 'Todos os vínculos' },
  { id: CUMPRIMENTO_SEM_REGISTRO, label: ROTULOS_CUMPRIMENTO[CUMPRIMENTO_SEM_REGISTRO] },
  { id: CUMPRIMENTO_A_COBRAR, label: ROTULOS_CUMPRIMENTO[CUMPRIMENTO_A_COBRAR] },
  { id: CUMPRIMENTO_RECEBIDO, label: ROTULOS_CUMPRIMENTO[CUMPRIMENTO_RECEBIDO] },
  { id: CUMPRIMENTO_NO_FINANCEIRO, label: ROTULOS_CUMPRIMENTO[CUMPRIMENTO_NO_FINANCEIRO] },
];

function linkPagamentos(linha) {
  const params = new URLSearchParams({ tipo: 'RECEBER' });
  if (linha.processoId) params.set('processoId', String(linha.processoId));
  if (linha.pagamentoId) params.set('pagamentoId', String(linha.pagamentoId));
  return `/pagamentos?${params.toString()}`;
}

function linkProcesso(linha, pathname) {
  const extra = {};
  if (linha.processoId != null && Number.isFinite(Number(linha.processoId))) {
    extra.processoApiId = Number(linha.processoId);
  }
  return buildLinkDestinoProcesso(pathname, linha.codigoCliente, linha.numeroInterno, extra);
}

function linkProcessoForm(linha) {
  return linkProcesso(linha, '/processos');
}

function linkProcessoRecebiveis(linha) {
  return linkProcesso(linha, '/processos/recebiveis');
}

function chaveSugestaoHonorarios(linha) {
  return `${linha.contratoId}-${linha.numeroParcela}`;
}

/**
 * @param {object} [props]
 * @param {number} [props.processoId] — filtra parcelas de um processo (modo dentro do proc.)
 * @param {{ codigoCliente?: string|null, numeroInterno?: number|null }} [props.contextoProcesso]
 * @param {boolean} [props.modoProcesso]
 */
export function RecebiveisConsolidados({
  processoId = null,
  contextoProcesso = null,
  modoProcesso = false,
  modoDrillDown = false,
  onVoltar = null,
} = {}) {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState([]);
  const [sugestoesFinanceiro, setSugestoesFinanceiro] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindoContrato, setAbrindoContrato] = useState(false);
  const [aprovandoChave, setAprovandoChave] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState({
    de: '',
    ate: '',
    vencimentoDe: '',
    vencimentoAte: '',
    situacao: 'TODOS',
    cumprimento: 'TODOS',
    somenteAtrasados: false,
  });

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    setMsgOk('');
    try {
      const params = {};
      if (processoId != null) params.processoId = processoId;
      if (filtros.de) params.de = filtros.de;
      if (filtros.ate) params.ate = filtros.ate;
      const [lista, sugestoes] = await Promise.all([
        listarContratosHonorarios(params),
        listarSugestoesFinanceiroHonorarios(params),
      ]);
      setContratos(Array.isArray(lista) ? lista : []);
      setSugestoesFinanceiro(Array.isArray(sugestoes) ? sugestoes : []);
    } catch (e) {
      setContratos([]);
      setSugestoesFinanceiro([]);
      setErro(e?.message || 'Falha ao carregar parcelas de honorários.');
    } finally {
      setCarregando(false);
    }
  }, [filtros.de, filtros.ate, processoId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const abrirEdicaoContrato = useCallback(
    async (ctx = {}) => {
      const pid = ctx.processoId ?? processoId;
      if (pid == null || !Number.isFinite(Number(pid)) || Number(pid) <= 0) {
        setErro('Processo não identificado para abrir o contrato.');
        return;
      }
      setAbrindoContrato(true);
      setErro('');
      try {
        const dadosProcesso = await montarDadosParaDocumentoFromProcesso({
          processoApiId: Number(pid),
          codigoCliente: ctx.codigoCliente ?? contextoProcesso?.codigoCliente,
          numeroInterno: ctx.numeroInterno ?? contextoProcesso?.numeroInterno,
          processo: ctx.numeroInterno ?? contextoProcesso?.numeroInterno,
        });
        navigate('/documentos/gerar', {
          state: { dadosProcesso, modoInicial: 'documentos', documentoSubtipo: 'contrato' },
        });
      } catch (e) {
        setErro(e?.message || 'Falha ao abrir edição do contrato.');
      } finally {
        setAbrindoContrato(false);
      }
    },
    [processoId, contextoProcesso, navigate],
  );

  const linhas = useMemo(() => consolidarRecebiveisContratos(contratos), [contratos]);

  const sugestoesPorChave = useMemo(() => {
    const map = new Map();
    for (const s of sugestoesFinanceiro) {
      if (s?.contratoId == null || s?.numeroParcela == null) continue;
      map.set(`${s.contratoId}-${s.numeroParcela}`, s);
    }
    return map;
  }, [sugestoesFinanceiro]);

  const aprovarSugestao = useCallback(
    async (linha, sugestao) => {
      const chave = chaveSugestaoHonorarios(linha);
      setAprovandoChave(chave);
      setErro('');
      setMsgOk('');
      try {
        const resp = await aprovarSugestaoFinanceiroHonorarios({
          contratoId: sugestao.contratoId,
          numeroParcela: sugestao.numeroParcela,
          financeiroLancamentoId: sugestao.financeiroLancamentoId,
        });
        setMsgOk(resp?.mensagem || 'Vínculo confirmado.');
        await recarregar();
      } catch (e) {
        setErro(e?.message || 'Falha ao vincular com o financeiro.');
      } finally {
        setAprovandoChave('');
      }
    },
    [recarregar],
  );

  const linhasFiltradas = useMemo(() => {
    let r = linhas;
    if (filtros.vencimentoDe) {
      r = r.filter((l) => l.dataVencimento && l.dataVencimento >= filtros.vencimentoDe);
    }
    if (filtros.vencimentoAte) {
      r = r.filter((l) => l.dataVencimento && l.dataVencimento <= filtros.vencimentoAte);
    }
    if (filtros.somenteAtrasados) {
      r = r.filter((l) => l.situacao === SITUACAO_ATRASADO);
    } else if (filtros.situacao !== 'TODOS') {
      r = r.filter((l) => l.situacao === filtros.situacao);
    }
    if (filtros.cumprimento !== 'TODOS') {
      r = r.filter((l) => l.cumprimento === filtros.cumprimento);
    }
    return r;
  }, [linhas, filtros]);

  const resumo = useMemo(() => resumirRecebiveisConsolidados(linhas), [linhas]);
  const resumoFiltrado = useMemo(() => resumirRecebiveisConsolidados(linhasFiltradas), [linhasFiltradas]);

  const rotuloProcessoAtual =
    contextoProcesso?.codigoCliente && contextoProcesso?.numeroInterno != null
      ? `${contextoProcesso.codigoCliente} / proc. ${contextoProcesso.numeroInterno}`
      : processoId
        ? `processo #${processoId}`
        : null;

  const voltarProcessoState =
    contextoProcesso?.codigoCliente && contextoProcesso?.numeroInterno != null
      ? buildRouterStateChaveClienteProcesso(
          contextoProcesso.codigoCliente,
          String(contextoProcesso.numeroInterno),
          { processoApiId: processoId },
        )
      : processoId
        ? { processoApiId: processoId }
        : null;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/30 to-emerald-50/40 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        {modoProcesso ? (
          voltarProcessoState ? (
            <Link
              to="/processos"
              state={voltarProcessoState}
              className="inline-flex text-sm font-medium text-cyan-800 hover:underline dark:text-cyan-300"
            >
              ← Voltar ao processo
            </Link>
          ) : null
        ) : modoDrillDown && typeof onVoltar === 'function' ? (
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300"
          >
            ← Voltar ao quadro de recebíveis
          </button>
        ) : modoDrillDown ? null : (
          <ResultadoFinanceiroSubmenu />
        )}

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 p-2.5 text-white shadow-lg shadow-indigo-500/25">
              <Receipt className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {modoProcesso ? 'Recebíveis' : modoDrillDown ? 'Cobrança de honorários' : 'Resultado financeiro'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {modoProcesso ? (
                  <>
                    Cobrança de honorários do processo{' '}
                    {rotuloProcessoAtual ? (
                      <strong>{rotuloProcessoAtual}</strong>
                    ) : (
                      'selecionado'
                    )}
                    . Para visão geral de todos os processos, use{' '}
                    <Link to="/recebiveis?tipo=HONORARIOS" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                      Recebíveis → Honorários
                    </Link>
                    .
                  </>
                ) : modoDrillDown ? (
                  <>
                    Parcelas de honorários em <strong>todos os processos</strong> — previsão de recebimentos, vínculo
                    com Pagamentos e conciliação com o financeiro.
                  </>
                ) : (
                  <>
                    Cobrança de honorários em <strong>todos os processos</strong> — previsão de recebimentos e vínculo
                    com Pagamentos.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {modoProcesso && processoId ? (
              <button
                type="button"
                className={btnPrimary}
                onClick={() => void abrirEdicaoContrato()}
                disabled={abrindoContrato || carregando}
              >
                {abrindoContrato ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ScrollText className="h-4 w-4" aria-hidden />
                )}
                Editar contrato
              </button>
            ) : null}
            <button type="button" className={btnSecondary} onClick={() => void recarregar()} disabled={carregando}>
              <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} aria-hidden />
              Atualizar
            </button>
          </div>
        </header>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {modoProcesso ? (
                <>
                  Parcelas fixas de cobrança deste processo: atraso, recebimento do cliente e vínculo com Pagamentos /
                  Conta Corrente. Use <strong>Editar contrato</strong> para configurar o parcelamento e marcar
                  &quot;Gerar recebíveis&quot;.
                </>
              ) : (
                <>
                  O <strong>resultado nos autos</strong> (aba ao lado) depende do que entra nos processos e é imprevisível
                  quando a remuneração é percentual. Aqui você controla as <strong>parcelas fixas de cobrança</strong> do
                  contrato: se o cliente está pagando, se há atraso e se o recebimento já foi vinculado ao financeiro
                  (Pagamentos → Conta Corrente).
                </>
              )}
            </span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Previsão (a vencer)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{resumo.qtdAVencer}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{formatarMoedaBRL(resumo.valorPrevisao)}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Inadimplência
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-800 dark:text-red-200">{resumo.qtdAtrasado}</p>
            <p className="text-sm text-red-700 dark:text-red-300">{formatarMoedaBRL(resumo.valorAtrasado)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sem cobrança registrada</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{resumo.qtdSemRegistro}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{formatarMoedaBRL(resumo.valorSemRegistro)}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-800 dark:text-sky-200">Recebido do cliente</p>
            <p className="mt-1 text-2xl font-semibold text-sky-900 dark:text-sky-100">{resumo.qtdRecebidoCliente}</p>
            <p className="text-sm text-sky-800 dark:text-sky-200">{formatarMoedaBRL(resumo.valorRecebidoCliente)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">No financeiro</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{resumo.qtdNoFinanceiro}</p>
            <p className="text-sm text-emerald-800 dark:text-emerald-200">{formatarMoedaBRL(resumo.valorNoFinanceiro)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Contrato de</span>
            <input
              type="date"
              className={`${inputClass} min-w-[10rem]`}
              value={filtros.de}
              onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Contrato até</span>
            <input
              type="date"
              className={`${inputClass} min-w-[10rem]`}
              value={filtros.ate}
              onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Vencimento de</span>
            <input
              type="date"
              className={`${inputClass} min-w-[10rem]`}
              value={filtros.vencimentoDe}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoDe: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Vencimento até</span>
            <input
              type="date"
              className={`${inputClass} min-w-[10rem]`}
              value={filtros.vencimentoAte}
              onChange={(e) => setFiltros((f) => ({ ...f, vencimentoAte: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Situação</span>
            <select
              className={`${inputClass} min-w-[11rem]`}
              value={filtros.situacao}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, situacao: e.target.value, somenteAtrasados: false }))
              }
            >
              {FILTROS_SITUACAO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Vínculo financeiro</span>
            <select
              className={`${inputClass} min-w-[12rem]`}
              value={filtros.cumprimento}
              onChange={(e) => setFiltros((f) => ({ ...f, cumprimento: e.target.value }))}
            >
              {FILTROS_CUMPRIMENTO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={filtros.somenteAtrasados}
              onChange={(e) =>
                setFiltros((f) => ({
                  ...f,
                  somenteAtrasados: e.target.checked,
                  situacao: e.target.checked ? 'TODOS' : f.situacao,
                }))
              }
            />
            Somente atrasados
          </label>
          <p className="pb-2 text-sm text-slate-500 dark:text-slate-400">
            {linhasFiltradas.length} parcela{linhasFiltradas.length === 1 ? '' : 's'}
            {linhasFiltradas.length !== linhas.length
              ? ` · ${formatarMoedaBRL(resumoFiltrado.valorTotal)}`
              : null}
          </p>
        </div>

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {erro}
          </div>
        ) : null}

        {msgOk ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            {msgOk}
          </div>
        ) : null}

        {sugestoesFinanceiro.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
            <p className="font-medium">
              {sugestoesFinanceiro.length} provável{sugestoesFinanceiro.length === 1 ? '' : 'is'} no financeiro — use{' '}
              <strong>Vincular</strong> na linha para classificar (se necessário) e conciliar em um clique.
            </p>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          {carregando ? (
            <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando parcelas…
            </p>
          ) : linhasFiltradas.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
              {modoProcesso && contratos.length > 0 ? (
                <>
                  O contrato está salvo, mas ainda não há cobrança no financeiro. Abra{' '}
                  <strong>Editar contrato</strong>, marque &quot;Parcelar valores&quot; (se for parcelado) e{' '}
                  &quot;Gerar recebíveis no financeiro&quot;, depois salve.
                </>
              ) : (
                <>
                  Nenhuma parcela de cobrança encontrada{modoProcesso ? ' neste processo' : ''}. Cadastre o parcelamento
                  no contrato de honorários{modoProcesso ? '' : ' do processo'} e marque &quot;Gerar recebíveis&quot;
                  para vincular a Pagamentos.
                </>
              )}
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <tr>
                  {!modoProcesso ? <th className="px-3 py-2 font-medium">Cliente / Proc.</th> : null}
                  <th className="px-3 py-2 font-medium">Parte cliente</th>
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium text-center">Pago</th>
                  <th className="px-3 py-2 font-medium">Data pagamento</th>
                  <th className="px-3 py-2 font-medium">Banco</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 font-medium">Cumprimento</th>
                  <th className="px-3 py-2 font-medium">Pagamento</th>
                  <th className="px-3 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map((linha) => {
                  const sugestao = sugestoesPorChave.get(chaveSugestaoHonorarios(linha));
                  const chave = chaveSugestaoHonorarios(linha);
                  const aprovando = aprovandoChave === chave;
                  return (
                  <tr key={linha.chave} className="border-t border-slate-200 dark:border-slate-700">
                      {!modoProcesso ? (
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {linha.codigoCliente ?? '—'} / {linha.numeroInterno ?? '—'}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {linha.parteCliente || linha.nomeContratante || '—'}
                    </td>
                      <td className="px-3 py-2">
                        {linha.numeroParcela}/{linha.totalParcelas}
                      </td>
                      <td className="px-3 py-2 font-medium">{formatarMoedaBRL(linha.valor)}</td>
                      <td className="px-3 py-2">{formatarDataBR(linha.dataVencimento)}</td>
                      <td className="px-3 py-2 text-center">
                        {linha.pagamentoPago ? (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            title="Pago"
                            aria-label="Pago"
                          >
                            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          </span>
                        ) : (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900/40"
                            title="Não pago"
                            aria-label="Não pago"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {linha.pagamentoDataPagamento ? formatarDataBR(linha.pagamentoDataPagamento) : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {formatarRotuloBanco(linha.pagamentoBancoNumero, linha.pagamentoBancoNome)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classeBadgeSituacao(linha.situacao)}`}
                        >
                          {ROTULOS_SITUACAO[linha.situacao] ?? linha.situacao}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${classeBadgeCumprimento(linha.cumprimento)}`}
                        >
                          {ROTULOS_CUMPRIMENTO[linha.cumprimento] ?? linha.cumprimento}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {linha.pagamentoId ? (
                          <span className="block">
                            #{linha.pagamentoId} · {rotuloStatusPagamento(linha.pagamentoStatus)}
                          </span>
                        ) : (
                          '—'
                        )}
                        {linha.pagamentoFinanceiroLancamentoId ? (
                          <span className="block text-xs text-emerald-700 dark:text-emerald-300">
                            Lanç. financeiro #{linha.pagamentoFinanceiroLancamentoId}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-end gap-2">
                          {sugestao &&
                          linha.cumprimento !== CUMPRIMENTO_NO_FINANCEIRO &&
                          !linha.pagamentoFinanceiroLancamentoId ? (
                            <div className="w-full max-w-xs rounded-lg border border-amber-300 bg-amber-50/90 p-2 text-left text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                              <p className="font-medium">Provável no financeiro</p>
                              <p className="mt-0.5 text-amber-900 dark:text-amber-200">
                                {formatarMoedaBRL(sugestao.financeiroValor)} ·{' '}
                                {formatarDataBR(sugestao.financeiroData)} ·{' '}
                                {formatarRotuloBanco(sugestao.financeiroBancoNumero, sugestao.financeiroBancoNome)}
                              </p>
                              {sugestao.financeiroDescricao ? (
                                <p className="mt-0.5 line-clamp-2 text-amber-800 dark:text-amber-300">
                                  {sugestao.financeiroDescricao}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                className={`${btnPrimary} mt-2 w-full justify-center py-1.5 text-xs`}
                                disabled={aprovando || carregando}
                                onClick={() => void aprovarSugestao(linha, sugestao)}
                              >
                                {aprovando ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Vincular
                              </button>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-2">
                          {!modoProcesso ? (
                            <Link
                              to={linkProcessoRecebiveis(linha)}
                              className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300"
                            >
                              Recebíveis
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          ) : null}
                          {linha.pagamentoId ? (
                            <Link
                              to={linkPagamentos(linha)}
                              className="inline-flex items-center gap-1 text-indigo-700 hover:underline dark:text-indigo-300"
                            >
                              Pagamentos
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-indigo-700 hover:underline disabled:opacity-50 dark:text-indigo-300"
                                disabled={abrindoContrato}
                                onClick={() =>
                                  void abrirEdicaoContrato({
                                    processoId: linha.processoId,
                                    codigoCliente: linha.codigoCliente,
                                    numeroInterno: linha.numeroInterno,
                                  })
                                }
                              >
                                Editar contrato
                                <ScrollText className="h-3 w-3" aria-hidden />
                              </button>
                              <Link
                                to={linkProcessoForm(linha)}
                                className="inline-flex items-center gap-1 text-amber-700 hover:underline dark:text-amber-300"
                              >
                                Ver no processo
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </Link>
                            </>
                          )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecebiveisConsolidados;
