import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { MessageComposePreview } from './components/MessageComposePreview.jsx';
import { TemplateParamsForm, TemplateSelect } from './components/TemplateParamsForm.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppTemplates } from './hooks/useWhatsAppTemplates.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { isValidBrazilPhone, normalizePhoneForApi } from '../../utils/whatsappFormat.js';
import {
  buildComposePreviewText,
  FREE_TEXT_DELIVERY_ERROR,
  FREE_TEXT_WINDOW_BANNER,
} from '../../utils/whatsappTemplateUtils.js';
import { processosBtnPrimary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

function findTemplate(templates, name) {
  return templates.find((t) => t.value === name) ?? null;
}

export function WhatsAppEnviarMensagem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendText, sendTemplate } = useWhatsApp();
  const { templates, loading: loadingTemplates } = useWhatsAppTemplates({ approvedOnly: true });
  const toast = useWhatsAppToast();
  const [mode, setMode] = useState('texto');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const preselected = location.state?.templateName;
    if (preselected) {
      setMode('template');
      setTemplateName(preselected);
    }
  }, [location.state?.templateName]);

  useEffect(() => {
    const tpl = findTemplate(templates, templateName);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName, templates]);

  const selectedTemplate = useMemo(
    () => findTemplate(templates, templateName),
    [templates, templateName],
  );

  const previewText = useMemo(
    () =>
      buildComposePreviewText({
        mode,
        message,
        template: selectedTemplate,
        params,
      }),
    [mode, message, selectedTemplate, params],
  );

  const previewTemplateName = mode === 'template' && templateName ? templateName : null;
  const previewEmptyHint =
    mode === 'template'
      ? 'Selecione um template e preencha os parâmetros para ver o preview.'
      : 'Digite a mensagem para ver o preview.';

  const resetForm = () => {
    setPhone('');
    setMessage('');
    setTemplateName('');
    setParams([]);
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    const normalized = normalizePhoneForApi(phone);
    if (!isValidBrazilPhone(phone)) {
      toast.error('Informe um telefone brasileiro válido (DDD + número).');
      return;
    }
    const text = message.trim();
    if (!text) {
      toast.error('Digite a mensagem.');
      return;
    }
    setSending(true);
    try {
      const res = await sendText(normalized, text);
      if (res?.success === false) {
        toast.error(res.error || FREE_TEXT_DELIVERY_ERROR);
        return;
      }
      toast.success('Mensagem enviada com sucesso.');
      navigate(`/whatsapp/conversas?telefone=${encodeURIComponent(normalized)}`);
      resetForm();
    } catch (err) {
      toast.error(err?.message || FREE_TEXT_DELIVERY_ERROR);
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (e) => {
    e.preventDefault();
    const normalized = normalizePhoneForApi(phone);
    if (!isValidBrazilPhone(phone)) {
      toast.error('Informe um telefone brasileiro válido (DDD + número).');
      return;
    }
    if (!templateName) {
      toast.error('Selecione um template.');
      return;
    }
    setSending(true);
    try {
      const res = await sendTemplate(
        normalized,
        templateName,
        'pt_BR',
        params.map((p) => String(p ?? '').trim()),
      );
      if (res?.success === false) {
        toast.error(res.error || 'Falha ao enviar template.');
        return;
      }
      toast.success('Template enviado com sucesso.');
      navigate(`/whatsapp/conversas?telefone=${encodeURIComponent(normalized)}`);
      resetForm();
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar template.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setMode('texto')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'texto' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700' : 'text-slate-600'
          }`}
        >
          Texto livre
        </button>
        <button
          type="button"
          onClick={() => setMode('template')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'template' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-700' : 'text-slate-600'
          }`}
        >
          Template
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {mode === 'texto' ? (
          <form
            onSubmit={handleSendText}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div
              className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p>{FREE_TEXT_WINDOW_BANNER}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
              <input
                type="tel"
                className={processosInputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(62) 99999-1234"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mensagem</label>
              <textarea
                className={`${processosInputClass} min-h-[140px] resize-y`}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 4096))}
                maxLength={4096}
              />
              <p className="text-right text-xs text-slate-400 mt-1">{message.length}/4096</p>
            </div>
            <button type="submit" disabled={sending} className={processosBtnPrimary}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleSendTemplate}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Telefone</label>
              <input
                type="tel"
                className={processosInputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(62) 99999-1234"
              />
            </div>
            <TemplateSelect
              value={templateName}
              onChange={setTemplateName}
              id="enviar-template"
              templates={templates}
              loading={loadingTemplates}
            />
            <TemplateParamsForm
              templateName={templateName}
              values={params}
              onChange={setParams}
              templates={templates}
            />
            <button type="submit" disabled={sending} className={processosBtnPrimary}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar template
            </button>
          </form>
        )}

        <MessageComposePreview
          text={previewText}
          templateName={previewTemplateName}
          emptyHint={previewEmptyHint}
        />
      </div>
    </div>
  );
}
