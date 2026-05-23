import { Field } from '../../../components/ui/Field.jsx';
import { fieldErrorClass, inputClass, textareaClass } from '../documentosStyles.js';

export function DadosPartes({ values, onChange, errors = {} }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Autor / Requerente *">
          <input
            className={inputClass}
            value={values.nomeAutor}
            onChange={(e) => onChange({ nomeAutor: e.target.value })}
          />
          {errors.nomeAutor && <p className={fieldErrorClass}>{errors.nomeAutor}</p>}
        </Field>
        <Field label="Qualificação do autor">
          <textarea
            className={textareaClass}
            value={values.qualificacaoAutor}
            onChange={(e) => onChange({ qualificacaoAutor: e.target.value })}
            placeholder="brasileiro, solteiro, empresário, CPF…"
          />
        </Field>
      </div>
      <div className="space-y-4">
        <Field label="Réu / Requerido *">
          <input
            className={inputClass}
            value={values.nomeReu}
            onChange={(e) => onChange({ nomeReu: e.target.value })}
          />
          {errors.nomeReu && <p className={fieldErrorClass}>{errors.nomeReu}</p>}
        </Field>
        <Field label="Qualificação do réu">
          <textarea
            className={textareaClass}
            value={values.qualificacaoReu}
            onChange={(e) => onChange({ qualificacaoReu: e.target.value })}
            placeholder="pessoa jurídica de direito privado, CNPJ…"
          />
        </Field>
      </div>
    </div>
  );
}
