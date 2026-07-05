import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Link2, Search, Trash2, X } from 'lucide-react';
import { ModalVinculoClienteProcFinanceiro } from '../../ModalVinculoClienteProcFinanceiro.jsx';
import { ModalBuscaImovel } from '../../imoveis/ModalBuscaImovel.jsx';
import {
  normalizarCodigoClienteFinanceiro,
  normalizarNumeroImovelFinanceiro,
  normalizarProcFinanceiro,
  registrarCodigoClienteFinanceiroPorPessoaId,
} from '../../../data/financeiroData.js';
import { buildRouterStateChaveClienteProcesso } from '../../../domain/camposProcessoCliente.js';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../../../repositories/processosRepository.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ETAPA_LABELS, ETAPAS } from '../constants/financeiroConstants.js';
import { resolverTextosPartesCabecalhoCalculo } from '../../../data/processosDadosRelatorio.js';
import {
  extratoRowToUi,
  formatDataExtratoColuna,
  mergeExtratoRowComRespostaApi,
  mergeExtratoRowComRespostaApiCartao,
  montarObservacaoExtratoVinculo,
  promoverContaEscritorioSeVinculado,
  mapApiLancamentoToExtratoRow,
} from './extratoMappers.js';
import { temImovelVinculadoExtratoRow } from './extratoCadastroFiltro.js';
import { buildExtratoUrlParaLancamento } from './extratoDeepLink.js';
import { carregarImovelCadastroPorNumeroPlanilha } from '../../../repositories/imoveisRepository.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
  montarContasContabeisParaSelectExtrato,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  listarLancamentosPorGrupoCompensacaoApi,
  removerLancamentoFinanceiroApi,
  salvarOuAtualizarLancamentoFinanceiroApi,
  removerLancamentoCartaoFinanceiroApi,
  salvarOuAtualizarLancamentoCartaoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { ParearManualCompensacao } from './ParearManualCompensacao.jsx';

const ProcessosLazy = lazy(() =>
  import('../../Processos.jsx').then((module) => ({ default: module.Processos })),
);

function lancamentoPodeAbrirProcesso(draft) {
  if (String(draft?.contaCodigo ?? '').trim().toUpperCase() !== 'A') return false;
  const cod = normalizarCodigoClienteFinanceiro(draft?.codCliente);
  const proc = normalizarProcFinanceiro(draft?.proc);
  return Boolean(cod && proc !== '');
}

/** Resolve cliente/processo na API a partir dos campos digitados (sempre revalida, não reutiliza FK antiga). */
async function resolverVinculoClienteProcNoDraft(draftBase) {
  const codDigitado = normalizarCodigoClienteFinanceiro(draftBase.codCliente);
  const procNorm = normalizarProcFinanceiro(draftBase.proc);

  if (!codDigitado && procNorm === '') {
    return {
      ...draftBase,
      codCliente: '',
      proc: '',
      clienteId: null,
      pessoaRefId: null,
      processoId: null,
    };
  }

  if (!featureFlags.useApiFinanceiro || !featureFlags.useApiProcessos) {
    return {
      ...draftBase,
      codCliente: codDigitado || String(draftBase.codCliente ?? '').trim(),
      proc: procNorm,
    };
  }

  let clienteId = null;
  let pessoaRefId = null;
  let processoId = null;
  let codGravado = codDigitado || '';

  if (codDigitado) {
    const cliente = await buscarClientePorCodigo(codDigitado);
    clienteId =
      cliente?.clienteId != null
        ? Number(cliente.clienteId)
        : cliente?.id != null
          ? Number(cliente.id)
          : null;
    pessoaRefId =
      cliente?.pessoaId != null && Number.isFinite(Number(cliente.pessoaId))
        ? Number(cliente.pessoaId)
        : null;
    const codResolucao = normalizarCodigoClienteFinanceiro(cliente?.codigoCliente);
    if (codResolucao) codGravado = codResolucao;
    if (!clienteId) {
      throw new Error(`Cliente ${codDigitado} não encontrado.`);
    }
  }

  if (codDigitado && procNorm !== '') {
    const processo = await buscarProcessoPorChaveNatural(codGravado || codDigitado, procNorm);
    processoId =
      processo?.id != null && Number.isFinite(Number(processo.id)) ? Number(processo.id) : null;
  }

  if (pessoaRefId && codGravado) {
    registrarCodigoClienteFinanceiroPorPessoaId(pessoaRefId, codGravado);
  }

  return {
    ...draftBase,
    codCliente: codGravado || codDigitado || '',
    proc: procNorm,
    clienteId,
    pessoaRefId,
    processoId,
  };
}

