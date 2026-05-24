import { WHATSAPP_TEMPLATES } from '../../../data/whatsappTemplates.js';
import { processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';

export function TemplateParamsForm({ templateName, values, onChange }) {
  const template = WHATSAPP_TEMPLATES.find((t) => t.value === templateName);
  if (!template || !template.params?.length) return null;

  return (
    <div className="space-y-3">
      {template.params.map((label, index) => (
        <div key={label}>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
          <input
            type="text"
            className={processosInputClass}
            value={values[index] ?? ''}
            onChange={(e) => {
              const next = [...(values ?? [])];
              next[index] = e.target.value;
              onChange(next);
            }}
            placeholder={label}
          />
        </div>
      ))}
    </div>
  );
}

export function TemplateSelect({ value, onChange, id = 'whatsapp-template' }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        Template
      </label>
      <select id={id} className={processosInputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione…</option>
        {WHATSAPP_TEMPLATES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
