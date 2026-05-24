import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { processosBtnPrimary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { TemplateParamsForm, TemplateSelect } from './TemplateParamsForm.jsx';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import { useWhatsAppToast } from '../WhatsAppToast.jsx';
import {
  datetimeLocalToIso,
  isFutureDatetimeLocal,
  isValidBrazilPhone,
  normalizePhoneForApi,
} from '../../../utils/whatsappFormat.js';
import { findWhatsAppTemplate } from '../../../data/whatsappTemplates.js';

export function ScheduleModal({ open, onClose, onSuccess }) {
  const { createSchedule } = useWhatsApp();
  const toast = useWhatsAppToast();
  const [phone, setPhone] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [processoId, setProcessoId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setTemplateName('');
    setParams([]);
    setScheduledAtLocal('');
    setDescricao('');
    setClienteId('');
    setProcessoId('');
  }, [open]);

  useEffect(() => {
    const tpl = findWhatsAppTemplate(templateName);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName]);

  if (!open) return null;

  const handleSubmit = async (e) => {
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
    if (!isFutureDatetimeLocal(scheduledAtLocal)) {
      toast.error('A data e hora do agendamento devem ser no futuro.');
      return;
    }
    const scheduledAt = datetimeLocalToIso(scheduledAtLocal);
    if (!scheduledAt) {
      toast.error('Data/hora inválida.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        phoneNumber: normalized,
        templateName,
        parameters: params.map((p) => String(p ?? '').trim()),
        scheduledAt,
        descricao: descricao.trim() || null,
      };
      const cid = String(clienteId ?? '').trim();
      const pid = String(processoId ?? '').trim();
      if (cid) body.clienteId = Number(cid);
      if (pid) body.processoId = Number(pid);

      const res = await createSchedule(body);
      if (res?.success === false) {
        toast.error(res.error || 'Falha ao agendar mensagem.');
        return;
      }
      toast.success('Agendamento criado com sucesso.');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Erro ao agendar mensagem.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Novo agendamento</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <TemplateSelect value={templateName} onChange={setTemplateName} id="schedule-template" />
          <TemplateParamsForm templateName={templateName} values={params} onChange={setParams} />
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Data e hora do envio
            </label>
            <input
              type="datetime-local"
              className={processosInputClass}
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descrição</label>
            <input
              type="text"
              className={processosInputClass}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Identificação interna"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Cliente ID (opcional)
              </label>
              <input
                type="number"
                min="1"
                className={processosInputClass}
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Processo ID (opcional)
              </label>
              <input
                type="number"
                min="1"
                className={processosInputClass}
                value={processoId}
                onChange={(e) => setProcessoId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving} className={processosBtnPrimary}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Agendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
