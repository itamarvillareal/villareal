import { WHATSAPP_TEMPLATES } from '../../../data/whatsappTemplates.js';
import { processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';

function resolveTemplate(templateName, templates) {
  const list = templates?.length ? templates : WHATSAPP_TEMPLATES;
  return list.find((t) => t.value === templateName) ?? null;
}

export function TemplateParamsForm({ templateName, values, onChange, templates }) {
  const template = resolveTemplate(templateName, templates);
  if (!template || !template.params?.length) return null;

  return (
    <div className="space-y-3">
      {template.params.map((label, index) => (
        <div key={`${templateName}-${label}-${index}`}>
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

export function TemplateSelect({ value, onChange, id = 'whatsapp-template', templates, loading = false }) {
  const list = templates?.length ? templates : WHATSAPP_TEMPLATES;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        Template
      </label>
      <select
        id={id}
        className={processosInputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? 'Carregando templates…' : 'Selecione…'}</option>
        {list.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label || t.value}
          </option>
        ))}
      </select>
    </div>
  );
}