/** Valida e normaliza nº do imóvel (planilha) para conta I. */
async function resolverVinculoImovelNoDraft(draftBase) {
  const npDigitado = normalizarNumeroImovelFinanceiro(draftBase.numeroImovel);
  if (!npDigitado) {
    return {
      ...draftBase,
      numeroImovel: '',
      grupoCompensacao: null,
      codCliente: '',
      proc: '',
      clienteId: null,
      pessoaRefId: null,
      processoId: null,
    };
  }
  if (featureFlags.useApiImoveis) {
    const r = await carregarImovelCadastroPorNumeroPlanilha(npDigitado);
    if (!r?.encontrado) {
      throw new Error(`Imóvel nº ${npDigitado} não encontrado no cadastro.`);
    }
  }
  return {
    ...draftBase,
    numeroImovel: npDigitado,
    grupoCompensacao: npDigitado,
    codCliente: '',
    proc: '',
    clienteId: null,
    pessoaRefId: null,
    processoId: null,
  };
}

/** Observação «Parte cliente x Parte oposta» após vínculo cod.+proc. */
async function buscarObservacaoVinculoCodProc(codGravado, procNorm, clienteResolvido = null, processoResolvido = null) {
  if (!procNorm) return '';
  try {
    const partes = await resolverTextosPartesCabecalhoCalculo(codGravado, procNorm);
    const obs = montarObservacaoExtratoVinculo(partes.parteCliente, partes.parteOposta);
    if (obs) return obs;
  } catch {
    /* fallback abaixo */
  }
  const pc = String(
    clienteResolvido?.nomeReferencia ?? clienteResolvido?.nomeRazao ?? clienteResolvido?.nome ?? '',
  ).trim();
  const po = String(processoResolvido?.parteOposta ?? processoResolvido?.parte_oposta ?? '').trim();
  return montarObservacaoExtratoVinculo(pc, po);
}

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

