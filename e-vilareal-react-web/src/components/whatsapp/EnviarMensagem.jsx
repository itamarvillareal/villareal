import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TemplateParamsForm, TemplateSelect } from './components/TemplateParamsForm.jsx';
import { useWhatsApp } from './hooks/useWhatsApp.js';
import { useWhatsAppToast } from './WhatsAppToast.jsx';
import { findWhatsAppTemplate } from '../../data/whatsappTemplates.js';
import { isValidBrazilPhone, normalizePhoneForApi } from '../../utils/whatsappFormat.js';
import { processosBtnPrimary, processosInputClass } from '../processos/ProcessosAdminLayout.jsx';

export function WhatsAppEnviarMensagem() {
  const navigate = useNavigate();
  const { sendText, sendTemplate } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [mode, setMode] = useState('texto');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const tpl = findWhatsAppTemplate(templateName);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName]);

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
        toast.error(res.error || 'Falha ao enviar.');
        return;
      }
      toast.success('Mensagem enviada com sucesso.');
      navigate(`/whatsapp/conversas?telefone=${encodeURIComponent(normalized)}`);
      resetForm();
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar mensagem.');
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
    <div className="max-w-xl mx-auto space-y-6">
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

      {mode === 'texto' ? (
        <form onSubmit={handleSendText} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
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
        <form onSubmit={handleSendTemplate} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
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
          <TemplateSelect value={templateName} onChange={setTemplateName} id="enviar-template" />
          <TemplateParamsForm templateName={templateName} values={params} onChange={setParams} />
          <button type="submit" disabled={sending} className={processosBtnPrimary}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enviar template
          </button>
        </form>
      )}
    </div>
  );
}
