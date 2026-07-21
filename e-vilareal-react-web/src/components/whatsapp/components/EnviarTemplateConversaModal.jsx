import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LayoutTemplate, Loader2, RotateCcw, X } from 'lucide-react';
import { getJanelaAberta, sendWhatsAppTemplate } from '../../../repositories/whatsappRepository.js';
import { formatDateTimeBR, formatPhoneDisplay } from '../../../utils/whatsappFormat.js';
import { buildComposePreviewText } from '../../../utils/whatsappTemplateUtils.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { processosBtnPrimary } from '../../processos/ProcessosAdminLayout.jsx';
import { MessageComposePreview } from './MessageComposePreview.jsx';
import { TemplateParamsForm, TemplateSelect } from './TemplateParamsForm.jsx';
import { useWhatsAppTemplates } from '../hooks/useWhatsAppTemplates.js';
import {
  buildTemplateParamsFromMessage,
  resolveTemplateDefinition,
} from '../utils/whatsappTemplateParamsUtils.js';

export function EnviarTemplateConversaModal({
  open,
  onClose,
  phoneNumber,
  contactName = '',
  lastTemplateMessage = null,
  contextoVinculo = null,
  onSuccess,
}) {
  const { templates, loading: loadingTemplates } = useWhatsAppTemplates({ approvedOnly: true });

  const [mode, setMode] = useState('reenviar');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [resendParams, setResendParams] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [janela, setJanela] = useState(null);
  const [carregandoJanela, setCarregandoJanela] = useState(false);

  const resendTemplateName = String(lastTemplateMessage?.templateName ?? '').trim();
  const hasPreviousTemplate = Boolean(resendTemplateName);

  const reset = useCallback(() => {
    setMode(hasPreviousTemplate ? 'reenviar' : 'outro');
    setTemplateName('');
    setParams([]);
    setResendParams([]);
    setError('');
    setJanela(null);
  }, [hasPreviousTemplate]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || !hasPreviousTemplate) return;
    const { params: parsed } = buildTemplateParamsFromMessage(lastTemplateMessage, templates);
    setResendParams(parsed);
  }, [open, hasPreviousTemplate, lastTemplateMessage, templates]);

  useEffect(() => {
    if (!open || !phoneNumber) {
      setJanela(null);
      return undefined;
    }
    let cancelado = false;
    setCarregandoJanela(true);
    void getJanelaAberta(phoneNumber)
      .then((res) => {
        if (!cancelado) setJanela(res);
      })
      .catch(() => {
        if (!cancelado) setJanela(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoJanela(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, phoneNumber]);

  useEffect(() => {
    const tpl = resolveTemplateDefinition(templateName, templates);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName, templates]);

  const resendTemplate = useMemo(
    () => resolveTemplateDefinition(resendTemplateName, templates),
    [resendTemplateName, templates],
  );

  const selectedTemplate = useMemo(
    () => resolveTemplateDefinition(templateName, templates),
    [templateName, templates],
  );

  const resendPreview = useMemo(
    () =>
      buildComposePreviewText({
        mode: 'template',
        template: resendTemplate,
        params: resendParams,
      }),
    [resendTemplate, resendParams],
  );

  const otherPreview = useMemo(
    () =>
      buildComposePreviewText({
        mode: 'template',
        template: selectedTemplate,
        params,
      }),
    [selectedTemplate, params],
  );

  const vinculo = useMemo(() => {
    const opts = {};
    if (contextoVinculo?.clienteId != null) opts.clienteId = Number(contextoVinculo.clienteId);
    if (contextoVinculo?.processoId != null) opts.processoId = Number(contextoVinculo.processoId);
    return opts;
  }, [contextoVinculo]);

  const tituloContato = useMemo(() => {
    const nome = String(contactName ?? '').trim();
    if (nome) return nome;
    return formatPhoneDisplay(phoneNumber);
  }, [contactName, phoneNumber]);

  useCloseOnEscape(open, onClose, { enabled: !sending });

  const enviarTemplate = async (nomeTemplate, parametros) => {
    if (!phoneNumber) {
      setError('Telefone da conversa inválido.');
      return;
    }
    if (!nomeTemplate) {
      setError('Selecione um template.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const res = await sendWhatsAppTemplate(
        phoneNumber,
        nomeTemplate,
        'pt_BR',
        parametros.map((p) => String(p ?? '').trim()),
        vinculo,
      );
      if (res?.success === false) {
        setError(res.error || 'Falha ao enviar template.');
        return;
      }
      onSuccess?.({ templateName: nomeTemplate, params: parametros });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Falha ao enviar template.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'reenviar') {
      await enviarTemplate(resendTemplateName, resendParams);
      return;
    }
    await enviarTemplate(templateName, params);
  };

  if (!open) return null;

  const janelaFechada = janela && !janela.janelaAberta;
  const previewText = mode === 'reenviar' ? resendPreview : otherPreview;
  const previewTemplateName =
    mode === 'reenviar' ? resendTemplateName : templateName || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enviar-template-conversa-titulo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id="enviar-template-conversa-titulo"
            className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            <LayoutTemplate className="h-5 w-5 text-emerald-600" aria-hidden />
            Enviar template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Para <span className="font-semibold text-slate-800 dark:text-slate-200">{tituloContato}</span>
          {phoneNumber ? (
            <span className="text-slate-500 dark:text-slate-500"> · {formatPhoneDisplay(phoneNumber)}</span>
          ) : null}
        </p>

        {carregandoJanela ? (
          <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando janela de conversa…
          </p>
        ) : null}

        {janelaFechada && !carregandoJanela ? (
          <div
            className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p>
                Este contato não respondeu nas últimas 24 horas. Use um template aprovado para enviar a mensagem.
              </p>
              {janela.ultimaInboundAt ? (
                <p className="mt-1 text-xs opacity-80">
                  Última resposta: {formatDateTimeBR(janela.ultimaInboundAt)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPreviousTemplate ? (
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('reenviar')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'reenviar'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reenviar anterior
              </button>
              <button
                type="button"
                onClick={() => setMode('outro')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'outro'
                    ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <LayoutTemplate className="h-4 w-4" aria-hidden />
                Outro template
              </button>
            </div>
          ) : null}

          {mode === 'reenviar' && hasPreviousTemplate ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Template anterior
                </p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {resendTemplate?.label || resendTemplateName.replace(/_/g, ' ')}
                </p>
              </div>
              <TemplateParamsForm
                templateName={resendTemplateName}
                values={resendParams}
                onChange={setResendParams}
                templates={templates}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <TemplateSelect
                value={templateName}
                onChange={setTemplateName}
                id="conversa-template"
                templates={templates}
                loading={loadingTemplates}
              />
              <TemplateParamsForm
                templateName={templateName}
                values={params}
                onChange={setParams}
                templates={templates}
              />
            </div>
          )}

          <MessageComposePreview
            compact
            text={previewText}
            templateName={previewTemplateName}
            emptyHint="Selecione um template e preencha os parâmetros."
          />

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending || (mode === 'outro' && !templateName)}
              className={processosBtnPrimary}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'reenviar' ? 'Reenviar template' : 'Enviar template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
