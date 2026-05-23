import { Field } from '../../../components/ui/Field.jsx';
import { TIPOS_PECA } from '../constants.js';
import { fieldErrorClass, inputClass, textareaClass } from '../documentosStyles.js';

export function FatosDoCaso({ values, onChange, errors = {} }) {
  const usarOutro = values.tipoPecaSelect === '__outro__';

  return (
    <div className="grid gap-4">
      <Field label="Tipo de peça *">
        <select
          className={inputClass}
          value={values.tipoPecaSelect}
          onChange={(e) => onChange({ tipoPecaSelect: e.target.value })}
        >
          <option value="">Selecione…</option>
          {TIPOS_PECA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="__outro__">Outro</option>
        </select>
        {errors.tipoPeca && <p className={fieldErrorClass}>{errors.tipoPeca}</p>}
      </Field>

      {usarOutro && (
        <Field label="Tipo de peça (texto livre) *">
          <input
            className={inputClass}
            value={values.tipoPecaOutro}
            onChange={(e) => onChange({ tipoPecaOutro: e.target.value })}
          />
        </Field>
      )}

      <Field label="Fatos do caso *">
        <textarea
          className={`${textareaClass} min-h-[160px]`}
          value={values.fatos}
          onChange={(e) => onChange({ fatos: e.target.value })}
          placeholder="Descreva os fatos relevantes para a peça…"
        />
        {errors.fatos && <p className={fieldErrorClass}>{errors.fatos}</p>}
      </Field>

      <Field label="Valor da causa (opcional)">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">R$</span>
          <input
            className={inputClass}
            value={values.valorCausa}
            onChange={(e) => onChange({ valorCausa: e.target.value })}
            placeholder="4.500,00"
          />
        </div>
      </Field>
    </div>
  );
}

export function resolveTipoPeca(values) {
  if (values.tipoPecaSelect === '__outro__') {
    return (values.tipoPecaOutro || '').trim();
  }
  return (values.tipoPecaSelect || '').trim();
}
