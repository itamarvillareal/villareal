import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { processosBtnPrimary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { MessageComposePreview } from './MessageComposePreview.jsx';
import { TemplateParamsForm, TemplateSelect } from './TemplateParamsForm.jsx';
import {
  BATCH_MODE_MENSAL,
  buildScheduleBatchPayload,
  ScheduleBatchFields,
} from './ScheduleBatchFields.jsx';
import { useWhatsAppToast } from '../WhatsAppToast.jsx';
import {
  datetimeLocalToIso,
  isFutureDatetimeLocal,
  isValidBrazilPhone,
  normalizePhoneForApi,
} from '../../../utils/whatsappFormat.js';
import { findWhatsAppTemplate } from '../../../data/whatsappTemplates.js';
import { useWhatsAppTemplates } from '../hooks/useWhatsAppTemplates.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { buildComposePreviewText } from '../../../utils/whatsappTemplateUtils.js';
import { createWhatsAppSchedule, createWhatsAppScheduleBatch } from '../../../repositories/whatsappRepository.js';
import { WhatsAppDestinatarioCampo } from './WhatsAppDestinatarioCampo.jsx';

const MODE_UNICO = 'unico';
const MODE_LOTE = 'lote';

export function ScheduleModal({ open, onClose, onSuccess, initialPhone = '' }) {
  const { templates, loading: loadingTemplates } = useWhatsAppTemplates({ approvedOnly: true });
  const toast = useWhatsAppToast();
  const [formMode, setFormMode] = useState(MODE_UNICO);
  const [batchMode, setBatchMode] = useState(BATCH_MODE_MENSAL);
  const [batchState, setBatchState] = useState(null);
  const [phone, setPhone] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [params, setParams] = useState([]);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [processoId, setProcessoId] = useState('');
  const [saving, setSaving] = useState(false);

  useCloseOnEscape(open, onClose, { enabled: !saving });

  useEffect(() => {
    if (!open) return;
    setFormMode(MODE_UNICO);
    setBatchMode(BATCH_MODE_MENSAL);
    setBatchState(null);
    setPhone(String(initialPhone ?? '').trim());
    setTemplateName('');
    setParams([]);
    setScheduledAtLocal('');
    setDescricao('');
    setClienteId('');
    setProcessoId('');
  }, [open, initialPhone]);

  useEffect(() => {
    const tpl =
      templates.find((t) => t.value === templateName) ?? findWhatsAppTemplate(templateName);
    setParams(tpl ? tpl.params.map(() => '') : []);
  }, [templateName, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.value === templateName) ?? findWhatsAppTemplate(templateName),
    [templates, templateName],
  );

  const previewText = useMemo(
    () =>
      buildComposePreviewText({
        mode: 'template',
        template: selectedTemplate,
        params,
      }),
    [selectedTemplate, params],
  );

  const handleBatchStateChange = useCallback((state) => {
    setBatchState(state);
  }, []);

  if (!open) return null;

  const buildBaseBody = (normalized) => {
    const body = {
      phoneNumber: normalized,
      templateName,
      parameters: params.map((p) => String(p ?? '').trim()),
      descricao: descricao.trim() || null,
    };
    const cid = String(clienteId ?? '').trim();
    const pid = String(processoId ?? '').trim();
    if (cid) body.clienteId = Number(cid);
    if (pid) body.processoId = Number(pid);
    return body;
  };

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

    setSaving(true);
    try {
      if (formMode === MODE_LOTE) {
        const built = buildScheduleBatchPayload(buildBaseBody(normalized), batchState);
        if (built.error) {
          toast.error(built.error);
          return;
        }
        const res = await createWhatsAppScheduleBatch(built.body);
        if (!res?.criados) {
          toast.error(res?.message || 'Nenhum agendamento criado.');
          return;
        }
        const extra = res.pulados > 0 ? ` (${res.pulados} ignorado(s))` : '';
        toast.success(`${res.criados} agendamento(s) criado(s)${extra}.`);
      } else {
        if (!isFutureDatetimeLocal(scheduledAtLocal)) {
          toast.error('A data e hora do agendamento devem ser no futuro.');
          return;
        }
        const scheduledAt = datetimeLocalToIso(scheduledAtLocal);
        if (!scheduledAt) {
          toast.error('Data/hora inválida.');
          return;
        }
        const res = await createWhatsAppSchedule({ ...buildBaseBody(normalized), scheduledAt });
        if (res?.success === false) {
          toast.error(res.error || 'Falha ao agendar mensagem.');
          return;
        }
        toast.success('Agendamento criado com sucesso.');
      }
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
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Novo agendamento</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 text-sm py-2 rounded-lg border ${
              formMode === MODE_UNICO
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 dark:border-slate-600'
            }`}
            onClick={() => setFormMode(MODE_UNICO)}
          >
            Único
          </button>
          <button
            type="button"
            className={`flex-1 text-sm py-2 rounded-lg border ${
              formMode === MODE_LOTE
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 dark:border-slate-600'
            }`}
            onClick={() => setFormMode(MODE_LOTE)}
          >
            Em lote
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <WhatsAppDestinatarioCampo phone={phone} onPhoneChange={setPhone} disabled={saving} />
          <TemplateSelect
            value={templateName}
            onChange={setTemplateName}
            id="schedule-template"
            templates={templates}
            loading={loadingTemplates}
          />
          <TemplateParamsForm
            templateName={templateName}
            values={params}
            onChange={setParams}
            templates={templates}
          />
          <MessageComposePreview
            compact
            text={previewText}
            templateName={templateName || null}
            emptyHint="Selecione um template e preencha os parâmetros para ver o preview."
          />

          {formMode === MODE_UNICO ? (
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
          ) : (
            <ScheduleBatchFields
              batchMode={batchMode}
              onBatchModeChange={setBatchMode}
              onStateChange={handleBatchStateChange}
            />
          )}

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
              {formMode === MODE_LOTE ? 'Agendar lote' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