export function ExtratoDetailPanel({
  item,
  onClose,
  onSaved,
  onDeleted,
  onModoParearChange,
  fonteExtrato = 'banco',
}) {
  const isCartao = fonteExtrato === 'cartao';
  const toast = useFinanceiroToast();
  const [draft, setDraft] = useState(item);
  const [contas, setContas] = useState([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [modalBuscaImovelAberto, setModalBuscaImovelAberto] = useState(false);
  const [imovelLegenda, setImovelLegenda] = useState(null);
  const [imovelLegendaLoading, setImovelLegendaLoading] = useState(false);
  const [processoEmbed, setProcessoEmbed] = useState(null);
  const [partesLegenda, setPartesLegenda] = useState(null);
  const [partesLegendaLoading, setPartesLegendaLoading] = useState(false);
  const [elosGrupo, setElosGrupo] = useState([]);
  const [elosLoading, setElosLoading] = useState(false);
  /** Evita sobrescrever observação editada manualmente ao resolver partes do processo. */
  const obsEditadaManualRef = useRef(false);

  useEffect(() => {
    setDraft(item);
    setExtrasOpen(false);
    obsEditadaManualRef.current = false;
  }, [item]);

  const codLegenda = normalizarCodigoClienteFinanceiro(draft.codCliente);
  const procLegenda = normalizarProcFinanceiro(draft.proc);
  const contaCodigoDraft = String(draft.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  const isContaE = contaCodigoDraft === 'E';
  const isContaI = contaCodigoDraft === 'I';
  const numeroImovelLegenda = normalizarNumeroImovelFinanceiro(draft.numeroImovel);
  const grupoElo = String(draft.grupoCompensacao ?? draft.proc ?? '').trim();

  useEffect(() => {
    if (isContaE || isContaI || !codLegenda || procLegenda === '') {
      setPartesLegenda(null);
      setPartesLegendaLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPartesLegendaLoading(true);
    resolverTextosPartesCabecalhoCalculo(codLegenda, procLegenda)
      .then((partes) => {
        if (!cancelled) setPartesLegenda(partes);
      })
      .catch(() => {
        if (!cancelled) setPartesLegenda({ parteCliente: '', parteOposta: '' });
      })
      .finally(() => {
        if (!cancelled) setPartesLegendaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codLegenda, procLegenda, isContaE, isContaI]);

  useEffect(() => {
    if (!isContaI || !numeroImovelLegenda || !featureFlags.useApiImoveis) {
      setImovelLegenda(null);
      setImovelLegendaLoading(false);
      return undefined;
    }
    let cancelled = false;
    setImovelLegendaLoading(true);
    carregarImovelCadastroPorNumeroPlanilha(numeroImovelLegenda)
      .then((r) => {
        if (!cancelled) setImovelLegenda(r?.encontrado ? r.item : null);
      })
      .catch(() => {
        if (!cancelled) setImovelLegenda(null);
      })
      .finally(() => {
        if (!cancelled) setImovelLegendaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isContaI, numeroImovelLegenda]);

  useEffect(() => {
    if (isContaE || isContaI || !codLegenda || procLegenda === '' || partesLegendaLoading || obsEditadaManualRef.current) {
      return;
    }
    const obsVinculo = montarObservacaoExtratoVinculo(
      partesLegenda?.parteCliente,
      partesLegenda?.parteOposta,
    );
    if (!obsVinculo) return;
    setDraft((d) => {
      if (
        normalizarCodigoClienteFinanceiro(d.codCliente) !== codLegenda ||
        normalizarProcFinanceiro(d.proc) !== procLegenda
      ) {
        return d;
      }
      if (d.observacao === obsVinculo && d.descricaoDetalhada === obsVinculo) return d;
      return { ...d, observacao: obsVinculo, descricaoDetalhada: obsVinculo };
    });
  }, [codLegenda, procLegenda, partesLegenda, partesLegendaLoading, isContaE, isContaI]);

  useEffect(() => {
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((rows) => setContas(Array.isArray(rows) ? rows : []))
      .catch(() => setContas([]));
    return () => ac.abort();
  }, []);

  const contasSelect = useMemo(() => montarContasContabeisParaSelectExtrato(contas), [contas]);

  const contaToLetra = useMemo(
    () => ({
      ...buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
      ...Object.fromEntries(
        (contas || []).map((c) => [String(c.nome ?? ''), String(c.codigo ?? '').toUpperCase()]),
      ),
    }),
    [contas],
  );

  const elosPares = useMemo(
    () =>
      (elosGrupo || []).filter((l) => Number(l.id) !== Number(draft.id)),
    [elosGrupo, draft.id],
  );

  useEffect(() => {
    if (!isContaE || !grupoElo || !featureFlags.useApiFinanceiro) {
      setElosGrupo([]);
      setElosLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    setElosLoading(true);
    listarLancamentosPorGrupoCompensacaoApi(grupoElo, { signal: ac.signal })
      .then((lista) => {
        if (ac.signal.aborted) return;
        const mapped = (Array.isArray(lista) ? lista : []).map((l) =>
          mapApiLancamentoToExtratoRow(l, contaToLetra),
        );
        setElosGrupo(mapped);
      })
      .catch(() => {
        if (!ac.signal.aborted) setElosGrupo([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setElosLoading(false);
      });
    return () => ac.abort();
  }, [isContaE, grupoElo, draft.id, contaToLetra]);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);

  const handlePareadoCompensacao = useCallback(
    (merged) => {
      setDraft(merged);
      onSaved?.(merged);
    },
    [onSaved],
  );

  const mostrarParearManual =
    isContaE &&
    !isCartao &&
    featureFlags.useApiFinanceiro &&
    !elosLoading &&
    elosPares.length === 0;

  useEffect(() => {
    if (!onModoParearChange) return undefined;
    if (mostrarParearManual && draft?.id) {
      onModoParearChange({
        active: true,
        lancamentoId: Number(draft.id),
        origemExtrato: isCartao ? 'cartao' : 'banco',
      });
    } else {
      onModoParearChange(null);
    }
    return () => onModoParearChange(null);
  }, [mostrarParearManual, draft?.id, isCartao, onModoParearChange]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let draftSalvar = promoverContaEscritorioSeVinculado(draft, contasSelect);
      const codConta = String(draftSalvar.contaCodigo ?? '').trim().toUpperCase();
      const contaEscolhida = contasSelect.find((c) => c.codigo === codConta);
      if (contaEscolhida?.id) {
        draftSalvar = {
          ...draftSalvar,
          contaContabilId: contaEscolhida.id,
          contaContabilNome: contaEscolhida.nome ?? draftSalvar.contaContabilNome,
        };
      }
      try {
        draftSalvar =
          String(draftSalvar.contaCodigo ?? '').trim().toUpperCase() === 'I'
            ? await resolverVinculoImovelNoDraft(draftSalvar)
            : await resolverVinculoClienteProcNoDraft(draftSalvar);
      } catch (e) {
        toast.error(e?.message || 'Falha ao resolver vínculo.');
        return;
      }
      const codGravado = normalizarCodigoClienteFinanceiro(draftSalvar.codCliente);
      const procNorm = normalizarProcFinanceiro(draftSalvar.proc);
      const codContaSalvar = String(draftSalvar.contaCodigo ?? '').trim().toUpperCase();
      if (
        codContaSalvar !== 'I' &&
        codGravado &&
        procNorm !== '' &&
        !obsEditadaManualRef.current
      ) {
        let obsVinculo = montarObservacaoExtratoVinculo(
          partesLegenda?.parteCliente,
          partesLegenda?.parteOposta,
        );
        if (!obsVinculo) {
          obsVinculo = await buscarObservacaoVinculoCodProc(codGravado, procNorm);
        }
        if (obsVinculo) {
          draftSalvar = { ...draftSalvar, observacao: obsVinculo, descricaoDetalhada: obsVinculo };
        }
      }
      if (draftSalvar.contaCodigo !== draft.contaCodigo) {
        setDraft(draftSalvar);
      }
      const ui = extratoRowToUi(draftSalvar);
      const saved = isCartao
        ? await salvarOuAtualizarLancamentoCartaoFinanceiroApi(ui)
        : await salvarOuAtualizarLancamentoFinanceiroApi(ui);
      if (!saved?.id) {
        toast.error('Falha ao salvar lançamento.');
        return;
      }
      const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
      const merged = isCartao
        ? mergeExtratoRowComRespostaApiCartao(draftSalvar, saved, contaToLetra)
        : mergeExtratoRowComRespostaApi(draftSalvar, saved, contaToLetra);
      if (merged.pessoaRefId && merged.codCliente) {
        registrarCodigoClienteFinanceiroPorPessoaId(merged.pessoaRefId, merged.codCliente);
      }
      onSaved(merged);
      setDraft(merged);
      toast.success('Lançamento atualizado.');
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarVinculoProcesso = async ({ codCliente, proc }) => {
    const cod = normalizarCodigoClienteFinanceiro(codCliente);
    const procNorm = normalizarProcFinanceiro(proc);
    if (!cod) {
      toast.warn('Selecione um cliente com código válido.');
      return;
    }

    setModalVinculoAberto(false);
    setSaving(true);

    let clienteId = draft.clienteId ?? null;
    let pessoaRefId = draft.pessoaRefId ?? null;
    let processoId = draft.processoId ?? null;

    let codGravado = cod;
    let clienteResolvido = null;
    let processoResolvido = null;

    if (featureFlags.useApiFinanceiro && featureFlags.useApiProcessos) {
      try {
        clienteResolvido = await buscarClientePorCodigo(cod);
        processoResolvido = procNorm ? await buscarProcessoPorChaveNatural(cod, procNorm) : null;
        const clientePk =
          clienteResolvido?.clienteId != null
            ? Number(clienteResolvido.clienteId)
            : clienteResolvido?.id != null
              ? Number(clienteResolvido.id)
              : null;
        pessoaRefId =
          clienteResolvido?.pessoaId != null && Number.isFinite(Number(clienteResolvido.pessoaId))
            ? Number(clienteResolvido.pessoaId)
            : null;
        const codResolucao = normalizarCodigoClienteFinanceiro(clienteResolvido?.codigoCliente);
        if (codResolucao) codGravado = codResolucao;
        clienteId = clientePk;
        processoId =
          processoResolvido?.id != null && Number.isFinite(Number(processoResolvido.id))
            ? Number(processoResolvido.id)
            : null;
      } catch (e) {
        toast.error(e?.message || 'Falha ao resolver cliente/processo na API.');
        setSaving(false);
        return;
      }
    }

    let obsVinculo = '';
    if (procNorm) {
      obsVinculo = await buscarObservacaoVinculoCodProc(
        codGravado,
        procNorm,
        clienteResolvido,
        processoResolvido,
      );
    }

    obsEditadaManualRef.current = false;
    const nextDraft = promoverContaEscritorioSeVinculado(
      {
        ...draft,
        codCliente: codGravado,
        proc: procNorm || '',
        clienteId,
        pessoaRefId,
        processoId,
        ...(obsVinculo ? { observacao: obsVinculo, descricaoDetalhada: obsVinculo } : {}),
      },
      contasSelect,
    );

    if (pessoaRefId) registrarCodigoClienteFinanceiroPorPessoaId(pessoaRefId, codGravado);

    try {
      if (!featureFlags.useApiFinanceiro) {
        setDraft(nextDraft);
        onSaved?.(nextDraft);
        toast.success(`Vínculo: cliente ${cod}, proc. ${procNorm || '—'} (conta A).`);
        onClose?.();
        return;
      }

      const ui = extratoRowToUi(nextDraft);
      const saved = isCartao
        ? await salvarOuAtualizarLancamentoCartaoFinanceiroApi(ui)
        : await salvarOuAtualizarLancamentoFinanceiroApi(ui);
      if (!saved?.id) {
        toast.error('Falha ao gravar vínculo no lançamento.');
        return;
      }
      const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
      const merged = isCartao
        ? mergeExtratoRowComRespostaApiCartao(nextDraft, saved, contaToLetra)
        : mergeExtratoRowComRespostaApi(nextDraft, saved, contaToLetra);
      setDraft(merged);
      onSaved?.(merged);
      dispatchRefreshPendentes();
      toast.success(`Vinculado: cliente ${codGravado}, proc. ${procNorm || '—'} — conta A (Escritório).`);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao gravar vínculo.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    const apiId = Number(draft.id);
    if (!featureFlags.useApiFinanceiro) {
      toast.error('API financeiro desativada — exclusão indisponível.');
      return;
    }
    if (!apiId) {
      toast.error('Lançamento sem id na API.');
      return;
    }
    setDeleting(true);
    try {
      await (isCartao ? removerLancamentoCartaoFinanceiroApi(apiId) : removerLancamentoFinanceiroApi(apiId));
      toast.success('Lançamento excluído do extrato.');
      dispatchRefreshPendentes();
      onDeleted?.(apiId);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao excluir lançamento.');
    } finally {
      setDeleting(false);
      setConfirmExcluir(false);
    }
  };

  const dataCompleta = formatDataExtratoColuna(draft.dataLancamento);
  const resumoVinculo = `${draft.descricao} · ${dataCompleta} · ${draft.bancoNome ?? ''}`;
  const podeExcluir = featureFlags.useApiFinanceiro && Number(draft.id) > 0;
  const compensacaoSemPar =
    isContaE && grupoElo && !elosLoading && elosGrupo.length < 2;
  const etapaExibida = compensacaoSemPar ? ETAPAS.IMPORTADO : draft.etapa;
  const etapaLabel = ETAPA_LABELS[etapaExibida] ?? etapaExibida;
  const podeAbrirProcesso = useMemo(() => lancamentoPodeAbrirProcesso(draft), [draft]);

  const abrirProcessoFlutuante = useCallback(() => {
    const cod = normalizarCodigoClienteFinanceiro(draft.codCliente);
    const proc = normalizarProcFinanceiro(draft.proc);
    if (!cod || proc === '') return;
    setProcessoEmbed({
      revision: Date.now(),
      routerState: buildRouterStateChaveClienteProcesso(cod, proc),
    });
  }, [draft.codCliente, draft.proc]);

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-30 w-[360px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] animate-in pointer-events-auto"
      style={{ animation: 'extratoPanelIn 200ms ease' }}
      role="dialog"
      aria-label="Detalhes do lançamento"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Detalhes do lançamento</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Fechar"
          data-financeiro-fechar-detalhe
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        <section className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Informações</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{draft.descricao}</p>
          {draft.descricaoDetalhada ? (
            <p className="text-slate-600 dark:text-slate-400">{draft.descricaoDetalhada}</p>
          ) : null}
          <p className="text-slate-500 text-xs">
            {draft.bancoNome}
            {draft.numeroBanco != null ? ` (${draft.numeroBanco})` : ''}
          </p>
          <p className="font-mono text-xs text-slate-400 break-all">{draft.numeroLancamento}</p>
          <p className="text-slate-600 dark:text-slate-400">{dataCompleta}</p>
          <ValorText valor={draft.valor} natureza={draft.natureza} />
          {draft.saldo != null ? (
            <p className="text-xs text-slate-500">Saldo: {Number(draft.saldo).toLocaleString('pt-BR')}</p>
          ) : null}
          <Field label="Observação">
            <textarea
              value={draft.observacao ?? ''}
              onChange={(e) => {
                obsEditadaManualRef.current = true;
                const v = e.target.value;
                patch({ observacao: v, descricaoDetalhada: v });
              }}
              rows={2}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 resize-y"
              placeholder="Observação do lançamento"
            />
          </Field>
        </section>

        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Classificação</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {podeAbrirProcesso ? (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={abrirProcessoFlutuante}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
                  title={`Abrir processo (cliente ${normalizarCodigoClienteFinanceiro(draft.codCliente)}, proc. ${normalizarProcFinanceiro(draft.proc)})`}
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden />
                  Abrir processo
                </button>
              ) : null}
              {!isContaE && !isContaI ? (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => setModalVinculoAberto(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/50 dark:hover:bg-indigo-950 disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" aria-hidden />
                  Vincular a Processo
                </button>
              ) : null}
            </div>
          </div>
          <Field label="Conta">
            <select
              value={contaCodigoDraft}
              onChange={(e) => {
                const cod = String(e.target.value ?? '').trim().toUpperCase();
                const c = contasSelect.find((x) => String(x.codigo).toUpperCase() === cod);
                patch({
                  contaCodigo: cod,
                  contaContabilId: c?.id ?? draft.contaContabilId,
                  contaContabilNome: c?.nome ?? draft.contaContabilNome,
                  ...(cod === 'E'
                    ? { codCliente: '', proc: '', clienteId: null, processoId: null, numeroImovel: '' }
                    : {}),
                  ...(cod === 'I'
                    ? {
                        codCliente: '',
                        proc: '',
                        clienteId: null,
                        pessoaRefId: null,
                        processoId: null,
                        numeroImovel: normalizarNumeroImovelFinanceiro(draft.numeroImovel ?? draft.grupoCompensacao),
                        grupoCompensacao: normalizarNumeroImovelFinanceiro(draft.numeroImovel ?? draft.grupoCompensacao) || null,
                      }
                    : {}),
                  ...(contaCodigoDraft === 'I' && cod !== 'I'
                    ? { numeroImovel: '', grupoCompensacao: null }
                    : {}),
                });
              }}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
            >
              {!contasSelect.some((c) => String(c.codigo).toUpperCase() === contaCodigoDraft) ? (
                <option value={contaCodigoDraft}>
                  {contaCodigoDraft} — {draft.contaContabilNome}
                </option>
              ) : null}
              {contasSelect.map((c) => (
                <option key={c.codigo} value={String(c.codigo ?? '').toUpperCase()}>
                  {String(c.codigo ?? '').toUpperCase()} — {c.nome}
                </option>
              ))}
            </select>
          </Field>
          {isContaE ? (
            <Field label="Vínculo (elo com outro lançamento)">
              {grupoElo ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Grupo {grupoElo}
                  </p>
                  {elosLoading ? (
                    <p className="text-xs text-slate-500">Carregando lançamentos do par…</p>
                  ) : elosPares.length > 0 ? (
                    <ul className="space-y-2">
                      {elosPares.map((elo) => (
                        <li key={elo.id}>
                          <Link
                            to={buildExtratoUrlParaLancamento({
                              lancamentoId: elo.id,
                              numeroBanco: elo.numeroBanco,
                              data: elo.dataExibicao ?? elo.dataLancamento,
                            })}
                            className="block rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-2.5 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <ContaBadge codigo={elo.contaCodigo} size="sm" />
                              <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                                {elo.dataExibicao}
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2">
                              {elo.descricao || '—'}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                              <ValorText valor={elo.valor} natureza={elo.natureza} />
                              <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-medium">
                                <ExternalLink className="w-3 h-3" aria-hidden />
                                Ver no extrato
                              </span>
                            </div>
                            {elo.bancoNome ? (
                              <p className="text-[10px] text-slate-400 mt-1 truncate">{elo.bancoNome}</p>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                      Grupo registrado, mas ainda sem o outro lançamento do par.
                    </p>
                  )}
                  <Link
                    to={`/financeiro/compensacao?grupo=${encodeURIComponent(grupoElo)}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Abrir módulo de compensação
                  </Link>
                </div>
              ) : !mostrarParearManual ? (
                <p className="text-sm text-slate-500">Sem elo — pareie no Inbox ou em Compensação.</p>
              ) : null}
              {mostrarParearManual ? (
                <ParearManualCompensacao
                  lancamento={draft}
                  contaToLetra={contaToLetra}
                  onPareado={handlePareadoCompensacao}
                  disabled={saving || deleting}
                />
              ) : null}
            </Field>
          ) : isContaI ? (
            <>
              <Field label="Imóvel (nº planilha)">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.numeroImovel ?? ''}
                    onChange={(e) => {
                      const np = normalizarNumeroImovelFinanceiro(e.target.value);
                      patch({
                        numeroImovel: e.target.value,
                        grupoCompensacao: np || null,
                        codCliente: '',
                        proc: '',
                        clienteId: null,
                        pessoaRefId: null,
                        processoId: null,
                      });
                    }}
                    className="flex-1 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                    placeholder="Nº do imóvel"
                  />
                  <button
                    type="button"
                    disabled={saving || deleting}
                    onClick={() => setModalBuscaImovelAberto(true)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    title="Buscar no cadastro de imóveis"
                  >
                    <Search className="w-3.5 h-3.5" aria-hidden />
                    Buscar
                  </button>
                </div>
              </Field>
              {numeroImovelLegenda ? (
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 space-y-1 text-xs">
                  {imovelLegendaLoading ? (
                    <p className="text-slate-500 dark:text-slate-400">Carregando cadastro do imóvel…</p>
                  ) : imovelLegenda ? (
                    <>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium text-slate-500 dark:text-slate-400">Condomínio: </span>
                        {imovelLegenda.condominio?.trim() || '—'}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium text-slate-500 dark:text-slate-400">Unidade: </span>
                        {imovelLegenda.unidade?.trim() || '—'}
                      </p>
                      <Link
                        to="/imoveis"
                        state={{ numeroPlanilha: Number(numeroImovelLegenda) }}
                        className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-medium hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden />
                        Abrir cadastro do imóvel
                      </Link>
                    </>
                  ) : (
                    <p className="text-amber-800 dark:text-amber-200">
                      Nº {numeroImovelLegenda} não encontrado no cadastro de imóveis.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Field label="Cliente (código)">
                <input
                  type="text"
                  value={draft.codCliente}
                  onChange={(e) => {
                    obsEditadaManualRef.current = false;
                    patch({
                      codCliente: e.target.value,
                      clienteId: null,
                      pessoaRefId: null,
                      processoId: null,
                    });
                  }}
                  className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                  placeholder="Cód. cliente"
                />
              </Field>
              <Field label="Processo">
                <input
                  type="text"
                  value={draft.proc}
                  onChange={(e) => {
                    obsEditadaManualRef.current = false;
                    patch({ proc: e.target.value, processoId: null });
                  }}
                  className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
                  placeholder="Nº processo"
                />
              </Field>
              {codLegenda && procLegenda !== '' ? (
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 space-y-1 text-xs">
                  {partesLegendaLoading ? (
                    <p className="text-slate-500 dark:text-slate-400">Carregando partes do processo…</p>
                  ) : (
                    <>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium text-slate-500 dark:text-slate-400">Parte autora: </span>
                        {partesLegenda?.parteCliente?.trim() ? partesLegenda.parteCliente : '—'}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium text-slate-500 dark:text-slate-400">Parte oposta: </span>
                        {partesLegenda?.parteOposta?.trim() ? partesLegenda.parteOposta : '—'}
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <EtapaDot
              etapa={etapaExibida}
              cadastroImoveis={isContaI ? temImovelVinculadoExtratoRow(draft) : undefined}
            />
            <span>{etapaLabel}</span>
            <ContaBadge codigo={draft.contaCodigo} size="sm" />
          </div>
          {String(draft.contaCodigo ?? '').toUpperCase() === 'N' &&
          (String(draft.codCliente ?? '').trim() || draft.clienteId) ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              Cliente/processo preenchidos, mas a conta contábil ainda é <strong>N</strong> (não
              identificada). Use <strong>Vincular a Processo</strong> ou <strong>Salvar</strong> para
              classificar como <strong>A</strong> (Escritório).
            </p>
          ) : null}
        </section>

        {!isContaE ? (
          <section className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs font-medium text-slate-500">Compensação</p>
            {draft.grupoCompensacao ? (
              <p className="text-sm">
                Grupo:{' '}
                <Link
                  to={`/financeiro/compensacao?grupo=${encodeURIComponent(draft.grupoCompensacao)}`}
                  className="text-blue-600 hover:underline dark:text-blue-400 font-mono text-xs"
                >
                  {draft.grupoCompensacao}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-slate-500">(nenhum)</p>
            )}
          </section>
        ) : null}

        <section className="border-t border-slate-100 dark:border-slate-800 pt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 w-full"
            onClick={() => setExtrasOpen((v) => !v)}
          >
            {extrasOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Campos extras
          </button>
          {extrasOpen ? (
            <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p>
                <span className="text-slate-400">Dimensão: </span>
                {draft.dimensao || '—'}
              </p>
              <p>
                <span className="text-slate-400">Parcela: </span>
                {draft.parcela || '—'}
              </p>
              <p>
                <span className="text-slate-400">Eq.: </span>
                {draft.eq || '—'}
              </p>
              <p>
                <span className="text-slate-400">Ref: </span>
                {draft.ref || '—'}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {podeExcluir ? (
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => setConfirmExcluir(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:bg-red-950/40 dark:hover:bg-red-950/70 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
            {deleting ? 'Excluindo…' : 'Excluir lançamento do extrato'}
          </button>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => void handleSave()}
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </footer>

      <ModalVinculoClienteProcFinanceiro
        aberto={modalVinculoAberto}
        onFechar={() => setModalVinculoAberto(false)}
        resumoLancamento={resumoVinculo}
        onAplicar={handleAplicarVinculoProcesso}
        modoContaEscritorio
        titulo="Vincular a Processo"
      />

      <ModalBuscaImovel
        open={modalBuscaImovelAberto}
        onClose={() => setModalBuscaImovelAberto(false)}
        onSelecionar={(im) => {
          const np = normalizarNumeroImovelFinanceiro(im?.numeroPlanilha);
          if (!np) {
            toast.warn('Imóvel selecionado sem nº de planilha válido.');
            return;
          }
          patch({
            numeroImovel: np,
            grupoCompensacao: np,
            codCliente: '',
            proc: '',
            clienteId: null,
            pessoaRefId: null,
            processoId: null,
          });
          setModalBuscaImovelAberto(false);
        }}
      />

      <ConfirmDialog
        open={confirmExcluir}
        title="Excluir lançamento?"
        message={`Remover permanentemente «${draft.descricao}» (${dataCompleta}) deste extrato? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmExcluir(false)}
        onConfirm={() => void handleExcluir()}
      />

      {processoEmbed ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extrato-processo-embed-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProcessoEmbed(null);
          }}
        >
          <div
            className="flex flex-col w-[min(100vw-0.5rem,1280px)] h-[min(100dvh-0.5rem,920px)] max-h-[min(100dvh-0.5rem,920px)] min-h-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f141c] shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141c2c] shrink-0">
              <h2 id="extrato-processo-embed-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                Processo (cadastro)
              </h2>
              <button
                type="button"
                onClick={() => setProcessoEmbed(null)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Fechar formulário de processo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                    Carregando formulário de processos…
                  </div>
                }
              >
                <ProcessosLazy
                  key={processoEmbed.revision}
                  embedIntent={processoEmbed.routerState}
                  embedIntentRevision={processoEmbed.revision}
                  onFecharEmbed={() => setProcessoEmbed(null)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes extratoPanelIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
