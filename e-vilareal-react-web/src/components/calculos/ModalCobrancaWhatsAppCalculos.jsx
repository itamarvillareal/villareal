import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { dispararCobrancas, getCobrancaPreview } from '../../repositories/whatsappRepository.js';
import { buildScheduledMessagePreview } from '../../utils/whatsappTemplateUtils.js';
import { useWhatsAppTemplates } from '../whatsapp/hooks/useWhatsAppTemplates.js';

const TEMPLATE_COBRANCA = 'cobranca_pagamento';

function extrairPrimeiroNome(nome) {
  const t = String(nome ?? '').trim();
  if (!t) return 'Cliente';
  return t.split(/\s+/)[0] || 'Cliente';
}

function formatMoeda(val) {
  return Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Envia cobrança WhatsApp (template cobranca_pagamento) para o processo da rodada atual.
 */
export function ModalCobrancaWhatsAppCalculos({
  open,
  onClose,
  codigoCliente,
  numeroProcesso,
  dimensao = 0,
}) {
  const { templates } = useWhatsAppTemplates({ approvedOnly: true });
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  useCloseOnEscape(open, onClose);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    setSucesso(false);
    setPreviewItem(null);
    try {
      const rows = await getCobrancaPreview({ clienteEscritorioCodigo: codigoCliente });
      const list = Array.isArray(rows) ? rows : [];
      const ni = Number(numeroProcesso);
      const item = list.find((p) => Number(p.processoNumeroInterno) === ni);
      if (!item) {
        setErro(
          `Processo ${numeroProcesso} não encontrado para cobrança. Verifique cadastro do réu e unidade no módulo Processos.`,
        );
        return;
      }
      setPreviewItem(item);
    } catch (e) {
      setErro(e?.message || 'Erro ao carregar dados da cobrança.');
    } finally {
      setLoading(false);
    }
  }, [codigoCliente, numeroProcesso]);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  const motivoBloqueio = useMemo(() => {
    if (!previewItem) return '';
    if (!previewItem.temTelefone) return 'Réu/devedor sem telefone WhatsApp cadastrado.';
    if (previewItem.elegivelCobranca === false) {
      return previewItem.motivoInelegivel || 'Processo inelegível para cobrança.';
    }
    if (previewItem.jaCobradoEsteMes) return 'Já foi enviada cobrança para este processo neste mês.';
    if (previewItem.calculoDesatualizado) {
      return `Cálculo desatualizado${previewItem.dataCalculo ? ` (${previewItem.dataCalculo})` : ''}. Atualize antes de cobrar.`;
    }
    return '';
  }, [previewItem]);

  const podeEnviar = Boolean(previewItem && !motivoBloqueio && !enviando && !sucesso);

  const textoPreview = useMemo(() => {
    if (!previewItem) return '';
    const params = [
      extrairPrimeiroNome(previewItem.pessoaNome),
      previewItem.unidadeDescricao || '—',
      previewItem.condominioNome || '—',
    ];
    return buildScheduledMessagePreview(TEMPLATE_COBRANCA, params, templates);
  }, [previewItem, templates]);

  const handleEnviar = async () => {
    if (!previewItem || !podeEnviar) return;
    const tel = previewItem.telefoneFormatado || previewItem.telefone || '';
    if (
      !window.confirm(
        `Enviar cobrança WhatsApp (template) para ${previewItem.pessoaNome}${tel ? ` — ${tel}` : ''}?`,
      )
    ) {
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const item = {
        imovelId: previewItem.imovelId ?? null,
        clienteId: previewItem.clienteId ?? null,
        pessoaId: previewItem.pessoaId,
        pessoaNome: previewItem.pessoaNome,
        telefone: previewItem.telefone,
        condominioNome: previewItem.condominioNome,
        unidadeDescricao: previewItem.unidadeDescricao,
        processoId: previewItem.processoId,
        valorPendente: previewItem.valorPendente ?? 0,
      };
      const loteDescricao = `Cálculos — cliente ${codigoCliente} proc. ${numeroProcesso} dim. ${dimensao}`;
      const res = await dispararCobrancas([item], loteDescricao);
      if ((res?.enviados ?? 0) >= 1) {
        setSucesso(true);
        return;
      }
      throw new Error(
        `Envio não concluído (${res?.falhos ?? 0} falha(s), ${res?.puladosInelegiveis ?? 0} ignorado(s)).`,
      );
    } catch (e) {
      setErro(e?.message || 'Falha ao enviar cobrança.');
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cobranca-wa-calculos-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-emerald-200/80 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
          <h2 id="modal-cobranca-wa-calculos-titulo" className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            Cobrança WhatsApp
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3 text-sm text-slate-700">
          <p className="text-xs text-slate-500">
            Cliente <span className="font-mono font-medium text-slate-700">{codigoCliente}</span> · proc.{' '}
            <span className="font-mono font-medium text-slate-700">{numeroProcesso}</span>
            {Number(dimensao) > 0 ? (
              <>
                {' '}
                · dim. <span className="font-mono font-medium text-slate-700">{dimensao}</span>
              </>
            ) : null}
          </p>

          {loading ? (
            <p className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando dados…
            </p>
          ) : null}

          {erro ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-xs leading-snug">{erro}</p>
          ) : null}

          {sucesso ? (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-xs leading-snug">
              Cobrança enviada com sucesso via template <strong>cobranca_pagamento</strong>.
            </p>
          ) : null}

          {previewItem && !loading ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-slate-500">Destinatário</dt>
                <dd className="font-medium text-slate-800">{previewItem.pessoaNome || '—'}</dd>
                <dt className="text-slate-500">Unidade</dt>
                <dd>{previewItem.unidadeDescricao || '—'}</dd>
                <dt className="text-slate-500">Telefone</dt>
                <dd>{previewItem.temTelefone ? previewItem.telefoneFormatado || previewItem.telefone : '—'}</dd>
                <dt className="text-slate-500">Pendência</dt>
                <dd className="tabular-nums">{formatMoeda(previewItem.valorPendente)}</dd>
              </dl>

              {motivoBloqueio ? (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs leading-snug">
                  {motivoBloqueio}
                </p>
              ) : null}

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                  Preview — template cobranca_pagamento
                </p>
                <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-sans leading-relaxed">
                  {textoPreview || '—'}
                </pre>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {sucesso ? 'Fechar' : 'Cancelar'}
          </button>
          {!sucesso ? (
            <button
              type="button"
              disabled={!podeEnviar}
              onClick={() => void handleEnviar()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Enviar cobrança
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
